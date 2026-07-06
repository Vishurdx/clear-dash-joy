import { useMemo, useState, useCallback, Dispatch, SetStateAction } from "react";
import { type Booking, daysUntil } from "@/lib/sheet.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plane,
  Building,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  X,
  FileText,
  AlertCircle,
  MessageSquare,
  Save,
} from "lucide-react";

function CommentCell({
  pn,
  existingText,
  expandedComments,
  draftComments,
  toggleComment,
  setDraftComments,
  handleSaveComment,
  handleClearComment,
  setExpandedComments,
}: {
  pn: string;
  existingText: string;
  expandedComments: Record<string, boolean>;
  draftComments: Record<string, string>;
  toggleComment: (pn: string) => void;
  setDraftComments: Dispatch<SetStateAction<Record<string, string>>>;
  handleSaveComment: (pn: string) => void;
  handleClearComment: (pn: string) => void;
  setExpandedComments: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const isOpen = expandedComments[pn] ?? false;
  const draft = draftComments[pn] ?? existingText;
  const hasSaved = !!existingText;

  return (
    <td className="px-3 py-2.5 min-w-[180px]">
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => toggleComment(pn)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border transition-all duration-150 cursor-pointer ${
            hasSaved
              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          {hasSaved ? (isOpen ? "Hide note" : "View/Edit note") : (isOpen ? "Cancel" : "Add note")}
        </button>

        {!isOpen && hasSaved && (
          <p className="text-[10px] text-slate-500 italic leading-snug line-clamp-2">
            {existingText}
          </p>
        )}

        {isOpen && (
          <div className="flex flex-col gap-1.5 mt-0.5">
            <textarea
              rows={3}
              value={draft}
              onChange={(e) =>
                setDraftComments((prev) => ({ ...prev, [pn]: e.target.value }))
              }
              placeholder="Type a reason or note for this PN..."
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder-slate-300 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 resize-none transition-all duration-150"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { handleSaveComment(pn); setExpandedComments((p) => ({ ...p, [pn]: false })); }}
                className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-orange-600 transition cursor-pointer"
              >
                <Save className="h-3 w-3" /> Save
              </button>
              {hasSaved && (
                <button
                  onClick={() => handleClearComment(pn)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </td>
  );
}

/**
 * Voucher Release Dashboard redesigned with a simple, operations-first workflow.
 */
export function VoucherReleaseTab({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateVoucherComment,
}: {
  bookings: Booking[];
  isLoading: boolean;
  onSelectBooking?: (booking: Booking, mode: "voucher") => void;
  onUpdateVoucherComment?: (pn: string, text: string) => void;
}) {
  const [quickFilter, setQuickFilter] = useState<"dot-15" | "dot-7" | "dot-3" | null>(null);
  const [search, setSearch] = useState<string>("");
  const [activeModal, setActiveModal] = useState<"flight-not-shared" | "hotel-not-shared" | "final-not-shared" | "critical-pending" | null>(null);

  // ── Comment state ──
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const toggleComment = useCallback((pn: string) => {
    setExpandedComments((prev) => ({ ...prev, [pn]: !prev[pn] }));
    const bk = bookings.find((b) => b.pn === pn);
    setDraftComments((prev) => ({
      ...prev,
      [pn]: prev[pn] ?? (bk?.voucherComment || ""),
    }));
  }, [bookings]);

  const handleSaveComment = useCallback((pn: string) => {
    const text = draftComments[pn] ?? "";
    onUpdateVoucherComment?.(pn, text.trim());
  }, [draftComments, onUpdateVoucherComment]);

  const handleClearComment = useCallback((pn: string) => {
    onUpdateVoucherComment?.(pn, "");
    setDraftComments((prev) => ({ ...prev, [pn]: "" }));
  }, [onUpdateVoucherComment]);

  // Derived milestones for future trips (Travel Date >= Today)
  const enrichedBookings = useMemo(() => {
    return bookings
      .map((b) => {
        const td = daysUntil(b.travelDate);
        const isFuture = td !== null && td >= 0;

        const flightVoucherLower = b.flightVoucher?.toLowerCase() || "";
        const flightIncluded = (b.flightSp ?? 0) > 0;

        const hotelVoucherLower = b.hotelVoucher?.toLowerCase() || "";
        const hotelIncluded =
          (b.hotelSp ?? 0) > 0 ||
          (hotelVoucherLower !== "" &&
           hotelVoucherLower !== "not applicable" &&
           hotelVoucherLower !== "n/a");

        const flightVoucherShared =
          flightVoucherLower === "shared" ||
          flightVoucherLower === "not applicable" ||
          flightVoucherLower === "n/a";

        const hotelVoucherShared =
          hotelVoucherLower === "shared" ||
          hotelVoucherLower === "not applicable" ||
          hotelVoucherLower === "n/a";
        // Treat "Not Applicable" as satisfied — visa-only bookings have no final voucher
        const finalVoucherNA = b.finalVoucher?.toLowerCase() === "not applicable";
        const finalVoucherShared = b.finalVoucher?.toLowerCase() === "shared" || finalVoucherNA;

        const inst1StatusLower = b.installment1Status?.toLowerCase() || "";
        const inst1Received = inst1StatusLower === "received" || inst1StatusLower === "not applicable";

        // Second Installment logic: ((final amount (column AP) - 1st installment amount (BI column))/2) > pending amount (BS column)
        const finalAmt = b.finalTtv ?? 0;
        const inst1Amt = b.installment1Amount ?? 0;
        const pendingAmt = b.pendingAmount ?? 0;
        
        const formulaReceived = ((finalAmt - inst1Amt) / 2) > pendingAmt;
        const inst2StatusLower = b.installment2Status?.toLowerCase() || "";
        const inst2Received = formulaReceived || inst2StatusLower === "received" || inst2StatusLower === "not applicable";

        const inst3StatusLower = b.installment3Status?.toLowerCase() || "";
        const inst3Received = inst3StatusLower === "received" || inst3StatusLower === "not applicable";
        
        // Final Payment Collected = pending amount (column BS) is 0
        const finalPaymentCollected = pendingAmt === 0;

        // Eligibility rules
        const isFlightEligible = flightIncluded && inst1Received && !flightVoucherShared;
        const isHotelEligible = hotelIncluded && inst2Received && !hotelVoucherShared;
        const isFinalEligible = finalPaymentCollected && !finalVoucherShared;

        // Voucher pending criteria
        const hasVoucherPending =
          (flightIncluded && !flightVoucherShared) ||
          (hotelIncluded && !hotelVoucherShared) ||
          !finalVoucherShared;

        return {
          ...b,
          travelDays: td,
          isFuture,
          flightIncluded,
          hotelIncluded,
          flightVoucherShared,
          hotelVoucherShared,
          finalVoucherShared,
          inst1Received,
          inst2Received,
          inst3Received,
          finalPaymentCollected,
          isFlightEligible,
          isHotelEligible,
          isFinalEligible,
          hasVoucherPending,
        };
      })
      .filter((b) => {
        // Exclude dropped bookings
        if (b.tripStatus && b.tripStatus.toLowerCase().includes("dropped")) {
          return false;
        }
        // Exclude past trips (Only consider bookings where Travel Date >= Today)
        return b.isFuture;
      })
      .sort((a, b) => {
        const tdA = a.travelDays ?? Infinity;
        const tdB = b.travelDays ?? Infinity;
        return tdA - tdB;
      });
  }, [bookings]);


  // Card calculations based only on future bookings
  const cardsData = useMemo(() => {
    let flightVoucherNotSharedCount = 0;
    let hotelVoucherNotSharedCount = 0;
    let finalVoucherNotSharedCount = 0;
    let criticalVoucherPendingCount = 0;

    for (const b of enrichedBookings) {
      // 1. Flight Voucher Not Shared
      if (b.flightIncluded && b.inst1Received && !b.flightVoucherShared) {
        flightVoucherNotSharedCount++;
      }

      // 2. Hotel Voucher Not Shared
      if (b.inst2Received && !b.hotelVoucherShared && b.hotelIncluded) {
        hotelVoucherNotSharedCount++;
      }

      // 3. Final Voucher Not Shared (pending amount is 0 and final voucher not shared)
      if (b.finalPaymentCollected && !b.finalVoucherShared) {
        finalVoucherNotSharedCount++;
      }

      // 4. Critical Voucher Pending (Travel Date <= Today + 3 days)
      if (b.travelDays !== null && b.travelDays <= 3 && b.hasVoucherPending) {
        criticalVoucherPendingCount++;
      }
    }

    return {
      flightVoucherNotSharedCount,
      hotelVoucherNotSharedCount,
      finalVoucherNotSharedCount,
      criticalVoucherPendingCount,
    };
  }, [enrichedBookings]);

  // Modal dataset filters
  const modalBookings = useMemo(() => {
    if (activeModal === "flight-not-shared") {
      return enrichedBookings.filter((b) => b.flightIncluded && b.inst1Received && !b.flightVoucherShared);
    }
    if (activeModal === "hotel-not-shared") {
      return enrichedBookings.filter((b) => b.inst2Received && !b.hotelVoucherShared && b.hotelIncluded);
    }
    if (activeModal === "final-not-shared") {
      return enrichedBookings.filter((b) => b.finalPaymentCollected && !b.finalVoucherShared);
    }
    if (activeModal === "critical-pending") {
      return enrichedBookings.filter((b) => b.travelDays !== null && b.travelDays <= 3 && b.hasVoucherPending);
    }
    return [];
  }, [enrichedBookings, activeModal]);

  // Table dataset filters
  const filteredBookings = useMemo(() => {
    let result = enrichedBookings;

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.pn.toLowerCase().includes(q) ||
          (b.leadPax || "").toLowerCase().includes(q) ||
          (b.destination || "").toLowerCase().includes(q)
      );
    }

    // Quick filter check
    if (quickFilter === "dot-15") {
      result = result.filter((b) => b.travelDays !== null && b.travelDays <= 15 && b.hasVoucherPending);
    } else if (quickFilter === "dot-7") {
      result = result.filter((b) => b.travelDays !== null && b.travelDays <= 7 && b.hasVoucherPending);
    } else if (quickFilter === "dot-3") {
      result = result.filter((b) => b.travelDays !== null && b.travelDays <= 3 && b.hasVoucherPending);
    }

    return result;
  }, [enrichedBookings, search, quickFilter]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading operations panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleek Operations-First Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Voucher Release Workspace</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track and dispatch flight, hotel, and final vouchers based on collected payments and milestone receipts.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Current Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* 1. Flight Voucher Not Shared (Clickable) */}
        <div
          onClick={() => setActiveModal("flight-not-shared")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/50 hover:shadow-md transition-all duration-150"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Flight Voucher Not Shared</div>
          <div className="mt-2 text-2xl font-bold text-sky-600">{cardsData.flightVoucherNotSharedCount}</div>
        </div>

        {/* 2. Hotel Voucher Not Shared (Clickable) */}
        <div
          onClick={() => setActiveModal("hotel-not-shared")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/50 hover:shadow-md transition-all duration-150"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hotel Voucher Not Shared</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{cardsData.hotelVoucherNotSharedCount}</div>
        </div>

        {/* 3. Final Voucher Not Shared (Clickable) */}
        <div
          onClick={() => setActiveModal("final-not-shared")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/50 hover:shadow-md transition-all duration-150"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Final Voucher Not Shared</div>
          <div className="mt-2 text-2xl font-bold text-orange-600">{cardsData.finalVoucherNotSharedCount}</div>
        </div>

        {/* 4. Critical Voucher Pending (Clickable) */}
        <div
          onClick={() => setActiveModal("critical-pending")}
          className="rounded-xl border border-red-100 bg-red-50/50 p-4 shadow-sm cursor-pointer hover:bg-red-100/50 hover:shadow-md transition-all duration-150"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-red-600">Critical Voucher Pending</div>
          <div className="mt-2 text-2xl font-bold text-red-700">{cardsData.criticalVoucherPendingCount}</div>
        </div>
      </div>

      {/* Quick Filters & Search Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">Quick Filters:</span>

          {/* DOT <= 15 days */}
          <button
            onClick={() => setQuickFilter(quickFilter === "dot-15" ? null : "dot-15")}
            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 duration-200 cursor-pointer ${
              quickFilter === "dot-15"
                ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            DOT ≤ 15 Days + Pending
          </button>

          {/* DOT <= 7 days (Orange) */}
          <button
            onClick={() => setQuickFilter(quickFilter === "dot-7" ? null : "dot-7")}
            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 duration-200 cursor-pointer ${
              quickFilter === "dot-7"
                ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20"
                : "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100/70"
            }`}
          >
            DOT ≤ 7 Days + Pending
          </button>

          {/* DOT <= 3 days (Red critical) */}
          <button
            onClick={() => setQuickFilter(quickFilter === "dot-3" ? null : "dot-3")}
            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 duration-200 cursor-pointer ${
              quickFilter === "dot-3"
                ? "bg-red-600 text-white animate-pulse shadow-sm shadow-red-600/25"
                : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100/70"
            }`}
          >
            DOT ≤ 3 Days + Pending
          </button>

          {quickFilter && (
            <button
              onClick={() => setQuickFilter(null)}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 ml-1.5 px-2 py-1 rounded hover:bg-rose-50"
            >
              Clear Filter <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Compact Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Pax name, PN or destination..."
            className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-xs bg-white focus:outline-none hover:border-orange-500/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200 shadow-sm"
          />
        </div>
      </div>

      {/* Main Operational Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <table className="min-w-[1500px] w-full text-xs">
          <thead className="bg-[#141b2b] text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3.5 font-bold">Lead Name</th>
              <th className="px-4 py-3.5 font-bold">PN</th>
              <th className="px-4 py-3.5 font-bold">Destination</th>
              <th className="px-4 py-3.5 font-bold">Travel Date</th>
              <th className="px-4 py-3.5 font-bold">Installment 1 Status</th>
              <th className="px-4 py-3.5 font-bold">Installment 2 Status</th>
              <th className="px-4 py-3.5 font-bold">Installment 3 Status</th>
              <th className="px-4 py-3.5 font-bold text-center">Flight Included</th>
              <th className="px-4 py-3.5 font-bold text-center">Hotel Included</th>
              <th className="px-4 py-3.5 font-bold text-center">Flight Voucher Status</th>
              <th className="px-4 py-3.5 font-bold text-center">Hotel Voucher Status</th>
              <th className="px-4 py-3.5 font-bold text-center">Final Voucher Status</th>
              <th className="px-4 py-3.5 font-bold">Assigned RM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-slate-400 font-medium">
                  No future bookings found matching the current filters.
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => (
                <tr key={b.pn} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    {b.leadPax || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={() => onSelectBooking?.(b, "voucher")}
                      className="font-medium text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                    >
                      {b.pn}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      {b.destination || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                    {b.travelDate}
                    {b.travelDays !== null && (
                      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        b.travelDays <= 3
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : b.travelDays <= 7
                          ? "bg-orange-50 text-orange-600 border border-orange-100"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        T-{b.travelDays}d
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      b.inst1Received
                        ? "bg-orange-50 text-orange-700 border border-orange-100"
                        : "bg-slate-50 text-slate-400 border border-slate-100"
                    }`}>
                      {b.inst1Received && <CheckCircle2 className="h-3 w-3" />}
                      {b.installment1Status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      b.inst2Received
                        ? "bg-orange-50 text-orange-700 border border-orange-100"
                        : "bg-slate-50 text-slate-400 border border-slate-100"
                    }`}>
                      {b.inst2Received && <CheckCircle2 className="h-3 w-3" />}
                      {b.installment2Status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                      b.inst3Received
                        ? "bg-orange-50 text-orange-700 border border-orange-100"
                        : "bg-slate-50 text-slate-400 border border-slate-100"
                    }`}>
                      {b.inst3Received && <CheckCircle2 className="h-3 w-3" />}
                      {b.installment3Status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {b.flightIncluded ? (
                      <span className="font-bold text-sky-600">Yes</span>
                    ) : (
                      <span className="text-slate-300">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {b.hotelIncluded ? (
                      <span className="font-bold text-amber-600">Yes</span>
                    ) : (
                      <span className="text-slate-300">No</span>
                    )}
                  </td>
                  
                  {/* Flight Voucher */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {b.flightVoucher?.toLowerCase() === "not applicable" || b.flightVoucher?.toLowerCase() === "n/a" ? (
                      <span className="inline-flex rounded bg-slate-100 border border-slate-300 px-2 py-1 font-bold text-slate-500">
                        N/A
                      </span>
                    ) : !b.flightIncluded ? (
                      <span className="text-slate-300">—</span>
                    ) : b.flightVoucherShared ? (
                      <span className="inline-flex rounded bg-orange-50 border border-orange-200 px-2 py-1 font-bold text-orange-700">
                        Shared
                      </span>
                    ) : b.isFlightEligible ? (
                      <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-1 font-bold text-amber-700 animate-pulse">
                        Eligible to Share
                      </span>
                    ) : (
                      <span className="inline-flex rounded bg-slate-50 border border-slate-200 px-2 py-1 font-semibold text-slate-400">
                        Pending (Inst 1)
                      </span>
                    )}
                  </td>

                  {/* Hotel Voucher */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {b.hotelVoucher?.toLowerCase() === "not applicable" || b.hotelVoucher?.toLowerCase() === "n/a" ? (
                      <span className="inline-flex rounded bg-slate-100 border border-slate-300 px-2 py-1 font-bold text-slate-500">
                        N/A
                      </span>
                    ) : !b.hotelIncluded ? (
                      <span className="text-slate-300">—</span>
                    ) : b.hotelVoucherShared ? (
                      <span className="inline-flex rounded bg-orange-50 border border-orange-200 px-2 py-1 font-bold text-orange-700">
                        Shared
                      </span>
                    ) : b.isHotelEligible ? (
                      <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-1 font-bold text-amber-700 animate-pulse">
                        Eligible to Share
                      </span>
                    ) : (
                      <span className="inline-flex rounded bg-slate-50 border border-slate-200 px-2 py-1 font-semibold text-slate-400">
                        Pending (Inst 2)
                      </span>
                    )}
                  </td>

                  {/* Final Voucher */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {b.finalVoucher?.toLowerCase() === "not applicable" ? (
                      <span className="inline-flex rounded bg-slate-100 border border-slate-300 px-2 py-1 font-bold text-slate-500">
                        N/A
                      </span>
                    ) : b.finalVoucherShared ? (
                      <span className="inline-flex rounded bg-orange-50 border border-orange-200 px-2 py-1 font-bold text-orange-700">
                        Shared
                      </span>
                    ) : b.isFinalEligible ? (
                      <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-1 font-bold text-amber-700 animate-pulse">
                        Eligible to Share
                      </span>
                    ) : (
                      <span className="inline-flex rounded bg-slate-50 border border-slate-200 px-2 py-1 font-semibold text-slate-400">
                        Pending (Final Pay)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">{b.opsRm || "Unassigned"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* INSPECT DIALOG MODALS */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3 mb-2">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {activeModal === "flight-not-shared" && (
                <>
                  <Plane className="h-5 w-5 text-sky-600" />
                  <span>Flight Vouchers Pending Release (Installment 1 Received)</span>
                  <span className="ml-2 text-xs font-semibold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "hotel-not-shared" && (
                <>
                  <Building className="h-5 w-5 text-amber-600" />
                  <span>Hotel Vouchers Pending Release (Installment 2 Received)</span>
                  <span className="ml-2 text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "final-not-shared" && (
                <>
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <span>Final Vouchers Pending Release (Payment Collected)</span>
                  <span className="ml-2 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "critical-pending" && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
                  <span>Critical Vouchers Pending Release (Travel Date ≤ Today + 3 days)</span>
                  <span className="ml-2 text-xs font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Modal Content Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              {activeModal === "flight-not-shared" ? (
                <>
                  <thead className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">PN Number</th>
                      <th className="px-3 py-2.5">Lead Name</th>
                      <th className="px-3 py-2.5">Destination</th>
                      <th className="px-3 py-2.5">Travel Date</th>
                      <th className="px-3 py-2.5">Installment 1 Status</th>
                      <th className="px-3 py-2.5">Flight Voucher Status</th>
                      <th className="px-3 py-2.5">Assigned RM</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Comments / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalBookings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                          No pending flight vouchers.
                        </td>
                      </tr>
                    ) : (
                      modalBookings.map((b) => (
                        <tr key={b.pn} className="hover:bg-slate-50/50 align-top">
                          <td className="px-3 py-2.5 font-semibold">
                            <button
                              onClick={() => {
                                setActiveModal(null);
                                onSelectBooking?.(b, "voucher");
                              }}
                              className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                            >
                              {b.pn}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{b.leadPax || "—"}</td>
                          <td className="px-3 py-2.5">{b.destination || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {b.travelDate}
                            {b.travelDays !== null && (
                              <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                T-{b.travelDays}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 font-medium ${
                              b.inst1Received
                                ? "bg-orange-50 text-orange-800 border border-orange-100"
                                : "bg-slate-50 text-slate-400 border border-slate-100"
                            }`}>
                              {b.inst1Received && <CheckCircle2 className="h-3 w-3" />}
                              {b.installment1Status || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-0.5 font-bold text-amber-700">
                              {b.flightVoucher || "Pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{b.opsRm || "Unassigned"}</td>
                          <CommentCell
                            pn={b.pn}
                            existingText={b.voucherComment || ""}
                            expandedComments={expandedComments}
                            draftComments={draftComments}
                            toggleComment={toggleComment}
                            setDraftComments={setDraftComments}
                            handleSaveComment={handleSaveComment}
                            handleClearComment={handleClearComment}
                            setExpandedComments={setExpandedComments}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              ) : activeModal === "hotel-not-shared" ? (
                <>
                  <thead className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">PN Number</th>
                      <th className="px-3 py-2.5">Lead Name</th>
                      <th className="px-3 py-2.5">Destination</th>
                      <th className="px-3 py-2.5">Travel Date</th>
                      <th className="px-3 py-2.5">Installment 2 Status</th>
                      <th className="px-3 py-2.5">Installment 3 Status</th>
                      <th className="px-3 py-2.5">Hotel Voucher Status</th>
                      <th className="px-3 py-2.5">Assigned RM</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Comments / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                          No pending hotel vouchers.
                        </td>
                      </tr>
                    ) : (
                      modalBookings.map((b) => (
                        <tr key={b.pn} className="hover:bg-slate-50/50 align-top">
                          <td className="px-3 py-2.5 font-semibold">
                            <button
                              onClick={() => {
                                setActiveModal(null);
                                onSelectBooking?.(b, "voucher");
                              }}
                              className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                            >
                              {b.pn}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{b.leadPax || "—"}</td>
                          <td className="px-3 py-2.5">{b.destination || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {b.travelDate}
                            {b.travelDays !== null && (
                              <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                T-{b.travelDays}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 font-medium ${
                              b.inst2Received
                                ? "bg-orange-50 text-orange-800 border border-orange-100"
                                : "bg-slate-50 text-slate-400 border border-slate-100"
                            }`}>
                              {b.inst2Received && <CheckCircle2 className="h-3 w-3" />}
                              {b.installment2Status || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 font-medium ${
                              b.inst3Received
                                ? "bg-orange-50 text-orange-800 border border-orange-100"
                                : "bg-slate-50 text-slate-400 border border-slate-100"
                            }`}>
                              {b.inst3Received && <CheckCircle2 className="h-3 w-3" />}
                              {b.installment3Status || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-0.5 font-bold text-amber-700">
                              {b.hotelVoucher || "Pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{b.opsRm || "Unassigned"}</td>
                          <CommentCell
                            pn={b.pn}
                            existingText={b.voucherComment || ""}
                            expandedComments={expandedComments}
                            draftComments={draftComments}
                            toggleComment={toggleComment}
                            setDraftComments={setDraftComments}
                            handleSaveComment={handleSaveComment}
                            handleClearComment={handleClearComment}
                            setExpandedComments={setExpandedComments}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              ) : activeModal === "final-not-shared" ? (
                <>
                  <thead className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">PN Number</th>
                      <th className="px-3 py-2.5">Lead Name</th>
                      <th className="px-3 py-2.5">Destination</th>
                      <th className="px-3 py-2.5">Travel Date</th>
                      <th className="px-3 py-2.5">Final Payment Collected</th>
                      <th className="px-3 py-2.5">Final Voucher Status</th>
                      <th className="px-3 py-2.5">Assigned RM</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Comments / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalBookings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                          No pending final vouchers.
                        </td>
                      </tr>
                    ) : (
                      modalBookings.map((b) => (
                        <tr key={b.pn} className="hover:bg-slate-50/50 align-top">
                          <td className="px-3 py-2.5 font-semibold">
                            <button
                              onClick={() => {
                                setActiveModal(null);
                                onSelectBooking?.(b, "voucher");
                              }}
                              className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                            >
                              {b.pn}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{b.leadPax || "—"}</td>
                          <td className="px-3 py-2.5">{b.destination || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {b.travelDate}
                            {b.travelDays !== null && (
                              <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                T-{b.travelDays}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-0.5 rounded bg-orange-50 text-orange-800 px-2 py-0.5 font-medium border border-orange-100">
                              <CheckCircle2 className="h-3 w-3" />
                              {b.paymentCollected || "Yes"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex rounded bg-amber-50 border border-amber-300 px-2 py-0.5 font-bold text-amber-700">
                              {b.finalVoucher || "Pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{b.opsRm || "Unassigned"}</td>
                          <CommentCell
                            pn={b.pn}
                            existingText={b.voucherComment || ""}
                            expandedComments={expandedComments}
                            draftComments={draftComments}
                            toggleComment={toggleComment}
                            setDraftComments={setDraftComments}
                            handleSaveComment={handleSaveComment}
                            handleClearComment={handleClearComment}
                            setExpandedComments={setExpandedComments}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  {/* Critical Pending Modal */}
                  <thead className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">PN Number</th>
                      <th className="px-3 py-2.5">Lead Name</th>
                      <th className="px-3 py-2.5">Destination</th>
                      <th className="px-3 py-2.5">Travel Date</th>
                      <th className="px-3 py-2.5 text-center">Flight Voucher</th>
                      <th className="px-3 py-2.5 text-center">Hotel Voucher</th>
                      <th className="px-3 py-2.5 text-center">Final Voucher</th>
                      <th className="px-3 py-2.5">Assigned RM</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Comments / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                          No critical pending vouchers.
                        </td>
                      </tr>
                    ) : (
                      modalBookings.map((b) => (
                        <tr key={b.pn} className="hover:bg-slate-50/50 align-top">
                          <td className="px-3 py-2.5 font-semibold">
                            <button
                              onClick={() => {
                                setActiveModal(null);
                                onSelectBooking?.(b, "voucher");
                              }}
                              className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                            >
                              {b.pn}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{b.leadPax || "—"}</td>
                          <td className="px-3 py-2.5">{b.destination || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {b.travelDate}
                            {b.travelDays !== null && (
                              <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                T-{b.travelDays}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {b.flightVoucher?.toLowerCase() === "not applicable" || b.flightVoucher?.toLowerCase() === "n/a" ? (
                              <span className="inline-flex rounded px-2 py-0.5 font-semibold bg-slate-100 text-slate-500 border border-slate-300">
                                N/A
                              </span>
                            ) : b.flightIncluded ? (
                              <span className={`inline-flex rounded px-2 py-0.5 font-semibold ${
                                b.flightVoucherShared ? "bg-orange-50 text-orange-700 border border-orange-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {b.flightVoucher || "Pending"}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {b.hotelVoucher?.toLowerCase() === "not applicable" || b.hotelVoucher?.toLowerCase() === "n/a" ? (
                              <span className="inline-flex rounded px-2 py-0.5 font-semibold bg-slate-100 text-slate-500 border border-slate-300">
                                N/A
                              </span>
                            ) : b.hotelIncluded ? (
                              <span className={`inline-flex rounded px-2 py-0.5 font-semibold ${
                                b.hotelVoucherShared ? "bg-orange-50 text-orange-700 border border-orange-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {b.hotelVoucher || "Pending"}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {b.finalVoucher?.toLowerCase() === "not applicable" ? (
                              <span className="inline-flex rounded px-2 py-0.5 font-semibold bg-slate-100 text-slate-500 border border-slate-300">
                                N/A
                              </span>
                            ) : (
                              <span className={`inline-flex rounded px-2 py-0.5 font-semibold ${
                                b.finalVoucherShared ? "bg-orange-50 text-orange-700 border border-orange-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {b.finalVoucher || "Pending"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">{b.opsRm || "Unassigned"}</td>
                          <CommentCell
                            pn={b.pn}
                            existingText={b.voucherComment || ""}
                            expandedComments={expandedComments}
                            draftComments={draftComments}
                            toggleComment={toggleComment}
                            setDraftComments={setDraftComments}
                            handleSaveComment={handleSaveComment}
                            handleClearComment={handleClearComment}
                            setExpandedComments={setExpandedComments}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
