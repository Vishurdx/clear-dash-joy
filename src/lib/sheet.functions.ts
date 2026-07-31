import Papa from "papaparse";

// URL of the Google Sheet CSV export (publicly shared)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/18RQr7HBcjye3bZy8ec4j5YeFcYIgXChFnfZr2-w_Dr0/export?format=csv&gid=0";

/**
 * Types representing the data model pulled from the sheet.
 */
export enum CollectionPriority {
  Critical = "Critical",
  High = "High",
  Low = "Low",
}
export type Booking = {
  pn: string; // Booking reference number
  leadPax: string; // Lead/Passenger name
  destination: string;
  travelDate: string; // ISO date string (e.g., "2024-12-31")
  freeCancellationDate: string; // "FOC" date
  effectiveFocDate?: string; // Website-only effective FOC date (shifts to T-10d if inst 2 received)
  isFocShifted?: boolean; // Indicates if FOC date was shifted due to inst 2 payment
  installment1Date?: string; // Due date for installment 1 (column BH / Index 59)
  installment1Status?: string; // Status for installment 1 (column BK / Index 62)
  installment1Amount?: number; // 1st installment amount (BI column / Index 60)
  installment2Date: string; // Due date for installment 2 (column BL / Index 63)
  installment2Amount?: number; // Amount for installment 2 (column BM / Index 64)
  installment2Status: string; // Status for installment 2 (column BN / Index 65)
  installment3Date: string; // Due date for installment 3 (column BO / Index 66)
  installment3Amount?: number; // Amount for installment 3 (column BP / Index 67)
  installment3Status: string; // Status for installment 3 (column BQ / Index 68)
  paymentCollected: string; // "Yes" / "No" (column BV / Index 73)
  pendingAmount: number; // Pending amount (numeric / Index 70)
  totalInstallmentAmount?: number; // Total installment amount (column BT / Index 71)
  discrepancy?: string; // Discrepancy in cost (column BU / Index 72)
  paymentReminder?: string; // Payment reminder (column BW / Index 74)
  opsRm: string; // Assigned Relationship Manager
  seller?: string; // Seller column (optional)
  finalVoucher?: string; // Final Voucher column (optional)
  tripStatus?: string; // Trip Status column (optional)
  // Additional optional numeric fields used in UI
  adult?: number;
  child?: number;
  infant?: number;
  flightSp?: number;
  hotelSp?: number;
  landSp?: number;
  visaSp?: number;
  totalSp?: number;
  finalTtv?: number;
  // Additional optional string fields used in UI
  preTrip?: string;
  daysToTravel?: string;
  voucherPending?: string;
  hotelVoucher?: string;
  landVoucher?: string;
  visaVoucher?: string;
  flightVoucher?: string;
  dailyUpdates?: string; // Daily updates (column B / Index 1)
  createdDate?: string; // Date booking was created (column J / Index 9)
  firstCallStatus?: string; // (column Z / Index 25)
  postBookingCalls?: string; // (column CF / Index 81)
  installmentComment?: string; // Remarks by vishwajeet (column CF / Index 85)
  voucherComment?: string; // Comments (column CH / Index 87)
  rawData?: string[]; // Raw cell values array from Google Sheets
  // Additional fields that may exist in the sheet but are not required for the UI
  [key: string]: any;
};

/**
 * Helper: Calculate the number of days from today until the given date string.
 * Returns `null` if the date cannot be parsed.
 */
export function daysUntil(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  // Reset time components to ignore time-of-day differences
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function daysSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Helper to determine if an installment status indicates payment has been settled/received.
 * Recognizes "Received", "Paid", "Done", "Yes", "Completed", "Not Applicable", "N/A",
 * as well as payment date strings like "7/10/2026", "2026-07-10".
 */
export function isInstallmentSettled(status: string | undefined | null): boolean {
  if (!status) return false;
  const s = status.trim();
  if (!s) return false;
  const lower = s.toLowerCase();

  if (
    lower === "not received" ||
    lower === "pending" ||
    lower === "due" ||
    lower === "unpaid" ||
    lower === "no" ||
    lower === "false" ||
    lower === "—" ||
    lower === "-"
  ) {
    return false;
  }

  if (
    lower === "received" ||
    lower === "paid" ||
    lower === "done" ||
    lower === "yes" ||
    lower === "true" ||
    lower === "completed" ||
    lower === "ok" ||
    lower === "not applicable" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "n.a."
  ) {
    return true;
  }

  // Check if status is a valid date string (indicating payment received on date)
  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(s)) {
    return true;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    return true;
  }

  return false;
}

