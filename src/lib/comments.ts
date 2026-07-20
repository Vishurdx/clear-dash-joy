const APP_KEY = "kvdc4k1z";

export async function getPNComment(pn: string, type: "inst" | "vouch"): Promise<string> {
  const localKey = `local_comment_${type}_${pn}`;
  try {
    const key = `${type}_${pn}`;
    const url = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${APP_KEY}/${key}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return (typeof window !== "undefined" ? localStorage.getItem(localKey) : "") || "";
    }
    const txt = await resp.text();
    if (!txt || txt === '""') return "";
    
    let raw = "";
    try {
      raw = JSON.parse(txt) || "";
    } catch {
      raw = txt.replace(/^"|"$/g, "");
    }
    
    if (!raw || raw === "_EMPTY_") {
      if (typeof window !== "undefined") localStorage.removeItem(localKey);
      return "";
    }

    let finalVal = raw;
    if (raw.startsWith("b64:")) {
      const decoded = fromBase64Url(raw.slice(4));
      if (decoded) finalVal = decoded;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(localKey, finalVal);
    }
    return finalVal;
  } catch (e) {
    console.error("Failed to fetch comment for", pn, e);
    return (typeof window !== "undefined" ? localStorage.getItem(localKey) : "") || "";
  }
}

export async function savePNComment(pn: string, type: "inst" | "vouch", text: string): Promise<boolean> {
  const localKey = `local_comment_${type}_${pn}`;
  try {
    const key = `${type}_${pn}`;
    const cleanText = text.trim();

    if (typeof window !== "undefined") {
      if (cleanText) {
        localStorage.setItem(localKey, cleanText);
      } else {
        localStorage.removeItem(localKey);
      }
    }

    const valToSend = cleanText ? `b64:${toBase64Url(cleanText)}` : "_EMPTY_";
    const url = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${APP_KEY}/${key}/${valToSend}`;
    const resp = await fetch(url, { method: "POST" });
    if (!resp.ok) {
      console.warn("KeyVal remote save non-ok status:", resp.status);
      return true; // Return true because local cache succeeded
    }
    return true;
  } catch (e) {
    console.error("Failed to save comment for", pn, e);
    return true;
  }
}

// ─── Shared Activity Log/Edit History (Circular Buffer of 25 items) ───

export interface EditLog {
  id: string;
  timestamp: number;
  userName: string;
  userEmail: string;
  pn: string;
  action: string;
}

function toBase64Url(str: string): string {
  try {
    const base64 = window.btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  } catch (e) {
    console.error("Failed to base64 encode:", e);
    return "";
  }
}

function fromBase64Url(base64url: string): string {
  try {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const raw = window.atob(base64);
    return decodeURIComponent(
      raw.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch (e) {
    console.error("Failed to base64 decode:", e);
    return "";
  }
}

export async function getEditLogs(): Promise<EditLog[]> {
  try {
    const slots = Array.from({ length: 25 }, (_, i) => i + 1);
    const logs = await Promise.all(
      slots.map(async (slot) => {
        try {
          const url = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${APP_KEY}/history_slot_${slot}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const txt = await resp.text();
          if (!txt || txt === '""') return null;
          
          // Unquote the outer string from the keyvalue store response
          const cleanB64 = JSON.parse(txt);
          if (!cleanB64) return null;
          
          const decoded = fromBase64Url(cleanB64);
          if (!decoded) return null;
          
          return JSON.parse(decoded);
        } catch (e) {
          return null;
        }
      })
    );
    // Filter out nulls and sort by timestamp descending
    return (logs.filter((l) => l !== null) as EditLog[]).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error("Failed to load edit logs:", e);
    return [];
  }
}

export async function pushEditLog(pn: string, action: string, userName: string, userEmail: string): Promise<boolean> {
  try {
    // 1. Get current pointer
    const ptrUrl = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${APP_KEY}/history_pointer`;
    const ptrResp = await fetch(ptrUrl);
    let ptr = 1;
    if (ptrResp.ok) {
      const ptrTxt = await ptrResp.text();
      if (ptrTxt && ptrTxt !== '""') {
        const num = parseInt(JSON.parse(ptrTxt), 10);
        if (!isNaN(num) && num >= 1 && num <= 25) {
          ptr = num;
        }
      }
    }

    // 2. Base64 encode log payload and write to current slot
    const record: EditLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: Date.now(),
      userName,
      userEmail,
      pn,
      action
    };
    const b64 = toBase64Url(JSON.stringify(record));
    const writeUrl = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${APP_KEY}/history_slot_${ptr}/${b64}`;
    await fetch(writeUrl, { method: "POST" });

    // 3. Move pointer to next slot (wrap to 1 if 25)
    const nextPtr = ptr >= 25 ? 1 : ptr + 1;
    const updatePtrUrl = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${APP_KEY}/history_pointer/${nextPtr}`;
    await fetch(updatePtrUrl, { method: "POST" });

    return true;
  } catch (e) {
    console.error("Failed to push edit log:", e);
    return false;
  }
}
