import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { formatClockDisplay } from "../utils/clock";

const GOAL_STING_DURATION_MS = 1900;
const GOAL_SCORE_REVEAL_MS = 280;
const PENALTY_ANIMATION_MS = 260;
type GoalTeam = "home" | "away";
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

function useAnimatedPenalties(penalties: any[]): AnimatedPenalty[] {
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
        }, PENALTY_ANIMATION_MS);
        exitTimersRef.current.set(item.id, timer);
      }
    });
  }, [animatedPenalties]);

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

export default function Overlay({ embedded = false, skipConnect = false }: { embedded?: boolean; skipConnect?: boolean } = {}) {
  const { gameState, connect, serverTimeOffsetMs } = useStore();
  const [renderedLayout, setRenderedLayout] = useState<"main" | "corner">("main");
  const [renderedCorner, setRenderedCorner] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-right");
  const [displayTime, setDisplayTime] = useState("20:00");
  const [displayScores, setDisplayScores] = useState({ home: 0, away: 0 });
  const [goalSting, setGoalSting] = useState<{ active: boolean; team: GoalTeam }>({
    active: false,
    team: "home",
  });
  const previousScoresRef = useRef<{ home: number; away: number } | null>(null);
  const stingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stingStateRef = useRef<{ active: boolean; team: GoalTeam | null }>({ active: false, team: null });
  const goalQueueRef = useRef<GoalEvent[]>([]);

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
    }, GOAL_SCORE_REVEAL_MS);

    stingTimeoutRef.current = setTimeout(() => {
      stingStateRef.current = { active: false, team: null };
      setGoalSting((current) => ({ ...current, active: false }));
      playNextGoalSting();
    }, GOAL_STING_DURATION_MS);
  };

  useEffect(() => {
    if (!skipConnect) {
      connect();
    }
  }, [connect, skipConnect]);

  useEffect(() => {
    return () => {
      clearStingTimers();
    };
  }, []);

  const overlayVisible = gameState?.overlayVisible ?? true;
  const overlayLayout = gameState?.overlayLayout ?? "main";
  const overlayCorner = gameState?.overlayCorner ?? "top-left";
  const overlayTheme = gameState?.overlayTheme ?? "dark";
  const isLight = overlayTheme === "light";

  useEffect(() => {
    if (!gameState) return;
    if (renderedLayout !== overlayLayout) {
      setRenderedLayout(overlayLayout);
    }
    if (renderedCorner !== overlayCorner) {
      setRenderedCorner(overlayCorner);
    }
  }, [gameState, overlayLayout, overlayCorner, renderedLayout, renderedCorner]);

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

  const homePenalties = useAnimatedPenalties(gameState?.homeTeam.penalties ?? []);
  const awayPenalties = useAnimatedPenalties(gameState?.awayTeam.penalties ?? []);

  if (!gameState) return null;

  const { homeTeam, awayTeam, period } = gameState;
  const scoringTeamData = goalSting.team === "home" ? homeTeam : awayTeam;
  const cornerPosition =
    renderedCorner === "top-left"
      ? "top-4 left-4"
      : renderedCorner === "top-right"
        ? "top-4 right-4"
        : renderedCorner === "bottom-left"
          ? "bottom-4 left-4"
          : "bottom-4 right-4";

  if (!overlayVisible) {
    return (
      <div
        className={`${
          embedded ? "relative w-full h-full" : "w-screen h-screen"
        } overflow-hidden bg-transparent font-sans text-white`}
      />
    );
  }

  const borderClass = isLight ? "border-zinc-400" : "border-zinc-600";
  const bgClass = isLight ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-100";
  const mutedText = isLight ? "text-zinc-700" : "text-zinc-300";
  const subtleText = isLight ? "text-zinc-600" : "text-zinc-400";
  const dividerBg = isLight ? "bg-zinc-300" : "bg-zinc-700";
  const scoreBg = isLight ? "bg-zinc-200" : "bg-zinc-800";

  return (
    <div
      className={`${
        embedded ? "relative w-full h-full" : "w-screen h-screen"
      } overflow-hidden bg-transparent font-sans text-white`}
    >
      {renderedLayout === "corner" ? (
        <div className={`absolute ${cornerPosition} z-20`}>
          <div className={`border ${borderClass} ${bgClass} px-3 py-2 min-w-[180px]`}>
            <div className={`flex items-center justify-between text-xs font-semibold ${mutedText}`}>
              <span className="font-bold">{homeTeam.abbreviation}</span>
              <span className={`${isLight ? "text-amber-700" : "text-yellow-400"} font-mono`}>{displayTime}</span>
              <span className="font-bold">{awayTeam.abbreviation}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-lg font-mono font-bold">
              <span>{displayScores.home}</span>
              <span className={`text-xs font-semibold uppercase ${subtleText}`}>{period}</span>
              <span>{displayScores.away}</span>
            </div>
            <div className={`mt-2 h-1 w-full overflow-hidden ${dividerBg}`}>
              <div className="h-full" style={{ width: "100%", backgroundColor: homeTeam.color }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-stretch gap-1">
          <div className={`relative px-4 py-1 border ${borderClass} ${bgClass} flex items-center gap-4 overflow-hidden`}>
            <span className="w-10 text-right font-mono text-lg font-bold">{homeTeam.shots}</span>
            <span className={`flex-1 text-center text-xs font-bold tracking-[0.2em] uppercase ${mutedText}`}>Shots</span>
            <span className="w-10 text-left font-mono text-lg font-bold">{awayTeam.shots}</span>
          </div>

          {/* Scoreboard Bug - Top Center */}
          <div className={`relative z-30 flex items-stretch border ${borderClass} ${bgClass}`}>
            <div className={`absolute inset-x-0 bottom-0 h-px ${borderClass}`} />
            {goalSting.active && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
                <div
                  className={`goal-sting-overlay ${isLight ? "goal-sting-light" : ""} ${goalSting.team === "home" ? "goal-sting-home" : "goal-sting-away"}`}
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
              <div className="flex items-center h-14">
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
              <div className={`flex flex-col items-center justify-center px-6 h-14 ${bgClass} min-w-35 border-x ${borderClass}`}>
                <div className={`text-3xl font-mono font-bold tracking-tighter ${isLight ? "text-amber-700" : "text-yellow-400"}`}>
                  {displayTime}
                </div>
                <div className={`text-xs font-bold tracking-widest uppercase mt-1 ${subtleText}`}>
                  {period}
                </div>
              </div>

            {/* Away Team */}
            <div className="relative">
              <div className="flex items-center h-14">
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
              {homePenalties.length > 0 && (
                <div
                  className="overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
                  style={{
                    maxHeight: `${homePenalties.length * 40}px`,
                    opacity: homePenalties.length > 0 ? 1 : 0,
                    transform: homePenalties.length > 0 ? "translateY(0)" : "translateY(-8px)",
                  }}
                >
                  <div className="flex flex-col text-xs font-mono font-bold overflow-hidden">
                    {homePenalties.map((p) => (
                      <PenaltyTimer
                        key={p.id}
                        penalty={p}
                        className={
                          p.animState === "entering"
                            ? "penalty-item-enter"
                            : p.animState === "exiting"
                              ? "penalty-item-exit"
                              : ""
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-1/2 pl-[70px]">
              {awayPenalties.length > 0 && (
                <div
                  className="overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
                  style={{
                    maxHeight: `${awayPenalties.length * 40}px`,
                    opacity: awayPenalties.length > 0 ? 1 : 0,
                    transform: awayPenalties.length > 0 ? "translateY(0)" : "translateY(-8px)",
                  }}
                >
                  <div className="flex flex-col text-xs font-mono font-bold overflow-hidden">
                    {awayPenalties.map((p) => (
                      <PenaltyTimer
                        key={p.id}
                        penalty={p}
                        className={
                          p.animState === "entering"
                            ? "penalty-item-enter"
                            : p.animState === "exiting"
                              ? "penalty-item-exit"
                              : ""
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PenaltyTimer({ penalty, className = "" }: { penalty: any; className?: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const totalSeconds = Math.ceil(Math.max(0, penalty.timeRemaining) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    let playerNumber = String(penalty.playerNumber ?? "").trim();
    playerNumber = playerNumber == "00" ? "" : playerNumber;
    setDisplay(playerNumber ? `${playerNumber} - ${timeDisplay}` : timeDisplay);
  }, [penalty.timeRemaining, penalty.playerNumber]);

  return (
    <div className={`penalty-item px-3 py-1 bg-red-600 border-t border-red-200/70 flex justify-center items-center ${className}`}>
      <span>{display}</span>
    </div>
  );
}
