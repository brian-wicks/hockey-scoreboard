import type { Penalty } from "../store";

export function createBlankPenalty(): Penalty {
  return {
    id: Math.random().toString(36).slice(2, 11),
    playerNumber: "",
    timeRemaining: 120000,
    duration: 120000,
    infraction: "",
  };
}
