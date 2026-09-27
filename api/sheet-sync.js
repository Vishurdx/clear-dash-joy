export default async function handler(req, res) {
  // Set CORS headers for API route
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    const SHEET_CSV_URL =
      "https://docs.google.com/spreadsheets/d/18RQr7HBcjye3bZy8ec4j5YeFcYIgXChFnfZr2-w_Dr0/export?format=csv&gid=0";

    try {
      const googleResponse = await fetch(SHEET_CSV_URL);
      if (!googleResponse.ok) {
        throw new Error(`Google Sheet returned status ${googleResponse.status}`);
      }
      const csvText = await googleResponse.text();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.status(200).send(csvText);
      return;
    } catch (err) {
      console.error("Sheet CSV fetch proxy error:", err);
      res.status(500).json({ status: "error", message: err.toString() });
      return;
    }
  }

  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const SCRIPT_URL =
    process.env.VITE_GOOGLE_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbz5JpbQj-JQJzytf27gLJc-62aGF7RiIYqYJR3DcJKdw-emlbe4ozyUGDAnW5SO7bGe/exec";

  try {
    const payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const googleResponse = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: payload,
      redirect: "follow",
    });

    const resText = await googleResponse.text();
    try {
      const data = JSON.parse(resText);
      res.status(200).json(data);
    } catch {
      res.status(200).json({ status: "success", message: resText });
    }
  } catch (err) {
    console.error("Sheet sync proxy error:", err);
    res.status(500).json({ status: "error", message: err.toString() });
  }
}

