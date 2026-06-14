import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGet, mockRun, mockExec, mockPrepare, mockPragma } = vi.hoisted(() => {
  const mGet = vi.fn();
  const mRun = vi.fn();
  return {
    mockGet: mGet,
    mockRun: mRun,
    mockExec: vi.fn(),
    mockPrepare: vi.fn().mockReturnValue({
      get: mGet,
      run: mRun,
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
  saveGameState, 
  getShareUserId, 
  getUserIdShare, 
  setUserIdShare 
} from "../../db/database";

describe("Database Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets user config", () => {
    mockGet.mockReturnValue({ value: "test-value" });
    const result = getUserConfig("user1", "key1");
    
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT value FROM user_configs"));
    expect(mockGet).toHaveBeenCalledWith("user1", "key1");
    expect(result).toBe("test-value");
  });

  it("returns null if user config not found", () => {
    mockGet.mockReturnValue(undefined);
    const result = getUserConfig("user1", "key1");
    expect(result).toBeNull();
  });

  it("sets user config", () => {
    setUserConfig("user1", "key1", "value1");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_configs"));
    expect(mockRun).toHaveBeenCalledWith("user1", "key1", "value1");
  });

  it("gets game state", () => {
    mockGet.mockReturnValue({ state: "{\"score\": 1}" });
    const result = getGameState("user1");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT state FROM user_game_state"));
    expect(result).toBe("{\"score\": 1}");
  });

  it("saves game state", () => {
    saveGameState("user1", "{\"score\": 2}");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_game_state"));
    expect(mockRun).toHaveBeenCalledWith("user1", "{\"score\": 2}");
  });

  it("gets share user id", () => {
    mockGet.mockReturnValue({ userId: "user-abc" });
    const result = getShareUserId("share-123");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT userId FROM user_shares"));
    expect(result).toBe("user-abc");
  });

  it("gets user id share", () => {
    mockGet.mockReturnValue({ shareId: "share-xyz" });
    const result = getUserIdShare("user-def");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("SELECT shareId FROM user_shares"));
    expect(result).toBe("share-xyz");
  });

  it("sets user id share", () => {
    setUserIdShare("user-ghi", "share-789");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_shares"));
    expect(mockRun).toHaveBeenCalledWith("share-789", "user-ghi");
  });
});
