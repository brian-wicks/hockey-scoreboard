import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors sqliteAdapter.test.ts's "assert the right query shape was issued" intent,
// translated to Firestore's path-based API: collectionSpy/docSpy/orderBySpy record
// the chain of .collection()/.doc()/.orderBy() calls, while mockGet/mockSet/mockDelete
// stand in for the terminal document/query operations.
const { mockGet, mockSet, mockUpdate, mockDelete, mockOrderByGet, collectionSpy, docSpy, orderBySpy } = vi.hoisted(() => {
  return {
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockOrderByGet: vi.fn(),
    collectionSpy: vi.fn(),
    docSpy: vi.fn(),
    orderBySpy: vi.fn(),
  };
});

function makeDocRef() {
  return {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
    collection: (name: string) => {
      collectionSpy(name);
      return makeCollectionRef();
    },
  };
}

function makeCollectionRef() {
  return {
    doc: (id: string) => {
      docSpy(id);
      return makeDocRef();
    },
    orderBy: (field: string, direction: string) => {
      orderBySpy(field, direction);
      return { get: mockOrderByGet };
    },
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      collectionSpy(name);
      return makeCollectionRef();
    },
  }),
}));

// Import after mocking
import {
  getUserConfig,
  setUserConfig,
  getGameState,
  getSavedGames,
  getSavedGame,
  createSavedGame,
  updateSavedGame,
  deleteSavedGame,
  getShareUserId,
  getUserIdShare,
  setUserIdShare,
  pingDatabase,
} from "../../db/firestoreAdapter";

