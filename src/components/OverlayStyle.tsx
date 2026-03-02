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

  const { overlayLayout, overlayCorner } = gameState;

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
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Theme</span>
              <button
                type="button"
                onClick={() =>
                  updateState({ overlayTheme: gameState.overlayTheme === "light" ? "dark" : "light" })
                }
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 transition"
              >
                {gameState.overlayTheme === "light" ? "Light" : "Dark"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div
              className={`flex items-stretch overflow-hidden rounded-xl border transition ${
                overlayLayout === "corner"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <button
                type="button"
                onClick={() => updateState({ overlayLayout: "corner" })}
                className={`flex-1 px-4 py-6 text-left transition ${
                  overlayLayout === "corner" ? "hover:bg-emerald-500/10" : "hover:bg-zinc-900"
                }`}
              >
                <div className="text-base font-semibold text-white">Corner Overlay</div>
                <div className="text-sm text-zinc-400 mt-1">Compact layout for tight broadcasts.</div>
              </button>
              <button
                type="button"
                onMouseDown={(event) => {
                  const target = event.currentTarget;
                  const rect = target.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  const isLeft = x < rect.width / 2;
                  const isTop = y < rect.height / 2;
                  const nextCorner = isTop
                    ? isLeft
                      ? "top-left"
                      : "top-right"
                    : isLeft
                      ? "bottom-left"
                      : "bottom-right";
                  updateState({ overlayCorner: nextCorner });
                }}
                className={`w-16 border-l transition flex items-center justify-center relative ${
                  overlayLayout === "corner" ? "border-emerald-500/40 hover:bg-emerald-500/10" : "border-zinc-800 hover:bg-zinc-900"
                }`}
                aria-label="Select corner"
                title="Click a corner to select"
              >
                <span className="relative block h-8 w-8 border border-zinc-600 rounded-sm">
                  <span
                    className={`absolute h-3 w-3 rounded-sm ${
                      overlayLayout === "corner" ? "bg-emerald-400" : "bg-zinc-500"
                    } ${
                      overlayCorner === "top-left"
                        ? "top-0 left-0"
                        : overlayCorner === "top-right"
                          ? "top-0 right-0"
                          : overlayCorner === "bottom-left"
                            ? "bottom-0 left-0"
                            : "bottom-0 right-0"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
