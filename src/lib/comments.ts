const BUCKET_ID = "X9HkWZ3y7L2M5N8P"; // Public KV bucket for Opsdash notes sync
const PRIMARY_KV_URL = `https://kvdb.io/${BUCKET_ID}`;
const ALT_KEYVAL_APP_KEY = "kvdc4k1z";

const commentChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("opsdash_comments_channel")
    : null;

export function subscribeToCommentChanges(
  cb: (data: { pn: string; type: "inst" | "vouch"; text: string }) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (e: MessageEvent) => {
    if (e.data && e.data.pn && e.data.type !== undefined) {
      cb(e.data);
    }
  };

  commentChannel?.addEventListener("message", handleMessage);

  const handleStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith("local_comment_")) {
      const parts = e.key.split("_");
      const type = parts[2] as "inst" | "vouch";
      const pn = parts.slice(3).join("_");
      if (pn && type) {
        cb({ pn, type, text: e.newValue || "" });
      }
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    commentChannel?.removeEventListener("message", handleMessage);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function getPNComment(pn: string, type: "inst" | "vouch"): Promise<string> {
  const localKey = `local_comment_${type}_${pn}`;
  const localVal = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
  const key = `${type}_${pn}`;

  // Try Primary KV store (kvdb.io)
  try {
    const resp = await fetch(`${PRIMARY_KV_URL}/${key}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const text = (await resp.text()).trim();
      if (text && text !== "_EMPTY_") {
        let finalVal = text;
        if (text.startsWith("b64:")) {
          const decoded = fromBase64Url(text.slice(4));
          if (decoded) finalVal = decoded;
        }
        if (typeof window !== "undefined") {
          localStorage.setItem(localKey, finalVal);
        }
        return finalVal;
      } else if (text === "_EMPTY_") {
        if (typeof window !== "undefined") localStorage.removeItem(localKey);
        return "";
      }
    }
  } catch (e) {
    // Ignore and fallback
  }

  // Try Secondary KeyVal store
  try {
    const altUrl = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${ALT_KEYVAL_APP_KEY}/${key}`;
    const resp = await fetch(altUrl, { signal: AbortSignal.timeout(2500) });
    if (resp.ok) {
      const txt = await resp.text();
      if (txt && txt !== '""') {
        let raw = "";
        try {
          raw = JSON.parse(txt) || "";
        } catch {
          raw = txt.replace(/^"|"$/g, "");
        }
        if (raw && raw !== "_EMPTY_") {
          let finalVal = raw;
          if (raw.startsWith("b64:")) {
            const decoded = fromBase64Url(raw.slice(4));
            if (decoded) finalVal = decoded;
          }
          if (typeof window !== "undefined") {
            localStorage.setItem(localKey, finalVal);
          }
          return finalVal;
        }
      }
    }
  } catch (e) {
    // Ignore and fallback
  }

  return localVal || "";
}

export async function savePNComment(pn: string, type: "inst" | "vouch", text: string): Promise<boolean> {
  const localKey = `local_comment_${type}_${pn}`;
  const cleanText = text.trim();
  const key = `${type}_${pn}`;

  // 1. Immediately update localStorage & notify other tabs on this browser
  if (typeof window !== "undefined") {
    if (cleanText) {
      localStorage.setItem(localKey, cleanText);
    } else {
      localStorage.removeItem(localKey);
    }
  }

  commentChannel?.postMessage({ pn, type, text: cleanText });

  const valToSend = cleanText ? `b64:${toBase64Url(cleanText)}` : "_EMPTY_";

  // 2. Write to Primary KV store (kvdb.io)
  try {
    await fetch(`${PRIMARY_KV_URL}/${key}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: valToSend,
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    // Fallback attempt
  }

  // 3. Write to Secondary KeyVal store
  try {
    const url = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${ALT_KEYVAL_APP_KEY}/${key}/${valToSend}`;
    fetch(url, { method: "POST" }).catch(() => {});
  } catch (e) {
    // Ignore background error
  }

  return true;
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
          const resp = await fetch(`${PRIMARY_KV_URL}/history_slot_${slot}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!resp.ok) return null;
          const txt = (await resp.text()).trim();
          if (!txt || txt === "_EMPTY_") return null;
          const decoded = fromBase64Url(txt.replace(/^"|"$/g, ""));
          if (!decoded) return null;
          return JSON.parse(decoded);
        } catch (e) {
          return null;
        }
      })
    );
    return (logs.filter((l) => l !== null) as EditLog[]).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error("Failed to load edit logs:", e);
    return [];
  }
}

export async function pushEditLog(pn: string, action: string, userName: string, userEmail: string): Promise<boolean> {
  try {
    let ptr = 1;
    try {
      const ptrResp = await fetch(`${PRIMARY_KV_URL}/history_pointer`, {
        signal: AbortSignal.timeout(3000),
      });
      if (ptrResp.ok) {
        const ptrTxt = (await ptrResp.text()).trim();
        const num = parseInt(ptrTxt, 10);
        if (!isNaN(num) && num >= 1 && num <= 25) {
          ptr = num;
        }
      }
    } catch {
      // Ignore fallback
    }

    const record: EditLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: Date.now(),
      userName,
      userEmail,
      pn,
      action,
    };

    const b64 = toBase64Url(JSON.stringify(record));
    await fetch(`${PRIMARY_KV_URL}/history_slot_${ptr}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: b64,
    }).catch(() => {});

    const nextPtr = ptr >= 25 ? 1 : ptr + 1;
    await fetch(`${PRIMARY_KV_URL}/history_pointer`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: nextPtr.toString(),
    }).catch(() => {});

    return true;
  } catch (e) {
    console.error("Failed to push edit log:", e);
    return false;
  }
}
