import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { formatClockDisplay } from "../utils/clock";

function formatPenaltyTime(ms: number) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPeriodLabel(period: string | undefined | null) {
  const raw = String(period ?? "").trim().toUpperCase();
  if (!raw) return "PERIOD";
  if (raw.startsWith("1")) return "1ST PERIOD";
  if (raw.startsWith("2")) return "2ND PERIOD";
  if (raw.startsWith("3")) return "3RD PERIOD";
  if (raw.startsWith("OT")) return "OVERTIME";
  return raw;
}

function formatTeamLabel(name: string | undefined | null, abbreviation: string | undefined | null) {
  const abbr = String(abbreviation ?? "").trim().toUpperCase();
  if (abbr) return abbr;
  const cleanedName = String(name ?? "").trim();
  if (!cleanedName) return "";
  return cleanedName.replace(/\s+/g, " ").slice(0, 3).toUpperCase();
}

export default function JumbotronScoreboard() {
  const { gameState, connect, serverTimeOffsetMs } = useStore();
  const [displayTime, setDisplayTime] = useState("20:00");

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!gameState) return;

    let animationFrameId: number;
    const updateDisplay = () => {
      let currentRemaining = gameState.clock.timeRemaining;
      if (gameState.clock.isRunning) {
        const now = Date.now() + (serverTimeOffsetMs ?? 0);
        const elapsed = now - gameState.clock.lastUpdate;
        currentRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      }

      setDisplayTime(formatClockDisplay(currentRemaining));

      if (gameState.clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState?.clock.isRunning, gameState?.clock.timeRemaining, gameState?.clock.lastUpdate, serverTimeOffsetMs]);

  const fallbackTeam = {
    name: "",
    abbreviation: "",
    score: 0,
    shots: 0,
    timeouts: 0,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  };
  const safeState = gameState ?? {
    homeTeam: fallbackTeam,
    awayTeam: fallbackTeam,
    clock: { timeRemaining: 20 * 60 * 1000, isRunning: false, lastUpdate: Date.now() },
    period: "",
    eventLog: [],
    overlayVisible: true,
    overlayLayout: "main" as const,
    overlayCorner: "top-left" as const,
    overlayTheme: "dark" as const,
    jumbotronGradientsEnabled: true,
  };

  const { homeTeam, awayTeam, period, jumbotronGradientsEnabled } = safeState;
  const periodLabel = formatPeriodLabel(period);
  const homeLabel = formatTeamLabel(homeTeam.name, homeTeam.abbreviation);
  const awayLabel = formatTeamLabel(awayTeam.name, awayTeam.abbreviation);
  const homePenalties = homeTeam.penalties ?? [];
  const awayPenalties = awayTeam.penalties ?? [];
  const homePenaltyRows = useMemo(
    () =>
      homePenalties
        .slice()
        .sort((a, b) => a.timeRemaining - b.timeRemaining)
        .map((penalty) => ({
          id: penalty.id,
          number: penalty.playerNumber,
          infraction: penalty.infraction,
          remaining: formatPenaltyTime(penalty.timeRemaining ?? 0),
        })),
    [homePenalties],
  );
  const awayPenaltyRows = useMemo(
    () =>
      awayPenalties
        .slice()
        .sort((a, b) => a.timeRemaining - b.timeRemaining)
        .map((penalty) => ({
          id: penalty.id,
          number: penalty.playerNumber,
          infraction: penalty.infraction,
          remaining: formatPenaltyTime(penalty.timeRemaining ?? 0),
        })),
    [awayPenalties],
  );


  return (
    <div className="w-screen h-screen bg-black text-white jumbotron-root">
      {jumbotronGradientsEnabled && (
        <div
          className="jumbotron-gradient"
          style={
            {
              "--home-glow": homeTeam.color || "#3b82f6",
              "--away-glow": awayTeam.color || "#ef4444",
            } as CSSProperties
          }
        />
      )}
      <div className="jumbotron-content">
        <div className="jumbotron-main">
          <div className="jumbotron-side">
            <div className="jumbotron-side-top">
              <div className="jumbotron-logo">
                {homeTeam.logo ? (
                  <img src={homeTeam.logo} alt={homeTeam.abbreviation} />
                ) : (
                  <div className="jumbotron-logo-placeholder" />
                )}
              </div>
              <div className="jumbotron-team-name">{homeLabel}</div>
              <div className="jumbotron-score" style={{ color: "white" }}>
                {homeTeam.score}
              </div>
            </div>
          </div>

          <div className="jumbotron-center">
            <div className="jumbotron-period-label">{periodLabel}</div>
            <div className="jumbotron-clock">{displayTime}</div>
            <div className="jumbotron-shots">
              <span className="jumbotron-shots-value">{homeTeam.shots}</span>
              <span className="jumbotron-shots-label">Shots</span>
              <span className="jumbotron-shots-value">{awayTeam.shots}</span>
            </div>
          </div>

          <div className="jumbotron-side">
            <div className="jumbotron-side-top">
              <div className="jumbotron-logo">
                {awayTeam.logo ? (
                  <img src={awayTeam.logo} alt={awayTeam.abbreviation} />
                ) : (
                  <div className="jumbotron-logo-placeholder" />
                )}
              </div>
              <div className="jumbotron-team-name">{awayLabel}</div>
              <div className="jumbotron-score" style={{ color: "white" }}>
                {awayTeam.score}
              </div>
            </div>
          </div>
        </div>

        <div className="jumbotron-penalties">
          <div className="jumbotron-penalty-column">
            {homePenaltyRows.map((penalty) => (
                penalty.number ? (
                    <div key={penalty.id} className="jumbotron-penalty-row">
                      <span className="jumbotron-penalty-number">{penalty.number || ""}</span>
                      <span className="jumbotron-penalty-time">{penalty.remaining}</span>
                      <span className="jumbotron-penalty-desc">{penalty.infraction || ""}</span>
                    </div>
                ) : ""
            ))}
          </div>

          <div className="jumbotron-penalty-column right">
            {awayPenaltyRows.map((penalty) => (
                penalty.number ? (
                    <div key={penalty.id} className="jumbotron-penalty-row right">
                      <span className="jumbotron-penalty-desc">{penalty.infraction || ""}</span>
                      <span className="jumbotron-penalty-time">{penalty.remaining}</span>
                      <span className="jumbotron-penalty-number">{penalty.number || ""}</span>
                    </div>
                ) : ""
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
