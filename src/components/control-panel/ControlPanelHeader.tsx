import { useState } from "react";
import { Link } from "react-router-dom";
import { Share2, AlertCircle, LayoutPanelTop, LogOut, PresentationIcon, RotateCcw, Trophy, User as UserIcon, Menu, X } from "lucide-react";
import { useStore } from "../../store";
import { GlassButton } from "./ui/glass";

interface ControlPanelHeaderProps {
  isConnected: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onShare?: () => void;
}

export default function ControlPanelHeader({ isConnected, onUndo, canUndo, onShare }: ControlPanelHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const isViewer = useStore((state) => state.isViewer);
  const shareId = useStore((state) => state.shareId);

  const [imageError, setImageError] = useState(false);

  const overlayPath = isViewer ? `/share/${shareId}/overlay` : "/overlay";
  const jumbotronPath = isViewer ? `/share/${shareId}/jumbotron` : "/jumbotron";
  const resultsPath = "/results";

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className="bg-white/[0.03] backdrop-blur-xl border-b border-white/10 relative z-50">
      <div className="px-3 py-2 sm:px-6 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
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
            {isViewer ? (
              <span className="truncate max-w-[120px] sm:max-w-none">Hockey Scoreboard</span>
            ) : (
              <Link to="/" className="truncate max-w-[120px] sm:max-w-none hover:text-zinc-300 transition-colors" title="Back to Dashboard">
                Hockey Scoreboard
              </Link>
            )}
          </h1>
          <GlassButton
            onClick={onUndo}
            disabled={!canUndo}
            variant="secondary"
            className="px-2.5 sm:px-4"
            title="Undo last score/shots/penalty change"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">Undo</span>
          </GlassButton>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex gap-2">
            <a
              href={overlayPath}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
            >
              <LayoutPanelTop size={16} />
              <span>Overlay</span>
            </a>
            <a
              href={jumbotronPath}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
            >
              <PresentationIcon size={16} />
              <span>Jumbotron</span>
            </a>
            {!isViewer && (
              <a
                href={resultsPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
              >
                <Trophy size={16} />
                <span>Results</span>
              </a>
            )}
            {!isViewer && onShare && (
              <GlassButton onClick={onShare} variant="primary">
                <Share2 size={16} />
                <span>Share</span>
              </GlassButton>
            )}
          </div>

          {user && !isViewer && (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="flex items-center gap-2 group cursor-default">
                {user.photoURL && !imageError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || ""}
                    className="w-8 h-8 rounded-full border border-white/15"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error("Profile image load failed:", e);
                      setImageError(true);
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center">
                    <UserIcon size={14} className="text-zinc-400" />
                  </div>
                )}
                <span className="text-sm font-medium text-zinc-300">
                  {user.displayName}
                </span>
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

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          {user && !isViewer && (
             <div className="flex items-center mr-1">
               {user.photoURL && !imageError ? (
                 <img
                   src={user.photoURL}
                   alt={user.displayName || ""}
                   className="w-7 h-7 rounded-full border border-white/15"
                   referrerPolicy="no-referrer"
                   crossOrigin="anonymous"
                   onError={(e) => {
                     console.error("Mobile profile image load failed:", e);
                     setImageError(true);
                   }}
                 />
               ) : (
                 <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center">
                   <UserIcon size={12} className="text-zinc-400" />
                 </div>
               )}
             </div>
          )}
          <button
            onClick={toggleMenu}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 flex flex-col gap-2">
            <a
              href={overlayPath}
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
            >
              <LayoutPanelTop size={18} className="text-zinc-400" />
              <span>Overlay</span>
            </a>
            <a
              href={jumbotronPath}
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
            >
              <PresentationIcon size={18} className="text-zinc-400" />
              <span>Jumbotron</span>
            </a>
            {!isViewer && (
              <a
                href={resultsPath}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-medium text-zinc-100 transition-colors"
              >
                <Trophy size={18} className="text-zinc-400" />
                <span>Results</span>
              </a>
            )}
            {!isViewer && onShare && (
              <button
                onClick={() => {
                  onShare();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 rounded-xl text-sm font-medium transition-colors"
              >
                <Share2 size={18} />
                <span>Share Scoreboard</span>
              </button>
            )}

            {user && !isViewer && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between px-2">
                <span className="text-sm font-medium text-zinc-400 truncate max-w-[200px]">
                  {user.displayName}
                </span>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
