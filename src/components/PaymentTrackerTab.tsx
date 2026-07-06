import { useMemo, useState, useCallback } from "react";
import { type Booking, daysUntil, inr } from "@/lib/sheet.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle, Calendar, ShieldAlert, DollarSign, X, MessageSquare, Save } from "lucide-react";

// ─── PN Comment Helpers (localStorage-based) ──────────────────────────────────
const COMMENT_KEY = "pn_installment_comments";

function loadComments(): Record<string, { text: string; savedAt: string }> {
  try {
    const raw = localStorage.getItem(COMMENT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveComment(pn: string, text: string) {
  const all = loadComments();
  all[pn] = { text, savedAt: new Date().toISOString() };
  localStorage.setItem(COMMENT_KEY, JSON.stringify(all));
}

function deleteComment(pn: string) {
  const all = loadComments();
  delete all[pn];
  localStorage.setItem(COMMENT_KEY, JSON.stringify(all));
}

/**
 * Simple payment tracker focused on actionable bookings.
 * Features:
 *  - Quick filters for travel, free cancellation, and installment due dates.
 *  - Clean table showing essential columns.
 */
export function PaymentTrackerTab({ bookings, isLoading, onSelectBooking }: { bookings: Booking[]; isLoading: boolean; onSelectBooking?: (booking: Booking, mode: "payment") => void }) {
  const [quickFilter, setQuickFilter] = useState<string>("");
  const [activeModal, setActiveModal] = useState<"dot-30-pending" | "foc-7-pending" | "foc-5-pending" | "foc-3-pending" | "inst2-due-pending" | "inst3-due-pending" | null>(null);

  // ── Comment state ──
  const [allComments, setAllComments] = useState<Record<string, { text: string; savedAt: string }>>(() => loadComments());
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const toggleComment = useCallback((pn: string) => {
    setExpandedComments((prev) => ({ ...prev, [pn]: !prev[pn] }));
    // Pre-fill draft with existing comment
    setDraftComments((prev) => ({
      ...prev,
      [pn]: prev[pn] ?? (loadComments()[pn]?.text || ""),
    }));
  }, []);

  const handleSaveComment = useCallback((pn: string) => {
    const text = draftComments[pn] ?? "";
    if (text.trim()) {
      saveComment(pn, text.trim());
    } else {
      deleteComment(pn);
    }
    const updated = loadComments();
    setAllComments({ ...updated });
  }, [draftComments]);

  const handleClearComment = useCallback((pn: string) => {
    deleteComment(pn);
    setAllComments((prev) => { const n = { ...prev }; delete n[pn]; return n; });
    setDraftComments((prev) => ({ ...prev, [pn]: "" }));
  }, []);

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

  // Bookings for the inspect modal
  const modalBookings = useMemo(() => {
    if (!activeModal) return [];
    const rawModal = activeBookings.filter((b) => {
      const td = daysUntil(b.travelDate);
      const fc = daysUntil(b.freeCancellationDate);
      const i2 = daysUntil(b.installment2Date);
      const i3 = daysUntil(b.installment3Date);
      const notPaid = b.paymentCollected?.toLowerCase() !== "yes";
      const i2NotRec = b.installment2Status?.toLowerCase() !== "received";
      const i3NotRec = b.installment3Status?.toLowerCase() !== "received";
      switch (activeModal) {
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
    return rawModal;
  }, [activeBookings, activeModal]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading payments...</p>
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
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Payments Action Workspace</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Focus on bookings that require immediate payment actions and milestone collections.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Current Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* KPI Cards (Clickable) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Travel ≤ 30 Days */}
        <div
          onClick={() => setActiveModal("dot-30-pending")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/55 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Travel ≤ 30 Days</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{dot30Count}</div>
        </div>
        
        {/* Card 2: FOC ≤ 7 Days */}
        <div
          onClick={() => setActiveModal("foc-7-pending")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/55 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">FOC ≤ 7 Days</div>
          <div className="mt-2 text-2xl font-bold text-red-600">{foc7Count}</div>
        </div>

        {/* Card 3: FOC ≤ 5 Days */}
        <div
          onClick={() => setActiveModal("foc-5-pending")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/55 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">FOC ≤ 5 Days</div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{foc5Count}</div>
        </div>

        {/* Card 4: FOC ≤ 3 Days */}
        <div
          onClick={() => setActiveModal("foc-3-pending")}
          className="rounded-xl border border-red-100 bg-red-50/50 p-4 shadow-sm cursor-pointer hover:bg-red-100/50 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-red-600 font-bold">FOC ≤ 3 Days</div>
          <div className="mt-2 text-2xl font-bold text-red-700">{foc3Count}</div>
        </div>

        {/* Card 5: Inst 2 Due */}
        <div
          onClick={() => setActiveModal("inst2-due-pending")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/55 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Inst 2 Due</div>
          <div className="mt-2 text-2xl font-bold text-slate-600">{inst2Count}</div>
        </div>

        {/* Card 6: Inst 3 Due */}
        <div
          onClick={() => setActiveModal("inst3-due-pending")}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/55 hover:shadow-md transition-all duration-150"
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Inst 3 Due</div>
          <div className="mt-2 text-2xl font-bold text-slate-700">{inst3Count}</div>
        </div>
      </div>

      {/* Quick Filters control bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">Quick Filters:</span>
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
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer active:scale-95 duration-200 ${
                quickFilter === item.id
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
              {item.count > 0 && (
                <span
                  className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    item.id === "dot-30-pending"
                      ? "bg-amber-100 text-amber-800"
                      : item.id.startsWith("foc-")
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
          {quickFilter && (
            <button
              onClick={() => setQuickFilter("")}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 ml-1.5 px-2 py-1 rounded hover:bg-rose-50"
            >
              Clear filter <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Actionable Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <table className="min-w-[1200px] w-full text-xs">
          <thead className="bg-[#141b2b] text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Lead Name</th>
              <th className="px-4 py-3">PN</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Travel Date</th>
              <th className="px-4 py-3">FOC Date</th>
              <th className="px-4 py-3">Inst 2 Date</th>
              <th className="px-4 py-3">Inst 3 Date</th>
              <th className="px-4 py-3 font-semibold">Pending Amount</th>
              <th className="px-4 py-3">Assigned RM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No matching bookings require immediate payment actions.
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => (
                <tr key={b.pn} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{b.leadPax || "—"}</td>
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={() => onSelectBooking?.(b, "payment")}
                      className="font-medium text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
                    >
                      {b.pn}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      {b.destination || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {b.travelDate || "—"}
                    {daysUntil(b.travelDate) !== null && (
                      <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                        T-{daysUntil(b.travelDate)}d
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {b.freeCancellationDate || "—"}
                    {daysUntil(b.freeCancellationDate) !== null && (
                      <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        daysUntil(b.freeCancellationDate)! <= 3 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                      }`}>
                        {daysUntil(b.freeCancellationDate)! <= 0 ? "Expired" : `${daysUntil(b.freeCancellationDate)}d`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-slate-700">{b.installment2Date || "—"}</span>
                      <span className="text-[10px] text-slate-400">{b.installment2Status || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-slate-700">{b.installment3Date || "—"}</span>
                      <span className="text-[10px] text-slate-400">{b.installment3Status || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{inr(b.pendingAmount)}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">{b.opsRm || "Unassigned"}</td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {/* INSPECT DIALOG MODALS */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-3 mb-2">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {activeModal === "dot-30-pending" && (
                <>
                  <Calendar className="h-5 w-5 text-amber-600" />
                  <span>Pending Payments - Travel ≤ 30 Days</span>
                  <span className="ml-2 text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "foc-7-pending" && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span>Free Cancellation (FOC) ≤ 7 Days</span>
                  <span className="ml-2 text-xs font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "foc-5-pending" && (
                <>
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                  <span>Free Cancellation (FOC) ≤ 5 Days</span>
                  <span className="ml-2 text-xs font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "foc-3-pending" && (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-700 animate-pulse" />
                  <span>CRITICAL: Free Cancellation (FOC) ≤ 3 Days</span>
                  <span className="ml-2 text-xs font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "inst2-due-pending" && (
                <>
                  <DollarSign className="h-5 w-5 text-slate-600" />
                  <span>Installment 2 Overdue/Pending</span>
                  <span className="ml-2 text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
              {activeModal === "inst3-due-pending" && (
                <>
                  <DollarSign className="h-5 w-5 text-slate-700" />
                  <span>Installment 3 Overdue/Pending</span>
                  <span className="ml-2 text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    {modalBookings.length} Bookings
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Modal Content Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">PN Number</th>
                  <th className="px-3 py-2.5">Lead Name</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5">Travel Date</th>
                  <th className="px-3 py-2.5">FOC Date</th>
                  <th className="px-3 py-2.5">Inst 2 Date / Status</th>
                  <th className="px-3 py-2.5">Inst 3 Date / Status</th>
                  <th className="px-3 py-2.5">Pending Amount</th>
                  <th className="px-3 py-2.5">Assigned RM</th>
                  <th className="px-3 py-2.5 min-w-[180px]">Comments / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modalBookings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                      No matching pending payments.
                    </td>
                  </tr>
                ) : (
                  modalBookings.map((b) => {
                    const existing = allComments[b.pn];
                    const isOpen = expandedComments[b.pn] ?? false;
                    const draft = draftComments[b.pn] ?? (existing?.text || "");
                    const hasSaved = !!existing?.text;

                    return (
                      <tr key={b.pn} className={`hover:bg-slate-50/50 align-top ${isOpen ? "bg-amber-50/20" : ""}`}>
                        <td className="px-3 py-2.5 font-semibold">
                          <button
                            onClick={() => {
                              setActiveModal(null);
                              onSelectBooking?.(b, "payment");
                            }}
                            className="font-semibold text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
                          >
                            {b.pn}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{b.leadPax || "—"}</td>
                        <td className="px-3 py-2.5">{b.destination || "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {b.travelDate || "—"}
                          {daysUntil(b.travelDate) !== null && (
                            <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                              T-{daysUntil(b.travelDate)}d
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {b.freeCancellationDate || "—"}
                          {daysUntil(b.freeCancellationDate) !== null && (
                            <span className={`ml-1.5 text-[9px] font-bold px-1 py-0.2 rounded ${
                              daysUntil(b.freeCancellationDate)! <= 3 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                            }`}>
                              {daysUntil(b.freeCancellationDate)! <= 0 ? "Expired" : `${daysUntil(b.freeCancellationDate)}d`}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span>{b.installment2Date || "—"}</span>
                            <span className="text-[10px] text-slate-400">{b.installment2Status || "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span>{b.installment3Date || "—"}</span>
                            <span className="text-[10px] text-slate-400">{b.installment3Status || "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">{inr(b.pendingAmount)}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium">{b.opsRm || "Unassigned"}</td>

                        {/* ── Comment Cell ── */}
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <div className="flex flex-col gap-1.5">
                            {/* Toggle button */}
                            <button
                              onClick={() => toggleComment(b.pn)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border transition-all duration-150 cursor-pointer ${
                                hasSaved
                                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              <MessageSquare className="h-3 w-3" />
                              {hasSaved ? (isOpen ? "Hide note" : "View/Edit note") : (isOpen ? "Cancel" : "Add note")}
                            </button>

                            {/* Collapsed preview */}
                            {!isOpen && hasSaved && (
                              <p className="text-[10px] text-slate-500 italic leading-snug line-clamp-2">
                                {existing.text}
                              </p>
                            )}

                            {/* Expanded editor */}
                            {isOpen && (
                              <div className="flex flex-col gap-1.5 mt-0.5">
                                <textarea
                                  rows={3}
                                  value={draft}
                                  onChange={(e) =>
                                    setDraftComments((prev) => ({ ...prev, [b.pn]: e.target.value }))
                                  }
                                  placeholder="Type a reason or note for this PN..."
                                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 placeholder-slate-300 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 resize-none transition-all duration-150"
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => { handleSaveComment(b.pn); setExpandedComments((p) => ({ ...p, [b.pn]: false })); }}
                                    className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-orange-600 transition cursor-pointer"
                                  >
                                    <Save className="h-3 w-3" /> Save
                                  </button>
                                  {hasSaved && (
                                    <button
                                      onClick={() => handleClearComment(b.pn)}
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
                                    >
                                      <X className="h-3 w-3" /> Clear
                                    </button>
                                  )}
                                </div>
                                {existing?.savedAt && (
                                  <span className="text-[9px] text-slate-400">
                                    Last saved: {new Date(existing.savedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}