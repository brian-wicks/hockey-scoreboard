import React, { useEffect, useState } from "react";
import { useStore } from "../store";
import {
  Bookmark,
  Cast,
  FileText,
  LayoutGrid,
  MonitorPlay,
  Presentation,
  Radio,
  RotateCcw,
  Share2,
} from "lucide-react";
import { GlassPanel, glassInsetClass } from "./control-panel/ui/glass";
import OBSSetupGuide from "./control-panel/OBSSetupGuide";
import controlPanelScreenshot from "../assets/screenshots/control-panel.png";
import overlayScreenshot from "../assets/screenshots/overlay.png";
import jumbotronScreenshot from "../assets/screenshots/jumbotron.jpg";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SignInButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-3 bg-white text-zinc-950 hover:bg-zinc-200 font-semibold py-3 px-6 rounded-xl transition-colors ${className ?? ""}`}
    >
      <GoogleIcon className="w-5 h-5" />
      Sign in with Google
    </button>
  );
}

const SCREENSHOTS = [
  { src: controlPanelScreenshot, label: "Control Panel", alt: "The Control Panel, mid-game: score, shots, and clock for both teams" },
  { src: overlayScreenshot, label: "Overlay", alt: "The broadcast overlay bar, meant to sit in an OBS browser source" },
  { src: jumbotronScreenshot, label: "Jumbotron", alt: "The full-screen jumbotron display" },
];

const CAROUSEL_INTERVAL_MS = 4000;

// Real screenshots of the actual screens, not a mockup — cycles on its own,
// or jump straight to one with the dots.
function ScreenshotCarousel() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SCREENSHOTS.length), CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused]);

  return (
    <GlassPanel
      className="p-3 w-full max-w-md"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative rounded-xl overflow-hidden bg-black/30 aspect-[16/10] flex items-center justify-center">
        {SCREENSHOTS.map((shot, i) => (
          <img
            key={shot.label}
            src={shot.src}
            alt={shot.alt}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-xs font-medium text-zinc-400">{SCREENSHOTS[index].label}</span>
        <div className="flex gap-1.5">
          {SCREENSHOTS.map((shot, i) => (
            <button
              key={shot.label}
              onClick={() => setIndex(i)}
              aria-label={`Show the ${shot.label} screenshot`}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === index ? "bg-indigo-400" : "bg-white/20 hover:bg-white/35"
              }`}
            />
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

const CAPABILITIES = [
  {
    icon: Radio,
    title: "Live game control",
    description: "Goals, shots, penalties and the clock, with each change sent to every display as you make it.",
  },
  {
    icon: MonitorPlay,
    title: "Overlay for OBS, vMix or any capture setup",
    description: "A scoreboard bar on a transparent background, sized for a browser source.",
  },
  {
    icon: Presentation,
    title: "Jumbotron view for the rink",
    description: "A full-screen scoreboard with goal highlights for the screen above the ice.",
  },
  {
    icon: Share2,
    title: "Read-only share links",
    description: "Viewers open the link in any browser. They don't need an account or an app.",
  },
  {
    icon: Bookmark,
    title: "Saved teams and rosters",
    description: "Enter a lineup once and pick the team from your library when you start the next game.",
  },
  {
    icon: LayoutGrid,
    title: "Stream Deck-style button grid",
    description: "Large buttons for goals, shots and penalties, so you can keep your eyes on the play.",
  },
  {
    icon: RotateCcw,
    title: "Multi-step undo",
    description: "Undo steps back through score, shot and penalty edits one at a time.",
  },
  {
    icon: FileText,
    title: "Gamesheet PDF export",
    description: "Fills in your league's gamesheet from the event log, lined up with the printed boxes.",
  },
];

export const Login: React.FC = () => {
  const login = useStore((state) => state.login);
  const [isOBSGuideOpen, setIsOBSGuideOpen] = useState(false);

  return (
    <div className="relative min-h-screen text-zinc-100 font-sans">
      <div className="control-panel-ambient-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-4 sm:px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Radio size={18} />
            </div>
            <span className="text-lg font-bold text-white">Hockey Scoreboard</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-colors"
            >
              <Cast size={16} />
              OBS setup guide
            </button>
            <SignInButton onClick={login} className="!py-2 !px-4 text-sm" />
          </div>
        </header>

        <OBSSetupGuide isOpen={isOBSGuideOpen} onClose={() => setIsOBSGuideOpen(false)} />

        <main className="flex-1 px-4 sm:px-6 max-w-5xl mx-auto w-full flex flex-col gap-14 pb-20">
          {/* Hero */}
          <section className="pt-6 sm:pt-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
            <div className="flex flex-col gap-5">
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                Run your hockey scoreboard from one control panel
              </h1>
              <p className="text-base text-zinc-400 max-w-lg">
                Enter goals, shots, penalties and clock changes as the game happens. Your stream overlay,
                the rink jumbotron and any share links read from the same game, so they update as you
                go.
              </p>
              <div>
                <SignInButton onClick={login} />
                <p className="text-xs text-zinc-500 mt-2">
                  Or grab the{" "}
                  <a
                    href="https://github.com/brian-wicks/hockey-scoreboard/releases/latest"
                    className="underline hover:text-zinc-300"
                  >
                    offline desktop app
                  </a>{" "}
                  for rinks with no usable wifi.
                </p>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <ScreenshotCarousel />
            </div>
          </section>

          {/* Capabilities */}
          <section className="flex flex-col gap-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Features</h2>
            <div className={`overflow-hidden ${glassInsetClass}`}>
              <div className="grid sm:grid-cols-2">
                {CAPABILITIES.map(({ icon: Icon, title, description }, i) => (
                  <div
                    key={title}
                    className={`flex items-start gap-3 p-4 sm:p-5 ${
                      i % 2 === 0 ? "sm:border-r sm:border-white/[0.06]" : ""
                    } ${i > 0 ? "border-t border-white/[0.06] sm:border-t-0" : ""} ${
                      i >= 2 ? "sm:border-t sm:border-white/[0.06]" : ""
                    }`}
                  >
                    <Icon size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">{title}</h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Closer */}
          <section className="flex items-center justify-between gap-4 flex-wrap border-t border-white/[0.06] pt-8">
            <p className="text-sm text-zinc-400">Sign in with your Google account to get started.</p>
            <SignInButton onClick={login} className="!py-2.5 !px-5 text-sm" />
          </section>
        </main>
      </div>
    </div>
  );
};
