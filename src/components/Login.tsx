import React from "react";
import { useStore } from "../store";
import {
  Bookmark,
  FileText,
  LayoutGrid,
  MonitorPlay,
  Presentation,
  Radio,
  RotateCcw,
  Share2,
} from "lucide-react";
import { GlassPanel, glassInsetClass } from "./control-panel/ui/glass";

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

const FEATURES = [
  {
    icon: Radio,
    color: "text-indigo-400 bg-indigo-500/15 border-indigo-400/30",
    title: "Real-Time Sync",
    description: "Score, clock, and penalty changes reach your overlay, jumbotron, and viewers the instant you make them.",
  },
  {
    icon: MonitorPlay,
    color: "text-amber-400 bg-amber-500/15 border-amber-400/30",
    title: "Broadcast Overlay",
    description: "A clean scoreboard bar built to capture straight into OBS, vMix, or any streaming setup.",
  },
  {
    icon: Presentation,
    color: "text-sky-400 bg-sky-500/15 border-sky-400/30",
    title: "Jumbotron Display",
    description: "A full-screen scoreboard for the big screen at the rink, with goal highlights built in.",
  },
  {
    icon: Share2,
    color: "text-emerald-400 bg-emerald-500/15 border-emerald-400/30",
    title: "Shareable Viewer Links",
    description: "Send a read-only link so anyone can follow the game live — no account required on their end.",
  },
  {
    icon: Bookmark,
    color: "text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-400/30",
    title: "Team & Roster Library",
    description: "Save teams and rosters once, then reuse them for every matchup instead of re-typing lineups.",
  },
  {
    icon: LayoutGrid,
    color: "text-rose-400 bg-rose-500/15 border-rose-400/30",
    title: "Stream Deck Controls",
    description: "A customizable button grid for one-tap goals, shots, and penalties while you're focused on the game.",
  },
  {
    icon: RotateCcw,
    color: "text-cyan-400 bg-cyan-500/15 border-cyan-400/30",
    title: "Full Undo History",
    description: "Made a mistake mid-play? Step back through score, shots, and penalty edits without losing your place.",
  },
  {
    icon: FileText,
    color: "text-violet-400 bg-violet-500/15 border-violet-400/30",
    title: "Gamesheet Export",
    description: "Generate a PDF gamesheet straight from the event log when the final horn sounds.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Sign in & set up your teams",
    description: "Pick teams from your library or create new ones with full rosters, in a guided setup.",
  },
  {
    step: "2",
    title: "Run the game",
    description: "Control score, clock, and penalties live from the Control Panel — every game autosaves as you go.",
  },
  {
    step: "3",
    title: "Broadcast it",
    description: "Your overlay, jumbotron, and any shareable viewer links update in real time, automatically.",
  },
];

export const Login: React.FC = () => {
  const login = useStore((state) => state.login);

  return (
    <div className="relative min-h-screen text-zinc-100 font-sans">
      <div className="control-panel-ambient-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-4 sm:px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Radio size={18} />
            </div>
            <span className="text-lg font-bold text-white">Hockey Scoreboard</span>
          </div>
          <SignInButton onClick={login} className="!py-2 !px-4 text-sm hidden sm:inline-flex" />
        </header>

        <main className="flex-1 px-4 sm:px-6 max-w-6xl mx-auto w-full flex flex-col gap-16 sm:gap-24 pb-20">
          {/* Hero */}
          <section className="pt-8 sm:pt-16 flex flex-col items-center text-center gap-6">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-400/30 rounded-full px-3 py-1">
              Live game control for ice hockey broadcasts
            </span>
            <h1 className="text-4xl sm:text-6xl font-bold text-white max-w-3xl leading-tight">
              Run the scoreboard.
              <br />
              Everything else updates itself.
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-xl">
              One control panel drives your score, clock, and penalties — and instantly syncs them to your stream
              overlay, jumbotron display, and shareable viewer links.
            </p>
            <SignInButton onClick={login} className="mt-2" />
            <p className="text-xs text-zinc-500">Sign in with Google — no install, no setup.</p>
          </section>

          {/* Feature grid */}
          <section className="flex flex-col gap-8">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Built for running a live broadcast</h2>
              <p className="text-zinc-400 mt-2">Everything you need to operate a game, from puck drop to gamesheet.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon: Icon, color, title, description }) => (
                <GlassPanel key={title} className="p-5 flex flex-col gap-3">
                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{description}</p>
                  </div>
                </GlassPanel>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="flex flex-col gap-8">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">How it works</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map(({ step, title, description }) => (
                <div key={step} className={`p-5 flex flex-col gap-2 ${glassInsetClass}`}>
                  <span className="text-2xl font-bold text-indigo-400">{step}</span>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="flex flex-col items-center text-center gap-4 py-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to run your next game?</h2>
            <SignInButton onClick={login} />
            <p className="text-xs text-zinc-500">Sign in with your Google account to get started.</p>
          </section>
        </main>
      </div>
    </div>
  );
};
