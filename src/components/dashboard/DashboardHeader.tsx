import { useEffect, useRef, useState } from "react";
import { AlertCircle, Cast, LogOut, User as UserIcon } from "lucide-react";
import { useStore } from "../../store";
import OBSSetupGuide from "../control-panel/OBSSetupGuide";

export default function DashboardHeader() {
  const user = useStore((state) => state.user);
  const isConnected = useStore((state) => state.isConnected);
  const logout = useStore((state) => state.logout);
  const [imageError, setImageError] = useState(false);
  const [isOBSGuideOpen, setIsOBSGuideOpen] = useState(false);
  const hasCheckedOnboardingRef = useRef(false);

  useEffect(() => {
    if (!user || hasCheckedOnboardingRef.current) return;
    hasCheckedOnboardingRef.current = true;
    void (async () => {
      try {
        // @ts-ignore
        const baseUrl = (import.meta.env.VITE_BASE_URL || window.location.origin).replace(/\/+$/, "");
        const token = await user.getIdToken();
        const response = await fetch(`${baseUrl}/api/onboarding`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (!data.obsSetupSeen) setIsOBSGuideOpen(true);
        }
      } catch (error) {
        console.error("Failed to load onboarding state:", error);
      }
    })();
  }, [user]);

  return (
    <>
    <header className="bg-white/[0.03] backdrop-blur-xl border-b border-white/10">
      <div className="px-3 py-2 sm:px-6 sm:py-4 flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
          {isConnected ? (
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" title="Connected to server" />
          ) : (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-red-500/15 text-red-400"
              title="Server connection lost"
            >
              <AlertCircle size={14} />
            </span>
          )}
          <span>Hockey Scoreboard</span>
        </h1>

        {user && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
              title="Set up the overlay in OBS"
            >
              <Cast size={16} />
              <span>OBS Setup</span>
            </button>
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="sm:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
              title="Set up the overlay in OBS"
            >
              <Cast size={18} />
            </button>
            <div className="flex items-center gap-2">
              {user.photoURL && !imageError ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || ""}
                  className="w-8 h-8 rounded-full border border-white/15"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center">
                  <UserIcon size={14} className="text-zinc-400" />
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium text-zinc-300">{user.displayName}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>

    <OBSSetupGuide isOpen={isOBSGuideOpen} onClose={() => setIsOBSGuideOpen(false)} />
    </>
  );
}
