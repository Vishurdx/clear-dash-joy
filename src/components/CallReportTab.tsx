import { useMemo, useState } from "react";
import { type Booking } from "@/lib/sheet.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  CheckSquare,
  Square
} from "lucide-react";

// Safe date parsing helper
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Compare if a date is on or after July 3, 2026
function isCreatedOnOrAfterJuly3_2026(createdDateStr: string | undefined): boolean {
  const createdDate = parseDate(createdDateStr);
  if (!createdDate) return false;
  
  createdDate.setHours(0, 0, 0, 0);
  const boundary = new Date(2026, 6, 3); // July 3, 2026
  boundary.setHours(0, 0, 0, 0);
  
  return createdDate.getTime() >= boundary.getTime();
}

export function CallReportTab({
  bookings,
  isLoading,
  onToggleCallStatus,
}: {
  bookings: Booking[];
  isLoading: boolean;
  onToggleCallStatus: (booking: Booking, taskNumber: number, completed: boolean) => void;
}) {
  // 1. Filter bookings: only created on or after July 3, 2026, and exclude dropped ones
  const activeBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        isCreatedOnOrAfterJuly3_2026(b.createdDate) &&
        (!b.tripStatus || !b.tripStatus.toLowerCase().includes("dropped"))
    );
  }, [bookings]);

  // Destination filter unique values
  const destinations = useMemo(() => {
    return [...new Set(activeBookings.map((b) => b.destination).filter(Boolean))].sort();
  }, [activeBookings]);

  const [selectedDest, setSelectedDest] = useState<string>("");
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<Booking | null>(null);

  // Define tasks for a single booking, reading status directly from parsed booking fields
  const getBookingTasks = (b: Booking) => {
    const createdDate = parseDate(b.createdDate);
    const travelDate = parseDate(b.travelDate);

    // Task 1: Naming Quality Check Call (Due: booking created date)
    const task1Date = createdDate ? new Date(createdDate.getTime()) : null;

    // Task 2: Hotel Confirmation & Installment Call (Due: created date + 20 days)
    let task2Date = null;
    if (createdDate) {
      task2Date = new Date(createdDate.getTime());
      task2Date.setDate(task2Date.getDate() + 20);
    }

    // Task 3: Final On-Trip Call (Due: travel date - 3 days)
    let task3Date = null;
    if (travelDate) {
      task3Date = new Date(travelDate.getTime());
      task3Date.setDate(task3Date.getDate() - 3);
    }

    return [
      {
        id: `${b.pn}_1`,
        number: 1,
        name: "Naming Quality Check Call",
        dueDate: task1Date,
        dueDateStr: task1Date ? task1Date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
        completed: b.firstCallStatus?.toLowerCase() === "done",
      },
      {
        id: `${b.pn}_2`,
        number: 2,
        name: "Hotel Confirmation & Installment Call",
        dueDate: task2Date,
        dueDateStr: task2Date ? task2Date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
        completed: b.postBookingCalls?.toLowerCase() === "done",
      },
      {
        id: `${b.pn}_3`,
        number: 3,
        name: "Final On-Trip Call",
        dueDate: task3Date,
        dueDateStr: task3Date ? task3Date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
        completed: b.preTrip?.toLowerCase() === "done",
      },
    ];
  };

  // Today reference at midnight
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Filtered by selected destination
  const filteredBookings = useMemo(() => {
    if (!selectedDest) return activeBookings;
    return activeBookings.filter((b) => b.destination === selectedDest);
  }, [activeBookings, selectedDest]);

  // Compute lists of pending and completed tasks grouped/mapped to bookings
  const taskGroups = useMemo(() => {
    const pendingList: Array<{ booking: Booking; dueTasks: Array<any> }> = [];
    const completedList: Array<{ booking: Booking; completedTasks: Array<any> }> = [];

    for (const b of filteredBookings) {
      const tasks = getBookingTasks(b);
      const bPending: typeof tasks = [];
      const bCompleted: typeof tasks = [];

      for (const t of tasks) {
        if (t.completed) {
          bCompleted.push(t);
        } else if (t.dueDate && t.dueDate.getTime() <= todayMidnight.getTime()) {
          // Overdue or due today
          bPending.push(t);
        }
      }

      if (bPending.length > 0) {
        pendingList.push({ booking: b, dueTasks: bPending });
      }
      if (bCompleted.length > 0) {
        completedList.push({ booking: b, completedTasks: bCompleted });
      }
    }

    return { pendingList, completedList };
  }, [filteredBookings, todayMidnight]);

  // Sync selected booking for modal from props on updates
  const activeSelectedBooking = useMemo(() => {
    if (!selectedBookingForModal) return null;
    return bookings.find(b => b.pn === selectedBookingForModal.pn) || selectedBookingForModal;
  }, [bookings, selectedBookingForModal]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="mt-2 text-sm text-slate-500">Loading call report workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
            <Phone className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Call Report Workspace</h2>
            <p className="text-xs text-slate-500">Manage required verification and confirmation calls for new bookings.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter Destination:
          </span>
          <select
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-orange-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200 shadow-sm cursor-pointer min-w-[160px]"
          >
            <option value="">All Destinations</option>
            {destinations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Pending Tasks */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4.5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="font-bold text-slate-900 text-sm">Pending Calls Due Today</h3>
            </div>
            <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-0.5 text-xs font-bold">
              {taskGroups.pendingList.reduce((acc, curr) => acc + curr.dueTasks.length, 0)} Calls
            </span>
          </div>

          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {taskGroups.pendingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white rounded-lg border border-slate-100 shadow-sm">
                <CheckCircle2 className="h-9 w-9 text-slate-300 mb-2" />
                <p className="text-xs font-medium">All caught up! No pending calls due today.</p>
              </div>
            ) : (
              taskGroups.pendingList.map(({ booking, dueTasks }) => (
                <div
                  key={booking.pn}
                  className="bg-white rounded-lg border border-slate-200/80 p-3.5 shadow-sm hover:shadow transition-shadow space-y-3"
                >
                  {/* Booking Info Card Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                    <div>
                      <button
                        onClick={() => setSelectedBookingForModal(booking)}
                        className="font-bold text-orange-700 hover:text-orange-950 hover:underline text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {booking.pn}
                      </button>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Created: {booking.createdDate || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">{booking.leadPax}</div>
                      <div className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {booking.destination}
                      </div>
                    </div>
                  </div>

                  {/* Tasks List for this Booking */}
                  <div className="space-y-2">
                    {dueTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-rose-50/20 border border-rose-100/50 rounded-md p-2 text-xs hover:bg-rose-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 flex-1 mr-3">
                          <button
                            onClick={() => onToggleCallStatus(booking, t.number, true)}
                            className="text-slate-400 hover:text-orange-600 cursor-pointer flex-shrink-0"
                          >
                            <Square className="h-4.5 w-4.5" />
                          </button>
                          <span className="font-semibold text-slate-800">{t.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap">
                          <Clock className="h-3 w-3" /> Due {t.dueDateStr}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Completed Tasks */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4.5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-slate-900 text-sm">Completed Calls Log</h3>
            </div>
            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold">
              {taskGroups.completedList.reduce((acc, curr) => acc + curr.completedTasks.length, 0)} Calls
            </span>
          </div>

          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {taskGroups.completedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white rounded-lg border border-slate-100 shadow-sm">
                <Clock className="h-9 w-9 text-slate-300 mb-2" />
                <p className="text-xs font-medium">No calls completed yet today.</p>
              </div>
            ) : (
              taskGroups.completedList.map(({ booking, completedTasks }) => (
                <div
                  key={booking.pn}
                  className="bg-white rounded-lg border border-slate-200/80 p-3.5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                    <div>
                      <button
                        onClick={() => setSelectedBookingForModal(booking)}
                        className="font-bold text-orange-700 hover:text-orange-950 hover:underline text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {booking.pn}
                      </button>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Created: {booking.createdDate || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">{booking.leadPax}</div>
                      <div className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {booking.destination}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {completedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-emerald-50/20 border border-emerald-100/50 rounded-md p-2 text-xs hover:bg-emerald-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 flex-1 mr-3">
                          <button
                            onClick={() => onToggleCallStatus(booking, t.number, false)}
                            className="text-emerald-600 hover:text-slate-400 cursor-pointer flex-shrink-0"
                          >
                            <CheckSquare className="h-4.5 w-4.5" />
                          </button>
                          <span className="font-medium text-slate-500 line-through">{t.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Clickable PN Task Breakdown Modal */}
      <Dialog
        open={activeSelectedBooking !== null}
        onOpenChange={(open) => !open && setSelectedBookingForModal(null)}
      >
        {activeSelectedBooking && (
          <DialogContent className="max-w-md">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Phone className="h-4.5 w-4.5 text-orange-600" />
                <span>PN Call Checklist — {activeSelectedBooking.pn}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Booking Context */}
              <div className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200/60 grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <span className="text-slate-400 block font-medium">Lead Pax</span>
                  <span className="font-bold text-slate-800">{activeSelectedBooking.leadPax}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Destination</span>
                  <span className="font-bold text-slate-800">{activeSelectedBooking.destination}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Booking Created</span>
                  <span className="font-bold text-slate-800">{activeSelectedBooking.createdDate || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Travel Date</span>
                  <span className="font-bold text-slate-800">{activeSelectedBooking.travelDate || "—"}</span>
                </div>
              </div>

              {/* Three Specific Tasks */}
              <div className="space-y-3.5">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Required Calls Process</div>
                
                {getBookingTasks(activeSelectedBooking).map((task) => {
                  const isChecked = task.completed;
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => onToggleCallStatus(activeSelectedBooking, task.number, !isChecked)}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer select-none transition-all duration-200 ${
                        isChecked
                          ? "bg-slate-50/50 border-slate-200 opacity-75"
                          : "bg-white border-slate-200 hover:border-orange-500/50 shadow-sm"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isChecked ? "text-slate-500 line-through" : "text-slate-800"}`}>
                            Task {task.number}: {task.number === 1 ? "Naming Quality Check" : task.number === 2 ? "Hotel Confirmation & Installment Call" : "Final On-Trip Call"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {task.number === 1 && "Perform name checks & welcome call."}
                          {task.number === 2 && "Double check hotel booking confirmation & remind of pending collection."}
                          {task.number === 3 && "Final call to coordinate on-trip handover briefings."}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Due Date:</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isChecked
                              ? "bg-slate-100 text-slate-500"
                              : task.dueDate && task.dueDate.getTime() <= todayMidnight.getTime()
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {task.dueDateStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
