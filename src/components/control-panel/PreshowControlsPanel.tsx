import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PreshowSettings, TeamPlayer } from "../../store";
import {
  MAX_SLIDE_SECONDS,
  MIN_SLIDE_SECONDS,
  clampRosterPage,
  faceoffTimeInputValue,
  getCurrentSlide,
  getPreshow,
  getRosterPageCount,
  nextFaceoffTime,
  rotationStartFor,
  type PreshowSlide,
  type ResolvedPreshow,
} from "../../utils/preshow";
import { UpdateGameState } from "./types";
import { CommitInput } from "./ui/CommitInput";
import { Button, Panel, SectionLabel, inputClass } from "./ui/primitives";

interface PreshowControlsPanelProps {
  preshow?: PreshowSettings;
  homePlayers: TeamPlayer[];
  awayPlayers: TeamPlayer[];
  updateState: UpdateGameState;
  serverTimeOffsetMs?: number;
}

const VIEWS: { view: PreshowSettings["view"]; label: string }[] = [
  { view: "teams", label: "Teams" },
  { view: "home", label: "Home roster" },
  { view: "away", label: "Away roster" },
];

export default function PreshowControlsPanel({
  preshow,
  homePlayers,
  awayPlayers,
  updateState,
  serverTimeOffsetMs = 0,
}: PreshowControlsPanelProps) {
  const current = getPreshow({ preshow });
  const { rotation } = current;
  const update = (changes: Partial<ResolvedPreshow>) => updateState({ preshow: { ...current, ...changes } });
  const serverNow = () => Date.now() + serverTimeOffsetMs;

  const showing = () => getCurrentSlide(current, homePlayers, awayPlayers, serverNow());
  const startFor = (slide: PreshowSlide, intervalSeconds: number) =>
    rotationStartFor(slide, homePlayers, awayPlayers, intervalSeconds, serverNow());

  // Either way, the slide on screen stays there, so nothing jumps on stream.
  const toggleRotation = () => {
    const slide = showing();
    if (rotation.enabled) {
      update({ ...slide, rotation: { ...rotation, enabled: false } });
    } else {
      update({ rotation: { ...rotation, enabled: true, startedAt: startFor(slide, rotation.intervalSeconds) } });
    }
  };

  const changeSlideSeconds = (value: string) => {
    if (value.trim() === "" || Number.isNaN(Number(value))) return;
    const intervalSeconds = Math.min(MAX_SLIDE_SECONDS, Math.max(MIN_SLIDE_SECONDS, Math.round(Number(value))));
    const startedAt = rotation.enabled ? startFor(showing(), intervalSeconds) : rotation.startedAt;
    update({ rotation: { ...rotation, intervalSeconds, startedAt } });
  };

  const roster = current.view === "home" ? homePlayers : awayPlayers;
  const pageCount = current.view === "teams" || rotation.enabled ? 1 : getRosterPageCount(roster);
  const page = pageCount > 1 ? clampRosterPage(roster, current.rosterPage) : 0;

  return (
    <Panel className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Pre-show</h2>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="flex flex-col gap-1">
          <SectionLabel>Showing</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            {VIEWS.map(({ view, label }) => (
              <Button
                key={view}
                onClick={() => update({ view, rosterPage: 0, rotation: { ...rotation, enabled: false } })}
                variant={!rotation.enabled && current.view === view ? "primary" : "secondary"}
                aria-pressed={!rotation.enabled && current.view === view}
              >
                {label}
              </Button>
            ))}
            {/* Always in place, so the row doesn't shift when moving between views. */}
            <div className="flex items-center gap-1 ml-1">
              <Button
                onClick={() => update({ rosterPage: page - 1 })}
                disabled={page === 0}
                variant="secondary"
                className="px-2"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm text-muted tabular-nums px-1 min-w-24 text-center">
                Page {page + 1} of {pageCount}
              </span>
              <Button
                onClick={() => update({ rosterPage: page + 1 })}
                disabled={page === pageCount - 1}
                variant="secondary"
                className="px-2"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button onClick={toggleRotation} variant={rotation.enabled ? "primary" : "secondary"} aria-pressed={rotation.enabled}>
            Rotate slides
          </Button>
          <div className="flex flex-col gap-1">
            <SectionLabel>
              <label htmlFor="preshow-slide-seconds">Seconds per slide</label>
            </SectionLabel>
            <CommitInput
              id="preshow-slide-seconds"
              type="number"
              min={MIN_SLIDE_SECONDS}
              max={MAX_SLIDE_SECONDS}
              value={String(rotation.intervalSeconds)}
              onCommit={changeSlideSeconds}
              className={`${inputClass} w-24`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>
            <label htmlFor="preshow-faceoff">Face-off time</label>
          </SectionLabel>
          <div className="flex items-center gap-2">
            <CommitInput
              id="preshow-faceoff"
              type="time"
              value={faceoffTimeInputValue(current.faceoffAt)}
              onCommit={(time) => update({ faceoffAt: nextFaceoffTime(time, serverNow()) })}
              className={inputClass}
            />
            {current.faceoffAt !== null && (
              <Button onClick={() => update({ faceoffAt: null })} variant="secondary">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
