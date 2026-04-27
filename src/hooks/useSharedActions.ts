import { useStore } from "../store";
import { buildShotEvent, buildPeriodEndEvent } from "../utils/eventLog";

const PERIODS = ["1st", "2nd", "3rd", "OT"];
const PERIOD_CLOCKS_MS: Record<string, number> = {
  "1st": 20 * 60 * 1000,
  "2nd": 20 * 60 * 1000,
  "3rd": 20 * 60 * 1000,
  OT: 5 * 60 * 1000,
};

export function useSharedActions() {
  const { gameState, startClock, stopClock, clockIncrease, clockDecrease, updateState, setClock } = useStore();

  const handleAction = (action: string) => {
    if (!gameState) return;

    const updatePeriod = (nextPeriod: string) => {
      const currentPeriod = gameState.period;
      if (currentPeriod !== nextPeriod) {
        const lastEvent = gameState.eventLog[gameState.eventLog.length - 1];
        const alreadyEnded =
          (gameState.clock.timeRemaining ?? 0) <= 0 ||
          (lastEvent?.type === "period_end" && lastEvent.period === currentPeriod);
        
        if (alreadyEnded) {
          updateState({ period: nextPeriod });
        } else {
          const endEvent = buildPeriodEndEvent(gameState, currentPeriod);
          updateState({ period: nextPeriod, eventLog: [...gameState.eventLog, endEvent] });
        }
      } else {
        updateState({ period: nextPeriod });
      }
      
      const nextClock = PERIOD_CLOCKS_MS[nextPeriod];
      if (typeof nextClock === "number") {
        setClock(nextClock);
      }
    };

    switch (action) {
      case "toggleClock":
        if (gameState.clock.isRunning) {
          stopClock();
        } else {
          startClock();
        }
        break;
      case "clockIncrease":
        clockIncrease();
        break;
      case "clockDecrease":
        clockDecrease();
        break;
      case "homeScoreUp":
        updateState({
          homeTeam: { ...gameState.homeTeam, score: gameState.homeTeam.score + 1 },
        });
        break;
      case "awayScoreUp":
        updateState({
          awayTeam: { ...gameState.awayTeam, score: gameState.awayTeam.score + 1 },
        });
        break;
      case "homeShotsUp": {
        const event = buildShotEvent(gameState, "home", 1);
        updateState({
          homeTeam: { ...gameState.homeTeam, shots: gameState.homeTeam.shots + 1 },
          eventLog: [...gameState.eventLog, event],
        });
        break;
      }
      case "awayShotsUp": {
        const event = buildShotEvent(gameState, "away", 1);
        updateState({
          awayTeam: { ...gameState.awayTeam, shots: gameState.awayTeam.shots + 1 },
          eventLog: [...gameState.eventLog, event],
        });
        break;
      }
      case "homeScoreDown":
        updateState({
          homeTeam: { ...gameState.homeTeam, score: Math.max(0, gameState.homeTeam.score - 1) },
        });
        break;
      case "awayScoreDown":
        updateState({
          awayTeam: { ...gameState.awayTeam, score: Math.max(0, gameState.awayTeam.score - 1) },
        });
        break;
      case "homeShotsDown": {
        const nextShots = Math.max(0, gameState.homeTeam.shots - 1);
        if (nextShots !== gameState.homeTeam.shots) {
          const event = buildShotEvent(gameState, "home", -1);
          updateState({
            homeTeam: { ...gameState.homeTeam, shots: nextShots },
            eventLog: [...gameState.eventLog, event],
          });
        }
        break;
      }
      case "awayShotsDown": {
        const nextShots = Math.max(0, gameState.awayTeam.shots - 1);
        if (nextShots !== gameState.awayTeam.shots) {
          const event = buildShotEvent(gameState, "away", -1);
          updateState({
            awayTeam: { ...gameState.awayTeam, shots: nextShots },
            eventLog: [...gameState.eventLog, event],
          });
        }
        break;
      }
      case "homePenaltyAdd": {
        const newPenalty = {
          id: Math.random().toString(36).slice(2, 11),
          playerNumber: "",
          timeRemaining: 120000,
          duration: 120000,
          infraction: "",
        };
        updateState({
          homeTeam: { ...gameState.homeTeam, penalties: [...gameState.homeTeam.penalties, newPenalty] },
        });
        break;
      }
      case "awayPenaltyAdd": {
        const newPenalty = {
          id: Math.random().toString(36).slice(2, 11),
          playerNumber: "",
          timeRemaining: 120000,
          duration: 120000,
          infraction: "",
        };
        updateState({
          awayTeam: { ...gameState.awayTeam, penalties: [...gameState.awayTeam.penalties, newPenalty] },
        });
        break;
      }
      case "homePenaltyRemoveEarliest":
        updateState({
          homeTeam: { ...gameState.homeTeam, penalties: gameState.homeTeam.penalties.slice(1) },
        });
        break;
      case "awayPenaltyRemoveEarliest":
        updateState({
          awayTeam: { ...gameState.awayTeam, penalties: gameState.awayTeam.penalties.slice(1) },
        });
        break;
      case "nextPeriod": {
        const currentIndex = PERIODS.indexOf(gameState.period);
        if (currentIndex < PERIODS.length - 1) {
          updatePeriod(PERIODS[currentIndex + 1]);
        }
        break;
      }
      case "prevPeriod": {
        const currentIndex = PERIODS.indexOf(gameState.period);
        if (currentIndex > 0) {
          updatePeriod(PERIODS[currentIndex - 1]);
        }
        break;
      }
      default:
        console.warn(`Unhandled action: ${action}`);
    }
  };

  return { handleAction };
}
