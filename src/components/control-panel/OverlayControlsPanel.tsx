import { UpdateGameState } from "./types";
import { Button, Panel, inputClass } from "./ui/primitives";
import { CommitInput } from "./ui/CommitInput";

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
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Overlay</h2>
          <p className="text-sm text-muted">Show/hide the overlay and toggle presentation options.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => updateState({overlayVisible: !overlayVisible})} variant="secondary">
            {overlayVisible ? "Hide overlay" : "Show overlay"}
          </Button>
          <Button
            onClick={() => updateState({jumbotronGradientsEnabled: !jumbotronGradientsEnabled})}
            variant="secondary"
          >
            {jumbotronGradientsEnabled ? "Disable jumbotron gradients" : "Enable jumbotron gradients"}
          </Button>
        </div>
      </div>
      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Lower third</h3>
          </div>
          <Button
            type="button"
            onClick={() =>
              updateState({ lowerThird: { ...currentLowerThird, active: !currentLowerThird.active } })
            }
            variant="secondary"
            className="px-3 py-1.5 text-xs font-semibold"
          >
            {currentLowerThird.active ? "Hide" : "Show"}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <CommitInput
            value={currentLowerThird.title}
            onCommit={(title) => updateState({ lowerThird: { ...currentLowerThird, title } })}
            placeholder="Title"
            className={`${inputClass} w-full`}
          />
          <CommitInput
            value={currentLowerThird.subtitle ?? ""}
            onCommit={(subtitle) => updateState({ lowerThird: { ...currentLowerThird, subtitle } })}
            placeholder="Subtitle"
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            type="button"
            onClick={() => updateState({ lowerThird: { active: false, title: "", subtitle: "" } })}
            variant="secondary"
            className="px-3 py-2 text-xs font-semibold"
          >
            Clear
          </Button>
        </div>
      </div>
    </Panel>
  );
}
