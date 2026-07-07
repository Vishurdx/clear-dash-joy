import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "./__root";
import { fetchBookings, addBookingToSheet, updateBookingInSheet, type Booking, daysUntil, daysSince, CollectionPriority } from "@/lib/sheet.functions";
import { toast } from "sonner";
import { PaymentTrackerTab } from "@/components/PaymentTrackerTab";
import { VoucherReleaseTab } from "@/components/VoucherReleaseTab";
import { DailyReportTab } from "@/components/DailyReportTab";
import { MonthlyBookingsTab } from "@/components/MonthlyBookingsTab";
import { CallReportTab } from "@/components/CallReportTab";
import { Compass, Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Post-Booking Operations — Cleartrip × TravClan" },
      {
        name: "description",
        content:
          "Live operations dashboard tracking Cleartrip × TravClan bookings, payments, vouchers and trip status from Google Sheets.",
      },
    ],
  }),
  component: Dashboard,
});

const OPS_RMS_LOCAL = ["Vishwajeet", "Shruti"];
const inr = (n: number | undefined) => {
  if (n === undefined || n === null) return "—";
  return n === 0
    ? "—"
    : "₹" +
      new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
};

function getPaymentUrgencyColor(freeCancellationDate: string, travelDate: string): string | null {
  const travelDays = daysUntil(travelDate);
  if (travelDays === null || travelDays < 0) return null;

  const cancellationDays = daysUntil(freeCancellationDate);
  if (cancellationDays === null) return null;

  if (cancellationDays <= 3) return "bg-red-50 border-l-4 border-red-500";
  if (cancellationDays <= 6) return "bg-orange-50 border-l-4 border-orange-500";
  if (cancellationDays >= 7) return "bg-pink-50 border-l-4 border-pink-500";
  return null;
}

function isFullyCollected(b: Booking) {
  return (b.paymentCollected?.toLowerCase() ?? "") === "yes" || b.pendingAmount <= 0;
}

function getPriorityColor(priority: CollectionPriority | undefined): string {
  if (priority === "Critical") return "bg-red-100 text-red-800 border-red-200";
  if (priority === "High") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-green-100 text-green-800 border-green-200";
}

import { DynamicBookingForm } from "@/components/DynamicBookingForm";

