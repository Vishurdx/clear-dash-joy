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
 * Website-only concept:
 * If a guest pays 2nd installment (installment2Status is "Received" or "Not Applicable"),
 * their FOC for 3rd installment (Land package) shifts to 10 days prior to their travel date.
 */
export function getEffectiveFoc(b: {
  freeCancellationDate?: string;
  travelDate?: string;
  installment2Status?: string;
}): { focDate: string; isShifted: boolean } {
  const rawFoc = b.freeCancellationDate || "";
  const inst2Status = b.installment2Status?.toLowerCase() || "";
  const inst2Received = inst2Status === "received" || inst2Status === "not applicable";

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
      const rawFoc = row[5]?.toString()?.trim() || "";
      const travelDate = row[4]?.toString()?.trim() || "";
      const inst2Status = row[66]?.toString()?.trim() || "";
      const focInfo = getEffectiveFoc({
        freeCancellationDate: rawFoc,
        travelDate,
        installment2Status: inst2Status,
      });

      return {
        pn: row[2]?.toString()?.trim() || "",
        leadPax: row[12]?.toString()?.trim() || "",
        destination: row[16]?.toString()?.trim() || "",
        travelDate,
        freeCancellationDate: rawFoc,
        effectiveFocDate: focInfo.focDate,
        isFocShifted: focInfo.isShifted,
        dailyUpdates: row[1]?.toString()?.trim() || "",
        createdDate: row[10]?.toString()?.trim() || "",
        installment1Date: row[60]?.toString()?.trim() || "",
        installment1Status: row[63]?.toString()?.trim() || "",
        installment1Amount: parseNum(row[61]),
        installment2Date: row[64]?.toString()?.trim() || "",
        installment2Amount: parseNum(row[65]),
        installment2Status: row[66]?.toString()?.trim() || "",
        installment3Date: row[67]?.toString()?.trim() || "",
        installment3Amount: parseNum(row[68]),
        installment3Status: row[69]?.toString()?.trim() || "",
        paymentCollected: row[74]?.toString()?.trim() || "",
        pendingAmount: parseNum(row[71]),
        totalInstallmentAmount: parseNum(row[72]),
        discrepancy: row[73]?.toString()?.trim() || "",
        paymentReminder: row[75]?.toString()?.trim() || "",
        opsRm: row[13]?.toString()?.trim() || "",
        seller: row[20]?.toString()?.trim() || "",
        finalVoucher: row[18]?.toString()?.trim() || "",
        tripStatus: row[85]?.toString()?.trim() || "",
        firstCallStatus: row[26]?.toString()?.trim() || "",
        postBookingCalls: row[82]?.toString()?.trim() || "",

        // Adults, child, infant
        adult: parseNum(row[7]),
        child: parseNum(row[8]),
        infant: parseNum(row[9]),

        // SP info
        flightSp: parseNum(row[38]),
        hotelSp: parseNum(row[39]),
        landSp: parseNum(row[40]),
        visaSp: parseNum(row[41]),
        finalTtv: parseNum(row[42]),
        totalSp: parseNum(row[34]),

        // Vouchers
        hotelVoucher: row[28]?.toString()?.trim() || "",
        landVoucher: row[29]?.toString()?.trim() || "",
        visaVoucher: row[30]?.toString()?.trim() || "",
        flightVoucher: row[31]?.toString()?.trim() || "",
        voucherPending: row[32]?.toString()?.trim() || "",
        preTrip: row[84]?.toString()?.trim() || "",
        daysToTravel: row[93]?.toString()?.trim() || "",
        matrics: row[19]?.toString()?.trim() || "",
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

/**
 * Appends a new booking row to Google Sheets via the Apps Script Web App.
 * The script URL must be set in VITE_GOOGLE_SCRIPT_URL env var.
 */
export async function addBookingToSheet(rowValues: string[]): Promise<{ status: string; message?: string }> {
  const url = import.meta.env.VITE_GOOGLE_SCRIPT_URL as string | undefined;

  if (!url) {
    console.warn("VITE_GOOGLE_SCRIPT_URL is not set. Saving locally only.");
    return { status: "local_only" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      action: "appendRow",
      values: rowValues,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Script Web App returned status ${response.status}`);
  }

  const resText = await response.text();
  try {
    return JSON.parse(resText);
  } catch {
    if (resText.includes("completed but did not return anything")) {
      throw new Error(
        "Your Google Apps Script Web App does not support the 'appendRow' action or completed without returning. Please check your Apps Script code.",
      );
    }
    throw new Error(`Failed to parse Google Script response: ${resText}`);
  }
}

/**
 * Updates an existing booking row in Google Sheets via the Apps Script Web App.
 */
export async function updateBookingInSheet({
  pn,
  values,
}: {
  pn: string;
  values: string[];
}): Promise<{ status: string; message?: string }> {
  const url = import.meta.env.VITE_GOOGLE_SCRIPT_URL as string | undefined;

  if (!url) {
    console.warn("VITE_GOOGLE_SCRIPT_URL is not set. Saving locally only.");
    return { status: "local_only" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      action: "updateRow",
      pn,
      values,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Script Web App returned status ${response.status}`);
  }

  const resText = await response.text();
  try {
    return JSON.parse(resText);
  } catch {
    if (resText.includes("completed but did not return anything")) {
      throw new Error(
        "Your Google Apps Script Web App does not support the 'updateRow' action. Please update your spreadsheet's Script Editor with the doPost code that supports updating rows, then deploy as a New Deployment.",
      );
    }
    throw new Error(`Failed to parse Google Script response: ${resText}`);
  }
}
