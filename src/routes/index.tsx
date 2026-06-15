import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { fetchBookings, type Booking } from "@/lib/sheet.functions";
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

const OPS_RMS = ["Vishwajeet", "Shruti"];
const inr = (n: number) =>
  n === 0 ? "—" : "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const [m, d, y] = dateStr.split("/").map(Number);
  if (!m || !d || !y) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now.getTime()) / 86400000);
}

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
  return b.paymentCollected.toLowerCase() === "yes" || b.pendingAmount <= 0;
}

function releaseRemark(b: Booking): string | null {
  if (isFullyCollected(b)) return null;
  const days = daysUntil(b.freeCancellationDate);
  if (days === null) return null;
  if (days < 0) return "Free cancellation date passed — kindly release now";
  if (days === 0) return "Kindly release today if payment not done";
  return `Kindly release if not done in ${days} day${days === 1 ? "" : "s"}`;
}

const YES_NO = ["Yes", "No"];
const VOUCHER_OPTS = ["", "Shared", "Not Shared", "Not Applicable"];
const INST_STATUS = ["", "Received", "Pending", "Not Applicable"];
const DISCREPANCY_OPTS = ["", "Equal", "Less", "More"];
const MATRICS_OPTS = ["", "Past", "Future"];

function Dashboard() {
  const fn = useServerFn(fetchBookings);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
  });

  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [seller, setSeller] = useState("");
  const [opsRm, setOpsRm] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [daysFilter, setDaysFilter] = useState("");
  const [hideDropped, setHideDropped] = useState(false);
  const [tab, setTab] = useState<"all" | "payment" | "voucher" | "upcoming">("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNewBookingForm, setShowNewBookingForm] = useState(false);

  const rows = data?.rows ?? [];

  const destinations = useMemo(
    () => [...new Set(rows.map((r) => r.destination).filter(Boolean))].sort(),
    [rows],
  );
  const sellers = useMemo(
    () => [...new Set(rows.map((r) => r.seller).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
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
      if (destination && b.destination !== destination) return false;
      if (seller && b.seller !== seller) return false;
      if (opsRm) {
        if (opsRm === "Unassigned" && b.opsRm) return false;
        if (opsRm !== "Unassigned" && b.opsRm !== opsRm) return false;
      }
      if (paymentStatus === "full" && !isFullyCollected(b)) return false;
      if (paymentStatus === "pending" && isFullyCollected(b)) return false;
      if (daysFilter) {
        const d = daysUntil(b.travelDate);
        if (d === null) return false;
        if (daysFilter === "after-today" && !(d >= 0)) return false;
        if (daysFilter === "0-14" && !(d >= 0 && d <= 14)) return false;
        if (daysFilter === "15-30" && !(d >= 15 && d <= 30)) return false;
        if (daysFilter === "31-90" && !(d >= 31 && d <= 90)) return false;
        if (daysFilter === "gt90" && !(d > 90)) return false;
      }
      if (hideDropped && b.tripStatus && b.tripStatus.toLowerCase().includes("dropped"))
        return false;
      if (tab === "payment" && isFullyCollected(b)) return false;
      if (tab === "voucher" && b.finalVoucher.toLowerCase() === "shared") return false;
      if (tab === "upcoming") {
        const d = daysUntil(b.travelDate);
        if (d === null || d < 0) return false;
      }
      return true;
    });
  }, [rows, search, destination, seller, opsRm, paymentStatus, daysFilter, hideDropped, tab]);

  const kpis = useMemo(() => {
    const finalTtv = filtered.reduce((a, b) => a + b.finalTtv, 0);
    const pending = filtered.reduce((a, b) => a + b.pendingAmount, 0);
    const fully = filtered.filter(isFullyCollected).length;
    const le14 = filtered.filter((b) => {
      const d = daysUntil(b.travelDate);
      return d !== null && d >= 0 && d <= 14;
    }).length;
    const unassigned = filtered.filter((b) => !b.opsRm || !OPS_RMS.includes(b.opsRm)).length;
    return { total: filtered.length, finalTtv, pending, fully, le14, unassigned };
  }, [filtered]);

  const clear = () => {
    setSearch("");
    setDestination("");
    setSeller("");
    setOpsRm("");
    setPaymentStatus("");
    setDaysFilter("");
    setHideDropped(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-3 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Post-Booking Operations
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Cleartrip × TravClan — Live from Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewBookingForm(true)}
              className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              + New booking
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isFetching ? "Refreshing…" : "↻ Refresh"}
            </button>
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
          <Kpi label="Fully collected" value={String(kpis.fully)} color="text-emerald-600" />
          <Kpi label="≤ 14 days out" value={String(kpis.le14)} color="text-orange-600" />
          <Kpi label="Unassigned RM" value={String(kpis.unassigned)} color="text-rose-600" />
        </section>

        {/* Filters */}
        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, PN, destination…"
              className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
            />
            <Select
              value={destination}
              onChange={setDestination}
              placeholder="All destinations"
              options={destinations}
            />
            <Select
              value={seller}
              onChange={setSeller}
              placeholder="All sellers"
              options={sellers}
            />
            <Select
              value={opsRm}
              onChange={setOpsRm}
              placeholder="All Ops RM"
              options={["Unassigned", ...OPS_RMS]}
            />
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
                { value: "after-today", label: "Travel date is after today" },
                { value: "0-14", label: "Next 14 days" },
                { value: "15-30", label: "Next 30 days" },
                { value: "31-90", label: "Next 90 days" },
                { value: "gt90", label: "More than 90 days" },
              ]}
            />
            <button
              onClick={() => setHideDropped(!hideDropped)}
              className={`h-9 rounded-md px-3 text-sm font-medium transition ${
                hideDropped
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {hideDropped ? "✓ Hide Dropped" : "Hide Dropped"}
            </button>
            <button
              onClick={clear}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <div className="ml-auto text-sm text-slate-500">
              {filtered.length} of {rows.length}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="mt-5 border-b border-slate-200">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All bookings"],
                ["payment", "Payment tracker"],
                ["voucher", "Voucher status"],
                ["upcoming", "Upcoming trips"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative -mb-px px-4 py-2.5 text-sm font-medium transition ${
                  tab === k
                    ? "border-b-2 border-emerald-600 text-emerald-700"
                    : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Table */}
        <section className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1500px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "PN",
                  "Lead pax",
                  "Destination",
                  "Travel",
                  "Days",
                  "Pax",
                  "Seller",
                  "Ops RM",
                  "Flight SP",
                  "Hotel SP",
                  "Land SP",
                  "Visa SP",
                  "Final TTV",
                  "Total SP",
                  "Payment",
                  "Pending",
                  "Status",
                  ...(tab === "payment" ? ["Urgent"] : []),
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">
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
                      {(() => {
                        const urgencyColor =
                          tab === "payment"
                            ? getPaymentUrgencyColor(b.freeCancellationDate, b.travelDate)
                            : null;
                        return (
                          <td className={`whitespace-nowrap px-3 py-2.5 ${urgencyColor || ""}`}>
                            <button
                              onClick={() => setSelectedBooking(b)}
                              className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                            >
                              {b.pn}
                            </button>
                          </td>
                        );
                      })()}
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-800">{b.leadPax}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {b.destination || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.travelDate || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {b.matrics?.toLowerCase() || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.adult}/{b.child}/{b.infant}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.seller || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <OpsRmSelect value={b.opsRm} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {inr(b.flightSp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {inr(b.hotelSp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {inr(b.landSp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {inr(b.visaSp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {inr(b.finalTtv)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">
                        {inr(b.totalSp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            full ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {full ? "Full" : "Pending"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {b.pendingAmount > 0 ? inr(b.pendingAmount) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                        {b.preTrip || "—"}
                      </td>
                      {tab === "payment" && (
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {b.freeCancellationDate
                            ? (() => {
                                const days = daysUntil(b.freeCancellationDate);
                                let badgeClass = "";
                                let label = "";
                                if (days !== null) {
                                  if (days <= 3) {
                                    badgeClass = "bg-red-100 text-red-800";
                                    label = `${days}d - URGENT`;
                                  } else if (days <= 6) {
                                    badgeClass = "bg-orange-100 text-orange-800";
                                    label = `${days}d - HIGH`;
                                  } else if (days >= 7) {
                                    badgeClass = "bg-pink-100 text-pink-800";
                                    label = `${days}d - MEDIUM`;
                                  }
                                }
                                const remark = releaseRemark(b);
                                return badgeClass ? (
                                  <div className="flex flex-col gap-1">
                                    <span
                                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
                                    >
                                      {label}
                                    </span>
                                    {remark ? (
                                      <span className="text-xs font-medium text-red-600">
                                        {remark}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  "—"
                                );
                              })()
                            : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <p className="mt-4 text-center text-xs text-slate-400">
          {data ? `Last refreshed ${new Date(data.fetchedAt).toLocaleString()}` : ""}
        </p>
      </main>

      <Dialog open={showNewBookingForm} onOpenChange={setShowNewBookingForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Booking</DialogTitle>
          </DialogHeader>
          <NewBookingForm
            onSuccess={() => {
              setShowNewBookingForm(false);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details — PN {selectedBooking?.pn}</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <BookingDetailView key={selectedBooking.pn} booking={selectedBooking} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${color}`}>{value}</div>
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
      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
      value={OPS_RMS.includes(v) ? v : ""}
      onChange={(e) => setV(e.target.value)}
      className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-emerald-500"
    >
      <option value="">— Unassigned —</option>
      {OPS_RMS.map((rm) => (
        <option key={rm} value={rm}>
          {rm}
        </option>
      ))}
    </select>
  );
}

function NewBookingForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Partial<Booking>>({
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
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            {errors[field.name] && (
              <span className="mt-1 text-xs text-red-600">{errors[field.name]?.message}</span>
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
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Add Booking
        </button>
      </DialogFooter>
    </form>
  );
}

type FieldType = "text" | "number" | "select";

function EditField({
  value,
  type = "text",
  options,
  onChange,
}: {
  value: string;
  type?: FieldType;
  options?: string[];
  onChange: (v: string) => void;
}) {
  const base =
    "w-44 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm font-semibold text-slate-900 outline-none transition hover:border-slate-200 hover:bg-slate-50 focus:border-emerald-500 focus:bg-white";
  if (type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${base} cursor-pointer appearance-none`}
      >
        {(options ?? []).map((o) => (
          <option key={o} value={o}>
            {o === "" ? "—" : o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}

function SectionHeader({ label, className }: { label: string; className: string }) {
  return (
    <div className={`${className} px-4 py-3 border-b border-t border-slate-200 mt-4`}>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}

function BookingDetailView({ booking }: { booking: Booking }) {
  const [edited, setEdited] = useState<Booking>(booking);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Booking>(key: K, value: Booking[K]) => {
    setEdited((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const setInst = (i: number, key: "dueDate" | "amount" | "status", value: string | number) => {
    setEdited((prev) => {
      const installments = prev.installments.map((inst, idx) =>
        idx === i ? { ...inst, [key]: value } : inst,
      );
      return { ...prev, installments };
    });
    setDirty(true);
  };

  const Row = ({
    label,
    field,
    type = "text",
    options,
    highlight,
  }: {
    label: string;
    field: keyof Booking;
    type?: FieldType;
    options?: string[];
    highlight?: boolean;
  }) => (
    <div
      className={`py-1.5 px-4 border-b border-slate-100 flex justify-between items-center gap-3 ${highlight ? "bg-slate-50" : ""}`}
    >
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <EditField
        value={String(edited[field] ?? "")}
        type={type}
        options={options}
        onChange={(v) =>
          set(field, (type === "number" ? Number(v || 0) : v) as Booking[typeof field])
        }
      />
    </div>
  );

  const InstRow = ({
    i,
    field,
    label,
    type = "text",
    options,
  }: {
    i: number;
    field: "dueDate" | "amount" | "status";
    label: string;
    type?: FieldType;
    options?: string[];
  }) => (
    <div className="py-1.5 px-4 border-b border-slate-100 flex justify-between items-center gap-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <EditField
        value={String(edited.installments[i]?.[field] ?? "")}
        type={type}
        options={options}
        onChange={(v) => setInst(i, field, type === "number" ? Number(v || 0) : v)}
      />
    </div>
  );

  const remark = releaseRemark(edited);

  return (
    <div className="rounded-lg bg-white border border-slate-200">
      <div className="flex items-center justify-between bg-emerald-50 px-4 py-3 border-b border-slate-200">
        <div className="text-sm text-slate-600">Booking Information</div>
        <span className="text-xs font-medium text-slate-400">
          {dirty ? "Edited — not saved to sheet" : "Click any value to edit"}
        </span>
      </div>
      <div>
        {Row({ label: "PN", field: "pn", highlight: true })}
        {Row({ label: "Lead Pax", field: "leadPax" })}
        {Row({ label: "Destination", field: "destination" })}
        {Row({ label: "Travel Date", field: "travelDate" })}
        {Row({ label: "Days to Travel", field: "daysToTravel" })}
      </div>

      <SectionHeader label="Passengers" className="bg-blue-50" />
      <div>
        {Row({ label: "Adults", field: "adult", type: "number" })}
        {Row({ label: "Children", field: "child", type: "number" })}
        {Row({ label: "Infants", field: "infant", type: "number" })}
        {Row({ label: "Matrics", field: "matrics", type: "select", options: MATRICS_OPTS })}
      </div>

      <SectionHeader label="Seller & Operations" className="bg-purple-50" />
      <div>
        {Row({ label: "Seller", field: "seller" })}
        {Row({ label: "Ops RM", field: "opsRm", type: "select", options: ["", ...OPS_RMS] })}
      </div>

      <SectionHeader label="Pricing & Payment" className="bg-amber-50" />
      <div>
        {Row({ label: "Flight SP", field: "flightSp", type: "number" })}
        {Row({ label: "Hotel SP", field: "hotelSp", type: "number" })}
        {Row({ label: "Land SP", field: "landSp", type: "number" })}
        {Row({ label: "Visa SP", field: "visaSp", type: "number" })}
        {Row({ label: "Total SP", field: "totalSp", type: "number" })}
        {Row({ label: "Final TTV", field: "finalTtv", type: "number", highlight: true })}
        {Row({
          label: "Payment Collected",
          field: "paymentCollected",
          type: "select",
          options: YES_NO,
        })}
        {Row({
          label: "Pending Amount",
          field: "pendingAmount",
          type: "number",
          highlight: edited.pendingAmount > 0,
        })}
      </div>

      <SectionHeader label="Installments" className="bg-indigo-50" />
      <div>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Installment {i + 1}
            </div>
            {InstRow({ i, field: "dueDate", label: "Due Date" })}
            {InstRow({ i, field: "amount", label: "Amount", type: "number" })}
            {InstRow({ i, field: "status", label: "Status", type: "select", options: INST_STATUS })}
          </div>
        ))}
        {Row({ label: "Additional", field: "additional" })}
        {Row({
          label: "Total Installment Amount",
          field: "totalInstallment",
          type: "number",
          highlight: true,
        })}
        {Row({
          label: "Discrepancy in Cost",
          field: "discrepancy",
          type: "select",
          options: DISCREPANCY_OPTS,
        })}
        {Row({ label: "Payment Reminder", field: "paymentReminder" })}
      </div>

      <SectionHeader label="Urgent — Payment Release" className="bg-rose-50" />
      <div className="px-4 py-3 border-b border-slate-100">
        {Row({ label: "Free Cancellation Date", field: "freeCancellationDate" })}
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {remark ?? "No release action needed — payment fully collected"}
        </div>
      </div>

      <SectionHeader label="Vouchers & Status" className="bg-teal-50" />
      <div>
        {Row({
          label: "Flight Voucher",
          field: "flightVoucher",
          type: "select",
          options: VOUCHER_OPTS,
        })}
        {Row({
          label: "Hotel Voucher",
          field: "hotelVoucher",
          type: "select",
          options: VOUCHER_OPTS,
        })}
        {Row({
          label: "Land Voucher",
          field: "landVoucher",
          type: "select",
          options: VOUCHER_OPTS,
        })}
        {Row({
          label: "Visa Voucher",
          field: "visaVoucher",
          type: "select",
          options: VOUCHER_OPTS,
        })}
        {Row({
          label: "Final Voucher",
          field: "finalVoucher",
          type: "select",
          options: VOUCHER_OPTS,
        })}
        {Row({ label: "Voucher Pending", field: "voucherPending" })}
        {Row({ label: "Trip Status", field: "tripStatus" })}
        {Row({ label: "Pre Trip", field: "preTrip" })}
      </div>
    </div>
  );
}
