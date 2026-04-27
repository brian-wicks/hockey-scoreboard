import { useStore } from "../store";
import { buildShotEvent } from "../utils/eventLog";

export function useSharedActions() {
  const { gameState, startClock, stopClock, clockIncrease, clockDecrease, updateState } = useStore();

  const handleAction = (action: string) => {
    if (!gameState) return;

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
      default:
        console.warn(`Unhandled action: ${action}`);
    }
  };

  return { handleAction };
}
