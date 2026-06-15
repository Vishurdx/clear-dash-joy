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
};

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[,₹\s-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function s(v: string | undefined): string {
  return (v ?? "").trim();
}

export const fetchBookings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rows: Booking[]; fetchedAt: string }> => {
    const res = await fetch(SHEET_CSV_URL, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const all = parsed.data as string[][];
    // Row 0: group header. Row 1: column headers. Data starts at row 2.
    const data = all.slice(2);

    const rows: Booking[] = data
      .map((r) => {
        const pn = s(r[2]);
        const totalSp = num(r[33]);
        const installments = num(r[71]);
        const finalCollected = s(r[73]);
        const pending = finalCollected.toLowerCase() === "yes" ? 0 : Math.max(totalSp - installments, 0);
        return {
          pn,
          leadPax: s(r[11]),
          destination: s(r[15]),
          travelDate: s(r[4]),
          matrics: s(r[18]),
          adult: num(r[6]),
          child: num(r[7]),
          infant: num(r[8]),
          seller: s(r[19]),
          opsRm: s(r[12]),
          flightSp: num(r[37]),
          hotelSp: num(r[38]),
          landSp: num(r[39]),
          visaSp: num(r[40]),
          finalTtv: num(r[41]),
          totalSp,
          paymentCollected: finalCollected,
          pendingAmount: pending,
          preTrip: s(r[83]),
          daysToTravel: s(r[92]),
          voucherPending: s(r[31]),
          hotelVoucher: s(r[27]),
          landVoucher: s(r[28]),
          visaVoucher: s(r[29]),
          flightVoucher: s(r[30]),
          finalVoucher: s(r[17]),
        };
      })
      .filter((r) => r.pn);

    return { rows, fetchedAt: new Date().toISOString() };
  },
);
