import { useState } from "react";
import { AlertCircle, Cast, LogOut, User as UserIcon } from "lucide-react";
import { useStore } from "../../store";
import OBSSetupGuide from "../control-panel/OBSSetupGuide";
import { Wordmark } from "../control-panel/ui/primitives";

export default function DashboardHeader() {
  const user = useStore((state) => state.user);
  const isConnected = useStore((state) => state.isConnected);
  const logout = useStore((state) => state.logout);
  const [imageError, setImageError] = useState(false);
  const [isOBSGuideOpen, setIsOBSGuideOpen] = useState(false);

  return (
    <>
    <header className="bg-canvas border-b border-line">
      <div className="px-3 py-2 sm:px-6 sm:py-4 flex items-center justify-between gap-2">
        <h1 className="text-lg flex items-center gap-2 min-w-0">
          <Wordmark className="truncate" />
          {isConnected ? (
            <span className="w-2 h-2 shrink-0 rounded-full bg-ink" title="Connected to server" />
          ) : (
            <span className="inline-flex items-center gap-1 shrink-0 text-xs font-normal text-danger" title="Server connection lost">
              <AlertCircle size={14} />
              <span className="hidden sm:inline">Connection lost</span>
            </span>
          )}
        </h1>

        {user && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              title="Set up the overlay in OBS"
            >
              <Cast size={16} />
              <span>OBS setup</span>
            </button>
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="sm:hidden p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
              title="Set up the overlay in OBS"
              aria-label="Set up the overlay in OBS"
            >
              <Cast size={18} />
            </button>
            <div className="flex items-center gap-2">
              {user.photoURL && !imageError ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || ""}
                  className="w-8 h-8 rounded-full border border-line"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-canvas border border-line flex items-center justify-center">
                  <UserIcon size={14} className="text-muted" />
                </div>
              )}
              <span className="hidden sm:inline text-sm font-semibold text-ink">{user.displayName}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-muted hover:text-danger hover:bg-surface rounded-sm transition-colors"
              title="Sign out"
              aria-label="Sign out"
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
