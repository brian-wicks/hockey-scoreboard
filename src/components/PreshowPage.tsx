import { type CSSProperties, type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import { type GameState, type TeamState, useStore } from "../store";
import {
  clampRosterPage,
  formatCountdown,
  getCurrentSlide,
  getPreshow,
  getRosterPage,
  msUntilNextSlide,
  type PreshowSlide,
} from "../utils/preshow";
const backgroundUrl = new URL("../assets/grunge-navy.jpg", import.meta.url).href;
const buihaLogoUrl = new URL("../assets/buiha-crest.png", import.meta.url).href;
const nuSportLogoUrl = new URL("../assets/team-newcastle.svg", import.meta.url).href;

export const FADE_MS = 600;

function TeamIdentity({ team }: { team: TeamState }) {
  return (
    <div className="results-team">
      <div className="results-logo">
        {team.logo ? <img src={team.logo} alt={team.name} /> : <div className="results-logo-fallback" />}
      </div>
      <div className="results-team-name">{team.name || team.abbreviation}</div>
    </div>
  );
}

function Roster({ team, page }: { team: TeamState; page: number }) {
  const players = team.players ?? [];

  return (
    <div className="preshow-roster">
      <TeamIdentity team={team} />
      {/* Only the players change between pages, so the logo and name stay still. */}
      <Crossfade
        className="preshow-roster-players"
        value={clampRosterPage(players, page)}
        itemKey={String}
        render={(shownPage) =>
          players.length === 0 ? (
            <p className="preshow-roster-empty">No roster added</p>
          ) : (
            <ul className="preshow-player-list">
              {getRosterPage(players, shownPage).map((player) => (
                <li key={player.id} className="preshow-player">
                  <span className="preshow-player-number">{player.jerseyNumber}</span>
                  <span className="preshow-player-name" data-testid="player-name">
                    {player.name}
                  </span>
                  {player.position && <span className="preshow-player-badge">{player.position}</span>}
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}

function Countdown({ faceoffAt, serverTimeOffsetMs }: { faceoffAt: number; serverTimeOffsetMs: number }) {
  const [, tick] = useReducer((count: number) => count + 1, 0);
  const remainingMs = faceoffAt - (Date.now() + serverTimeOffsetMs);
  const hasFinished = remainingMs <= 0;

  useEffect(() => {
    if (hasFinished) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hasFinished]);

  return <div className="preshow-countdown">{hasFinished ? "Starting soon" : `Face-off in ${formatCountdown(remainingMs)}`}</div>;
}

/**
 * Crossfades when the key of `value` changes, keeping the old content until the fade ends.
 * A change that keeps the same key updates in place, with no fade.
 */
function Crossfade<T>({
  value,
  itemKey,
  render,
  className,
}: {
  value: T;
  itemKey: (value: T) => string;
  render: (value: T) => ReactNode;
  className: string;
}) {
  const key = itemKey(value);
  const lastValue = useRef(value);
  const [shownKey, setShownKey] = useState(key);
  const [leaving, setLeaving] = useState<{ value: T } | null>(null);

  if (shownKey !== key) {
    setShownKey(key);
    setLeaving({ value: lastValue.current });
  }

  useEffect(() => {
    lastValue.current = value;
  });

  useEffect(() => {
    if (!leaving) return;
    const timeout = setTimeout(() => setLeaving(null), FADE_MS);
    return () => clearTimeout(timeout);
  }, [leaving]);

  // Going straight back to the slide that's fading out just shows it, with nothing to fade.
  const isFading = leaving !== null && itemKey(leaving.value) !== key;

  return (
    <div className={className} style={{ "--preshow-fade": `${FADE_MS}ms` } as CSSProperties}>
      {isFading && (
        <div key={itemKey(leaving.value)} className="preshow-slide preshow-slide-leaving" aria-hidden="true">
          {render(leaving.value)}
        </div>
      )}
      <div key={key} className={`preshow-slide ${isFading ? "preshow-slide-entering" : ""}`}>
        {render(value)}
      </div>
    </div>
  );
}

function PreshowScreen({ gameState, serverTimeOffsetMs }: { gameState: GameState; serverTimeOffsetMs: number }) {
  const { homeTeam, awayTeam } = gameState;
  const preshow = getPreshow(gameState);
  const { faceoffAt, rotation } = preshow;
  const [, tick] = useReducer((count: number) => count + 1, 0);
  const nowMs = Date.now() + serverTimeOffsetMs;
  const slide = getCurrentSlide(preshow, homeTeam.players ?? [], awayTeam.players ?? [], nowMs);

  useEffect(() => {
    if (!rotation.enabled) return;
    const timeout = setTimeout(tick, msUntilNextSlide(rotation, Date.now() + serverTimeOffsetMs));
    return () => clearTimeout(timeout);
  });

  const renderSlide = ({ view, rosterPage }: PreshowSlide) =>
    view === "teams" ? (
      <div className="results-body">
        <TeamIdentity team={homeTeam} />
        <div className="results-center">
          <div className="results-vs">VS</div>
        </div>
        <TeamIdentity team={awayTeam} />
      </div>
    ) : (
      <Roster team={view === "home" ? homeTeam : awayTeam} page={rosterPage} />
    );

  return (
    <div className="results-page" style={{ "--results-bg": `url('${backgroundUrl}')` } as CSSProperties}>
      <div className="results-corner-logo left">
        <img src={buihaLogoUrl} alt="BUIHA" />
      </div>
      <div className="results-corner-logo right">
        <img src={nuSportLogoUrl} alt="Newcastle University Sport" />
      </div>
      <div className="results-header">
        <span className="results-title">Coming up</span>
      </div>

      <Crossfade className="preshow-stage" value={slide} itemKey={(shown) => shown.view} render={renderSlide} />

      {faceoffAt !== null ? (
        <Countdown faceoffAt={faceoffAt} serverTimeOffsetMs={serverTimeOffsetMs} />
      ) : (
        // Holds the countdown's space, so setting or clearing a time doesn't move anything.
        <div className="preshow-countdown preshow-countdown-empty" aria-hidden="true">
          &nbsp;
        </div>
      )}
    </div>
  );
}

export default function PreshowPage() {
  const { gameState, ensureInitialized, serverTimeOffsetMs } = useStore();

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Connecting...</div>;
  }

  return <PreshowScreen gameState={gameState} serverTimeOffsetMs={serverTimeOffsetMs ?? 0} />;
}
