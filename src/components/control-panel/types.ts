import { GameState } from "../../store";

export type UpdateGameState = (updates: Partial<GameState>) => void;
