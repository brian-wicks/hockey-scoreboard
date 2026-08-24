import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import type { SavedGame } from "./types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, "../../data");
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(join(dbDir, "scoreboard.db"));

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_configs (
    userId TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY(userId, key)
  );

  CREATE TABLE IF NOT EXISTS user_game_state (
    userId TEXT PRIMARY KEY,
    state TEXT
  );

  CREATE TABLE IF NOT EXISTS user_shares (
    shareId TEXT PRIMARY KEY,
    userId TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS saved_games (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT,
    state TEXT,
    createdAt INTEGER
  );
`);

// Every export below is synchronous internally (better-sqlite3 has no async API) —
// only the return type is promisified, to satisfy the shared DbAdapter interface
// that src/db/firestoreAdapter.ts also implements. No behavior change from the
// pre-toggle version of this module.

export const getUserConfig = async (userId: string, key: string): Promise<string | null> => {
  const stmt = db.prepare("SELECT value FROM user_configs WHERE userId = ? AND key = ?");
  const row = stmt.get(userId, key) as { value: string } | undefined;
  return row ? row.value : null;
};

export const setUserConfig = async (userId: string, key: string, value: string): Promise<void> => {
  const stmt = db.prepare(`
    INSERT INTO user_configs (userId, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(userId, key, value);
};

export const getGameState = async (userId: string): Promise<string | null> => {
  const stmt = db.prepare("SELECT state FROM user_game_state WHERE userId = ?");
  const row = stmt.get(userId) as { state: string } | undefined;
  return row ? row.state : null;
};

export const saveGameState = async (userId: string, state: string): Promise<void> => {
  const stmt = db.prepare(`
    INSERT INTO user_game_state (userId, state)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET state = excluded.state
  `);
  stmt.run(userId, state);
};

export const getSavedGames = async (userId: string): Promise<SavedGame[]> => {
  const stmt = db.prepare("SELECT * FROM saved_games WHERE userId = ? ORDER BY createdAt DESC");
  return stmt.all(userId) as SavedGame[];
};

export const getSavedGame = async (id: string, userId: string): Promise<SavedGame | null> => {
  const stmt = db.prepare("SELECT * FROM saved_games WHERE id = ? AND userId = ?");
  return (stmt.get(id, userId) as SavedGame | undefined) ?? null;
};

export const createSavedGame = async (userId: string, name: string, state: string): Promise<string> => {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO saved_games (id, userId, name, state, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, name, state, Date.now());
  return id;
};

export const deleteSavedGame = async (id: string, userId: string): Promise<void> => {
  const stmt = db.prepare("DELETE FROM saved_games WHERE id = ? AND userId = ?");
  stmt.run(id, userId);
};

export const getShareUserId = async (shareId: string): Promise<string | null> => {
  const stmt = db.prepare("SELECT userId FROM user_shares WHERE shareId = ?");
  const row = stmt.get(shareId) as { userId: string } | undefined;
  return row ? row.userId : null;
};

export const getUserIdShare = async (userId: string): Promise<string | null> => {
  const stmt = db.prepare("SELECT shareId FROM user_shares WHERE userId = ?");
  const row = stmt.get(userId) as { shareId: string } | undefined;
  return row ? row.shareId : null;
};

export const setUserIdShare = async (userId: string, shareId: string): Promise<void> => {
  const stmt = db.prepare(`
    INSERT INTO user_shares (shareId, userId)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET shareId = excluded.shareId
  `);
  stmt.run(shareId, userId);
};

export const pingDatabase = async (): Promise<boolean> => {
  const row = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
  return row?.ok === 1;
};
