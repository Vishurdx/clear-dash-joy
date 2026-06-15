import { createServerFn } from "@tanstack/react-start";
import Papa from "papaparse";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/18RQr7HBcjye3bZy8ec4j5YeFcYIgXChFnfZr2-w_Dr0/export?format=csv&gid=0";

export type Booking = {
  pn: string;
  leadPax: string;
  destination: string;
  travelDate: string;
  matrics: string;
  adult: number;
  child: number;
  infant: number;
  seller: string;
  opsRm: string;
  flightSp: number;
  hotelSp: number;
  landSp: number;
  visaSp: number;
  finalTtv: number;
  totalSp: number;
  paymentCollected: string;
  pendingAmount: number;
  preTrip: string;
  daysToTravel: string;
  voucherPending: string;
  hotelVoucher: string;
  landVoucher: string;
  visaVoucher: string;
  flightVoucher: string;
  finalVoucher: string;
  tripStatus: string;
  freeCancellationDate: string;
};

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[,₹\s-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function s(v: string | undefined): string {
  return (v ?? "").trim();
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const normalized = candidates.map(normalizeHeader);
  const match = headers.findIndex((header) => normalized.includes(normalizeHeader(header)));
  return match >= 0 ? match : -1;
}

export const fetchBookings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rows: Booking[]; fetchedAt: string }> => {
    const cacheId = Date.now();
    const url = `${SHEET_CSV_URL}&rand=${cacheId}`;
    const res = await fetch(url, {
      headers: {
        "cache-control": "no-cache",
        "pragma": "no-cache"
      }
    });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const all = parsed.data as string[][];
    const headers = all[1] ?? [];
    const data = all.slice(2);

    const idx = {
      pn: headerIndex(headers, "PN. Number", "PN Number", "PN"),
      leadPax: headerIndex(headers, "Lead pax name", "Lead pax"),
      destination: headerIndex(headers, "Destination"),
      travelDate: headerIndex(headers, "Date of Travel", "Travel Date"),
      matrics: headerIndex(headers, "Matrics"),
      adult: headerIndex(headers, "Adult"),
      child: headerIndex(headers, "Child"),
      infant: headerIndex(headers, "Infant"),
      seller: headerIndex(headers, "Seller name dropdown", "Seller name", "Seller"),
      opsRm: headerIndex(headers, "Ops RM", "OpsRM"),
      flightSp: headerIndex(headers, "Flights SP", "Flight SP"),
      hotelSp: headerIndex(headers, "Hotel SP"),
      landSp: headerIndex(headers, "Land SP"),
      visaSp: headerIndex(headers, "VISA SP", "Visa SP"),
      finalTtv: headerIndex(headers, "Final ttv", "Final TTV"),
      totalSp: headerIndex(headers, "Total SP"),
      paymentCollected: headerIndex(headers, "Final Payment Collected", "Payment Collected"),
      pendingAmount: headerIndex(headers, "Pending Final Amount", "Pending Amount"),
      preTrip: headerIndex(headers, "Pre Trip", "PreTrip"),
      daysToTravel: headerIndex(headers, "Days to Travel"),
      voucherPending: headerIndex(headers, "Voucher Pending"),
      hotelVoucher: headerIndex(headers, "Hotel voucher"),
      landVoucher: headerIndex(headers, "Land Voucher"),
      visaVoucher: headerIndex(headers, "Visa voucher", "Visa Voucher"),
      flightVoucher: headerIndex(headers, "Flight voucher", "Flight Voucher"),
      finalVoucher: headerIndex(headers, "Final voucher", "Final Voucher"),
      tripStatus: headerIndex(headers, "Trip Status", "Trip status"),
      freeCancellationDate: headerIndex(headers, "Free Cancellation Date", "Free Cancellation", "Cancellation Date"),
      installments: headerIndex(headers, "Total installment amount", "Installment amount"),
    };

    const rows: Booking[] = data
      .map((r) => {
        const pn = s(idx.pn >= 0 ? r[idx.pn] : undefined);
        const totalSp = num(idx.totalSp >= 0 ? r[idx.totalSp] : undefined);
        const installments = num(idx.installments >= 0 ? r[idx.installments] : undefined);
        const finalCollected = s(idx.paymentCollected >= 0 ? r[idx.paymentCollected] : undefined);
        const bsPendingAmount = num(idx.pendingAmount >= 0 ? r[idx.pendingAmount] : undefined);
        const pending =
          bsPendingAmount > 0
            ? bsPendingAmount
            : finalCollected.toLowerCase() === "yes"
              ? 0
              : Math.max(totalSp - installments, 0);
        return {
          pn,
          leadPax: s(idx.leadPax >= 0 ? r[idx.leadPax] : undefined),
          destination: s(idx.destination >= 0 ? r[idx.destination] : undefined),
          travelDate: s(idx.travelDate >= 0 ? r[idx.travelDate] : undefined),
          matrics: s(idx.matrics >= 0 ? r[idx.matrics] : undefined),
          adult: num(idx.adult >= 0 ? r[idx.adult] : undefined),
          child: num(idx.child >= 0 ? r[idx.child] : undefined),
          infant: num(idx.infant >= 0 ? r[idx.infant] : undefined),
          seller: s(idx.seller >= 0 ? r[idx.seller] : undefined),
          opsRm: s(idx.opsRm >= 0 ? r[idx.opsRm] : undefined),
          flightSp: num(idx.flightSp >= 0 ? r[idx.flightSp] : undefined),
          hotelSp: num(idx.hotelSp >= 0 ? r[idx.hotelSp] : undefined),
          landSp: num(idx.landSp >= 0 ? r[idx.landSp] : undefined),
          visaSp: num(idx.visaSp >= 0 ? r[idx.visaSp] : undefined),
          finalTtv: num(idx.finalTtv >= 0 ? r[idx.finalTtv] : undefined),
          totalSp,
          paymentCollected: finalCollected,
          pendingAmount: pending,
          preTrip: s(idx.preTrip >= 0 ? r[idx.preTrip] : undefined),
          daysToTravel: s(idx.daysToTravel >= 0 ? r[idx.daysToTravel] : undefined),
          voucherPending: s(idx.voucherPending >= 0 ? r[idx.voucherPending] : undefined),
          hotelVoucher: s(idx.hotelVoucher >= 0 ? r[idx.hotelVoucher] : undefined),
          landVoucher: s(idx.landVoucher >= 0 ? r[idx.landVoucher] : undefined),
          visaVoucher: s(idx.visaVoucher >= 0 ? r[idx.visaVoucher] : undefined),
          flightVoucher: s(idx.flightVoucher >= 0 ? r[idx.flightVoucher] : undefined),
          finalVoucher: s(idx.finalVoucher >= 0 ? r[idx.finalVoucher] : undefined),
          tripStatus: s(idx.tripStatus >= 0 ? r[idx.tripStatus] : undefined),
          freeCancellationDate: s(idx.freeCancellationDate >= 0 ? r[idx.freeCancellationDate] : undefined),
        };
      })
      .filter((r) => r.pn);

    return { rows, fetchedAt: new Date().toISOString() };
  },
);
