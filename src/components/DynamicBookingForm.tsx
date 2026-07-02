import { useMemo, useState, useEffect } from "react";
import { type Booking, daysUntil } from "@/lib/sheet.functions";
import { HelpCircle, ChevronDown, ChevronUp, Check, Info, Lock } from "lucide-react";

interface DynamicBookingFormProps {
  headers: string[];
  uniqueValues: Record<string, string[]>;
  booking?: Booking;
  mode?: "all" | "payment" | "voucher";
  onSubmit: (booking: Booking, rowValues: string[]) => void;
  onCancel: () => void;
  onRemove?: (pn: string) => void;
}

// Field descriptions for tooltips
const FIELD_DESCRIPTIONS: Record<string, string> = {
  "Daily updates": "Current operations update status of the booking",
  "PN. Number": "Unique booking reference code starting with 'PN-'",
  "Query code": "Query Reference code from TravClan system",
  "Date of Travel": "Date when the customer begins their trip",
  "Free Cancellation Date": "Deadline date to cancel bookings without penalty (FOC)",
  "Adult": "Number of adult travelers (12+ years)",
  "Child": "Number of child travelers (2-11 years)",
  "Infant": "Number of infant travelers (<2 years)",
  "Booking created date": "Date when the booking was made",
  "Confirmed on (only date)": "Date when the booking was confirmed in system",
  "Lead pax name": "Full name of the lead passenger",
  "Destination": "Holiday destination country or city",
  "Final voucher": "Itinerary/Voucher status: Shared / Not Shared",
  "Matrics": "Automatic indicator of days remaining to travel",
  "Seller name \ndropdown ": "Sales RM who closed the booking",
  "Hotel voucher": "Voucher status for hotel bookings",
  "Visa voucher": "Voucher status for visa bookings",
  "Flight voucher": "Voucher status for flight bookings",
  "Voucher Pending": "List of vouchers still pending to be shared",
  "Flights SP": "Flight Selling Price in INR",
  "Hotel SP": "Hotel Selling Price in INR",
  "Land SP": "Land Package/DMC Selling Price in INR",
  "VISA SP": "Visa Processing Selling Price in INR",
  "Final ttv": "Total transaction value (Sum of Flights + Hotel + Land + Visa SP)",
  "Remarks for SP": "Specific comments related to selling price",
  "Net Cost (DMC)": "Net Cost Price of DMC/Land components",
  "Airfare + Visa Dmc Nett Cost": "Net Cost Price of Flights and Visas",
  "Total CP": "Total Cost Price (Net Cost DMC + Airfare & Visa Nett Cost)",
  "Remarks for CP": "Specific comments related to cost price",
  "Due date (Installment 1)": "Maturity date for installment 1",
  "Instalment 1": "Amount collected for installment 1",
  "Installment 1 status": "Collection status of installment 1",
  "Due date (Installment 2)": "Maturity date for installment 2",
  "Amount for Installment 2": "Amount expected/collected for installment 2",
  "Installment 2 status": "Collection status of installment 2",
  "Due date (Installment 3)": "Maturity date for installment 3",
  "Amount for Installment 3": "Amount expected/collected for installment 3",
  "Installment 3 status": "Collection status of installment 3",
  "Pending Final Amount": "Remaining balance to collect (Final TTV - Total Installments)",
  "Total installment amount": "Total sum of all installment amounts",
  "Discrepanncy in cost": "Comparison between Final TTV and total installments",
  "Final Payment Collected": "Indicates if full payment has been collected (Yes/No)",
  "Payment reminder": "Calculates remaining days or alerts if collection is urgent",
  "Arrival Pictures shared on whatsapp group": "Status of arrival pictures sharing",
  "Rating given by the customer": "Customer rating given post-trip",
  "Feedback given by the client": "Comments or feedback from customer",
  "Referrals if any": "Referrals provided by the client",
  "Post Booking calls": "Feedback call date or status",
  "Post Booking \n- 15 Days Prior trip": "Status/date of 15-days prior check call",
  "Pre Trip ": "Status/date of pre-trip briefing call",
  "Trip Status": "Overall current status of the trip",
  "Ops RM": "Operations Relationship Manager assigned to this booking",
  "Land voucher": "Voucher status for land components (DMC)",
};

// Fixed list of the 51 columns shown in screenshots with their index position in the spreadsheet
interface VisibleColumnDef {
  key: string;
  label: string;
  sheetIndex: number;
  type: "text" | "number" | "date" | "select";
  options?: string[];
  isCalculated?: boolean;
}

