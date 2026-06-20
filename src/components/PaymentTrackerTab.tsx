import { useMemo, useState } from "react";
import { type Booking, daysUntil, inr } from "@/lib/sheet.functions";

/**
 * Simple payment tracker focused on actionable bookings.
 * Features:
 *  - Quick filters for travel, free cancellation, and installment due dates.
 *  - Clean table showing essential columns.
 */
export function PaymentTrackerTab({ bookings, isLoading }: { bookings: Booking[]; isLoading: boolean }) {
  const [quickFilter, setQuickFilter] = useState<string>("");

  // Filter bookings for the payment tracker dashboard:
  // - Exclude dropped bookings
  // - Keep only bookings with travel date (DOT) after tomorrow
  // - Exclude bookings whose installments are all received or not applicable
  const activeBookings = useMemo(() => {
    const isSettled = (s: string | undefined | null) => {
      const lower = s?.trim().toLowerCase();
      return lower === "received" || lower === "not applicable";
    };

    return bookings.filter((b) => {
      if (b.tripStatus && b.tripStatus.toLowerCase().includes("dropped")) {
        return false;
      }

      const travelDays = daysUntil(b.travelDate);
      if (travelDays === null || travelDays <= 1) {
        return false;
      }

      const inst2Settled = isSettled(b.installment2Status);
      const inst3Settled = isSettled(b.installment3Status);

      // If the relevant installments are settled, it shouldn't show
      if (inst2Settled && inst3Settled) {
        return false;
      }

      // If DOT is > 30 days, we only show it if an action is pending
      if (travelDays > 30) {
        const i2Days = daysUntil(b.installment2Date);
        const i3Days = daysUntil(b.installment3Date);
        const focDays = daysUntil(b.freeCancellationDate);

        const i2Due = i2Days !== null && i2Days <= 0 && !inst2Settled;
        const i3Due = i3Days !== null && i3Days <= 0 && !inst3Settled;
        const focDue = focDays !== null && focDays <= 7 && b.paymentCollected?.toLowerCase() !== "yes";

        if (!i2Due && !i3Due && !focDue) {
          return false;
        }
      }

      return true;
    });
  }, [bookings]);

  // Helper to count bookings for each filter (optional badge UI)
  const dot30Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.travelDate) !== null && daysUntil(b.travelDate)! <= 30 && b.paymentCollected?.toLowerCase() !== "yes").length,
    [activeBookings]
  );
  const foc7Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.freeCancellationDate) !== null && daysUntil(b.freeCancellationDate)! <= 7 && b.paymentCollected?.toLowerCase() !== "yes").length,
    [activeBookings]
  );
  const foc5Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.freeCancellationDate) !== null && daysUntil(b.freeCancellationDate)! <= 5 && b.paymentCollected?.toLowerCase() !== "yes").length,
    [activeBookings]
  );
  const foc3Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.freeCancellationDate) !== null && daysUntil(b.freeCancellationDate)! <= 3 && b.paymentCollected?.toLowerCase() !== "yes").length,
    [activeBookings]
  );
  const inst2Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.installment2Date) !== null && daysUntil(b.installment2Date)! <= 0 && b.installment2Status?.toLowerCase() !== "received").length,
    [activeBookings]
  );
  const inst3Count = useMemo(
    () => activeBookings.filter((b) => daysUntil(b.installment3Date) !== null && daysUntil(b.installment3Date)! <= 0 && b.installment3Status?.toLowerCase() !== "received").length,
    [activeBookings]
  );

  // Filtered bookings based on selected quick filter
  const filteredBookings = useMemo(() => {
    if (!quickFilter) return activeBookings;
    const filtered = activeBookings.filter((b) => {
      const td = daysUntil(b.travelDate);
      const fc = daysUntil(b.freeCancellationDate);
      const i2 = daysUntil(b.installment2Date);
      const i3 = daysUntil(b.installment3Date);
      const notPaid = b.paymentCollected?.toLowerCase() !== "yes";
      const i2NotRec = b.installment2Status?.toLowerCase() !== "received";
      const i3NotRec = b.installment3Status?.toLowerCase() !== "received";
      switch (quickFilter) {
        case "dot-30-pending":
          return td !== null && td <= 30 && notPaid;
        case "foc-7-pending":
          return fc !== null && fc <= 7 && notPaid;
        case "foc-5-pending":
          return fc !== null && fc <= 5 && notPaid;
        case "foc-3-pending":
          return fc !== null && fc <= 3 && notPaid;
        case "inst2-due-pending":
          return i2 !== null && i2 <= 0 && i2NotRec;
        case "inst3-due-pending":
          return i3 !== null && i3 <= 0 && i3NotRec;
        default:
          return true;
      }
    });

    // Sort by earliest Free Cancellation, then earliest Travel Date, then highest pending amount
    const sorted = filtered.slice().sort((a, b) => {
      const fcA = daysUntil(a.freeCancellationDate) ?? Infinity;
      const fcB = daysUntil(b.freeCancellationDate) ?? Infinity;
      if (fcA !== fcB) return fcA - fcB;
      const tdA = daysUntil(a.travelDate) ?? Infinity;
      const tdB = daysUntil(b.travelDate) ?? Infinity;
      if (tdA !== tdB) return tdA - tdB;
      return (b.pendingAmount ?? 0) - (a.pendingAmount ?? 0);
    });
    return sorted;
  }, [activeBookings, quickFilter]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-md">
        <h2 className="text-xl font-bold">Payments Action Center</h2>
        <p className="text-sm text-slate-300">Focus on bookings that require immediate payment actions.</p>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "dot-30-pending", label: "Travel ≤30 Days", count: dot30Count },
          { id: "foc-7-pending", label: "FOC ≤7 Days", count: foc7Count },
          { id: "foc-5-pending", label: "FOC ≤5 Days", count: foc5Count },
          { id: "foc-3-pending", label: "FOC ≤3 Days", count: foc3Count },
          { id: "inst2-due-pending", label: "Inst 2 Due", count: inst2Count },
          { id: "inst3-due-pending", label: "Inst 3 Due", count: inst3Count },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setQuickFilter(quickFilter === item.id ? "" : item.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${quickFilter === item.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
          >
            {item.label}
            {item.count > 0 && (
                <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.id === 'dot-30-pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' : item.id.startsWith('foc-') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}
                  >
                  {item.count}
                </span>
              )}
          </button>
        ))}
        {(quickFilter && (
          <button onClick={() => setQuickFilter("")} className="text-xs font-bold text-rose-600 hover:underline ml-2">
            Clear filter
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400 font-bold">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-3.5">Lead Name</th>
              <th className="px-5 py-3.5">PN</th>
              <th className="px-5 py-3.5">Destination</th>
              <th className="px-5 py-3.5">Travel Date</th>
              <th className="px-5 py-3.5">FOC Date</th>
              <th className="px-5 py-3.5">Inst 2 Date</th>
              <th className="px-5 py-3.5">Inst 3 Date</th>
              <th className="px-5 py-3.5">Pending Amount</th>
              <th className="px-5 py-3.5">Assigned RM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.map((b) => (
              <tr key={b.pn} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-800">{b.leadPax || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{b.pn}</td>
                <td className="px-5 py-3">{b.destination || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{b.travelDate || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{b.freeCancellationDate || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{b.installment2Date || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{b.installment3Date || "—"}</td>
                <td className="px-5 py-3 font-bold text-slate-900">{inr(b.pendingAmount)}</td>
                <td className="px-5 py-3 text-slate-600">{b.opsRm || "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}