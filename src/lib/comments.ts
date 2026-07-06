const APP_KEY = "kvdc4k1z";

export async function getPNComment(pn: string, type: "inst" | "vouch"): Promise<string> {
  try {
    const key = `${type}_${pn}`;
    const url = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${APP_KEY}/${key}`;
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const txt = await resp.text();
    if (!txt) return "";
    try {
      // JSON.parse handles unquoting the string returned by the API
      return JSON.parse(txt) || "";
    } catch {
      return txt.replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.error("Failed to fetch comment for", pn, e);
    return "";
  }
}

export async function savePNComment(pn: string, type: "inst" | "vouch", text: string): Promise<boolean> {
  try {
    const key = `${type}_${pn}`;
    const cleanText = text.trim();
    const encoded = encodeURIComponent(cleanText);
    const url = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${APP_KEY}/${key}/${encoded}`;
    const resp = await fetch(url, { method: "POST" });
    if (!resp.ok) return false;
    const txt = await resp.text();
    return txt === "true";
  } catch (e) {
    console.error("Failed to save comment for", pn, e);
    return false;
  }
}