const VISIBLE_COLUMNS: VisibleColumnDef[] = [
  // Section 1: General Info & Travel Details
  { key: "Daily updates", label: "Daily updates", sheetIndex: 1, type: "text" },
  { key: "PN. Number", label: "PN. Number", sheetIndex: 2, type: "text" },
  { key: "Query code", label: "Query code", sheetIndex: 3, type: "text" },
  { key: "Date of Travel", label: "Date of Travel", sheetIndex: 4, type: "date" },
  { key: "Free Cancellation Date", label: "Free Cancellation Date", sheetIndex: 5, type: "date" },
  { key: "Adult", label: "Adult", sheetIndex: 6, type: "number" },
  { key: "Child", label: "Child", sheetIndex: 7, type: "number" },
  { key: "Infant", label: "Infant", sheetIndex: 8, type: "number" },
  { key: "Booking created date", label: "Booking created date", sheetIndex: 9, type: "date" },
  { key: "Confirmed on (only date)", label: "Confirmed on (only date)", sheetIndex: 10, type: "date" },
  { key: "Lead pax name", label: "Lead pax name", sheetIndex: 11, type: "text" },
  { 
    key: "Ops RM", 
    label: "Ops RM", 
    sheetIndex: 12, 
    type: "select", 
    options: ["Vishwajeet", "Shruti"] 
  },
  { 
    key: "Destination", 
    label: "Destination", 
    sheetIndex: 15, 
    type: "select", 
    options: ["Bali", "Thailand", "Singapore+Malaysia", "Maldives", "Sri lanka", "Varanasi", "Itlay", "Vietnam", "Europe", "Mauritius", "Hong Kong", "Kerela", "Singapore", "Goa", "Dubai"] 
  },
  { 
    key: "Final voucher", 
    label: "Final voucher", 
    sheetIndex: 17, 
    type: "select", 
    options: ["Shared", "Not Shared", "Not Applicable"] 
  },
  { key: "Matrics", label: "Matrics", sheetIndex: 18, type: "text", isCalculated: true },
  { 
    key: "Seller name \ndropdown ", 
    label: "Seller name dropdown", 
    sheetIndex: 19, 
    type: "select", 
    options: ["Khushi", "Shriya", "Dheeraj", "Priyanshu", "Deeraj", "Aasti", "Rishi", "Nitin", "Shreya sharma", "Vagisha", "Fakiha", "Saurabh P", "Pranjal", "Gurtej", "Vinay", "Amit", "Saurabh K", "Pranav", "Tejal", "Bhavya", "Syed", "Govind", "Shubham", "Rahul", "Kaif", 'Tanish'] 
  },
  { 
    key: "Hotel voucher", 
    label: "Hotel voucher", 
    sheetIndex: 27, 
    type: "select", 
    options: ["Shared", "Not Shared", "Not Applicable"] 
  },
  { 
    key: "Visa voucher", 
    label: "Visa voucher", 
    sheetIndex: 29, 
    type: "select", 
    options: ["Shared", "Not Shared", "Not Applicable"] 
  },
  { 
    key: "Flight voucher", 
    label: "Flight voucher", 
    sheetIndex: 30, 
    type: "select", 
    options: ["Shared", "Not Shared", "Not Applicable"] 
  },
  { key: "Voucher Pending", label: "Voucher Pending", sheetIndex: 31, type: "text", isCalculated: true },

  // Section 2: Costing & Budget
  { key: "Flights SP", label: "Flights SP", sheetIndex: 37, type: "number" },
  { key: "Hotel SP", label: "Hotel SP", sheetIndex: 38, type: "number" },
  { key: "Land SP", label: "Land SP", sheetIndex: 39, type: "number" },
  { key: "VISA SP", label: "VISA SP", sheetIndex: 40, type: "number" },
  { key: "Final ttv", label: "Final ttv", sheetIndex: 41, type: "number", isCalculated: true },
  { key: "Remarks for SP", label: "Remarks for SP", sheetIndex: 42, type: "text" },
  { key: "Net Cost (DMC)", label: "Net Cost (DMC)", sheetIndex: 52, type: "number" },
  { key: "Airfare + Visa Dmc Nett Cost", label: "Airfare + Visa Dmc Nett Cost", sheetIndex: 53, type: "number" },
  { key: "Total CP", label: "Total CP", sheetIndex: 56, type: "number", isCalculated: true },
  { key: "Remarks for CP", label: "Remarks for CP", sheetIndex: 57, type: "text" },

  // Section 3: Installments & Payments
  { key: "Due date (Installment 1)", label: "Due date (Installment 1)", sheetIndex: 59, type: "date" },
  { key: "Instalment 1", label: "Instalment 1", sheetIndex: 60, type: "number" },
  { 
    key: "Installment 1 status", 
    label: "Installment 1 status", 
    sheetIndex: 62, 
    type: "select", 
    options: ["Received", "Not Received", "Not Applicable"] 
  },
  { key: "Due date (Installment 2)", label: "Due date (Installment 2)", sheetIndex: 63, type: "date" },
  { key: "Amount for Installment 2", label: "Amount for Installment 2", sheetIndex: 64, type: "number" },
  { 
    key: "Installment 2 status", 
    label: "Installment 2 status", 
    sheetIndex: 65, 
    type: "select", 
    options: ["Received", "Not Received", "Not Applicable", "Out of service number"] 
  },
  { key: "Due date (Installment 3)", label: "Due date (Installment 3)", sheetIndex: 66, type: "date" },
  { key: "Amount for Installment 3", label: "Amount for Installment 3", sheetIndex: 67, type: "number" },
  { 
    key: "Installment 3 status", 
    label: "Installment 3 status", 
    sheetIndex: 68, 
    type: "select", 
    options: ["Received", "Not Received", "Not Applicable", "-"] 
  },
  { key: "Pending Final Amount", label: "Pending Final Amount", sheetIndex: 70, type: "number", isCalculated: true },
  { key: "Total installment amount", label: "Total installment amount", sheetIndex: 71, type: "number", isCalculated: true },
  { key: "Discrepanncy in cost", label: "Discrepanncy in cost", sheetIndex: 72, type: "text", isCalculated: true },
  { 
    key: "Final Payment Collected", 
    label: "Final Payment Collected", 
    sheetIndex: 73, 
    type: "select", 
    options: ["Yes", "No"], 
    isCalculated: true 
  },
  { key: "Payment reminder", label: "Payment reminder", sheetIndex: 74, type: "text", isCalculated: true },

  // Section 4: Trip Operations
  { key: "Arrival Pictures shared on whatsapp group", label: "Arrival Pictures shared on whatsapp group", sheetIndex: 76, type: "text" },
  { key: "Rating given by the customer", label: "Rating given by the customer", sheetIndex: 77, type: "text" },
  { key: "Feedback given by the client", label: "Feedback given by the client", sheetIndex: 78, type: "text" },
  { key: "Referrals if any", label: "Referrals if any", sheetIndex: 79, type: "text" },
  { key: "Post Booking calls", label: "Post Booking calls", sheetIndex: 81, type: "text" },
  { key: "Post Booking \n- 15 Days Prior trip", label: "Post Booking - 15 Days Prior trip", sheetIndex: 82, type: "text" },
  { key: "Pre Trip ", label: "Pre Trip", sheetIndex: 83, type: "text" },
  { 
    key: "Trip Status", 
    label: "Trip Status", 
    sheetIndex: 84, 
    type: "select", 
    options: ["Confirmed", "Dropped after Booking", "OnTrip"] 
  }
];

function formatToInputDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";

  // Check if it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Check if it's M/D/YYYY or MM/DD/YYYY
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    if (year.length === 4 && !isNaN(Number(month)) && !isNaN(Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback to JS Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function formatToSheetDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-");
    const m = parseInt(month, 10).toString();
    const d = parseInt(day, 10).toString();
    return `${m}/${d}/${year}`;
  }
  return trimmed;
}

export function DynamicBookingForm({ onSubmit, onCancel, booking, onRemove, mode = "all" }: DynamicBookingFormProps) {
  // Format helper for today's date
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Form State
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (booking) {
      const initial: Record<string, string> = {};
      VISIBLE_COLUMNS.forEach(col => {
        if (booking.rawData && col.sheetIndex < booking.rawData.length) {
          let rawVal = booking.rawData[col.sheetIndex] || "";
          if (col.type === "select" && col.options) {
            const matchedOpt = col.options.find(opt => opt.toLowerCase() === rawVal.trim().toLowerCase());
            if (matchedOpt) {
              rawVal = matchedOpt;
            }
          }
          initial[col.key] = col.type === "date" ? formatToInputDate(rawVal) : rawVal;
        } else {
          // Fallback mapping if rawData isn't available
          if (col.key === "PN. Number") initial[col.key] = booking.pn || "";
          else if (col.key === "Lead pax name") initial[col.key] = booking.leadPax || "";
          else if (col.key === "Destination") initial[col.key] = booking.destination || "";
          else if (col.key === "Date of Travel") initial[col.key] = formatToInputDate(booking.travelDate) || "";
          else if (col.key === "Free Cancellation Date") initial[col.key] = formatToInputDate(booking.freeCancellationDate) || "";
          else if (col.key === "Ops RM") initial[col.key] = booking.opsRm || "";
          else if (col.key === "Seller name \ndropdown ") initial[col.key] = booking.seller || "";
          else if (col.key === "Final voucher") initial[col.key] = booking.finalVoucher || "Not Shared";
          else if (col.key === "Hotel voucher") initial[col.key] = booking.hotelVoucher || "Not Shared";
          else if (col.key === "Visa voucher") initial[col.key] = booking.visaVoucher || "Not Applicable";
          else if (col.key === "Flight voucher") initial[col.key] = booking.flightVoucher || "Not Applicable";
          else if (col.key === "Adult") initial[col.key] = String(booking.adult ?? 1);
          else if (col.key === "Child") initial[col.key] = String(booking.child ?? 0);
          else if (col.key === "Infant") initial[col.key] = String(booking.infant ?? 0);
          else if (col.key === "Flights SP") initial[col.key] = String(booking.flightSp ?? 0);
          else if (col.key === "Hotel SP") initial[col.key] = String(booking.hotelSp ?? 0);
          else if (col.key === "Land SP") initial[col.key] = String(booking.landSp ?? 0);
          else if (col.key === "VISA SP") initial[col.key] = String(booking.visaSp ?? 0);
          else if (col.key === "Due date (Installment 1)") initial[col.key] = formatToInputDate(booking.installment1Date) || "";
          else if (col.key === "Instalment 1") initial[col.key] = String(booking.installment1Amount ?? 0);
          else if (col.key === "Installment 1 status") initial[col.key] = booking.installment1Status || "Not Received";
          else if (col.key === "Due date (Installment 2)") initial[col.key] = formatToInputDate(booking.installment2Date) || "";
          else if (col.key === "Amount for Installment 2") initial[col.key] = String(booking.installment2Amount ?? 0);
          else if (col.key === "Installment 2 status") initial[col.key] = booking.installment2Status || "Not Received";
          else if (col.key === "Due date (Installment 3)") initial[col.key] = formatToInputDate(booking.installment3Date) || "";
          else if (col.key === "Amount for Installment 3") initial[col.key] = String(booking.installment3Amount ?? 0);
          else if (col.key === "Installment 3 status") initial[col.key] = booking.installment3Status || "Not Received";
          else if (col.key === "Trip Status") initial[col.key] = booking.tripStatus || "Confirmed";
          else initial[col.key] = "";
        }
      });
      return initial;
    }

    return {
      "Daily updates": "All things done",
      "PN. Number": "",
      "Query code": "",
      "Date of Travel": "",
      "Free Cancellation Date": "",
      "Adult": "1",
      "Child": "0",
      "Infant": "0",
      "Booking created date": getTodayString(),
      "Confirmed on (only date)": getTodayString(),
      "Lead pax name": "",
      "Destination": "",
      "Final voucher": "Not Shared",
      "Seller name \ndropdown ": "",
      "Hotel voucher": "Not Shared",
      "Visa voucher": "Not Applicable",
      "Flight voucher": "Not Applicable",
      "Flights SP": "0",
      "Hotel SP": "0",
      "Land SP": "0",
      "VISA SP": "0",
      "Remarks for SP": "",
      "Net Cost (DMC)": "0",
      "Airfare + Visa Dmc Nett Cost": "0",
      "Remarks for CP": "",
      "Due date (Installment 1)": getTodayString(),
      "Instalment 1": "0",
      "Installment 1 status": "Not Received",
      "Due date (Installment 2)": "",
      "Amount for Installment 2": "0",
      "Installment 2 status": "Not Received",
      "Due date (Installment 3)": "",
      "Amount for Installment 3": "0",
      "Installment 3 status": "Not Received",
      "Arrival Pictures shared on whatsapp group": "",
      "Rating given by the customer": "",
      "Feedback given by the client": "",
      "Referrals if any": "",
      "Post Booking calls": "",
      "Post Booking \n- 15 Days Prior trip": "",
      "Pre Trip ": "",
      "Trip Status": "Confirmed",
      "Ops RM": ""
    };
  });

  // Track manual modification of installment amounts to lock in manual inputs
  const [hasManuallyEditedInst2, setHasManuallyEditedInst2] = useState(!!booking);
  const [hasManuallyEditedInst3, setHasManuallyEditedInst3] = useState(!!booking);

  // Auto-calculated fields state
  const [calculations, setCalculations] = useState({
    matrics: "",
    voucherPending: "Nothing Pending",
    finalTtv: 0,
    totalCp: 0,
    totalInstallmentAmount: 0,
    pendingFinalAmount: 0,
    discrepancy: "Equal",
    finalPaymentCollected: "No",
    paymentReminder: ""
  });

  // Accordion section state
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true
  });

  const toggleSection = (id: number) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper parser for numbers
  const parseNum = (val: string | undefined): number => {
    if (!val) return 0;
    const clean = val.replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Run all auto-calculations whenever formData changes
  useEffect(() => {
    // 1. Calculate Final TTV (Flights SP + Hotel SP + Land SP + VISA SP)
    const flightSp = parseNum(formData["Flights SP"]);
    const hotelSp = parseNum(formData["Hotel SP"]);
    const landSp = parseNum(formData["Land SP"]);
    const visaSp = parseNum(formData["VISA SP"]);
    const finalTtv = flightSp + hotelSp + landSp + visaSp;

    // 2. Calculate Total CP (Net Cost DMC + Airfare + Visa Nett Cost)
    const netCostDmc = parseNum(formData["Net Cost (DMC)"]);
    const airfareVisaDmc = parseNum(formData["Airfare + Visa Dmc Nett Cost"]);
    const totalCp = netCostDmc + airfareVisaDmc;

    // 3. Calculate Installment 1 Amount
    const inst1 = parseNum(formData["Instalment 1"]);

    // Calculate remaining balance to split by default
    const balance = finalTtv - inst1;
    let inst2 = parseNum(formData["Amount for Installment 2"]);
    let inst3 = parseNum(formData["Amount for Installment 3"]);

    // Dynamic defaults for installments 2 and 3 if they haven't been manually typed yet
    if (!hasManuallyEditedInst2 && !hasManuallyEditedInst3) {
      inst2 = Math.round(balance / 2);
      inst3 = balance - inst2;
    } else if (hasManuallyEditedInst2 && !hasManuallyEditedInst3) {
      inst3 = balance - inst2;
    } else if (!hasManuallyEditedInst2 && hasManuallyEditedInst3) {
      inst2 = balance - inst3;
    }

    // Sync state if calculated
    if (String(inst2) !== formData["Amount for Installment 2"] && !hasManuallyEditedInst2) {
      setFormData(prev => ({ ...prev, "Amount for Installment 2": String(inst2) }));
    }
    if (String(inst3) !== formData["Amount for Installment 3"] && !hasManuallyEditedInst3) {
      setFormData(prev => ({ ...prev, "Amount for Installment 3": String(inst3) }));
    }

    // 4. Calculate Total Installment Amount
    const totalInstallmentAmount = inst1 + inst2 + inst3;

    // 5. Calculate Pending Final Amount (TTV - Sum of Received Installment Amounts)
    let receivedAmount = 0;
    if (formData["Installment 1 status"] === "Received") {
      receivedAmount += inst1;
    }
    if (formData["Installment 2 status"] === "Received") {
      receivedAmount += inst2;
    }
    if (formData["Installment 3 status"] === "Received") {
      receivedAmount += inst3;
    }
    const pendingFinalAmount = Math.max(0, finalTtv - receivedAmount);

    // 6. Calculate Discrepancy (Equal, More, Less)
    let discrepancy = "Equal";
    if (totalInstallmentAmount > finalTtv) discrepancy = "More";
    else if (totalInstallmentAmount < finalTtv) discrepancy = "Less";

    // 7. Calculate Final Payment Collected (Yes if pending <= 0, else No)
    const finalPaymentCollected = pendingFinalAmount <= 0 ? "Yes" : "No";

    // 8. Calculate Matrics and Payment Reminder (based on Date of Travel)
    const travelDateStr = formData["Date of Travel"];
    let matrics = "";
    let paymentReminder = "";
    if (travelDateStr) {
      const days = daysUntil(travelDateStr);
      if (days !== null) {
        // Matrics calculation: Past if < 0, D+days if <= 15, else Future
        if (days < 0) matrics = "Past";
        else if (days <= 15) matrics = `D+${days}`;
        else matrics = "Future";

        // Payment Reminder calculation
        if (finalPaymentCollected === "Yes") {
          paymentReminder = "Full amount collected";
        } else {
          if (days < 0) {
            paymentReminder = "Collect full payment";
          } else {
            paymentReminder = `${days} days left`;
          }
        }
      }
    } else {
      if (finalPaymentCollected === "Yes") {
        paymentReminder = "Full amount collected";
      }
    }

    // 9. Calculate Voucher Pending status
    const finalVoucher = formData["Final voucher"];
    const hotelVoucher = formData["Hotel voucher"];
    const visaVoucher = formData["Visa voucher"];
    const flightVoucher = formData["Flight voucher"];

    const pendingVouchers: string[] = [];
    if (finalVoucher?.toLowerCase() === "not shared") pendingVouchers.push("Final voucher");
    // "Not Applicable" means this booking has no final voucher (e.g. visa-only), so exclude from pending
    if (hotelVoucher?.toLowerCase() === "not shared") pendingVouchers.push("Hotel voucher");
    if (visaVoucher?.toLowerCase() === "not shared") pendingVouchers.push("Visa voucher");
    if (flightVoucher?.toLowerCase() === "not shared") pendingVouchers.push("Flight voucher");

    const voucherPending = pendingVouchers.length > 0 ? pendingVouchers.join(", ") : "Nothing Pending";

    setCalculations({
      matrics,
      voucherPending,
      finalTtv,
      totalCp,
      totalInstallmentAmount,
      pendingFinalAmount,
      discrepancy,
      finalPaymentCollected,
      paymentReminder
    });
  }, [formData, hasManuallyEditedInst2, hasManuallyEditedInst3]);

  // Handle input changes
  const handleInputChange = (key: string, val: string) => {
    setFormData(prev => ({ ...prev, [key]: val }));

    if (key === "Amount for Installment 2") {
      setHasManuallyEditedInst2(true);
    }
    if (key === "Amount for Installment 3") {
      setHasManuallyEditedInst3(true);
    }
  };

  // Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check PN. Number, auto-generate if empty
    const finalPn = formData["PN. Number"]?.trim() || `PN-NEW-${Math.floor(100000 + Math.random() * 900000)}`;

    // Reconstruct full spreadsheet row (94 columns)
    const baseRow = booking?.rawData ? [...booking.rawData] : new Array(94).fill("");
    while (baseRow.length < 94) {
      baseRow.push("");
    }

    // Helper to map form values and auto-calculated values into row array
    VISIBLE_COLUMNS.forEach(col => {
      let finalVal = formData[col.key] || "";

      // Substitute calculated values
      if (col.key === "PN. Number") {
        finalVal = finalPn;
      } else if (col.key === "Matrics") {
        finalVal = calculations.matrics;
      } else if (col.key === "Voucher Pending") {
        finalVal = calculations.voucherPending;
      } else if (col.key === "Final ttv") {
        finalVal = String(calculations.finalTtv);
      } else if (col.key === "Total CP") {
        finalVal = String(calculations.totalCp);
      } else if (col.key === "Pending Final Amount") {
        finalVal = String(calculations.pendingFinalAmount);
      } else if (col.key === "Total installment amount") {
        finalVal = String(calculations.totalInstallmentAmount);
      } else if (col.key === "Discrepanncy in cost") {
        finalVal = calculations.discrepancy;
      } else if (col.key === "Final Payment Collected") {
        finalVal = calculations.finalPaymentCollected;
      } else if (col.key === "Payment reminder") {
        finalVal = calculations.paymentReminder;
      }

      // Convert date inputs to M/D/YYYY sheet format when writing to raw row values
      if (col.type === "date" && !col.isCalculated) {
        finalVal = formatToSheetDate(finalVal);
      }

      baseRow[col.sheetIndex] = finalVal;
    });

    // Populate extra defaults for non-form fields
    if (!booking) {
      baseRow[0] = "Travclan"; // Lead seller tag
    }

    // Also populate duplicate first installment column if present in the spreadsheet
    baseRow[61] = formData["Instalment 1"] || "0"; 

    // Reconstruct Booking object for local list
    const newBooking: Booking = {
      pn: finalPn,
      leadPax: formData["Lead pax name"] || "—",
      destination: formData["Destination"] || "—",
      travelDate: formatToSheetDate(formData["Date of Travel"]),
      freeCancellationDate: formatToSheetDate(formData["Free Cancellation Date"]),
      dailyUpdates: formData["Daily updates"] || "",
      createdDate: formatToSheetDate(formData["Booking created date"]),
      installment1Date: formatToSheetDate(formData["Due date (Installment 1)"]),
      installment1Status: formData["Installment 1 status"] || "Not Received",
      installment1Amount: parseNum(formData["Instalment 1"]),
      installment2Date: formatToSheetDate(formData["Due date (Installment 2)"]),
      installment2Amount: parseNum(formData["Amount for Installment 2"]),
      installment2Status: formData["Installment 2 status"] || "Not Received",
      installment3Date: formatToSheetDate(formData["Due date (Installment 3)"]),
      installment3Amount: parseNum(formData["Amount for Installment 3"]),
      installment3Status: formData["Installment 3 status"] || "Not Received",
      paymentCollected: calculations.finalPaymentCollected,
      pendingAmount: calculations.pendingFinalAmount,
      totalInstallmentAmount: calculations.totalInstallmentAmount,
      discrepancy: calculations.discrepancy,
      paymentReminder: calculations.paymentReminder,
      opsRm: formData["Ops RM"] || "Unassigned",
      seller: formData["Seller name \ndropdown "] || "—",
      finalVoucher: formData["Final voucher"] || "Not Shared",
      tripStatus: formData["Trip Status"] || "Confirmed",
      adult: parseNum(formData["Adult"]),
      child: parseNum(formData["Child"]),
      infant: parseNum(formData["Infant"]),
      flightSp: parseNum(formData["Flights SP"]),
      hotelSp: parseNum(formData["Hotel SP"]),
      landSp: parseNum(formData["Land SP"]),
      visaSp: parseNum(formData["VISA SP"]),
      finalTtv: calculations.finalTtv,
      totalSp: calculations.finalTtv, // Maps Final TTV to Total SP
      hotelVoucher: formData["Hotel voucher"] || "Not Shared",
      landVoucher: booking?.landVoucher || "Not Shared",
      visaVoucher: formData["Visa voucher"] || "Not Applicable",
      flightVoucher: formData["Flight voucher"] || "Not Applicable",
      voucherPending: calculations.voucherPending,
      preTrip: formData["Pre Trip "] || "—",
      daysToTravel: formData["Date of Travel"] ? String(daysUntil(formData["Date of Travel"])) : "—",
      matrics: calculations.matrics || "—",
      rawData: baseRow,
      updatedAt: Date.now(),
    };

    onSubmit(newBooking, baseRow);
  };

  // Render form field helper
  const renderField = (col: VisibleColumnDef, overrideIsCalculated?: boolean) => {
    const cleanLabel = col.label.replace(/\n/g, " ").trim();
    const description = FIELD_DESCRIPTIONS[col.key] || `Value for: ${cleanLabel}`;

    const isCalculated = col.isCalculated || overrideIsCalculated;

    // Get current value
    let val = formData[col.key] || "";
    if (col.isCalculated) {
      if (col.key === "Matrics") val = calculations.matrics;
      else if (col.key === "Voucher Pending") val = calculations.voucherPending;
      else if (col.key === "Final ttv") val = String(calculations.finalTtv);
      else if (col.key === "Total CP") val = String(calculations.totalCp);
      else if (col.key === "Pending Final Amount") val = String(calculations.pendingFinalAmount);
      else if (col.key === "Total installment amount") val = String(calculations.totalInstallmentAmount);
      else if (col.key === "Discrepanncy in cost") val = calculations.discrepancy;
      else if (col.key === "Final Payment Collected") val = calculations.finalPaymentCollected;
      else if (col.key === "Payment reminder") val = calculations.paymentReminder;
    }

    return (
      <div key={col.key} className="flex flex-col space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 tracking-wide uppercase">
          {cleanLabel}
          {isCalculated && (
            <span title="Locked / Auto-calculated">
              <Lock className="h-3 w-3 text-orange-600" />
            </span>
          )}
          <span title={description}>
            <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
          </span>
        </label>

        {col.type === "select" ? (
          <select
            value={val}
            onChange={(e) => handleInputChange(col.key, e.target.value)}
            disabled={isCalculated}
            className={`h-9 rounded-lg border px-3 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 shadow-sm ${
              isCalculated 
                ? "bg-slate-50 border-slate-200 text-slate-500 font-semibold cursor-not-allowed" 
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {col.key === "Destination" || col.key === "Seller name \ndropdown " || col.key === "Ops RM" ? (
              <option value="">— Select —</option>
            ) : null}
            {col.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type={col.type}
            value={val}
            onChange={(e) => handleInputChange(col.key, e.target.value)}
            disabled={isCalculated}
            placeholder={col.type === "number" ? "0" : `Enter ${cleanLabel}...`}
            className={`h-9 rounded-lg border px-3 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 shadow-sm ${
              isCalculated 
                ? "bg-orange-50/30 border-orange-100/50 text-orange-800 font-semibold cursor-not-allowed" 
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          />
        )}
      </div>
    );
  };

  // Group columns into sections
  const sec1Fields = VISIBLE_COLUMNS.filter(col => col.sheetIndex <= 31);
  const sec2Fields = VISIBLE_COLUMNS.filter(col => col.sheetIndex > 31 && col.sheetIndex <= 57);
  const sec3Fields = VISIBLE_COLUMNS.filter(col => col.sheetIndex > 57 && col.sheetIndex <= 74);
  const sec4Fields = VISIBLE_COLUMNS.filter(col => col.sheetIndex > 74);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-5">
      {/* Disclaimer / Info Header */}
      <div className="flex items-start gap-2.5 bg-orange-50/50 border border-orange-100 p-3.5 rounded-xl text-xs text-orange-800 leading-relaxed shadow-sm">
        <Info className="h-4.5 w-4.5 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Google Sheet Live Integration:</span> Only columns requested for your booking tracking workflow are shown here. Calculated columns (marked with <Lock className="inline h-3 w-3 mx-0.5" />) are computed instantly as you edit, maintaining the exact logic from the spreadsheet formulas.
        </div>
      </div>

      {mode === "voucher" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-3 mb-4">
            Voucher Status Update
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {VISIBLE_COLUMNS.filter(col => [
              "PN. Number",
              "Lead pax name",
              "Seller name \ndropdown ",
              "Hotel voucher",
              "Land voucher",
              "Visa voucher",
              "Flight voucher",
              "Final voucher",
              "Voucher Pending"
            ].includes(col.key)).map(col => {
              const isReadOnly = col.key === "PN. Number" || col.key === "Lead pax name";
              return renderField(col, isReadOnly);
            })}
          </div>
        </div>
      )}

      {mode === "payment" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-3 mb-4">
            Installment Plan & Payment Status
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Read-only PN and Lead pax for context */}
            {VISIBLE_COLUMNS.filter(col => col.key === "PN. Number" || col.key === "Lead pax name").map(col => 
              renderField(col, true)
            )}
            {/* Section 3 fields */}
            {sec3Fields.map(col => renderField(col))}
          </div>
        </div>
      )}

      {mode === "all" && (
        <div className="space-y-4">
          {/* Section 1: Travel & Pax details */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection(1)}
              className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-3 border-b border-slate-200 hover:from-slate-100/60 hover:to-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Section 1 – Booking & Travel Information</span>
              {expandedSections[1] ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {expandedSections[1] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white rounded-b-xl">
                {sec1Fields.map(col => renderField(col))}
              </div>
            )}
          </div>

          {/* Section 2: Pricing and DMC costing */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection(2)}
              className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-3 border-b border-slate-200 hover:from-slate-100/60 hover:to-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Section 2 – Costing & Financials</span>
              {expandedSections[2] ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {expandedSections[2] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white rounded-b-xl">
                {sec2Fields.map(col => renderField(col))}
              </div>
            )}
          </div>

          {/* Section 3: Installments tracking */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection(3)}
              className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-3 border-b border-slate-200 hover:from-slate-100/60 hover:to-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Section 3 – Installment Plan & Payment Status</span>
              {expandedSections[3] ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {expandedSections[3] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white rounded-b-xl">
                {sec3Fields.map(col => renderField(col))}
              </div>
            )}
          </div>

          {/* Section 4: Post-booking Operations */}
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection(4)}
              className="w-full flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-3 border-b border-slate-200 hover:from-slate-100/60 hover:to-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Section 4 – Post-Booking & Trip Operations</span>
              {expandedSections[4] ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>
            {expandedSections[4] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white rounded-b-xl">
                {sec4Fields.map(col => renderField(col))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog Footer Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 mt-6">
        <div>
          {booking && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(booking.pn)}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-sm cursor-pointer"
            >
              Remove Booking from Website
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition shadow-sm cursor-pointer"
          >
            {booking ? "Update Booking" : "Add Booking"}
          </button>
        </div>
      </div>
    </form>
  );
}
