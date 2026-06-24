import { useMemo, useState, useEffect, useRef } from "react";
import { type Booking, inr } from "@/lib/sheet.functions";
import { Calendar, AlertCircle, DollarSign, Edit, User, MapPin, Tag, RefreshCw } from "lucide-react";

interface DailyReportTabProps {
  bookings: Booking[];
  isLoading: boolean;
  onSelectBooking?: (booking: Booking, mode: "all") => void;
  onUpdateComment?: (pn: string, newComment: string) => Promise<void>;
}

// Inline Comment Editor Sub-component
function InlineCommentInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (val: string) => void;
}) {
  const [val, setVal] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVal(value);
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (val.trim() !== value.trim()) {
      onSave(val.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setVal(value);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className={`cursor-pointer px-1 py-0.5 rounded border border-dashed border-transparent hover:border-slate-300 hover:bg-white hover:shadow-xs transition-all duration-150 inline-block min-w-[100px] ${
          value ? "text-slate-700 italic font-normal" : "text-slate-400 italic font-light hover:text-slate-600"
        }`}
        title="Click to write/edit comment"
      >
        {value || "No comments"}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      className="h-6 w-56 px-2 py-0.5 text-xs text-slate-800 bg-white border border-orange-400 rounded outline-none ring-1 ring-orange-400 shadow-sm"
      placeholder="Type comment and press Enter..."
    />
  );
}

export function DailyReportTab({ bookings, isLoading, onSelectBooking, onUpdateComment }: DailyReportTabProps) {
  // 1. Generate the list of dates from yesterday (-1 offset) to today + 30 days (offset 30)
  const dateList = useMemo(() => {
    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = -1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push({
        date: d,
        daysOffset: i,
        // format like "23-Jun" to match screenshot
        label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }).replace(" ", "-"),
        fullLabel: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
      });
    }
    return list;
  }, []);

  // 2. Parse booking travel dates and map bookings to each offset day
  const dailyReportData = useMemo(() => {
    const allDays = dateList.map((dateItem) => {
      // Find all bookings traveling on this date
      const dateBookings = bookings.filter((b) => {
        if (!b.travelDate) return false;
        
        // Exclude dropped bookings from daily report
        if (b.tripStatus && b.tripStatus.toLowerCase().includes("dropped")) {
          return false;
        }

        const tDate = new Date(b.travelDate);
        if (isNaN(tDate.getTime())) return false;
        
        const compareDate = new Date(dateItem.date);
        compareDate.setHours(0, 0, 0, 0);
        tDate.setHours(0, 0, 0, 0);

        return tDate.getTime() === compareDate.getTime();
      });

      // Filter bookings for display:
      // Show ONLY those rows on which final payment is not collected
      const displayBookings = dateBookings.filter((b) => {
        const isCollected = (b.paymentCollected?.toLowerCase() ?? "") === "yes" || b.pendingAmount <= 0;
        return !isCollected;
      });

      // Sum of pending final amount for this date
      const sumPending = displayBookings.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);

      return {
        ...dateItem,
        bookings: displayBookings,
        sumPending,
      };
    });

    // Exclude dates that have no pending/actionable bookings
    return allDays.filter((day) => day.bookings.length > 0);
  }, [dateList, bookings]);

  // 3. Overall Stats Summary for the Cards
  const stats = useMemo(() => {
    let totalPending = 0;
    let totalActionable = 0;

    dailyReportData.forEach((day) => {
      totalPending += day.sumPending;
      totalActionable += day.bookings.length;
    });

    return {
      totalPending,
      totalActionable,
    };
  }, [dailyReportData]);

  // Helper to format FOC Date as D MMM
  const formatFocDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500 mb-3" />
        <p className="text-sm font-medium">Generating Daily Travel & Payment Report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">SUM of Pending Final Amount</span>
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight">
            {inr(stats.totalPending)}
          </div>
          <div className="mt-1 text-xs opacity-80">
            Across next 30 days of upcoming travel dates (excluding fully collected)
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-5 text-white shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">Total Actionable Bookings</span>
            <Calendar className="h-5 w-5 text-orange-400" />
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight">
            {stats.totalActionable}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Bookings traveling in next 30 days with pending collections
          </div>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#141b2b] text-[10px] font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3.5 w-32 border-r border-slate-800">Date of Travel - Day-Month</th>
              <th className="px-4 py-3.5 w-48 border-r border-slate-800 text-right">SUM of Pending Final Amount</th>
              <th className="px-6 py-3.5">Actionable Bookings (PN || FOC || Comment)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dailyReportData.map((day) => {
              const isToday = day.daysOffset === 0;
              const hasBookings = day.bookings.length > 0;
              
              return (
                <tr 
                  key={day.label} 
                  className={`hover:bg-slate-50/50 transition-colors ${
                    isToday ? "bg-orange-50/20 font-medium" : ""
                  }`}
                >
                  {/* Date Column */}
                  <td className="px-4 py-3 border-r border-slate-100 font-medium text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>{day.label}</span>
                      {isToday && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Sum Pending Column */}
                  <td className="px-4 py-3 border-r border-slate-100 text-right font-semibold text-slate-800">
                    {day.sumPending > 0 ? (
                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50">
                        {inr(day.sumPending)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">0</span>
                    )}
                  </td>

                  {/* Bookings Concatenated Details Column */}
                  <td className="px-6 py-2.5">
                    {hasBookings ? (
                      <div className="space-y-2">
                        {day.bookings.map((b) => {
                          const focDate = formatFocDate(b.freeCancellationDate);
                          const comment = b.dailyUpdates || "";
                          
                          return (
                            <div 
                              key={b.pn} 
                              className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-orange-200 hover:shadow-sm transition-all duration-200"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="font-mono font-semibold text-slate-900 shrink-0 select-all">
                                  {b.pn}
                                </span>
                                <span className="text-slate-300 shrink-0">|</span>
                                <div className="text-slate-600 flex items-center gap-1.5 flex-wrap">
                                  {focDate && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold mr-1 border border-slate-200/50">
                                      FOC: {focDate}
                                    </span>
                                  )}
                                  
                                  {/* Inline editable comment */}
                                  <InlineCommentInput 
                                    value={comment} 
                                    onSave={(newVal) => onUpdateComment && onUpdateComment(b.pn, newVal)}
                                  />

                                  <span className="ml-1 font-medium text-slate-800">
                                    ({b.leadPax || "No Lead Pax"})
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {/* Extra info badges */}
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{b.destination}</span>
                                </div>
                                
                                <span className="text-slate-300">|</span>

                                <div className="text-right font-semibold text-slate-700">
                                  {inr(b.pendingAmount)}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onSelectBooking && onSelectBooking(b, "all")}
                                  className="p-1 rounded-md text-slate-400 hover:text-orange-500 hover:bg-orange-50 cursor-pointer transition-colors duration-150"
                                  title="Open details modal"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-300 italic font-light">No pending bookings</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr className="font-bold text-slate-800">
              <td className="px-4 py-3.5 border-r border-slate-200">Grand Total</td>
              <td className="px-4 py-3.5 border-r border-slate-200 text-right text-sm text-orange-600">
                {inr(stats.totalPending)}
              </td>
              <td className="px-6 py-3.5 text-slate-500 text-[10px]">
                Report matches bookings traveling in next 30 days with pending balance
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