/**
 * Website-only concept:
 * If a guest pays 2nd installment (installment2Status is settled or payment date set),
 * their FOC for 3rd installment (Land package) shifts to 10 days prior to their travel date.
 */
export function getEffectiveFoc(b: {
  freeCancellationDate?: string;
  travelDate?: string;
  installment2Status?: string;
}): { focDate: string; isShifted: boolean } {
  const rawFoc = b.freeCancellationDate || "";
  const inst2Received = isInstallmentSettled(b.installment2Status);

  if (inst2Received && b.travelDate) {
    const tDate = new Date(b.travelDate);
    if (!isNaN(tDate.getTime())) {
      const focDate = new Date(tDate);
      focDate.setDate(focDate.getDate() - 10);
      const m = focDate.getMonth() + 1;
      const d = focDate.getDate();
      const y = focDate.getFullYear();
      return {
        focDate: `${m}/${d}/${y}`,
        isShifted: true,
      };
    }
  }
  return { focDate: rawFoc, isShifted: false };
}

/**
 * Format a number as Indian Rupees (₹) with commas.
 */
export function inr(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Fetches the CSV from Google Sheets, parses it, and returns a list of bookings.
 * Runs in the browser — requires the sheet to be publicly shared.
 */
export async function fetchBookings(): Promise<{
  rows: Booking[];
  headers: string[];
  uniqueValues: Record<string, string[]>;
  fetchedAt: string;
}> {
  const resp = await fetch(SHEET_CSV_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch sheet CSV: ${resp.status}`);
  }
  const csvText = await resp.text();

  const parsed = Papa.parse(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.warn("CSV parsing errors", parsed.errors);
  }

  const parseNum = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const clean = val.toString().replace(/,/g, "").trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const rows: Booking[] = (parsed.data as any[][])
    .filter((row) => {
      const pn = row[2]?.toString()?.trim() || "";
      return pn.startsWith("PN-");
    })
    .map((row) => {
      const rawFoc = row[5]?.toString()?.trim() || ""; // Column F
      const travelDate = row[4]?.toString()?.trim() || ""; // Column E
      const inst2Status = row[65]?.toString()?.trim() || ""; // Column BN (2nd installment status)
      const focInfo = getEffectiveFoc({
        freeCancellationDate: rawFoc,
        travelDate,
        installment2Status: inst2Status,
      });

      return {
        pn: row[2]?.toString()?.trim() || "", // Column C (PN Number)
        leadPax: row[11]?.toString()?.trim() || "", // Column L (Lead Pax Name)
        destination: row[15]?.toString()?.trim() || "", // Column P
        travelDate, // Column E
        freeCancellationDate: rawFoc, // Column F
        effectiveFocDate: focInfo.focDate,
        isFocShifted: focInfo.isShifted,
        dailyUpdates: row[1]?.toString()?.trim() || "", // Column B
        createdDate: row[9]?.toString()?.trim() || "", // Column J
        installment1Date: row[59]?.toString()?.trim() || "", // Column BH
        installment1Amount: parseNum(row[60]), // Column BI
        installment1Status: row[62]?.toString()?.trim() || "", // Column BK
        installment2Date: row[63]?.toString()?.trim() || "", // Column BL
        installment2Amount: parseNum(row[64]), // Column BM
        installment2Status: row[65]?.toString()?.trim() || "", // Column BN
        installment3Date: row[66]?.toString()?.trim() || "", // Column BO
        installment3Amount: parseNum(row[67]), // Column BP
        installment3Status: row[68]?.toString()?.trim() || "", // Column BQ
        pendingAmount: parseNum(row[70]), // Column BS
        paymentCollected: row[73]?.toString()?.trim() || "", // Column BV
        totalInstallmentAmount: parseNum(row[71]), // Column BT
        discrepancy: row[72]?.toString()?.trim() || "", // Column BU
        paymentReminder: row[74]?.toString()?.trim() || "", // Column BW
        opsRm: row[12]?.toString()?.trim() || "", // Column M
        seller: row[19]?.toString()?.trim() || "", // Column T
        finalVoucher: row[17]?.toString()?.trim() || "", // Column R
        matrics: row[18]?.toString()?.trim() || "", // Column S (Matrices for DOT)
        flightVoucher: row[27]?.toString()?.trim() || "", // Column AB
        hotelVoucher: row[29]?.toString()?.trim() || "", // Column AD
        landVoucher: row[30]?.toString()?.trim() || "", // Column AE
        visaVoucher: row[30]?.toString()?.trim() || "", // Column AE
        finalTtv: parseNum(row[41]), // Column AP
        tripStatus: row[84]?.toString()?.trim() || "",
        firstCallStatus: row[25]?.toString()?.trim() || "",
        postBookingCalls: row[81]?.toString()?.trim() || "",

        // Adults, child, infant
        adult: parseNum(row[6]), // Column G
        child: parseNum(row[7]), // Column H
        infant: parseNum(row[8]), // Column I

        // SP info
        flightSp: parseNum(row[37]),
        hotelSp: parseNum(row[38]),
        landSp: parseNum(row[39]),
        visaSp: parseNum(row[40]),
        totalSp: parseNum(row[33]),

        voucherPending: row[31]?.toString()?.trim() || "",
        preTrip: row[83]?.toString()?.trim() || "",
        daysToTravel: row[92]?.toString()?.trim() || "",
        rawData: row.map((cell: any) => cell?.toString() || ""),
      };
    });

  const headers = (parsed.data[1] as string[]) || [];
  const cleanHeaders = headers.map((h) => h?.trim() || "");

  const dataRows = (parsed.data as any[][]).slice(2).filter((row) => {
    const pn = row[2]?.toString()?.trim() || "";
    return pn.startsWith("PN-");
  });

  const uniqueValuesMap: Record<string, string[]> = {};
  cleanHeaders.forEach((headerName, colIndex) => {
    if (!headerName) return;
    const vals = new Set<string>();
    dataRows.forEach((row) => {
      const v = row[colIndex]?.toString()?.trim();
      if (v) {
        vals.add(v);
      }
    });
    if (vals.size > 0 && vals.size <= 12) {
      uniqueValuesMap[headerName] = Array.from(vals).sort();
    }
  });

  console.log("Fetched rows count:", rows.length);

  return {
    rows,
    headers: cleanHeaders,
    uniqueValues: uniqueValuesMap,
    fetchedAt: new Date().toISOString(),
  };
}

const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz5JpbQj-JQJzytf27gLJc-62aGF7RiIYqYJR3DcJKdw-emlbe4ozyUGDAnW5SO7bGe/exec";

/**
 * Appends a new booking row to Google Sheets via serverless proxy or Apps Script Web App.
 */
export async function addBookingToSheet(rowValues: string[]): Promise<{ status: string; message?: string }> {
  const payload = {
    action: "appendRow",
    values: rowValues,
  };

  // 1. Try Vercel Serverless proxy first (bypasses browser CORS completely)
  try {
    const proxyResp = await fetch("/api/sheet-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (proxyResp.ok) {
      const json = await proxyResp.json();
      if (json && json.status) return json;
    }
  } catch {
    // Proxy fallback to direct fetch
  }

  // 2. Direct fetch with CORS fallback
  const url = (import.meta.env.VITE_GOOGLE_SCRIPT_URL as string | undefined) || DEFAULT_SCRIPT_URL;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google Script returned status ${response.status}`);
    }

    const resText = await response.text();
    try {
      return JSON.parse(resText);
    } catch {
      return { status: "success", message: resText };
    }
  } catch {
    // 3. Mode no-cors fallback if browser blocks cross-origin POST
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
      });
      return { status: "success", message: "Dispatched booking append to Google Sheet." };
    } catch (err: any) {
      throw new Error(`Google Sheet sync failed: ${err.message}`);
    }
  }
}

