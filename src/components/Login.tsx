import { useEffect, useState } from "react";
import { AlertCircle, LogIn, KeyRound } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

interface UserSession {
  name: string;
  email: string;
  picture: string;
  token: string;
}

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  const handleCredentialResponse = (response: any) => {
    setError(null);
    const payload = parseJwt(response.credential);
    if (!payload) {
      setError("Could not parse login credential. Please try again.");
      return;
    }

    const email = payload.email || "";
    const emailDomain = email.split("@")[1]?.toLowerCase();

    if (emailDomain !== "travclan.com") {
      setError(`Access Denied: ${email} is not authorized. You must use a @travclan.com account to login.`);
      return;
    }

    const session: UserSession = {
      name: payload.name || "TravClan Operator",
      email: payload.email,
      picture: payload.picture || "",
      token: response.credential,
    };

    localStorage.setItem("travclan_user_session", JSON.stringify(session));
    onLoginSuccess(session);
  };

  useEffect(() => {
    let intervalId: any;

    const initializeGsi = () => {
      if (window.google?.accounts?.id) {
        clearInterval(intervalId);
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        const btnElement = document.getElementById("google-signin-btn");
        if (btnElement) {
          window.google.accounts.id.renderButton(btnElement, {
            theme: "filled_blue",
            size: "large",
            width: 320,
            text: "signin_with",
            shape: "pill",
          });
        }
      }
    };

    if (clientId) {
      intervalId = setInterval(initializeGsi, 150);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [clientId]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 overflow-hidden font-sans">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        {/* Logo / Header Branding */}
        <div className="mb-8 text-center animate-fade-in duration-700">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-950/20 px-3 py-1 text-xs font-semibold text-orange-400 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
            Operations Control Center
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Cleartrip <span className="bg-gradient-to-r from-orange-400 to-cyan-400 bg-clip-text text-transparent">×</span> TravClan
          </h1>
          <p className="mt-2.5 text-sm text-slate-400 font-medium">
            Post-Booking Management Dashboard
          </p>
        </div>

        {/* Card Component */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-cyan-500/20 border border-slate-700/50 shadow-inner">
              <KeyRound className="h-6 w-6 text-orange-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">Domain Restricted Login</h2>
            <p className="mt-2 text-xs text-slate-400 max-w-[280px]">
              Access to this control panel is restricted to verified operators with a <span className="text-cyan-400 font-bold">@travclan.com</span> email address.
            </p>
          </div>

          {error && (
            <div className="mt-6 flex gap-2.5 rounded-xl border border-red-500/20 bg-red-950/20 p-3.5 text-xs text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            {!clientId ? (
              <div className="w-full text-center border border-dashed border-amber-500/20 bg-amber-950/10 rounded-xl p-4">
                <p className="text-xs text-amber-300 font-semibold">
                  Google Client ID is missing!
                </p>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Please define the variable <code className="text-amber-400 font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded">VITE_GOOGLE_CLIENT_ID</code> in your Vercel project configuration or local <code className="text-[9px]">.env</code> file, then refresh.
                </p>
              </div>
            ) : (
              <div className="relative group w-[320px] transition-transform duration-200 hover:scale-[1.02]">
                {/* Background button glow */}
                <div className="absolute inset-0 -z-10 rounded-full bg-cyan-400/20 opacity-0 group-hover:opacity-100 blur-md transition duration-200" />
                <div id="google-signin-btn" className="flex justify-center" />
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-600">
          Powered by TravClan Ops Engineering. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
