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
  updatedAt: number;
}

// Both src/db/sqliteAdapter.ts and src/db/firestoreAdapter.ts export exactly these
// functions by name — src/db/database.ts picks one module at startup (via DB_BACKEND)
// and re-exports it. Keep both adapters' signatures in sync with this interface.
export interface DbAdapter {
  getUserConfig(userId: string, key: string): Promise<string | null>;
  setUserConfig(userId: string, key: string, value: string): Promise<void>;
  getGameState(userId: string): Promise<string | null>;
  saveGameState(userId: string, state: string): Promise<void>;
  getSavedGames(userId: string): Promise<SavedGame[]>;
  getSavedGame(id: string, userId: string): Promise<SavedGame | null>;
  createSavedGame(userId: string, name: string, state: string): Promise<string>;
  updateSavedGame(id: string, userId: string, state: string): Promise<void>;
  deleteSavedGame(id: string, userId: string): Promise<void>;
  getShareUserId(shareId: string): Promise<string | null>;
  getUserIdShare(userId: string): Promise<string | null>;
  setUserIdShare(userId: string, shareId: string): Promise<void>;
  pingDatabase(): Promise<boolean>;
}
