import { useState } from "react";
import { Link } from "react-router-dom";
import { Share2, AlertCircle, LayoutPanelTop, LogOut, PresentationIcon, RotateCcw, Trophy, Tv, User as UserIcon, Menu, X, DoorOpen } from "lucide-react";
import { MAX_UNDO_STEPS, useStore } from "../../store";
import { Button, Wordmark } from "./ui/primitives";

interface ControlPanelHeaderProps {
  isConnected: boolean;
  onUndo: () => void;
  canUndo: boolean;
  /** Current undo history length, used to warn once it's about to hit the cap —
   * without this, history past MAX_UNDO_STEPS silently drops the oldest entries. */
  undoCount?: number;
  onShare?: () => void;
}

export default function ControlPanelHeader({ isConnected, onUndo, canUndo, undoCount = 0, onShare }: ControlPanelHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  // These checks can't use `user`: an owner signed in on this browser would bring their
  // account menu into a second operator's session.
  const isOperator = useStore((state) => state.isOperator);
  const showsOwnerActions = !isOperator;

  const [imageError, setImageError] = useState(false);

  const overlayPath = "/overlay";
  const jumbotronPath = "/jumbotron";
  const resultsPath = "/results";
  const preshowPath = "/preshow";

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className="bg-canvas border-b border-line relative z-50">
      <div className="px-3 py-2 sm:px-6 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-lg flex items-center gap-2 min-w-0">
            {isOperator ? (
              <Wordmark className="truncate" />
            ) : (
              <Link to="/" className="truncate rounded-sm hover:underline" title="Back to Dashboard">
                <Wordmark />
              </Link>
            )}
            {isConnected ? (
              <span className="w-2 h-2 shrink-0 rounded-full bg-ink" title="Connected to server" />
            ) : (
              <span className="inline-flex items-center gap-1 shrink-0 text-xs font-normal text-danger" title="Server connection lost">
                <AlertCircle size={14} />
                <span className="hidden sm:inline">Connection lost</span>
              </span>
            )}
          </h1>
          <Button
            onClick={onUndo}
            disabled={!canUndo}
            variant="secondary"
            className="px-2.5 sm:px-4"
            title={
              undoCount >= MAX_UNDO_STEPS
                ? `Undo last score/shots/penalty change (history limit of ${MAX_UNDO_STEPS} reached, so the oldest changes can no longer be undone)`
                : "Undo last score/shots/penalty change"
            }
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">Undo</span>
          </Button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex gap-2">
            {showsOwnerActions && (
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
                title="Close this game and return to the Dashboard"
              >
                <DoorOpen size={16} />
                <span>Close</span>
              </Link>
            )}
            {!isOperator && (
              <>
                <a
                  href={overlayPath}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
                >
                  <LayoutPanelTop size={16} />
                  <span>Overlay</span>
                </a>
                <a
                  href={jumbotronPath}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
                >
                  <PresentationIcon size={16} />
                  <span>Jumbotron</span>
                </a>
              </>
            )}
            {showsOwnerActions && (
              <a
                href={resultsPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              >
                <Trophy size={16} />
                <span>Results</span>
              </a>
            )}
            {showsOwnerActions && (
              <a
                href={preshowPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              >
                <Tv size={16} />
                <span>Pre-show</span>
              </a>
            )}
            {showsOwnerActions && onShare && (
              <Button onClick={onShare} variant="primary">
                <Share2 size={16} />
                <span>Share</span>
              </Button>
            )}
          </div>

          {user && showsOwnerActions && (
            <div className="flex items-center gap-3 pl-4 border-l border-line">
              <div className="flex items-center gap-2 group cursor-default">
                {user.photoURL && !imageError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || ""}
                    className="w-8 h-8 rounded-full border border-line"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error("Profile image load failed:", e);
                      setImageError(true);
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-canvas border border-line flex items-center justify-center">
                    <UserIcon size={14} className="text-muted" />
                  </div>
                )}
                <span className="text-sm font-semibold text-ink">
                  {user.displayName}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-muted hover:text-danger hover:bg-surface rounded-sm transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          {user && showsOwnerActions && (
             <div className="flex items-center mr-1">
               {user.photoURL && !imageError ? (
                 <img
                   src={user.photoURL}
                   alt={user.displayName || ""}
                   className="w-7 h-7 rounded-full border border-line"
                   referrerPolicy="no-referrer"
                   crossOrigin="anonymous"
                   onError={(e) => {
                     console.error("Mobile profile image load failed:", e);
                     setImageError(true);
                   }}
                 />
               ) : (
                 <div className="w-7 h-7 rounded-full bg-canvas border border-line flex items-center justify-center">
                   <UserIcon size={12} className="text-muted" />
                 </div>
               )}
             </div>
          )}
          {!isOperator && (
            <button
              onClick={toggleMenu}
              className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-canvas border-b border-line">
          <div className="p-4 flex flex-col gap-2">
            {showsOwnerActions && (
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              >
                <DoorOpen size={18} />
                <span>Close</span>
              </Link>
            )}
            {!isOperator && (
              <>
                <a
                  href={overlayPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
                >
                  <LayoutPanelTop size={18} />
                  <span>Overlay</span>
                </a>
                <a
                  href={jumbotronPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
                >
                  <PresentationIcon size={18} />
                  <span>Jumbotron</span>
                </a>
              </>
            )}
            {showsOwnerActions && (
              <a
                href={resultsPath}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              >
                <Trophy size={18} />
                <span>Results</span>
              </a>
            )}
            {showsOwnerActions && (
              <a
                href={preshowPath}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-canvas hover:bg-surface border border-line rounded-sm text-sm font-semibold text-ink transition-colors"
              >
                <Tv size={18} />
                <span>Pre-show</span>
              </a>
            )}
            {showsOwnerActions && onShare && (
              <button
                onClick={() => {
                  onShare();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-action-hover text-ink border border-ink rounded-sm text-sm font-semibold transition-colors"
              >
                <Share2 size={18} />
                <span>Share scoreboard</span>
              </button>
            )}

            {user && showsOwnerActions && (
              <div className="mt-2 pt-2 border-t border-line flex items-center justify-between px-2">
                <span className="text-sm font-semibold text-muted truncate max-w-[200px]">
                  {user.displayName}
                </span>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-danger hover:bg-surface rounded-sm transition-colors text-sm font-semibold"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
