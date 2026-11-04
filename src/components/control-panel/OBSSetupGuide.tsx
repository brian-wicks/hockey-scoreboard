import { useEffect, useRef, useState } from "react";
import { Cast, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, X } from "lucide-react";
import { useStore } from "../../store";
import { getBaseUrl } from "../../lib/localMode";
import { Button, insetClass } from "./ui/primitives";

interface OBSSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEP_COUNT = 3;

export default function OBSSetupGuide({ isOpen, onClose }: OBSSetupGuideProps) {
  const user = useStore((state) => state.user);
  const login = useStore((state) => state.login);
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const hasMarkedSeenRef = useRef(false);

  // @ts-ignore
  const baseUrl = getBaseUrl().replace(/\/+$/, "");
  const overlayUrl = `${baseUrl}/overlay`;

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setCopied(false);
      hasMarkedSeenRef.current = false;
    }
  }, [isOpen]);

  const markSeen = () => {
    if (!user || hasMarkedSeenRef.current) return;
    hasMarkedSeenRef.current = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        await fetch(`${baseUrl}/api/onboarding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ obsSetupSeen: true }),
        });
      } catch (error) {
        console.error("Failed to save onboarding state:", error);
      }
    })();
  };

  const handleClose = () => {
    markSeen();
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-ink/60 duration-200"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg bg-canvas border border-line rounded-sm duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-line">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-ink">
            <Cast className="text-ink" size={24} />
            Set up in OBS
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 min-h-[220px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">1. Get your overlay link</h3>
                <p className="text-sm text-muted mt-1">
                  This is the URL you'll paste into OBS as a Browser Source.
                </p>
              </div>
              {user ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${insetClass}`}>
                    <code className="text-xs text-ink break-all flex-1 tabular-nums">{overlayUrl}</code>
                    <button
                      onClick={handleCopyLink}
                      className="text-muted hover:text-ink transition-colors p-1 shrink-0"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={16} className="text-ink" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    Running OBS on a different machine than your game control browser? Use a
                    <span className="text-ink"> share link </span>
                    from the Control Panel's Share button instead. Share links work on any device.
                  </p>
                </>
              ) : (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${insetClass} opacity-60`}>
                    <code className="text-xs text-muted break-all flex-1 tabular-nums">
                      {baseUrl.replace(/^https?:\/\//, "")}/overlay
                    </code>
                  </div>
                  <p className="text-xs text-muted">Sign in and start a game to get your personal overlay link.</p>
                  <Button onClick={login} variant="primary" className="w-full py-2.5">
                    Sign in with Google
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">2. Add a Browser Source in OBS</h3>
                <p className="text-sm text-muted mt-1">In OBS, under Sources:</p>
              </div>
              <ol className="text-sm text-ink space-y-2 list-decimal list-inside">
                <li>
                  Click <span className="font-semibold text-ink">+</span> and choose{" "}
                  <span className="font-semibold text-ink">Browser</span>, then name it and click OK.
                </li>
                <li>Paste your overlay URL into the URL field.</li>
                <li>Set width and height to match your OBS canvas (e.g. 1920x1080).</li>
                <li>
                  Uncheck <span className="font-semibold text-ink">Shutdown source when not visible</span>.
                </li>
                <li>
                  Check <span className="font-semibold text-ink">Refresh browser when scene becomes active</span>.
                </li>
                <li>Click OK.</li>
              </ol>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">3. Preview and position</h3>
                <p className="text-sm text-muted mt-1">
                  The overlay has a transparent background, so it sits on top of your stream. It updates
                  as the game changes, and you don't need to refresh it after placing it.
                </p>
              </div>
              <a href={overlayUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full py-2.5">
                  <ExternalLink size={16} />
                  Open overlay
                </Button>
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-line">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-colors ${
                  i === step ? "w-5 bg-ink" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button onClick={() => setStep((s) => s - 1)} variant="ghost">
                <ChevronLeft size={16} />
                Back
              </Button>
            )}
            {step < STEP_COUNT - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} variant="primary">
                Next
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleClose} variant="primary">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
