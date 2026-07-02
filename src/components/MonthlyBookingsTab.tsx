import { useMemo, useState, useEffect } from "react";
import { type Booking, daysUntil, inr } from "@/lib/sheet.functions";
import { Calendar, DollarSign, CreditCard, Users, CheckCircle2, User } from "lucide-react";

export function MonthlyBookingsTab({
  bookings,
  isLoading,
  onSelectBooking,
}: {
  bookings: Booking[];
  isLoading: boolean;
  onSelectBooking: (booking: Booking) => void;
}) {
  // Extract all unique month-year keys dynamically from the bookings createdDate
  const monthsList = useMemo(() => {
    const monthsMap: Record<string, { label: string; year: number; month: number }> = {};
    
    for (const b of bookings) {
      const dateToUse = b.createdDate || b.travelDate;
      if (!dateToUse) continue;
      const d = new Date(dateToUse);
      if (isNaN(d.getTime())) continue;
      
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthsMap[key]) {
        monthsMap[key] = {
          label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          year: d.getFullYear(),
          month: d.getMonth(),
        };
      }
    }
    
    return Object.entries(monthsMap)
      .map(([key, info]) => ({ key, ...info }))
      .sort((a, b) => a.key.localeCompare(b.key)); // Chronological order
  }, [bookings]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  // Default selection to the current month or the first month with data
  useEffect(() => {
    if (monthsList.length > 0 && !selectedMonthKey) {
      const today = new Date();
      const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const hasCurrent = monthsList.some((m) => m.key === currentKey);
      if (hasCurrent) {
        setSelectedMonthKey(currentKey);
      } else {
        setSelectedMonthKey(monthsList[0].key);
      }
    }
  }, [monthsList, selectedMonthKey]);

  // Filter bookings for the selected month (by creation date)
  const monthlyBookings = useMemo(() => {
    if (!selectedMonthKey) return [];
    return bookings
      .filter((b) => {
        const dateToUse = b.createdDate || b.travelDate;
        if (!dateToUse) return false;
        const d = new Date(dateToUse);
        if (isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === selectedMonthKey;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdDate || a.travelDate).getTime();
        const dateB = new Date(b.createdDate || b.travelDate).getTime();
        return dateA - dateB;
      });
  }, [bookings, selectedMonthKey]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalSales = 0;
    let totalPending = 0;
    let activeCount = 0;
    let droppedCount = 0;

    for (const b of monthlyBookings) {
      totalSales += b.totalSp ?? 0;
      totalPending += b.pendingAmount ?? 0;
      if (b.tripStatus?.toLowerCase().includes("dropped")) {
        droppedCount++;
      } else {
        activeCount++;
      }
    }

    return {
      totalSales,
      totalPending,
      activeCount,
      droppedCount,
    };
  }, [monthlyBookings]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading monthly workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Dropdown Selection Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Monthly Bookings Workspace</h2>
            <p className="text-xs text-slate-500">View and track all bookings created in a particular month.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Month:</span>
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-orange-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200 shadow-sm cursor-pointer min-w-[160px]"
          >
            {monthsList.length === 0 ? (
              <option value="">No Bookings Found</option>
            ) : (
              monthsList.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      {selectedMonthKey && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" /> Bookings
            </div>
            <div className="mt-2 text-2xl font-black text-slate-800">
              {monthlyBookings.length} <span className="text-xs font-normal text-slate-400">Total</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {stats.activeCount} Active / {stats.droppedCount} Dropped
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Total Sales (SP)
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600">
              {inr(stats.totalSales)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Gross collection targets
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5 text-rose-500" /> Total Pending
            </div>
            <div className={`mt-2 text-2xl font-black ${stats.totalPending > 0 ? "text-rose-600" : "text-slate-500"}`}>
              {inr(stats.totalPending)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Outstanding payments
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" /> Fully Collected
            </div>
            <div className="mt-2 text-2xl font-black text-orange-600">
              {monthlyBookings.filter((b) => (b.paymentCollected?.toLowerCase() ?? "") === "yes" || b.pendingAmount <= 0).length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Bookings paid in full
            </div>
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <table className="min-w-[1500px] w-full text-xs">
          <thead className="bg-[#141b2b] text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3.5">PN</th>
              <th className="px-4 py-3.5">Lead Pax</th>
              <th className="px-4 py-3.5">Destination</th>
              <th className="px-4 py-3.5">Travel Date</th>
              <th className="px-4 py-3.5">Pax (A/C/I)</th>
              <th className="px-4 py-3.5">Seller</th>
              <th className="px-4 py-3.5">Ops RM</th>
              <th className="px-4 py-3.5">Total SP</th>
              <th className="px-4 py-3.5">Payment</th>
              <th className="px-4 py-3.5">Pending Amount</th>
              <th className="px-4 py-3.5">Final Voucher</th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthlyBookings.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-slate-400 font-medium">
                  No bookings found for the selected month.
                </td>
              </tr>
            ) : (
              monthlyBookings.map((b) => {
                const isFullyPaid = (b.paymentCollected?.toLowerCase() ?? "") === "yes" || b.pendingAmount <= 0;
                const isDropped = b.tripStatus?.toLowerCase().includes("dropped");
                const travelDays = daysUntil(b.travelDate);
                
                return (
                  <tr key={b.pn} className={`hover:bg-slate-50/50 transition-colors ${isDropped ? "bg-red-50/20" : ""}`}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      <button
                        onClick={() => onSelectBooking(b)}
                        className="font-semibold text-orange-700 hover:text-orange-900 hover:underline cursor-pointer"
                      >
                        {b.pn}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{b.leadPax || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 border border-slate-200">
                        {b.destination || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {b.travelDate}
                      {travelDays !== null && (
                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          travelDays <= 3
                            ? "bg-red-50 text-red-600 border border-red-100"
                            : travelDays <= 7
                            ? "bg-orange-50 text-orange-600 border border-orange-100"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          T-{travelDays}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {b.adult ?? 0}/{b.child ?? 0}/{b.infant ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{b.seller || "—"}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {b.opsRm || "Unassigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{inr(b.totalSp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          isFullyPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isFullyPaid ? "Collected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      {b.pendingAmount > 0 ? inr(b.pendingAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          b.finalVoucher?.toLowerCase() === "shared"
                            ? "bg-orange-50 text-orange-700 border-orange-100"
                            : b.finalVoucher?.toLowerCase() === "not applicable"
                            ? "bg-slate-100 text-slate-500 border-slate-300"
                            : "bg-slate-50 text-slate-400 border-slate-150"
                        }`}
                      >
                        {b.finalVoucher || "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          isDropped
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        {b.tripStatus || "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