/**
 * Updates an existing booking row in Google Sheets via serverless proxy or Apps Script Web App.
 */
export async function updateBookingInSheet({
  pn,
  values,
}: {
  pn: string;
  values: string[];
}): Promise<{ status: string; message?: string }> {
  const payload = {
    action: "updateRow",
    pn,
    values,
  };

  // 1. Try Vercel Serverless proxy first (bypasses browser CORS completely)
  try {
    const proxyResp = await fetch("/api/sheet-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (proxyResp.ok) {
      const json = await proxyResp.json();
      if (json && json.status) return json;
    }
  } catch {
    // Proxy fallback to direct fetch
  }

  // 2. Direct fetch with CORS fallback
  const url = (import.meta.env.VITE_GOOGLE_SCRIPT_URL as string | undefined) || DEFAULT_SCRIPT_URL;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google Script returned status ${response.status}`);
    }

    const resText = await response.text();
    try {
      return JSON.parse(resText);
    } catch {
      return { status: "success", message: resText };
    }
  } catch {
    // 3. Mode no-cors fallback if browser blocks cross-origin POST
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
      });
      return { status: "success", message: "Dispatched booking update to Google Sheet." };
    } catch (err: any) {
      throw new Error(`Google Sheet sync failed: ${err.message}`);
    }
  }
}
