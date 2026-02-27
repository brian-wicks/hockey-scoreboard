import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

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
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setAnimatedPenalties((current) => {
      const nextById = new Map(penalties.map((penalty) => [penalty.id, penalty]));

      const nextItems = current.map((item) => {
        const nextPenalty = nextById.get(item.id);
        if (nextPenalty) {
          return {
            ...item,
            ...nextPenalty,
            animState: item.animState === "exiting" ? "exiting" : item.animState,
          };
        }
        return item.animState === "exiting" ? item : { ...item, animState: "exiting" };
      });

      penalties.forEach((penalty) => {
        if (!current.some((item) => item.id === penalty.id)) {
          nextItems.push({ ...penalty, animState: "entering" });
        }
      });

      return nextItems;
    });
  }, [penalties]);

  useEffect(() => {
    animatedPenalties.forEach((item) => {
      if (item.animState === "idle" || timersRef.current.has(item.id)) return;

      const timer = setTimeout(() => {
        setAnimatedPenalties((current) => {
          if (item.animState === "entering") {
            return current.map((penalty) =>
              penalty.id === item.id ? { ...penalty, animState: "idle" } : penalty,
            );
          }
          return current.filter((penalty) => penalty.id !== item.id);
        });
        timersRef.current.delete(item.id);
      }, PENALTY_ANIMATION_MS);

      timersRef.current.set(item.id, timer);
    });
  }, [animatedPenalties]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return animatedPenalties;
}

export default function Overlay() {
  const { gameState, connect } = useStore();
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
    connect();
  }, [connect]);

  useEffect(() => {
    return () => {
      clearStingTimers();
    };
  }, []);

  useEffect(() => {
    if (!gameState) return;
    
    let animationFrameId: number;
    const updateDisplay = () => {
      let currentRemaining = gameState.clock.timeRemaining;
      if (gameState.clock.isRunning) {
        const elapsed = Date.now() - gameState.clock.lastUpdate;
        currentRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      }
      
      const totalSeconds = Math.ceil(currentRemaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      if (currentRemaining <= 60000 && currentRemaining > 0) {
        const tenths = Math.floor((currentRemaining % 1000) / 100);
        setDisplayTime(`${seconds}.${tenths}`);
      } else {
        setDisplayTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
      
      if (gameState.clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState?.clock.isRunning, gameState?.clock.timeRemaining, gameState?.clock.lastUpdate]);

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

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent font-sans text-white">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-stretch gap-1">
        <div className="px-4 py-1 rounded-md border border-white/10 bg-black/75 backdrop-blur-md flex items-center gap-4">
          <span className="w-10 text-right font-mono text-lg font-bold">{homeTeam.shots}</span>
          <span className="flex-1 text-center text-xs font-bold tracking-[0.2em] uppercase text-zinc-300">Shots</span>
          <span className="w-10 text-left font-mono text-lg font-bold">{awayTeam.shots}</span>
        </div>

        {/* Scoreboard Bug - Top Center */}
        <div
          className={`relative flex items-stretch shadow-2xl border border-white/10 backdrop-blur-md bg-black/80 rounded-t-lg ${
            homePenalties.length > 0 ? "rounded-bl-none" : "rounded-bl-lg"
          } ${awayPenalties.length > 0 ? "rounded-br-none" : "rounded-br-lg"}`}
        >
          {goalSting.active && (
            <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none z-20">
              <div
                className={`goal-sting-overlay ${goalSting.team === "home" ? "goal-sting-home" : "goal-sting-away"}`}
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
              <div 
                className={`w-2 h-full rounded-tl-lg ${homePenalties.length > 0 ? "rounded-bl-none" : "rounded-bl-lg"}`}
                style={{ backgroundColor: homeTeam.color }} 
              />
              {homeTeam.logo && (
                <div className="pl-3 flex items-center justify-center">
                  <img src={homeTeam.logo} alt={homeTeam.abbreviation} className="h-8 w-8 object-contain" />
                </div>
              )}
              <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                {homeTeam.abbreviation}
              </div>
              <div className="px-4 bg-white/10 h-full flex items-center justify-center font-mono text-3xl font-bold w-16">
                {displayScores.home}
              </div>
            </div>

            {homePenalties.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 z-10 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
                style={{
                  maxHeight: `${homePenalties.length * 40}px`,
                  opacity: homePenalties.length > 0 ? 1 : 0,
                  transform: homePenalties.length > 0 ? "translateY(0)" : "translateY(-8px)",
                }}
              >
                <div className="flex flex-col bg-red-600/95 text-xs font-mono font-bold rounded-b-md overflow-hidden shadow-xl">
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

          {/* Center Clock & Period */}
          <div className="flex flex-col items-center justify-center px-6 h-14 bg-black/50 min-w-35 border-x border-white/10">
            <div className="text-3xl font-mono font-bold tracking-tighter text-yellow-400">
              {displayTime}
            </div>
            <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase mt-1">
              {period}
            </div>
          </div>

          {/* Away Team */}
          <div className="relative">
            <div className="flex items-center h-14">
              <div className="px-4 bg-white/10 h-full flex items-center justify-center font-mono text-3xl font-bold w-16">
                {displayScores.away}
              </div>
              <div className="px-4 font-bold text-2xl tracking-wider w-24 text-center">
                {awayTeam.abbreviation}
              </div>
              {awayTeam.logo && (
                <div className="pr-3 flex items-center justify-center">
                  <img src={awayTeam.logo} alt={awayTeam.abbreviation} className="h-8 w-8 object-contain" />
                </div>
              )}
              <div 
                className={`w-2 h-full rounded-tr-lg ${awayPenalties.length > 0 ? "rounded-br-none" : "rounded-br-lg"}`}
                style={{ backgroundColor: awayTeam.color }} 
              />
            </div>

            {awayPenalties.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 z-10 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
                style={{
                  maxHeight: `${awayPenalties.length * 40}px`,
                  opacity: awayPenalties.length > 0 ? 1 : 0,
                  transform: awayPenalties.length > 0 ? "translateY(0)" : "translateY(-8px)",
                }}
              >
                <div className="flex flex-col bg-red-600/95 text-xs font-mono font-bold rounded-b-md overflow-hidden shadow-xl">
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
    <div className={`px-3 py-1 border-t border-white/20 flex justify-center items-center ${className}`}>
      <span>{display}</span>
    </div>
  );
}
