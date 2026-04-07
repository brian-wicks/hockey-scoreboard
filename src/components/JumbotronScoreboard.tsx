import { type CSSProperties, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { formatPenaltyTimeMs } from "../utils/clock";
import { useClockDisplay } from "../hooks/useClockDisplay";

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
  const { gameState, connect, serverTimeOffsetMs, updateState } = useStore();

  useEffect(() => {
    connect();
  }, [connect]);

  const displayTime = useClockDisplay(gameState?.clock ?? null, serverTimeOffsetMs, "20:00");

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
    jumbotronGradientsEnabled: true,
    lowerThird: { active: false, title: "", subtitle: "" },
    jumbotronGoalHighlight: null,
  };

  const { homeTeam, awayTeam, period, jumbotronGradientsEnabled, jumbotronGoalHighlight } = safeState;
  const periodLabel = formatPeriodLabel(period);
  const homeLabel = formatTeamLabel(homeTeam.name, homeTeam.abbreviation);
  const awayLabel = formatTeamLabel(awayTeam.name, awayTeam.abbreviation);
  const highlightActive = Boolean(jumbotronGoalHighlight);
  const highlightTeamLabel =
    jumbotronGoalHighlight?.team === "home"
      ? (homeTeam.name || homeTeam.abbreviation || "").trim()
      : (awayTeam.name || awayTeam.abbreviation || "").trim();
  const highlightAssists = [jumbotronGoalHighlight?.assist1, jumbotronGoalHighlight?.assist2]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const highlightAssistText = highlightAssists.length > 0 ? highlightAssists.join(", ") : "";
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
          remaining: formatPenaltyTimeMs(penalty.timeRemaining ?? 0),
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
          remaining: formatPenaltyTimeMs(penalty.timeRemaining ?? 0),
        })),
    [awayPenalties],
  );

  useEffect(() => {
    if (!jumbotronGoalHighlight) return;
    const remainingMs = jumbotronGoalHighlight.expiresAt - (Date.now() + serverTimeOffsetMs);
    if (remainingMs <= 0) {
      updateState({
        jumbotronGoalHighlight: null,
        lowerThird: { ...safeState.lowerThird, active: false },
      });
      return;
    }
    const timer = window.setTimeout(() => {
      updateState({
        jumbotronGoalHighlight: null,
        lowerThird: { ...safeState.lowerThird, active: false },
      });
    }, remainingMs + 50);
    return () => window.clearTimeout(timer);
  }, [jumbotronGoalHighlight?.expiresAt, serverTimeOffsetMs, updateState, safeState.lowerThird]);

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
      {highlightActive && jumbotronGoalHighlight ? (
        <div className="jumbotron-goal-fullscreen">
          <div
            className="jumbotron-goal-tag"
            style={{ "--goal-line-ch": Math.max(1, `${highlightTeamLabel} Goal`.length) } as CSSProperties}
          >
            {highlightTeamLabel} Goal
          </div>
          <div
            className="jumbotron-goal-scorer"
            style={{ "--goal-line-ch": Math.max(1, jumbotronGoalHighlight.scorer.length) } as CSSProperties}
          >
            {jumbotronGoalHighlight.scorer}
          </div>
          {highlightAssistText && (
            <div
              className="jumbotron-goal-assists"
              style={{ "--goal-line-ch": Math.max(1, `Assists: ${highlightAssistText}`.length) } as CSSProperties}
            >
              Assists: {highlightAssistText}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
