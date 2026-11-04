import React, { useEffect, useState } from "react";
import { useStore } from "../store";
import {
  Bookmark,
  Cast,
  Check,
  FileText,
  LayoutGrid,
  MonitorPlay,
  Presentation,
  Radio,
  RotateCcw,
  Share2,
} from "lucide-react";
import { Wordmark } from "./control-panel/ui/primitives";
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
      className={`inline-flex items-center justify-center gap-3 bg-canvas text-ink hover:bg-surface border border-line text-sm font-semibold py-3 px-6 rounded-sm transition-colors ${className ?? ""}`}
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
    <div className="w-full max-w-xl" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div className="relative rounded-sm overflow-hidden border border-line bg-canvas aspect-[16/10] flex items-center justify-center">
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
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted">{SCREENSHOTS[index].label}</span>
        <div className="flex">
          {SCREENSHOTS.map((shot, i) => (
            <button
              key={shot.label}
              onClick={() => setIndex(i)}
              aria-label={`Show the ${shot.label} screenshot`}
              className="p-1.5 rounded-sm"
            >
              <span className={`block w-2 h-2 rounded-full transition-colors ${i === index ? "bg-ink" : "bg-line hover:bg-muted"}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
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

const CHECKLIST = [
  "Score, clock and penalties in one place",
  "Overlay, jumbotron and share links update as you go",
  "Offline desktop app for rinks with no usable wifi",
];

export const Login: React.FC = () => {
  const login = useStore((state) => state.login);
  const [isOBSGuideOpen, setIsOBSGuideOpen] = useState(false);

  return (
    <div className="ui relative min-h-screen bg-canvas">
      <div className="grid md:grid-cols-[2fr_3fr] md:min-h-screen">
        <section className="ui-dark bg-ink text-canvas flex flex-col gap-10 p-6 md:p-12">
          <Wordmark className="text-lg" />
          <div className="flex flex-col gap-6 md:my-auto">
            <h1 className="text-[2.5rem] leading-[1.1] tracking-[-0.01em] font-semibold text-balance">
              Run your hockey scoreboard from one control panel
            </h1>
            <p className="max-w-md">
              Enter goals, shots, penalties and clock changes as the game happens. Your stream overlay,
              the rink jumbotron and any share links read from the same game, so they update as you go.
            </p>
            <ul className="flex flex-col gap-3">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check size={18} className="shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-col p-6 md:p-12 gap-8">
          <div className="flex justify-end">
            <button
              onClick={() => setIsOBSGuideOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-canvas hover:bg-surface border border-line rounded-sm transition-colors"
            >
              <Cast size={16} />
              OBS setup guide
            </button>
          </div>
          <div className="flex flex-col gap-8 w-full max-w-xl mx-auto md:my-auto">
            <div className="flex flex-col gap-4">
              <h2 className="text-[1.75rem] leading-[1.2] font-semibold">Sign in</h2>
              <p className="text-muted">Sign in with your Google account to get started.</p>
              <SignInButton onClick={login} className="w-full" />
              <p className="text-sm text-muted">
                Or grab the{" "}
                <a
                  href="https://github.com/brian-wicks/hockey-scoreboard/releases/latest"
                  className="underline text-ink hover:no-underline rounded-sm"
                >
                  offline desktop app
                </a>{" "}
                for rinks with no usable wifi.
              </p>
            </div>
            <ScreenshotCarousel />
          </div>
        </section>
      </div>

      <OBSSetupGuide isOpen={isOBSGuideOpen} onClose={() => setIsOBSGuideOpen(false)} />

      <section className="border-t border-line px-6 py-16 md:px-12">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <h2 className="text-[1.75rem] leading-[1.2] font-semibold">Features</h2>
          <ul className="grid sm:grid-cols-2 gap-x-12 border-t border-line">
            {CAPABILITIES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3 py-5 border-b border-line">
                <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted mt-1">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
