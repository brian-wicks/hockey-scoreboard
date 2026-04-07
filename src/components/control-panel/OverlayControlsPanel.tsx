import { UpdateGameState } from "./types";

interface OverlayControlsPanelProps {
  overlayVisible: boolean;
  jumbotronGradientsEnabled: boolean;
  updateState: UpdateGameState;
  lowerThird?: {
    active: boolean;
    title: string;
    subtitle?: string;
  };
}

export default function OverlayControlsPanel({
  overlayVisible,
  jumbotronGradientsEnabled,
  updateState,
  lowerThird,
}: OverlayControlsPanelProps) {
  const currentLowerThird = lowerThird ?? { active: false, title: "", subtitle: "" };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 uppercase tracking-wider">Overlay</h2>
          <p className="text-sm text-zinc-500">Show/hide the overlay and toggle presentation options.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
              onClick={() => updateState({overlayVisible: !overlayVisible})}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-800 hover:bg-zinc-700"
          >
            {overlayVisible ? "Hide Overlay" : "Show Overlay"}
          </button>
          <button
              onClick={() => updateState({jumbotronGradientsEnabled: !jumbotronGradientsEnabled})}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-800 hover:bg-zinc-700"
          >
            {jumbotronGradientsEnabled ? "Disable Jumbotron Gradients" : "Enable Jumbotron Gradients"}
          </button>
        </div>
      </div>
      <div className="text-xs text-zinc-500">Layout: Main overlay (fixed)</div>
      <div className="border-t border-zinc-800 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Lower Third</h3>
            <p className="text-xs text-zinc-500">Display announcements and sponsor messages.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateState({ lowerThird: { ...currentLowerThird, active: !currentLowerThird.active } })
            }
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            {currentLowerThird.active ? "Hide" : "Show"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <input
            value={currentLowerThird.title}
            onChange={(e) =>
              updateState({ lowerThird: { ...currentLowerThird, title: e.target.value } })
            }
            placeholder="Title"
            className="bg-zinc-800 text-zinc-100 rounded px-3 py-2 text-sm w-full"
          />
          <input
            value={currentLowerThird.subtitle ?? ""}
            onChange={(e) =>
              updateState({ lowerThird: { ...currentLowerThird, subtitle: e.target.value } })
            }
            placeholder="Subtitle"
            className="bg-zinc-800 text-zinc-100 rounded px-3 py-2 text-sm w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => updateState({ lowerThird: { active: false, title: "", subtitle: "" } })}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
