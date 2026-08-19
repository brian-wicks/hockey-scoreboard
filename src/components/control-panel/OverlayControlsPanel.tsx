import { UpdateGameState } from "./types";
import { GlassButton, GlassPanel, glassInputClass } from "./ui/glass";

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
    <GlassPanel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 uppercase tracking-wider">Overlay</h2>
          <p className="text-sm text-zinc-500">Show/hide the overlay and toggle presentation options.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GlassButton onClick={() => updateState({overlayVisible: !overlayVisible})} variant="secondary">
            {overlayVisible ? "Hide Overlay" : "Show Overlay"}
          </GlassButton>
          <GlassButton
            onClick={() => updateState({jumbotronGradientsEnabled: !jumbotronGradientsEnabled})}
            variant="secondary"
          >
            {jumbotronGradientsEnabled ? "Disable Jumbotron Gradients" : "Enable Jumbotron Gradients"}
          </GlassButton>
        </div>
      </div>
      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Lower Third</h3>
          </div>
          <GlassButton
            type="button"
            onClick={() =>
              updateState({ lowerThird: { ...currentLowerThird, active: !currentLowerThird.active } })
            }
            variant="secondary"
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {currentLowerThird.active ? "Hide" : "Show"}
          </GlassButton>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <input
            value={currentLowerThird.title}
            onChange={(e) =>
              updateState({ lowerThird: { ...currentLowerThird, title: e.target.value } })
            }
            placeholder="Title"
            className={`${glassInputClass} w-full`}
          />
          <input
            value={currentLowerThird.subtitle ?? ""}
            onChange={(e) =>
              updateState({ lowerThird: { ...currentLowerThird, subtitle: e.target.value } })
            }
            placeholder="Subtitle"
            className={`${glassInputClass} w-full`}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <GlassButton
            type="button"
            onClick={() => updateState({ lowerThird: { active: false, title: "", subtitle: "" } })}
            variant="secondary"
            className="px-3 py-2 text-xs font-semibold"
          >
            Clear
          </GlassButton>
        </div>
      </div>
    </GlassPanel>
  );
}
