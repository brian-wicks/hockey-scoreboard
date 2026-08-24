import type { DbAdapter } from "./types.ts";

export type { DBConfig, SavedGame } from "./types.ts";

// DB_BACKEND selects the persistence backend: "firestore" opts in explicitly;
// anything else (unset, "sqlite", a typo) falls back to sqlite, so local dev
// stays zero-config by construction. Staging/production set this to "firestore"
// via ecosystem.config.cjs; vitest never sets it, so the test suite keeps
// exercising the real sqlite adapter exactly as it did before this toggle existed.
const backend = process.env.DB_BACKEND === "firestore" ? "firestore" : "sqlite";

// Fail fast at import time rather than on the first Firestore call deep inside a
// request handler, where a missing credential would surface as an opaque SDK error.
if (backend === "firestore" && !process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error(
    "DB_BACKEND=firestore requires FIREBASE_SERVICE_ACCOUNT to be set (see .env.example).",
  );
}

// Dynamically imported so a sqlite-only host never loads firebase-admin/firestore,
// and a Firestore-only host never opens/creates data/scoreboard.db on disk.
const adapter: DbAdapter =
  backend === "firestore" ? await import("./firestoreAdapter.ts") : await import("./sqliteAdapter.ts");

export const getUserConfig = adapter.getUserConfig;
export const setUserConfig = adapter.setUserConfig;
export const getGameState = adapter.getGameState;
export const saveGameState = adapter.saveGameState;
export const getSavedGames = adapter.getSavedGames;
export const getSavedGame = adapter.getSavedGame;
export const createSavedGame = adapter.createSavedGame;
export const deleteSavedGame = adapter.deleteSavedGame;
export const getShareUserId = adapter.getShareUserId;
export const getUserIdShare = adapter.getUserIdShare;
export const setUserIdShare = adapter.setUserIdShare;
export const pingDatabase = adapter.pingDatabase;
