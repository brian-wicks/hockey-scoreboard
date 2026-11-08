import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors sqliteAdapter.test.ts's "assert the right query shape was issued" intent,
// translated to Firestore's path-based API: collectionSpy/docSpy/orderBySpy record
// the chain of .collection()/.doc()/.orderBy() calls, while mockGet/mockSet/mockDelete
// stand in for the terminal document/query operations.
const { mockGet, mockSet, mockUpdate, mockDelete, mockOrderByGet, collectionSpy, docSpy, orderBySpy, batchSet, batchDelete, batchCommit } = vi.hoisted(() => {
  return {
    batchSet: vi.fn(),
    batchDelete: vi.fn(),
    batchCommit: vi.fn(),
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

function makeDocRef(id?: string) {
  return {
    id,
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
      return makeDocRef(id);
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
    batch: () => ({ set: batchSet, delete: batchDelete, commit: batchCommit }),
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
  getOperatorAccess,
  getUserOperatorAccess,
  setOperatorAccess,
  deleteOperatorAccess,
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

  const operatorAccess = {
    operatorId: "op-1",
    userId: "user-1",
    pinHash: "hash",
    pinSalt: "salt",
    failedAttempts: 0,
    lockedUntil: null,
    tokens: [],
  };

  it("reads operator access from operators/{operatorId}", async () => {
    mockGet.mockResolvedValue({ data: () => operatorAccess });
    expect(await getOperatorAccess("op-1")).toEqual(operatorAccess);
    expect(collectionSpy).toHaveBeenNthCalledWith(1, "operators");
    expect(docSpy).toHaveBeenNthCalledWith(1, "op-1");
  });

  it("returns null for an unknown operator link", async () => {
    mockGet.mockResolvedValue({ data: () => undefined });
    expect(await getOperatorAccess("missing")).toBeNull();
  });

  it("finds an account's operator access through the user doc field", async () => {
    mockGet
      .mockResolvedValueOnce({ data: () => ({ operatorId: "op-1" }) })
      .mockResolvedValueOnce({ data: () => operatorAccess });
    expect(await getUserOperatorAccess("user-1")).toEqual(operatorAccess);
    expect(docSpy).toHaveBeenCalledWith("user-1");
    expect(docSpy).toHaveBeenCalledWith("op-1");
  });

  it("returns null when the user doc has no operator link", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: null }) });
    expect(await getUserOperatorAccess("user-1")).toBeNull();
  });

  const expectOnlyBatchWrites = () => {
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(batchCommit).toHaveBeenCalledTimes(1);
  };

  it("saves operator access as a record plus a user doc field, in one batch", async () => {
    mockGet.mockResolvedValue({ data: () => ({}) });
    await setOperatorAccess(operatorAccess);
    expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ id: "op-1" }), operatorAccess);
    expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }), { operatorId: "op-1" }, { merge: true });
    expect(batchDelete).not.toHaveBeenCalled();
    expectOnlyBatchWrites();
  });

  it("removes the previous record in the same batch when an account gets a different link", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-old" }) });
    await setOperatorAccess(operatorAccess);
    expect(batchDelete).toHaveBeenCalledTimes(1);
    expect(batchDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "op-old" }));
    expect(batchSet).toHaveBeenCalledTimes(2);
    expectOnlyBatchWrites();
  });

  it("keeps the record when an account saves the same link again", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-1" }) });
    await setOperatorAccess(operatorAccess);
    expect(batchDelete).not.toHaveBeenCalled();
    expectOnlyBatchWrites();
  });

  it("deletes operator access and clears the user doc field, in one batch", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-1" }) });
    await deleteOperatorAccess("user-1");
    expect(batchDelete).toHaveBeenCalledTimes(1);
    expect(batchDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "op-1" }));
    expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }), { operatorId: null }, { merge: true });
    expectOnlyBatchWrites();
  });

  it("reads the user doc before writing anything to the batch", async () => {
    mockGet.mockImplementation(async () => {
      expect(batchSet).not.toHaveBeenCalled();
      expect(batchDelete).not.toHaveBeenCalled();
      return { data: () => ({ operatorId: "op-1" }) };
    });
    await deleteOperatorAccess("user-1");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("rejects when the batch fails, so removal can't report success", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-1" }) });
    batchCommit.mockRejectedValueOnce(new Error("commit failed"));
    await expect(deleteOperatorAccess("user-1")).rejects.toThrow("commit failed");
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
