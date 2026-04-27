import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { formatPenaltyTimeMs } from "../utils/clock";
import { useClockDisplay } from "../hooks/useClockDisplay";

const GOAL_STING_DURATION_MS = 1900;
const GOAL_SCORE_REVEAL_MS = 280;
const PENALTY_ANIMATION_MS = 260;
const MAIN_HIDE_PENALTY_LIFT_MS = 260;
const MAIN_HIDE_SCOREBOARD_CLOSE_MS = 320;
const PENALTY_ROW_HEIGHT_PX = 40;
type GoalTeam = "home" | "away";
type MainTransitionStage = "idle" | "hiding-penalties" | "hiding-close" | "showing-open" | "showing-penalties";
interface GoalEvent {
  team: GoalTeam;
  targetScore: number;
}
type PenaltyAnimState = "entering" | "idle" | "exiting";
interface AnimatedPenalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
  animState: PenaltyAnimState;
}

function useAnimatedPenalties(penalties: any[], animationMs: number): AnimatedPenalty[] {
  const [animatedPenalties, setAnimatedPenalties] = useState<AnimatedPenalty[]>([]);
  const enterTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setAnimatedPenalties((current) => {
      const nextById = new Map(penalties.map((penalty) => [penalty.id, penalty]));
      const currentById = new Set(current.map((item) => item.id));

      const nextItems = current.map((item) => {
        const nextPenalty = nextById.get(item.id);
        if (nextPenalty) {
          return {
            ...item,
            ...nextPenalty,
            animState: item.animState === "entering" ? "entering" : "idle",
          };
        }
        return item.animState === "exiting" ? item : { ...item, animState: "exiting" };
      });

      penalties.forEach((penalty) => {
        if (!currentById.has(penalty.id)) {
          nextItems.push({ ...penalty, animState: "entering" });
        }
      });

      return nextItems;
    });
  }, [penalties]);

  useEffect(() => {
    animatedPenalties.forEach((item) => {
      if (item.animState === "entering" && !enterTimersRef.current.has(item.id)) {
        const timer = setTimeout(() => {
          setAnimatedPenalties((current) =>
            current.map((penalty) =>
              penalty.id === item.id && penalty.animState === "entering"
                ? { ...penalty, animState: "idle" }
                : penalty,
            ),
          );
          enterTimersRef.current.delete(item.id);
        }, 16);
        enterTimersRef.current.set(item.id, timer);
      }

      if (item.animState === "exiting" && !exitTimersRef.current.has(item.id)) {
        const timer = setTimeout(() => {
          setAnimatedPenalties((current) => current.filter((penalty) => penalty.id !== item.id));
          exitTimersRef.current.delete(item.id);
          const enterTimer = enterTimersRef.current.get(item.id);
          if (enterTimer) {
            clearTimeout(enterTimer);
            enterTimersRef.current.delete(item.id);
          }
        }, animationMs);
        exitTimersRef.current.set(item.id, timer);
      }
    });
  }, [animatedPenalties, animationMs]);

  useEffect(() => {
    return () => {
      enterTimersRef.current.forEach((timer) => clearTimeout(timer));
      exitTimersRef.current.forEach((timer) => clearTimeout(timer));
      enterTimersRef.current.clear();
      exitTimersRef.current.clear();
    };
  }, []);

  return animatedPenalties;
}