function Dashboard() {
  const { user, logout } = useAuth();
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchBookings(),
    refetchOnWindowFocus: false,
  });

  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [seller, setSeller] = useState("");
  const [opsRm, setOpsRm] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [daysFilter, setDaysFilter] = useState("");
  const [hideDropped, setHideDropped] = useState(false);
  const [tab, setTab] = useState<"all" | "payment" | "voucher" | "report" | "monthly" | "call-report">("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editFormMode, setEditFormMode] = useState<"all" | "payment" | "voucher">("all");
  const [showNewBookingForm, setShowNewBookingForm] = useState(false);

  const addBookingFn = addBookingToSheet;
  const updateBookingFn = updateBookingInSheet;

  // Local storage updated bookings
  const [localUpdatedBookings, setLocalUpdatedBookings] = useState<Record<string, Booking>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem("local_updated_bookings");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error("Failed to load local updated bookings:", e);
      return {};
    }
  });

  const handleEditBooking = async (updatedBooking: Booking, rowValues: string[]) => {
    try {
      const result = await updateBookingFn({ pn: updatedBooking.pn, values: rowValues });
      
      if (result && result.status === "success") {
        toast.success(`Booking ${updatedBooking.pn} successfully updated in Google Sheet!`);
      } else if (result && (result.status === "local_only" || !result.status)) {
        toast.warning(`Saved locally. Set up VITE_GOOGLE_SCRIPT_URL to sync updates to Google Sheet.`);
      } else if (result && result.status === "error") {
        toast.error(`Failed to sync update to Google Sheet: ${result.message}`);
      }
    } catch (err: any) {
      console.error("Failed to sync booking update to Google Sheet:", err);
      toast.error(`Saved locally. Google Sheet sync failed: ${err.message}`);
    }

    const updated = {
      ...localUpdatedBookings,
      [updatedBooking.pn]: updatedBooking,
    };
    setLocalUpdatedBookings(updated);
    localStorage.setItem("local_updated_bookings", JSON.stringify(updated));
    setSelectedBooking(null);
    refetch();
  };

  // Local storage added bookings
  const [localAddedBookings, setLocalAddedBookings] = useState<Booking[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("local_added_bookings");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load local bookings:", e);
      return [];
    }
  });

  const handleAddBooking = async (newBooking: Booking, rowValues: string[]) => {
    try {
      const result = await addBookingFn(rowValues);
      
      if (result && result.status === "success") {
        toast.success(`Booking ${newBooking.pn} successfully synced to Google Sheet!`);
      } else if (result && (result.status === "local_only" || !result.status)) {
        toast.warning(`Saved locally. Set up VITE_GOOGLE_SCRIPT_URL to sync to Google Sheet.`);
      } else if (result && result.status === "error") {
        toast.error(`Failed to sync to Google Sheet: ${result.message}`);
      }
    } catch (err: any) {
      console.error("Failed to sync booking to Google Sheet:", err);
      toast.error(`Saved locally. Google Sheet sync failed: ${err.message}`);
    }

    const updated = [...localAddedBookings, newBooking];
    setLocalAddedBookings(updated);
    localStorage.setItem("local_added_bookings", JSON.stringify(updated));
    setShowNewBookingForm(false);
    refetch();
  };

  // Local hidden bookings (filtered out from display)
  const [localHiddenBookings, setLocalHiddenBookings] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("local_hidden_bookings");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load hidden bookings:", e);
      return [];
    }
  });

  const handleRemoveBooking = (pn: string) => {
    // 1. Remove from localAddedBookings if present
    const updatedLocal = localAddedBookings.filter(b => b.pn !== pn);
    setLocalAddedBookings(updatedLocal);
    localStorage.setItem("local_added_bookings", JSON.stringify(updatedLocal));

    // 2. Add to localHiddenBookings
    const updatedHidden = [...localHiddenBookings, pn];
    setLocalHiddenBookings(updatedHidden);
    localStorage.setItem("local_hidden_bookings", JSON.stringify(updatedHidden));

    toast.success(`Booking ${pn} has been removed from the website.`);
    setSelectedBooking(null);
  };

  const handleUpdateComment = async (pn: string, newComment: string) => {
    const booking = rows.find(r => r.pn === pn);
    if (!booking) return;

    const updatedRaw = [...(booking.rawData || [])];
    updatedRaw[1] = newComment;

    const updatedBooking: Booking = {
      ...booking,
      dailyUpdates: newComment,
      rawData: updatedRaw,
      updatedAt: Date.now()
    };

    const updatedLocally = {
      ...localUpdatedBookings,
      [pn]: updatedBooking,
    };
    setLocalUpdatedBookings(updatedLocally);
    localStorage.setItem("local_updated_bookings", JSON.stringify(updatedLocally));
    toast.info("Saving comment update...");

    try {
      const result = await updateBookingFn({ pn, values: updatedRaw });
      if (result && result.status === "success") {
        toast.success(`Comment for ${pn} successfully updated in Google Sheet!`);
      } else if (result && (result.status === "local_only" || !result.status)) {
        toast.warning(`Saved locally. Configure VITE_GOOGLE_SCRIPT_URL to sync to Google Sheet.`);
      } else if (result && result.status === "error") {
        toast.error(`Failed to sync update to Google Sheet: ${result.message}`);
      }
    } catch (err: any) {
      console.error("Failed to sync comment update to Google Sheet:", err);
      toast.error(`Comment saved locally, but Google Sheet sync failed: ${err.message}`);
    }

    refetch();
  };



  const handleUpdateCallStatus = async (booking: Booking, taskNumber: number, completed: boolean) => {
    const updatedRaw = [...(booking.rawData || [])];
    while (updatedRaw.length < 94) {
      updatedRaw.push("");
    }

    let indexToUpdate = -1;
    if (taskNumber === 1) indexToUpdate = 25; // 1st Call status
    else if (taskNumber === 2) indexToUpdate = 81; // Post Booking calls
    else if (taskNumber === 3) indexToUpdate = 83; // Pre Trip

    if (indexToUpdate !== -1) {
      updatedRaw[indexToUpdate] = completed ? "Done" : "";
    }

    const updatedBooking: Booking = {
      ...booking,
      rawData: updatedRaw,
      firstCallStatus: taskNumber === 1 ? (completed ? "Done" : "") : booking.firstCallStatus,
      postBookingCalls: taskNumber === 2 ? (completed ? "Done" : "") : booking.postBookingCalls,
      preTrip: taskNumber === 3 ? (completed ? "Done" : "") : booking.preTrip,
      updatedAt: Date.now()
    };

    const updatedLocally = {
      ...localUpdatedBookings,
      [booking.pn]: updatedBooking,
    };
    setLocalUpdatedBookings(updatedLocally);
    localStorage.setItem("local_updated_bookings", JSON.stringify(updatedLocally));

    toast.info(`Syncing call status update to Google Sheet...`);

    try {
      const result = await updateBookingFn({ pn: booking.pn, values: updatedRaw });
      if (result && result.status === "success") {
        toast.success(`Call status for ${booking.pn} successfully synced to Google Sheet!`);
      } else if (result && (result.status === "local_only" || !result.status)) {
        toast.warning(`Saved locally. Configure VITE_GOOGLE_SCRIPT_URL to sync to Google Sheet.`);
      } else if (result && result.status === "error") {
        toast.error(`Failed to sync update to Google Sheet: ${result.message}`);
      }
    } catch (err: any) {
      console.error("Failed to sync call status update to Google Sheet:", err);
      toast.error(`Saved locally. Google Sheet sync failed: ${err.message}`);
    }

    refetch();
  };

  const cleanHeaders = data?.headers || [];
  const uniqueValues = data?.uniqueValues || {};
  const fetchedRows = data?.rows ?? [];
  const rows = useMemo(() => {
    const combined = [...fetchedRows, ...localAddedBookings];
    const merged = combined.map(b => {
      const override = localUpdatedBookings[b.pn];
      if (override) {
        // Discard override if older than 10 minutes (600,000 ms)
        const age = Date.now() - (override.updatedAt || 0);
        if (age < 600000) {
          return {
            ...b,
            ...override,
            rawData: override.rawData || b.rawData,
          };
        }
      }
      return b;
    });
    return merged.filter(b => !localHiddenBookings.includes(b.pn));
  }, [fetchedRows, localAddedBookings, localUpdatedBookings, localHiddenBookings]);

  const destinations = useMemo(
    () => [...new Set(rows.map((r) => r.destination).filter(Boolean))].sort(),
    [rows],
  );
  const sellers = useMemo(
    () => [...new Set(rows.map((r) => r.seller).filter((s): s is string => !!s))].sort(),
    [rows],
  );

  // Global filters applied to ALL tabs (no tab-specific exclusions)
  const globalFiltered = useMemo(() => {
    return rows.filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !b.pn.toLowerCase().includes(q) &&
          !b.leadPax.toLowerCase().includes(q) &&
          !b.destination.toLowerCase().includes(q)
        )
          return false;
      }
      if (destination && b.destination?.trim() !== destination.trim()) return false;
      if (seller && b.seller?.trim() !== seller.trim()) return false;
      if (opsRm) {
        if (opsRm === "Unassigned" && b.opsRm) return false;
        if (opsRm !== "Unassigned" && b.opsRm?.trim() !== opsRm.trim()) return false;
      }
      if (paymentStatus === "full" && !isFullyCollected(b)) return false;
      if (paymentStatus === "pending" && isFullyCollected(b)) return false;
      if (daysFilter) {
        const d = daysUntil(b.travelDate);
        if (d === null) return false;
        if (daysFilter === "upcoming" && !(d >= 0)) return false;
        if (daysFilter === "0-14" && !(d >= 0 && d <= 14)) return false;
        if (daysFilter === "15-30" && !(d >= 15 && d <= 30)) return false;
        if (daysFilter === "31-90" && !(d >= 31 && d <= 90)) return false;
        if (daysFilter === "gt90" && !(d > 90)) return false;
      }
      if (hideDropped && b.tripStatus && b.tripStatus.toLowerCase().includes("dropped")) return false;
      return true;
    });
  }, [rows, search, destination, seller, opsRm, paymentStatus, daysFilter, hideDropped]);

  const filtered = useMemo(() => {
    return globalFiltered.filter((b) => {
      if (tab === "payment" && isFullyCollected(b)) return false;
      if (tab === "voucher" && b.finalVoucher?.toLowerCase() === "shared") return false;
      return true;
    });
  }, [globalFiltered, tab]);

  const clear = () => {
    setSearch("");
    setDestination("");
    setSeller("");
    setOpsRm("");
    setPaymentStatus("");
    setDaysFilter("");
    setHideDropped(false);
  };

  const kpis = useMemo(() => {
    const finalTtv = filtered.reduce((a, b) => a + (b.finalTtv ?? 0), 0);
    const pending = filtered.reduce((a, b) => a + b.pendingAmount, 0);
    const fully = filtered.filter(isFullyCollected).length;
    const le14 = filtered.filter((b) => {
      const d = daysUntil(b.travelDate);
      return d !== null && d >= 0 && d <= 14;
    }).length;
    const unassigned = filtered.filter((b) => !b.opsRm || !OPS_RMS_LOCAL.includes(b.opsRm)).length;
    return { total: filtered.length, finalTtv, pending, fully, le14, unassigned };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="bg-[#141b2b] border-b border-orange-500/20 text-white shadow-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.15)] animate-pulse">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  Cleartrip <span className="text-orange-500 font-medium">Operations Sheet</span>
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                  Live Sync
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400 font-medium">
                Cleartrip × TravClan — Direct Real-time Google Sheet Workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewBookingForm(true)}
              className="rounded-lg bg-orange-500 text-white px-4 py-2 text-xs font-bold shadow-md shadow-orange-500/25 hover:bg-orange-600 hover:shadow-lg active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-orange-400/20"
            >
              <Plus className="h-3.5 w-3.5" /> New Booking
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("local_updated_bookings");
                localStorage.removeItem("local_added_bookings");
                localStorage.removeItem("local_hidden_bookings");
                setLocalUpdatedBookings({});
                setLocalAddedBookings([]);
                setLocalHiddenBookings([]);
                refetch();
                toast.success("Cleared local overrides and synced with Google Sheet!");
              }}
              disabled={isFetching}
              className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white active:scale-95 transition-all duration-200 text-xs font-bold px-4 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Sync & Refresh
            </button>

            {/* Google Authenticated User Profile */}
            {user && (
              <div className="flex items-center gap-3 border-l border-slate-850 pl-3">
                <div className="flex items-center gap-2">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400 border border-orange-500/30">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-[11px] font-bold leading-tight text-white">{user.name}</span>
                    <span className="text-[9px] text-slate-400 leading-none">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="rounded-lg border border-slate-700 bg-slate-850/80 hover:bg-red-950/20 hover:border-red-900/30 hover:text-red-400 active:scale-95 text-slate-300 transition-all duration-200 text-[10px] font-bold px-2.5 py-1.5 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load bookings: {(error as Error).message}
          </div>
        ) : null}

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Total bookings" value={String(kpis.total)} color="text-slate-900" />
          <Kpi label="Final TTV" value={inr(kpis.finalTtv)} color="text-slate-900" />
          <Kpi label="Pending amount" value={inr(kpis.pending)} color="text-amber-600" />
          <Kpi label="Fully collected" value={String(kpis.fully)} color="text-orange-600" />
          <Kpi label="≤ 14 days out" value={String(kpis.le14)} color="text-orange-600" />
          <Kpi label="Unassigned RM" value={String(kpis.unassigned)} color="text-rose-600" />
        </section>

        {/* Filters Panel */}
        <section className="mt-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, PN, destination…"
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none hover:border-orange-500/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200 shadow-sm"
            />
            <Select value={destination} onChange={setDestination} placeholder="All destinations" options={destinations} />
            <Select value={seller} onChange={setSeller} placeholder="All sellers" options={sellers} />
            <Select value={opsRm} onChange={setOpsRm} placeholder="All Ops RM" options={["Unassigned", ...OPS_RMS_LOCAL]} />
            <Select
              value={paymentStatus}
              onChange={setPaymentStatus}
              placeholder="Payment status"
              options={[
                { value: "full", label: "Full collected" },
                { value: "pending", label: "Pending" },
              ]}
            />
            <Select
              value={daysFilter}
              onChange={setDaysFilter}
              placeholder="Days to travel"
              options={[
                { value: "upcoming", label: "Upcoming trips" },
                { value: "0-14", label: "Next 14 days" },
                { value: "15-30", label: "Next 30 days" },
                { value: "31-90", label: "Next 90 days" },
                { value: "gt90", label: "More than 90 days" },
              ]}
            />
            <button
              onClick={() => setHideDropped(!hideDropped)}
              className={`h-9 rounded-lg px-4 text-xs font-bold transition-all active:scale-95 duration-200 shadow-sm cursor-pointer ${
                hideDropped
                  ? "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/15"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {hideDropped ? "✓ Hide Dropped" : "Hide Dropped"}
            </button>
            <button
              onClick={clear}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 duration-200 cursor-pointer"
            >
              Clear
            </button>
            <div className="ml-auto text-sm text-slate-500">
              {globalFiltered.length} of {rows.length}
            </div>
          </div>
        </section>

        {/* Tabs Switcher */}
        <section className="mt-6 flex justify-start">
          <div className="bg-slate-200/70 p-1 rounded-xl inline-flex gap-1 border border-slate-300/40 shadow-inner">
            {([
              ["all", "All Bookings"],
              ["payment", "Payment Tracker"],
              ["voucher", "Voucher Release"],
              ["report", "Daily Report"],
              ["monthly", "Monthly Bookings"],
              ["call-report", "Call Report"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  tab === k
                    ? "bg-white text-orange-600 shadow-sm border border-orange-500/10 scale-102"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Payment Tracker Command Center */}
        {tab === "payment" && (
          <section className="mt-3">
            <PaymentTrackerTab 
              bookings={globalFiltered} 
              isLoading={isLoading} 
              onSelectBooking={(b) => {
                setEditFormMode("payment");
                setSelectedBooking(b);
              }} 
            />
          </section>
        )}

        {/* Voucher Release Command Center */}
        {tab === "voucher" && (
          <section className="mt-3">
            <VoucherReleaseTab 
              bookings={globalFiltered} 
              isLoading={isLoading} 
              onSelectBooking={(b) => {
                setEditFormMode("voucher");
                setSelectedBooking(b);
              }} 
            />
          </section>
        )}

        {/* Daily Report Command Center */}
        {tab === "report" && (
          <section className="mt-3">
            <DailyReportTab 
              bookings={globalFiltered} 
              isLoading={isLoading} 
              onSelectBooking={(b) => {
                setEditFormMode("all");
                setSelectedBooking(b);
              }} 
              onUpdateComment={handleUpdateComment}
            />
          </section>
        )}

        {/* Monthly Bookings Command Center */}
        {tab === "monthly" && (
          <section className="mt-3">
            <MonthlyBookingsTab 
              bookings={globalFiltered} 
              isLoading={isLoading} 
              onSelectBooking={(b) => {
                setEditFormMode("all");
                setSelectedBooking(b);
              }} 
            />
          </section>
        )}

        {/* Call Report Command Center */}
        {tab === "call-report" && (
          <section className="mt-3">
            <CallReportTab 
              bookings={rows} 
              isLoading={isLoading} 
              onToggleCallStatus={handleUpdateCallStatus}
            />
          </section>
        )}

        {/* Table — all other tabs */}
        {tab === "all" && <section className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
          <table className="w-full min-w-[1500px] text-xs">
            <thead className="bg-[#141b2b] text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
              <tr>
                {[
                  "PN","Lead pax","Destination","Travel","Days","Pax","Seller","Ops RM",
                  "Flight SP","Hotel SP","Land SP","Visa SP","Final TTV","Total SP","Payment","Pending","Final Voucher","Status",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3.5 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-slate-400">
                    Loading bookings…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-slate-400">
                    No bookings match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((b, index) => {
                  const full = isFullyCollected(b);
                  return (
                    <tr key={`${b.pn || "row"}-${index}`} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <button
                          onClick={() => {
                            setEditFormMode("all");
                            setSelectedBooking(b);
                          }}
                          className="font-medium text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                        >
                          {b.pn}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-800">{b.leadPax}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {b.destination || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{b.travelDate || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {b.matrics?.toLowerCase() || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.adult}/{b.child}/{b.infant}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{b.seller || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <OpsRmSelect value={b.opsRm} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{inr(b.flightSp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{inr(b.hotelSp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{inr(b.landSp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{inr(b.visaSp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{inr(b.finalTtv)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">{inr(b.totalSp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            full
                              ? "bg-orange-50 text-orange-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {full ? "Full" : "Pending"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.pendingAmount > 0 ? inr(b.pendingAmount) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            b.finalVoucher?.toLowerCase() === "shared"
                              ? "bg-orange-50 text-orange-700 border-orange-100"
                              : "bg-slate-50 text-slate-400 border-slate-100"
                          }`}
                        >
                          {b.finalVoucher || "Not Shared"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{b.preTrip || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>}

        <p className="mt-4 text-center text-xs text-slate-400">
          {data ? `Last refreshed ${new Date(data.fetchedAt).toLocaleString()}` : ""}
        </p>
      </main>

      <Dialog open={showNewBookingForm} onOpenChange={setShowNewBookingForm}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Add New Booking</DialogTitle>
          </DialogHeader>
          <DynamicBookingForm 
            headers={cleanHeaders} 
            uniqueValues={uniqueValues} 
            onSubmit={handleAddBooking} 
            onCancel={() => setShowNewBookingForm(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Edit Booking — PN {selectedBooking?.pn}</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <DynamicBookingForm 
              headers={cleanHeaders} 
              uniqueValues={uniqueValues} 
              booking={selectedBooking}
              mode={editFormMode}
              onSubmit={handleEditBooking} 
              onCancel={() => setSelectedBooking(null)} 
              onRemove={handleRemoveBooking}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="group rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-sm hover:shadow-md hover:border-orange-500/20 hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-orange-500 flex flex-col justify-between cursor-default">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-extrabold tracking-tight ${color}`}>
        {value}
      </div>
    </div>
  );
}

type Opt = string | { value: string; label: string };
function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none hover:border-orange-500/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200 shadow-sm cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

function OpsRmSelect({ value }: { value: string }) {
  const [v, setV] = useState(value);
  return (
    <select
      value={OPS_RMS_LOCAL.includes(v) ? v : ""}
      onChange={(e) => setV(e.target.value)}
      className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-orange-500"
    >
      <option value="">— Unassigned —</option>
      {OPS_RMS_LOCAL.map((rm) => (
        <option key={rm} value={rm}>
          {rm}
        </option>
      ))}
    </select>
  );
}

function NewBookingForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<Partial<Booking>>({
    defaultValues: {
      adult: 1,
      child: 0,
      infant: 0,
      flightSp: 0,
      hotelSp: 0,
      landSp: 0,
      visaSp: 0,
      finalTtv: 0,
      totalSp: 0,
      pendingAmount: 0,
    },
  });

  const onSubmit = (data: Partial<Booking>) => {
    console.log("New booking data:", data);
    setTimeout(() => {
      reset();
      onSuccess();
    }, 500);
  };

  const formFields = [
    { name: "pn" as const, label: "PN Number", type: "text", required: true },
    { name: "leadPax" as const, label: "Lead Pax Name", type: "text", required: true },
    { name: "destination" as const, label: "Destination", type: "text", required: true },
    { name: "travelDate" as const, label: "Travel Date", type: "text", placeholder: "MM/DD/YYYY" },
    { name: "matrics" as const, label: "Matrics", type: "text" },
    { name: "adult" as const, label: "Adults", type: "number", min: 0 },
    { name: "child" as const, label: "Children", type: "number", min: 0 },
    { name: "infant" as const, label: "Infants", type: "number", min: 0 },
    { name: "seller" as const, label: "Seller", type: "text" },
    { name: "opsRm" as const, label: "Ops RM", type: "text" },
    { name: "flightSp" as const, label: "Flight SP", type: "number", min: 0 },
    { name: "hotelSp" as const, label: "Hotel SP", type: "number", min: 0 },
    { name: "landSp" as const, label: "Land SP", type: "number", min: 0 },
    { name: "visaSp" as const, label: "Visa SP", type: "number", min: 0 },
    { name: "finalTtv" as const, label: "Final TTV", type: "number", min: 0 },
    { name: "totalSp" as const, label: "Total SP", type: "number", min: 0 },
    { name: "pendingAmount" as const, label: "Pending Amount", type: "number", min: 0 },
    { name: "paymentCollected" as const, label: "Payment Collected", type: "text" },
    { name: "preTrip" as const, label: "Pre Trip", type: "text" },
    { name: "daysToTravel" as const, label: "Days to Travel", type: "text" },
    { name: "voucherPending" as const, label: "Voucher Pending", type: "text" },
    { name: "hotelVoucher" as const, label: "Hotel Voucher", type: "text" },
    { name: "landVoucher" as const, label: "Land Voucher", type: "text" },
    { name: "visaVoucher" as const, label: "Visa Voucher", type: "text" },
    { name: "flightVoucher" as const, label: "Flight Voucher", type: "text" },
    { name: "finalVoucher" as const, label: "Final Voucher", type: "text" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {formFields.map((field) => (
          <div key={field.name} className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-700">{field.label}</label>
            <input
              {...register(field.name)}
              type={field.type}
              placeholder={field.placeholder || ""}
              min={field.min}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            {errors[field.name]?.message && (
              <span className="mt-1 text-xs text-red-600">
                {errors[field.name]?.message as string}
              </span>
            )}
          </div>
        ))}
      </div>
      <DialogFooter>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="submit"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          Add Booking
        </button>
      </DialogFooter>
    </form>
  );
}

function BookingDetailView({ 
  booking, 
  inr, 
  onRemove 
}: { 
  booking: Booking; 
  inr: (n: number | undefined) => string;
  onRemove: (pn: string) => void;
}) {
  const DetailRow = ({
    label,
    value,
    highlight,
  }: {
    label: string;
    value: string | number | undefined;
    highlight?: boolean;
  }) => (
    <div className={`py-3 px-4 border-b border-slate-100 flex justify-between items-center ${highlight ? "bg-slate-50" : ""}`}>
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-orange-700" : "text-slate-900"}`}>
        {value ?? "—"}
      </span>
    </div>
  );

  return (
    <div className="rounded-lg bg-white border border-slate-200">
      <div className="bg-orange-50 px-4 py-3 border-b border-slate-200">
        <div className="text-sm text-slate-600">Booking Information</div>
      </div>
      <div>
        <DetailRow label="PN" value={booking.pn} highlight />
        <DetailRow label="Lead Pax" value={booking.leadPax} />
        <DetailRow label="Destination" value={booking.destination} />
        <DetailRow label="Travel Date" value={booking.travelDate || "—"} />
        <DetailRow label="Days to Travel" value={booking.daysToTravel || "—"} />
      </div>

      <div className="bg-blue-50 px-4 py-3 border-b border-t border-slate-200 mt-4">
        <div className="text-sm text-slate-600">Passengers</div>
      </div>
      <div>
        <DetailRow label="Adults" value={booking.adult} />
        <DetailRow label="Children" value={booking.child} />
        <DetailRow label="Infants" value={booking.infant} />
        <DetailRow label="Matrics" value={booking.matrics || "—"} />
      </div>

      <div className="bg-purple-50 px-4 py-3 border-b border-t border-slate-200 mt-4">
        <div className="text-sm text-slate-600">Seller & Operations</div>
      </div>
      <div>
        <DetailRow label="Seller" value={booking.seller || "—"} />
        <DetailRow label="Ops RM" value={booking.opsRm || "Unassigned"} />
      </div>

      <div className="bg-amber-50 px-4 py-3 border-b border-t border-slate-200 mt-4">
        <div className="text-sm text-slate-600">Pricing & Payment</div>
      </div>
      <div>
        <DetailRow label="Flight SP" value={inr(booking.flightSp)} />
        <DetailRow label="Hotel SP" value={inr(booking.hotelSp)} />
        <DetailRow label="Land SP" value={inr(booking.landSp)} />
        <DetailRow label="Visa SP" value={inr(booking.visaSp)} />
        <DetailRow label="Total SP" value={inr(booking.totalSp)} />
        <DetailRow label="Final TTV" value={inr(booking.finalTtv)} highlight />
        <DetailRow label="Payment Collected" value={booking.paymentCollected} />
        <DetailRow label="Pending Amount" value={inr(booking.pendingAmount)} highlight={booking.pendingAmount > 0} />
      </div>

      <div className="bg-teal-50 px-4 py-3 border-b border-t border-slate-200 mt-4">
        <div className="text-sm text-slate-600">Vouchers & Status</div>
      </div>
      <div>
        <DetailRow label="Flight Voucher" value={booking.flightVoucher || "—"} />
        <DetailRow label="Hotel Voucher" value={booking.hotelVoucher || "—"} />
        <DetailRow label="Land Voucher" value={booking.landVoucher || "—"} />
        <DetailRow label="Visa Voucher" value={booking.visaVoucher || "—"} />
        <DetailRow label="Final Voucher" value={booking.finalVoucher || "—"} />
        <DetailRow label="Voucher Pending" value={booking.voucherPending || "—"} />
        <DetailRow label="Pre Trip" value={booking.preTrip || "—"} />
      </div>

      <div className="p-4 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(booking.pn)}
          className="rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-sm cursor-pointer"
        >
          Remove Booking from Website
        </button>
      </div>
    </div>
  );
}
