import { useEffect, useRef, useState } from "react";
import { Cast, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, X } from "lucide-react";
import { useStore } from "../../store";
import { GlassButton, glassInsetClass } from "./ui/glass";

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
  const baseUrl = (import.meta.env.VITE_BASE_URL || window.location.origin).replace(/\/+$/, "");
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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Cast className="text-indigo-400" size={24} />
            Set Up in OBS
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 min-h-[220px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">1. Get your overlay link</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  This is the URL you'll paste into OBS as a Browser Source.
                </p>
              </div>
              {user ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${glassInsetClass}`}>
                    <code className="text-xs text-zinc-300 break-all flex-1 font-mono">{overlayUrl}</code>
                    <button
                      onClick={handleCopyLink}
                      className="text-zinc-400 hover:text-white transition-colors p-1 shrink-0"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Running OBS on a different machine than your game control browser? Use a
                    <span className="text-zinc-300"> Share Link </span>
                    from the Control Panel's Share button instead — it works from any device.
                  </p>
                </>
              ) : (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${glassInsetClass} opacity-60`}>
                    <code className="text-xs text-zinc-400 break-all flex-1 font-mono">
                      {baseUrl.replace(/^https?:\/\//, "")}/overlay
                    </code>
                  </div>
                  <p className="text-xs text-zinc-500">Sign in and start a game to get your personal overlay link.</p>
                  <GlassButton onClick={login} variant="primary" className="w-full py-2.5">
                    Sign in with Google
                  </GlassButton>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">2. Add a Browser Source in OBS</h3>
                <p className="text-sm text-zinc-400 mt-1">In OBS, under Sources:</p>
              </div>
              <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Click <span className="font-semibold text-white">+</span> and choose{" "}
                  <span className="font-semibold text-white">Browser</span>, then name it and click OK.
                </li>
                <li>Paste your overlay URL into the URL field.</li>
                <li>Set Width/Height to match your OBS canvas (e.g. 1920×1080).</li>
                <li>
                  Uncheck <span className="font-semibold text-white">Shutdown source when not visible</span>.
                </li>
                <li>
                  Check <span className="font-semibold text-white">Refresh browser when scene becomes active</span>.
                </li>
                <li>Click OK.</li>
              </ol>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">3. Preview & position</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  The overlay has a transparent background, so it composites straight over your stream.
                  It updates live as the game state changes — no need to refresh once it's placed.
                </p>
              </div>
              <a href={overlayUrl} target="_blank" rel="noreferrer">
                <GlassButton variant="secondary" className="w-full py-2.5">
                  <ExternalLink size={16} />
                  Open Overlay
                </GlassButton>
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-indigo-400" : "w-1.5 bg-white/15"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <GlassButton onClick={() => setStep((s) => s - 1)} variant="ghost">
                <ChevronLeft size={16} />
                Back
              </GlassButton>
            )}
            {step < STEP_COUNT - 1 ? (
              <GlassButton onClick={() => setStep((s) => s + 1)} variant="primary">
                Next
                <ChevronRight size={16} />
              </GlassButton>
            ) : (
              <GlassButton onClick={handleClose} variant="primary">
                Done
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
