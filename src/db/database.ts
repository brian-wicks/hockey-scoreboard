import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

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

export interface DBConfig {
  userId: string;
  key: string;
  value: string;
}

export interface SavedGame {
  id: string;
  userId: string;
  name: string;
  state: string;
  createdAt: number;
}

export const getUserConfig = (userId: string, key: string): string | null => {
  const stmt = db.prepare("SELECT value FROM user_configs WHERE userId = ? AND key = ?");
  const row = stmt.get(userId, key) as { value: string } | undefined;
  return row ? row.value : null;
};

export const setUserConfig = (userId: string, key: string, value: string): void => {
  const stmt = db.prepare(`
    INSERT INTO user_configs (userId, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(userId, key, value);
};

export const getGameState = (userId: string): string | null => {
  const stmt = db.prepare("SELECT state FROM user_game_state WHERE userId = ?");
  const row = stmt.get(userId) as { state: string } | undefined;
  return row ? row.state : null;
};

export const saveGameState = (userId: string, state: string): void => {
  const stmt = db.prepare(`
    INSERT INTO user_game_state (userId, state)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET state = excluded.state
  `);
  stmt.run(userId, state);
};

export const getSavedGames = (userId: string): SavedGame[] => {
  const stmt = db.prepare("SELECT * FROM saved_games WHERE userId = ? ORDER BY createdAt DESC");
  return stmt.all(userId) as SavedGame[];
};

export const getSavedGame = (id: string, userId: string): SavedGame | null => {
  const stmt = db.prepare("SELECT * FROM saved_games WHERE id = ? AND userId = ?");
  return stmt.get(id, userId) as SavedGame | undefined ?? null;
};

export const createSavedGame = (userId: string, name: string, state: string): string => {
  const id = Math.random().toString(36).slice(2, 11);
  const stmt = db.prepare(`
    INSERT INTO saved_games (id, userId, name, state, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, userId, name, state, Date.now());
  return id;
};

export const deleteSavedGame = (id: string, userId: string): void => {
  const stmt = db.prepare("DELETE FROM saved_games WHERE id = ? AND userId = ?");
  stmt.run(id, userId);
};

export const getShareUserId = (shareId: string): string | null => {
  const stmt = db.prepare("SELECT userId FROM user_shares WHERE shareId = ?");
  const row = stmt.get(shareId) as { userId: string } | undefined;
  return row ? row.userId : null;
};

export const getUserIdShare = (userId: string): string | null => {
  const stmt = db.prepare("SELECT shareId FROM user_shares WHERE userId = ?");
  const row = stmt.get(userId) as { shareId: string } | undefined;
  return row ? row.shareId : null;
};

export const setUserIdShare = (userId: string, shareId: string): void => {
  const stmt = db.prepare(`
    INSERT INTO user_shares (shareId, userId)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET shareId = excluded.shareId
  `);
  stmt.run(shareId, userId);
};

export const pingDatabase = (): boolean => {
  const row = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
  return row?.ok === 1;
};

export default db;