export default function Overlay({ skipConnect = false }: { skipConnect?: boolean } = {}) {
  const { gameState, connect, serverTimeOffsetMs, updateState } = useStore();
  const [renderedLayout, setRenderedLayout] = useState<"main">("main");
  const [displayScores, setDisplayScores] = useState({ home: 0, away: 0 });
  const [goalSting, setGoalSting] = useState<{ active: boolean; team: GoalTeam }>({
    active: false,
    team: "home",
  });
  const [mainTransitionStage, setMainTransitionStage] = useState<MainTransitionStage>("idle");
  const [keepMainVisibleForHide, setKeepMainVisibleForHide] = useState(false);
  const previousScoresRef = useRef<{ home: number; away: number } | null>(null);
  const stingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidePenaltyLiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPenaltiesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOverlayVisibleRef = useRef<boolean>(true);
  const stingStateRef = useRef<{ active: boolean; team: GoalTeam | null }>({ active: false, team: null });
  const goalQueueRef = useRef<GoalEvent[]>([]);
  const shotsPanelRef = useRef<HTMLDivElement | null>(null);
  const scoreboardPanelRef = useRef<HTMLDivElement | null>(null);
  const [mainAnimationVars, setMainAnimationVars] = useState({ penaltiesLift: 58, shotsHide: 58, scoreboardHeight: 56 });
  const mainTransitionStageRef = useRef<MainTransitionStage>("idle");

  const clearStingTimers = () => {
    if (stingTimeoutRef.current) {
      clearTimeout(stingTimeoutRef.current);
    }
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
    }
    stingTimeoutRef.current = null;
    revealTimeoutRef.current = null;
  };

  const stopGoalSting = () => {
    clearStingTimers();
    goalQueueRef.current = [];
    stingStateRef.current = { active: false, team: null };
    setGoalSting((current) => ({ ...current, active: false }));
  };

  const clearMainHideTimers = () => {
    if (hidePenaltyLiftTimeoutRef.current) {
      clearTimeout(hidePenaltyLiftTimeoutRef.current);
      hidePenaltyLiftTimeoutRef.current = null;
    }
    if (hideCloseTimeoutRef.current) {
      clearTimeout(hideCloseTimeoutRef.current);
      hideCloseTimeoutRef.current = null;
    }
    if (showOpenTimeoutRef.current) {
      clearTimeout(showOpenTimeoutRef.current);
      showOpenTimeoutRef.current = null;
    }
    if (showPenaltiesTimeoutRef.current) {
      clearTimeout(showPenaltiesTimeoutRef.current);
      showPenaltiesTimeoutRef.current = null;
    }
  };

  const measureMainAnimationVars = () => {
    const scoreboardHeight = scoreboardPanelRef.current?.offsetHeight ?? 56;
    const shotsHeight = shotsPanelRef.current?.offsetHeight ?? 36;
    const next = {
      penaltiesLift: scoreboardHeight,
      shotsHide: Math.max(scoreboardHeight, shotsHeight),
      scoreboardHeight,
    };

    setMainAnimationVars((current) =>
      current.penaltiesLift !== next.penaltiesLift ||
      current.shotsHide !== next.shotsHide ||
      current.scoreboardHeight !== next.scoreboardHeight
        ? next
        : current,
    );
  };

  const playNextGoalSting = () => {
    const nextGoal = goalQueueRef.current.shift();
    if (!nextGoal) {
      stingStateRef.current = { active: false, team: null };
      setGoalSting((current) => ({ ...current, active: false }));
      return;
    }

    clearStingTimers();
    stingStateRef.current = { active: true, team: nextGoal.team };
    setGoalSting({ active: true, team: nextGoal.team });

    revealTimeoutRef.current = setTimeout(() => {
      setDisplayScores((current) => ({
        ...current,
        [nextGoal.team]: nextGoal.targetScore,
      }));
    }, goalScoreRevealMs);

    stingTimeoutRef.current = setTimeout(() => {
      stingStateRef.current = { active: false, team: null };
      setGoalSting((current) => ({ ...current, active: false }));
      playNextGoalSting();
    }, goalStingDurationMs);
  };

  useEffect(() => {
    if (!skipConnect) {
      connect();
    }
  }, [connect, skipConnect]);

  useEffect(() => {
    return () => {
      clearStingTimers();
      clearMainHideTimers();
    };
  }, []);

  const overlayVisible = gameState?.overlayVisible ?? true;
  const penaltyAnimationMs = PENALTY_ANIMATION_MS;
  const mainHidePenaltyLiftMs = MAIN_HIDE_PENALTY_LIFT_MS;
  const mainHideScoreboardCloseMs = MAIN_HIDE_SCOREBOARD_CLOSE_MS;
  const goalStingDurationMs = GOAL_STING_DURATION_MS;
  const goalScoreRevealMs = GOAL_SCORE_REVEAL_MS;
  const displayTime = useClockDisplay(gameState?.clock ?? null, serverTimeOffsetMs, "20:00");

  useEffect(() => {
    if (!gameState) return;
  }, [gameState]);

  const jumbotronGoalHighlight = gameState?.jumbotronGoalHighlight;
  useEffect(() => {
    if (!jumbotronGoalHighlight) return;
    const remainingMs = jumbotronGoalHighlight.expiresAt - (Date.now() + serverTimeOffsetMs);
    const hide = () => {
      updateState({
        jumbotronGoalHighlight: null,
        lowerThird: { ...(gameState?.lowerThird ?? { active: false, title: "", subtitle: "" }), active: false },
      });
    };
    if (remainingMs <= 0) {
      hide();
      return;
    }
    const timer = window.setTimeout(hide, remainingMs + 50);
    return () => window.clearTimeout(timer);
  }, [jumbotronGoalHighlight?.expiresAt, serverTimeOffsetMs]);

  useEffect(() => {
    if (!gameState) return;

    const nextScores = {
      home: gameState.homeTeam.score,
      away: gameState.awayTeam.score,
    };

    if (!previousScoresRef.current) {
      previousScoresRef.current = nextScores;
      setDisplayScores(nextScores);
      return;
    }

    const previousScores = previousScoresRef.current;
    const homeDelta = nextScores.home - previousScores.home;
    const awayDelta = nextScores.away - previousScores.away;

    if (homeDelta < 0 || awayDelta < 0 || (homeDelta > 0 && awayDelta > 0)) {
      stopGoalSting();
      setDisplayScores(nextScores);
    } else if (homeDelta > 0) {
      const goals = Array.from({ length: homeDelta }, (_, index) => ({
        team: "home" as const,
        targetScore: previousScores.home + index + 1,
      }));
      goalQueueRef.current.push(...goals);
      setDisplayScores((current) => ({ ...current, away: nextScores.away }));
      if (!stingStateRef.current.active) {
        playNextGoalSting();
      }
    } else if (awayDelta > 0) {
      const goals = Array.from({ length: awayDelta }, (_, index) => ({
        team: "away" as const,
        targetScore: previousScores.away + index + 1,
      }));
      goalQueueRef.current.push(...goals);
      setDisplayScores((current) => ({ ...current, home: nextScores.home }));
      if (!stingStateRef.current.active) {
        playNextGoalSting();
      }
    } else if (!stingStateRef.current.active && goalQueueRef.current.length === 0) {
      setDisplayScores(nextScores);
    }

    previousScoresRef.current = nextScores;
  }, [gameState?.homeTeam.score, gameState?.awayTeam.score]);

  useLayoutEffect(() => {
    measureMainAnimationVars();
    clearMainHideTimers();
    const wasVisible = previousOverlayVisibleRef.current;
    previousOverlayVisibleRef.current = overlayVisible;

    if (renderedLayout !== "main") {
      setMainTransitionStage("idle");
      mainTransitionStageRef.current = "idle";
      setKeepMainVisibleForHide(false);
      return;
    }

    if (!wasVisible && overlayVisible) {
      setMainTransitionStage("showing-open");
      mainTransitionStageRef.current = "showing-open";
      setKeepMainVisibleForHide(false);
      showOpenTimeoutRef.current = setTimeout(() => {
        setMainTransitionStage("showing-penalties");
        mainTransitionStageRef.current = "showing-penalties";
        showOpenTimeoutRef.current = null;
      }, mainHideScoreboardCloseMs);
      showPenaltiesTimeoutRef.current = setTimeout(() => {
        setMainTransitionStage("idle");
        mainTransitionStageRef.current = "idle";
        showPenaltiesTimeoutRef.current = null;
      }, mainHideScoreboardCloseMs + mainHidePenaltyLiftMs);
      return;
    }

    if (wasVisible && !overlayVisible) {
      setKeepMainVisibleForHide(true);
      setMainTransitionStage("hiding-penalties");
      mainTransitionStageRef.current = "hiding-penalties";
      hidePenaltyLiftTimeoutRef.current = setTimeout(() => {
        setMainTransitionStage("hiding-close");
        mainTransitionStageRef.current = "hiding-close";
        hidePenaltyLiftTimeoutRef.current = null;
      }, mainHidePenaltyLiftMs);
      hideCloseTimeoutRef.current = setTimeout(() => {
        setKeepMainVisibleForHide(false);
        setMainTransitionStage("idle");
        mainTransitionStageRef.current = "idle";
        hideCloseTimeoutRef.current = null;
      }, mainHidePenaltyLiftMs + mainHideScoreboardCloseMs);
      return;
    }

    if (overlayVisible) {
      setMainTransitionStage("idle");
      mainTransitionStageRef.current = "idle";
      setKeepMainVisibleForHide(false);
      return;
    }
  }, [overlayVisible, renderedLayout, mainHidePenaltyLiftMs, mainHideScoreboardCloseMs]);

  const homePenalties = useAnimatedPenalties(gameState?.homeTeam.penalties ?? [], penaltyAnimationMs);
  const awayPenalties = useAnimatedPenalties(gameState?.awayTeam.penalties ?? [], penaltyAnimationMs);

  useLayoutEffect(() => {
    if (renderedLayout !== "main") return;

    if (mainTransitionStageRef.current !== "idle") return;
    measureMainAnimationVars();
    const resizeHandler = () => {
      if (mainTransitionStageRef.current === "idle") {
        measureMainAnimationVars();
      }
    };
    window.addEventListener("resize", resizeHandler);
    return () => window.addEventListener("resize", resizeHandler);
  }, [renderedLayout, homePenalties.length, awayPenalties.length, gameState?.period]);

  if (!gameState) return null;

  const { homeTeam, awayTeam, period, lowerThird } = gameState;
  const scoringTeamData = goalSting.team === "home" ? homeTeam : awayTeam;

  const shouldRenderMainHideAnimation =
    renderedLayout === "main" &&
    (keepMainVisibleForHide || mainTransitionStage === "showing-open" || mainTransitionStage === "showing-penalties");
  const shouldRenderMain = overlayVisible || shouldRenderMainHideAnimation;

  const borderClass = "border-zinc-300";
  const bgClass = "bg-zinc-100 text-zinc-900";
  const textClass = "text-zinc-900";
  const mutedText = "text-zinc-600";
  const subtleText = "text-zinc-500";
  const scoreBg = "bg-zinc-200";
  const penaltiesLifting = mainTransitionStage === "hiding-penalties";
  const penaltiesHiddenStatic = mainTransitionStage === "hiding-close" || mainTransitionStage === "showing-open";
  const penaltiesDropping = mainTransitionStage === "showing-penalties";
  const scoreboardClosing = mainTransitionStage === "hiding-close";
  const scoreboardOpening = mainTransitionStage === "showing-open";
  const shotsHiding = mainTransitionStage === "hiding-penalties";
  const shotsHiddenStatic = mainTransitionStage === "hiding-close" || mainTransitionStage === "showing-open";
  const shotsShowing = mainTransitionStage === "showing-penalties";

  const renderPenaltyTimers = (
    penalties: Array<{ id: string; animState?: "entering" | "exiting" | string; timeRemaining: number; playerNumber?: string }>,
  ) => {
    if (penalties.length === 0) return null;
    return (
      <div className="overflow-hidden">
        <div className="flex flex-col text-xs font-mono font-bold overflow-hidden">
          {penalties.map((p, index) => (
            <PenaltyTimer
              key={p.id}
              penalty={p}
              style={
                {
                  // @ts-ignore custom CSS var
                  "--penalty-hide-shift": `${-(mainAnimationVars.scoreboardHeight / 2 + PENALTY_ROW_HEIGHT_PX / 2 + index * PENALTY_ROW_HEIGHT_PX)}px`,
                } as CSSProperties
              }
              className={
                `${penaltiesLifting ? " penalty-to-scoreboard-hide" : ""}${
                  penaltiesHiddenStatic ? " penalty-hidden-at-scoreboard" : ""
                }${penaltiesDropping ? " penalty-from-scoreboard-show" : ""}${
                  p.animState === "entering"
                    ? "penalty-item-enter"
                    : p.animState === "exiting"
                      ? "penalty-item-exit"
                      : ""
                }`
              }
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-transparent font-sans text-zinc-900"
    >
      {(lowerThird?.title || lowerThird?.subtitle) && (
        <div className={`lower-third ${lowerThird?.active ? "lower-third-show" : "lower-third-hide"}`}>
          <div className="lower-third-content">
            <div className="lower-third-title">{lowerThird.title}</div>
            {lowerThird.subtitle && <div className="lower-third-subtitle">{lowerThird.subtitle}</div>}
          </div>
        </div>
      )}
      {shouldRenderMain && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-stretch gap-1"
          style={
            {
              "--main-penalties-lift": `${mainAnimationVars.penaltiesLift}px`,
              "--main-shots-hide": `${mainAnimationVars.shotsHide}px`,
              "--main-scoreboard-height": `${mainAnimationVars.scoreboardHeight}px`,
            } as CSSProperties
          }
        >
          <div
            ref={shotsPanelRef}
            className={`relative z-10 px-4 py-1 border ${borderClass} ${bgClass} flex items-center gap-4 overflow-hidden ${
              shotsHiding ? "main-overlay-shots-hide" : ""
            } ${shotsHiddenStatic ? "main-overlay-shots-hidden-static" : ""} ${shotsShowing ? "main-overlay-shots-show" : ""}`}
          >
            <span className="w-10 text-right font-mono text-lg font-bold">{homeTeam.shots}</span>
            <span className={`flex-1 text-center text-xs font-bold tracking-[0.2em] uppercase ${mutedText}`}>Shots</span>
            <span className="w-10 text-left font-mono text-lg font-bold">{awayTeam.shots}</span>
          </div>

          {/* Scoreboard Bug - Top Center */}
          <div
            ref={scoreboardPanelRef}
            className={`relative z-30 flex items-stretch ${textClass} ${
              scoreboardClosing ? "main-overlay-scoreboard-closing" : ""
            } ${scoreboardOpening ? "main-overlay-scoreboard-opening" : ""}`}
          >
            {goalSting.active && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
                <div
                  className={`goal-sting-overlay goal-sting-light ${goalSting.team === "home" ? "goal-sting-home" : "goal-sting-away"}`}
                  style={
                    {
                      "--goal-sting-color": goalSting.team === "home" ? homeTeam.color : awayTeam.color,
                    } as Record<string, string>
                  }
                >
                  <div className="goal-sting-banner">
                    <span className="goal-sting-line" />
                    <span className="goal-sting-label">
                      {scoringTeamData.logo && (
                        <img
                          src={scoringTeamData.logo}
                          alt={scoringTeamData.abbreviation}
                          className="goal-sting-logo"
                        />
                      )}
                      <span className="goal-sting-text">GOAL!</span>
                    </span>
                    <span className="goal-sting-line" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Home Team */}
            <div className="relative">
              <div className={`flex items-center h-14 ${bgClass} border-y border-l ${borderClass}`}>
                <div className="w-2 h-full" style={{ backgroundColor: homeTeam.color }} />
                {homeTeam.logo && (
                  <div className="pl-3 w-8 h-8 flex items-center justify-center overflow-visible">
                    <img src={homeTeam.logo} alt={homeTeam.abbreviation} className="h-8 w-8 scale-150 object-contain" />
                  </div>
                )}
                <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                  {homeTeam.abbreviation}
                </div>
                <div className={`px-4 ${scoreBg} h-full flex items-center justify-center font-mono text-3xl font-bold w-16`}>
                  {displayScores.home}
                </div>
              </div>
            </div>

            {/* Center Clock & Period */}
              <div
                className={`flex flex-col items-center justify-center px-6 h-14 ${bgClass} min-w-35 border-x border-y ${borderClass}`}
              >
                <div className="text-3xl font-mono font-bold tracking-tighter text-amber-700">
                  {displayTime}
                </div>
                <div className={`text-xs font-bold tracking-widest uppercase mt-1 ${subtleText}`}>
                  {period}
                </div>
              </div>

            {/* Away Team */}
            <div className="relative">
              <div className={`flex items-center h-14 ${bgClass} border-y border-r ${borderClass}`}>
                <div className={`px-4 ${scoreBg} h-full flex items-center justify-center font-mono text-3xl font-bold w-16`}>
                  {displayScores.away}
                </div>
                <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                  {awayTeam.abbreviation}
                </div>
                {awayTeam.logo && (
                  <div className="pr-3 w-8 h-8 flex items-center justify-center overflow-visible">
                    <img src={awayTeam.logo} alt={awayTeam.abbreviation} className="h-8 w-8 scale-150 object-contain" />
                  </div>
                )}
                <div className="w-2 h-full" style={{ backgroundColor: awayTeam.color }} />
              </div>
            </div>
          </div>

          <div className="absolute top-full left-0 right-0 z-20 flex">
            <div className="w-1/2 pr-[70px]">
              {renderPenaltyTimers(homePenalties)}
            </div>

            <div className="w-1/2 pl-[70px]">
              {renderPenaltyTimers(awayPenalties)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PenaltyTimer({ penalty, className = "", style }: { penalty: any; className?: string; style?: CSSProperties }) {
  const timeDisplay = formatPenaltyTimeMs(penalty.timeRemaining ?? 0);
  let playerNumber = String(penalty.playerNumber ?? "").trim();
  playerNumber = playerNumber === "00" ? "" : playerNumber;
  const display = playerNumber ? `${playerNumber} - ${timeDisplay}` : timeDisplay;

  return (
    <div
      className={`penalty-item px-3 py-1 bg-red-600 border-t border-red-200/70 text-white flex justify-center items-center ${className}`}
      style={style}
    >
      <span>{display}</span>
    </div>
  );
}
