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

export interface OperatorDeviceToken {
  tokenHash: string;
  expiresAt: number;
}

export interface OperatorAccess {
  operatorId: string;
  userId: string;
  pinHash: string;
  pinSalt: string;
  /** Shown back to the owner on the share sheet. Sign-in still checks the hash. */
  pin?: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  tokens: OperatorDeviceToken[];
}

// Both src/db/sqliteAdapter.ts and src/db/firestoreAdapter.ts export exactly these
// functions by name — src/db/database.ts picks one module at startup (via DB_BACKEND)
// and re-exports it. Keep both adapters' signatures in sync with this interface.
export interface DbAdapter {
  getUserConfig(userId: string, key: string): Promise<string | null>;
  setUserConfig(userId: string, key: string, value: string): Promise<void>;
  // Legacy singleton game-state blob, predating per-game saved_games rows.
  // Read-only: nothing writes to it anymore, but loadActiveGame in serverApp.ts
  // still reads it once per user to migrate any pre-refactor state it finds.
  getGameState(userId: string): Promise<string | null>;
  getSavedGames(userId: string): Promise<SavedGame[]>;
  getSavedGame(id: string, userId: string): Promise<SavedGame | null>;
  createSavedGame(userId: string, name: string, state: string): Promise<string>;
  updateSavedGame(id: string, userId: string, state: string): Promise<void>;
  deleteSavedGame(id: string, userId: string): Promise<void>;
  getShareUserId(shareId: string): Promise<string | null>;
  getUserIdShare(userId: string): Promise<string | null>;
  setUserIdShare(userId: string, shareId: string): Promise<void>;
  /** Gives the account this share ID unless another account has it. False means it's taken. */
  claimShareId(userId: string, shareId: string): Promise<boolean>;
  getOperatorAccess(operatorId: string): Promise<OperatorAccess | null>;
  getUserOperatorAccess(userId: string): Promise<OperatorAccess | null>;
  setOperatorAccess(access: OperatorAccess): Promise<void>;
  deleteOperatorAccess(userId: string): Promise<void>;
  pingDatabase(): Promise<boolean>;
}
