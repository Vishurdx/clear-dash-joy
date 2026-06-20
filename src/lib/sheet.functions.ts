import { createServerFn } from "@tanstack/react-start";
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
  Low = "Low"
}
export type Booking = {
  pn: string; // Booking reference number
  leadPax: string; // Lead/Passenger name
  destination: string;
  travelDate: string; // ISO date string (e.g., "2024-12-31")
  freeCancellationDate: string; // "FOC" date
  installment1Status?: string; // Status for installment 1 (column BK)
  installment2Date: string; // Due date for installment 2 (column BL)
  installment2Status: string; // Status for installment 2 (column BN)
  installment3Date: string; // Due date for installment 3 (column BO)
  installment3Status: string; // Status for installment 3 (column BQ)
  paymentCollected: string; // "Yes" / "No" (column BV)
  pendingAmount: number; // Pending amount (numeric)
  opsRm: string; // Assigned Relationship Manager
  seller?: string; // Seller column (optional)
  finalVoucher?: string; // Final Voucher column (optional)
  tripStatus?: string; // Trip Status column (optional)
  installment1Amount?: number; // 1st installment amount (BI column)
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
  // Removed erroneous React hook
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  // Reset time components to ignore time‑of‑day differences
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
 * Server function that fetches the CSV, parses it, and returns a list of bookings.
 */
export const fetchBookings = createServerFn({ method: "GET" }).handler(async () => {
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
      return {
        pn: row[2]?.toString()?.trim() || "",
        leadPax: row[11]?.toString()?.trim() || "",
        destination: row[15]?.toString()?.trim() || "",
        travelDate: row[4]?.toString()?.trim() || "",
        freeCancellationDate: row[5]?.toString()?.trim() || "",
        installment1Status: row[62]?.toString()?.trim() || "",
        installment2Date: row[63]?.toString()?.trim() || "",
        installment2Status: row[65]?.toString()?.trim() || "",
        installment3Date: row[66]?.toString()?.trim() || "",
        installment3Status: row[68]?.toString()?.trim() || "",
        paymentCollected: row[73]?.toString()?.trim() || "",
        pendingAmount: parseNum(row[70]),
        installment1Amount: parseNum(row[60]),
        opsRm: row[12]?.toString()?.trim() || "",
        seller: row[19]?.toString()?.trim() || "",
        finalVoucher: row[17]?.toString()?.trim() || "",
        tripStatus: row[84]?.toString()?.trim() || "",

        // Adults, child, infant
        adult: parseNum(row[6]),
        child: parseNum(row[7]),
        infant: parseNum(row[8]),

        // SP info
        flightSp: parseNum(row[37]),
        hotelSp: parseNum(row[38]),
        landSp: parseNum(row[39]),
        visaSp: parseNum(row[40]),
        finalTtv: parseNum(row[41]),
        totalSp: parseNum(row[33]),

        // Vouchers
        hotelVoucher: row[27]?.toString()?.trim() || "",
        landVoucher: row[28]?.toString()?.trim() || "",
        visaVoucher: row[29]?.toString()?.trim() || "",
        flightVoucher: row[30]?.toString()?.trim() || "",
        voucherPending: row[31]?.toString()?.trim() || "",
        preTrip: row[83]?.toString()?.trim() || "",
        daysToTravel: row[92]?.toString()?.trim() || "",
        matrics: row[18]?.toString()?.trim() || "",
      };
    });

  console.log('Fetched rows count:', rows.length);

  return { rows, fetchedAt: new Date().toISOString() };
});
