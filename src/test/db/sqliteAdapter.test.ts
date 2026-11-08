import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockAll, mockExec, mockPrepare, mockPragma } = vi.hoisted(() => {
  const mGet = vi.fn();
  const mRun = vi.fn();
  // Defaults to "updatedAt already exists" so the module-load-time migration check
  // in sqliteAdapter.ts (PRAGMA table_info(saved_games)) doesn't trigger an ALTER
  // TABLE on every test run.
  const mAll = vi.fn().mockReturnValue([{ name: "updatedAt" }]);
  return {
    mockGet: mGet,
    mockRun: mRun,
    mockAll: mAll,
    mockExec: vi.fn(),
    mockPrepare: vi.fn().mockReturnValue({
      get: mGet,
      run: mRun,
      all: mAll,
    }),
    mockPragma: vi.fn(),
  };
});

vi.mock("better-sqlite3", () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        prepare: mockPrepare,
        run: mockRun,
        exec: mockExec,
        pragma: mockPragma,
      };
    }),
  };
});

// Import after mocking
import {
  getUserConfig,
  setUserConfig,
  getGameState,
  getShareUserId,
  getUserIdShare,
  setUserIdShare,
  getOperatorAccess,
  getUserOperatorAccess,
  setOperatorAccess,
  deleteOperatorAccess,
} from "../../db/sqliteAdapter";

describe("sqlite adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets user config", async () => {
    mockGet.mockReturnValue({ value: "test-value" });
    const result = await getUserConfig("user1", "key1");

    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT value FROM user_configs"));
    expect(mockGet).toHaveBeenCalledWith("user1", "key1");
    expect(result).toBe("test-value");
  });

  it("returns null if user config not found", async () => {
    mockGet.mockReturnValue(undefined);
    const result = await getUserConfig("user1", "key1");
    expect(result).toBeNull();
  });

  it("sets user config", async () => {
    await setUserConfig("user1", "key1", "value1");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_configs"));
    expect(mockRun).toHaveBeenCalledWith("user1", "key1", "value1");
  });

  it("gets game state", async () => {
    mockGet.mockReturnValue({ state: "{\"score\": 1}" });
    const result = await getGameState("user1");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT state FROM user_game_state"));
    expect(result).toBe("{\"score\": 1}");
  });

  it("gets share user id", async () => {
    mockGet.mockReturnValue({ userId: "user-abc" });
    const result = await getShareUserId("share-123");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT userId FROM user_shares"));
    expect(result).toBe("user-abc");
  });

  it("gets user id share", async () => {
    mockGet.mockReturnValue({ shareId: "share-xyz" });
    const result = await getUserIdShare("user-def");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT shareId FROM user_shares"));
    expect(result).toBe("share-xyz");
  });

  it("sets user id share", async () => {
    await setUserIdShare("user-ghi", "share-789");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_shares"));
    expect(mockRun).toHaveBeenCalledWith("share-789", "user-ghi");
  });

  const operatorRow = {
    operatorId: "op-1",
    userId: "user-1",
    pinHash: "hash",
    pinSalt: "salt",
    failedAttempts: 2,
    lockedUntil: null,
    tokens: JSON.stringify([{ tokenHash: "t", expiresAt: 5 }]),
  };
  const operatorAccess = { ...operatorRow, tokens: [{ tokenHash: "t", expiresAt: 5 }] };

  it("reads operator access by link, parsing its tokens", async () => {
    mockGet.mockReturnValue(operatorRow);
    expect(await getOperatorAccess("op-1")).toEqual(operatorAccess);
    expect(mockPrepare).toHaveBeenCalledWith("SELECT * FROM operator_access WHERE operatorId = ?");
    expect(mockGet).toHaveBeenCalledWith("op-1");
  });

  it("reads operator access by account", async () => {
    mockGet.mockReturnValue(operatorRow);
    expect(await getUserOperatorAccess("user-1")).toEqual(operatorAccess);
    expect(mockPrepare).toHaveBeenCalledWith("SELECT * FROM operator_access WHERE userId = ?");
  });

  it("returns null when no operator access exists", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getOperatorAccess("missing")).toBeNull();
    expect(await getUserOperatorAccess("missing")).toBeNull();
  });

  it("replaces an account's operator access on save", async () => {
    await setOperatorAccess(operatorAccess);
    expect(mockPrepare.mock.calls.at(-1)?.[0]).toContain("INSERT OR REPLACE INTO operator_access");
    expect(mockRun).toHaveBeenCalledWith("op-1", "user-1", "hash", "salt", 2, null, operatorRow.tokens);
  });

  it("deletes operator access by account", async () => {
    await deleteOperatorAccess("user-1");
    expect(mockPrepare).toHaveBeenCalledWith("DELETE FROM operator_access WHERE userId = ?");
    expect(mockRun).toHaveBeenCalledWith("user-1");
  });
});
