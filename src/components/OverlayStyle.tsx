import { useEffect } from "react";
import { useStore } from "../store";
export default function OverlayStyle({ embedded = false }: { embedded?: boolean } = {}) {
  const { gameState, connect, updateState } = useStore();

  useEffect(() => {
    connect();
  }, [connect]);

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Connecting...</div>;
  }

  const { overlayLayout } = gameState;

  return (
    <div className={`${embedded ? "" : "min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6"}`}>
      <div className={`${embedded ? "" : "max-w-3xl mx-auto"} flex flex-col gap-6`}>
        {!embedded && (
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Overlay Style</h1>
              <p className="text-sm text-zinc-400 mt-1">Choose the overlay layout and placement.</p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Back to Controls
            </a>
          </header>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-300 uppercase tracking-wider">Layout</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              onClick={() => updateState({ overlayLayout: "main" })}
              className={`rounded-xl border px-4 py-6 text-left transition ${
                overlayLayout === "main"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
              }`}
            >
              <div className="text-base font-semibold text-white">Main Overlay</div>
              <div className="text-sm text-zinc-400 mt-1">Full-width scoreboard layout.</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
