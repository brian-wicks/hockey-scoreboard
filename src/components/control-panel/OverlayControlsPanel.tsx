import OverlayStyle from "../OverlayStyle";
import { UpdateGameState } from "./types";

interface OverlayControlsPanelProps {
  overlayVisible: boolean;
  jumbotronGradientsEnabled: boolean;
  updateState: UpdateGameState;
}

export default function OverlayControlsPanel({
  overlayVisible,
  jumbotronGradientsEnabled,
  updateState,
}: OverlayControlsPanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 uppercase tracking-wider">Overlay</h2>
          <p className="text-sm text-zinc-500">Show/hide the overlay and adjust layout settings.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
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
      <OverlayStyle embedded />
    </div>
  );
}