describe("firestore adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets user config from users/{userId}/configs/{key}", async () => {
    mockGet.mockResolvedValue({ data: () => ({ value: "test-value" }) });
    const result = await getUserConfig("user1", "key1");

    expect(collectionSpy).toHaveBeenNthCalledWith(1, "users");
    expect(docSpy).toHaveBeenNthCalledWith(1, "user1");
    expect(collectionSpy).toHaveBeenNthCalledWith(2, "configs");
    expect(docSpy).toHaveBeenNthCalledWith(2, "key1");
    expect(result).toBe("test-value");
  });

  it("returns null if user config not found", async () => {
    mockGet.mockResolvedValue({ data: () => undefined });
    const result = await getUserConfig("user1", "key1");
    expect(result).toBeNull();
  });

  it("sets user config", async () => {
    mockSet.mockResolvedValue(undefined);
    await setUserConfig("user1", "key1", "value1");
    expect(mockSet).toHaveBeenCalledWith({ value: "value1" });
  });

  it("gets game state from users/{userId}/gameState/current", async () => {
    mockGet.mockResolvedValue({ data: () => ({ state: '{"score": 1}' }) });
    const result = await getGameState("user1");

    expect(collectionSpy).toHaveBeenNthCalledWith(2, "gameState");
    expect(docSpy).toHaveBeenNthCalledWith(2, "current");
    expect(result).toBe('{"score": 1}');
  });

  it("lists saved games ordered by createdAt desc, scoped under the user", async () => {
    mockOrderByGet.mockResolvedValue({
      docs: [
        { id: "game-2", data: () => ({ name: "Second", state: "{}", createdAt: 200 }) },
        { id: "game-1", data: () => ({ name: "First", state: "{}", createdAt: 100 }) },
      ],
    });
    const result = await getSavedGames("user1");

    expect(collectionSpy).toHaveBeenNthCalledWith(2, "savedGames");
    expect(orderBySpy).toHaveBeenCalledWith("createdAt", "desc");
    expect(result).toEqual([
      { id: "game-2", userId: "user1", name: "Second", state: "{}", createdAt: 200, updatedAt: 200 },
      { id: "game-1", userId: "user1", name: "First", state: "{}", createdAt: 100, updatedAt: 100 },
    ]);
  });

  it("gets a single saved game by id", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "game-1",
      data: () => ({ name: "First", state: "{}", createdAt: 100 }),
    });
    const result = await getSavedGame("game-1", "user1");
    expect(result).toEqual({ id: "game-1", userId: "user1", name: "First", state: "{}", createdAt: 100, updatedAt: 100 });
  });

  it("returns null for a saved game that doesn't exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const result = await getSavedGame("missing", "user1");
    expect(result).toBeNull();
  });

  it("creates a saved game under a generated id", async () => {
    mockSet.mockResolvedValue(undefined);
    const id = await createSavedGame("user1", "My Game", '{"score":0}');

    expect(docSpy).toHaveBeenNthCalledWith(2, id);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Game", state: '{"score":0}', createdAt: expect.any(Number) }),
    );
  });

  it("updates a saved game's state in place, autosaving without changing its id", async () => {
    mockUpdate.mockResolvedValue(undefined);
    await updateSavedGame("game-1", "user1", '{"score":3}');
    expect(collectionSpy).toHaveBeenNthCalledWith(2, "savedGames");
    expect(docSpy).toHaveBeenNthCalledWith(2, "game-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: '{"score":3}', updatedAt: expect.any(Number) }),
    );
  });

  it("deletes a saved game", async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteSavedGame("game-1", "user1");
    expect(collectionSpy).toHaveBeenNthCalledWith(2, "savedGames");
    expect(docSpy).toHaveBeenNthCalledWith(2, "game-1");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("gets the userId for a top-level share doc", async () => {
    mockGet.mockResolvedValue({ data: () => ({ userId: "user-abc" }) });
    const result = await getShareUserId("share-123");

    expect(collectionSpy).toHaveBeenNthCalledWith(1, "shares");
    expect(docSpy).toHaveBeenNthCalledWith(1, "share-123");
    expect(result).toBe("user-abc");
  });

  it("gets a user's shareId from the user doc field, not a query", async () => {
    mockGet.mockResolvedValue({ data: () => ({ shareId: "share-xyz" }) });
    const result = await getUserIdShare("user-def");

    expect(collectionSpy).toHaveBeenNthCalledWith(1, "users");
    expect(docSpy).toHaveBeenNthCalledWith(1, "user-def");
    expect(result).toBe("share-xyz");
  });

  it("sets a share as a 2-document fan-out (shares/{shareId} + users/{userId}.shareId)", async () => {
    mockGet.mockResolvedValue({ data: () => undefined });
    mockSet.mockResolvedValue(undefined);
    await setUserIdShare("user-ghi", "share-789");

    expect(mockSet).toHaveBeenCalledWith({ userId: "user-ghi" });
    expect(mockSet).toHaveBeenCalledWith({ shareId: "share-789" }, { merge: true });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("revokes the previous share link when a user's shareId is replaced", async () => {
    mockGet.mockResolvedValue({ data: () => ({ shareId: "share-old" }) });
    mockSet.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    await setUserIdShare("user-ghi", "share-new");

    expect(docSpy).toHaveBeenCalledWith("share-old");
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ userId: "user-ghi" });
    expect(mockSet).toHaveBeenCalledWith({ shareId: "share-new" }, { merge: true });
  });

  it("does not attempt to revoke when regenerating to the same shareId", async () => {
    mockGet.mockResolvedValue({ data: () => ({ shareId: "share-same" }) });
    mockSet.mockResolvedValue(undefined);
    await setUserIdShare("user-ghi", "share-same");

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("pings healthy when the read succeeds", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const result = await pingDatabase();
    expect(collectionSpy).toHaveBeenCalledWith("_health");
    expect(docSpy).toHaveBeenCalledWith("ping");
    expect(result).toBe(true);
  });

  it("pings unhealthy when the read throws", async () => {
    mockGet.mockRejectedValue(new Error("unreachable"));
    const result = await pingDatabase();
    expect(result).toBe(false);
  });
});
