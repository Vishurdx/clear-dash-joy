import Papa from 'papaparse';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/18RQr7HBcjye3bZy8ec4j5YeFcYIgXChFnfZr2-w_Dr0/export?format=csv&gid=0";

async function main() {
  const res = await fetch(SHEET_CSV_URL);
  const text = await res.text();
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  const all = parsed.data;
  
  const tripStatusValues = new Set();
  const bookingsWithPending = [];
  
  const headers = all[1] ?? [];
  const idx = headers.indexOf("Trip Status");
  const pnIdx = headers.indexOf("PN. Number");
  const leadIdx = headers.indexOf("Lead pax name");
  const pendingIdx = headers.indexOf("Pending Final Amount");
  
  for (let i = 2; i < all.length; i++) {
    const row = all[i];
    const status = (row[idx] || "").trim();
    tripStatusValues.add(status);
    
    const pendingVal = Number((row[pendingIdx] || "").replace(/[,₹\s-]/g, "")) || 0;
    if (pendingVal > 0) {
      bookingsWithPending.push({
        pn: row[pnIdx],
        leadPax: row[leadIdx],
        status: status,
        pending: pendingVal
      });
    }
  }

  console.log("Unique Trip Status values:", Array.from(tripStatusValues));
  console.log("\nBookings with pending amount > 0:");
  console.log(bookingsWithPending);
}

main().catch(console.error);
