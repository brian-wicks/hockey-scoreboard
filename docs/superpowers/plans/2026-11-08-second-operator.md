# Second operator access implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner give one person a working control panel (Controls and Deck tabs) for the live game, using a separate link and a six-digit PIN from the share sheet.

**Architecture:** A new `src/server/operatorAccess.ts` module holds the REST routes and handshake check, backed by a new `OperatorAccess` record in both database adapters. An authenticated operator socket joins the owner's existing Socket.IO room with an `isOperator` flag, so live sync reuses the current patch and broadcast code. On the client, `/operate/:operatorId` renders an `OperatorGate` that handles the PIN and waiting screens before showing a reduced `ControlPanel`.

**Tech Stack:** TypeScript, Express 5, Socket.IO, better-sqlite3, Firestore (firebase-admin), React, Zustand, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-08-second-operator-design.md`

## Global Constraints

- All new copy follows `tropes.md`: sentence case, plain and specific, no em dashes, no unicode arrows, no promotional tone.
- Never edit existing entries in `src/data/changelog.ts`. No version bump or changelog entry on this branch.
- Never log PINs, device tokens or operator links. Log the owner's `userId` and the socket id only.
- Six-digit PIN, five failed attempts, 15-minute lock, 24-hour token lifetime, five tokens per record.
- Keep `sqliteAdapter.ts` and `firestoreAdapter.ts` in step with `DbAdapter`.
- Commit messages use the repo's sentence-case imperative style and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the files named in the task. `.claude/` and `tropes.md` stay untracked.
- Check with `npm run lint` and `npx vitest run`. The baseline before this work is clean type checking and 421 passing tests.

## Review Focus

- `/operate/:id?tab=settings` opened by hand: the second operator must stay on Controls and must not reach Settings or Teams. Test in Task 8.
- The owner opens the operator link in a browser where they are signed in: they get the PIN flow, no owner socket and no account REST calls. Test in Task 5.
- A database fault during a reconnect: the handshake fails with a non-session error, Socket.IO does not retry server middleware errors on its own, and the second operator must not be stuck or signed out. Test in Task 5.
- A PIN pasted with spaces or typed with letters: the input keeps digits only, up to six. Test in Task 7.
- "Create new PIN" racing a wrong guess in flight: the guess must not write the old PIN back over the new record. Test in Task 3.

---

### Task 1: Credential helpers

**Files:**
- Create: `src/lib/operatorAccess.ts`
- Create: `src/server/operatorCredentials.ts`
- Modify: `src/db/types.ts`
- Test: `src/test/operatorCredentials.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/lib/operatorAccess.ts` (safe for the client): `OPERATOR_PIN_LENGTH: 6`, `OPERATOR_SESSION_ENDED_ERROR: string`, `isValidOperatorPin(pin: unknown): pin is string`.
  - `src/db/types.ts`: `OperatorDeviceToken`, `OperatorAccess`.
  - `src/server/operatorCredentials.ts` (server only): `MAX_FAILED_PIN_ATTEMPTS`, `PIN_LOCK_MS`, `DEVICE_TOKEN_TTL_MS`, `MAX_DEVICE_TOKENS`, `isValidOperatorId(id: unknown): id is string`, `generatePin(): string`, `hashPin(pin): Promise<{ pinHash: string; pinSalt: string }>`, `verifyPin(pin, { pinHash, pinSalt }): Promise<boolean>`, `issueDeviceToken(tokens, nowMs): { token: string; tokens: OperatorDeviceToken[] }`, `hasValidDeviceToken(tokens, token, nowMs): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/test/operatorCredentials.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isValidOperatorPin } from "../lib/operatorAccess";
import {
  DEVICE_TOKEN_TTL_MS,
  MAX_DEVICE_TOKENS,
  generatePin,
  hasValidDeviceToken,
  hashPin,
  isValidOperatorId,
  issueDeviceToken,
  verifyPin,
} from "../server/operatorCredentials";

describe("operator credentials", () => {
  it("accepts only six-digit PINs", () => {
    expect(isValidOperatorPin("012345")).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", " 12345", 123456, null, undefined]) {
      expect(isValidOperatorPin(bad)).toBe(false);
    }
  });

  it("generates six-digit PINs, keeping leading zeros", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it("accepts only UUIDs as operator IDs", () => {
    expect(isValidOperatorId("3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b")).toBe(true);
    for (const bad of ["x/y", "", "not-a-uuid", 7, null]) {
      expect(isValidOperatorId(bad)).toBe(false);
    }
  });

  it("verifies the right PIN and rejects a wrong one", async () => {
    const credentials = await hashPin("123456");
    expect(credentials.pinHash).not.toContain("123456");
    expect(await verifyPin("123456", credentials)).toBe(true);
    expect(await verifyPin("654321", credentials)).toBe(false);
  });

  it("salts each PIN hash separately", async () => {
    const first = await hashPin("123456");
    const second = await hashPin("123456");
    expect(first.pinHash).not.toBe(second.pinHash);
  });

  it("stores only a hash of each device token, with an expiry", () => {
    const { token, tokens } = issueDeviceToken([], 1000);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(token);
    expect(tokens[0].expiresAt).toBe(1000 + DEVICE_TOKEN_TTL_MS);
    expect(hasValidDeviceToken(tokens, token, 1000)).toBe(true);
    expect(hasValidDeviceToken(tokens, "other", 1000)).toBe(false);
    expect(hasValidDeviceToken(tokens, token, 1000 + DEVICE_TOKEN_TTL_MS + 1)).toBe(false);
  });

  it("drops the oldest token past the cap, and expired tokens on issue", () => {
    let tokens = issueDeviceToken([], 0).tokens;
    const first = issueDeviceToken(tokens, 1);
    tokens = first.tokens;
    for (let i = 0; i < MAX_DEVICE_TOKENS; i += 1) {
      tokens = issueDeviceToken(tokens, 2 + i).tokens;
    }
    expect(tokens).toHaveLength(MAX_DEVICE_TOKENS);
    expect(hasValidDeviceToken(tokens, first.token, 10)).toBe(false);

    const afterExpiry = issueDeviceToken(tokens, DEVICE_TOKEN_TTL_MS + 100);
    expect(afterExpiry.tokens).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/operatorCredentials.test.ts`
Expected: FAIL because `../lib/operatorAccess` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/operatorAccess.ts`:

```ts
/** Values both the client and server need. Hashing stays in src/server/operatorCredentials.ts. */
export const OPERATOR_PIN_LENGTH = 6;

/** Handshake failure text. The client uses it to tell a rejected token from a network failure. */
export const OPERATOR_SESSION_ENDED_ERROR = "Authentication error: Operator session ended";

export const isValidOperatorPin = (pin: unknown): pin is string =>
  typeof pin === "string" && /^\d{6}$/.test(pin);
```

Add to the top of `src/db/types.ts`, after `SavedGame`:

```ts
export interface OperatorDeviceToken {
  tokenHash: string;
  expiresAt: number;
}

export interface OperatorAccess {
  operatorId: string;
  userId: string;
  pinHash: string;
  pinSalt: string;
  failedAttempts: number;
  lockedUntil: number | null;
  tokens: OperatorDeviceToken[];
}
```

Create `src/server/operatorCredentials.ts`:

```ts
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { OperatorDeviceToken } from "../db/types.ts";

export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;
export const DEVICE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DEVICE_TOKENS = 5;

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const PIN_HASH_BYTES = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checked before any database read: a route param can decode to a value with a slash,
// which Firestore would treat as a path into a different document.
export const isValidOperatorId = (id: unknown): id is string =>
  typeof id === "string" && UUID_PATTERN.test(id);

export const generatePin = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(pin, pinSalt, PIN_HASH_BYTES);
  return { pinHash: hash.toString("hex"), pinSalt };
}

export async function verifyPin(pin: string, credentials: { pinHash: string; pinSalt: string }): Promise<boolean> {
  const expected = Buffer.from(credentials.pinHash, "hex");
  const actual = await scryptAsync(pin, credentials.pinSalt, PIN_HASH_BYTES);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export function issueDeviceToken(
  tokens: OperatorDeviceToken[],
  nowMs: number,
): { token: string; tokens: OperatorDeviceToken[] } {
  const token = randomBytes(32).toString("base64url");
  const live = tokens.filter((entry) => entry.expiresAt > nowMs);
  const next = [...live, { tokenHash: hashToken(token), expiresAt: nowMs + DEVICE_TOKEN_TTL_MS }];
  return { token, tokens: next.slice(-MAX_DEVICE_TOKENS) };
}

export function hasValidDeviceToken(tokens: OperatorDeviceToken[], token: string, nowMs: number): boolean {
  const hash = Buffer.from(hashToken(token), "hex");
  return tokens.some((entry) => {
    const stored = Buffer.from(entry.tokenHash, "hex");
    return entry.expiresAt > nowMs && stored.length === hash.length && timingSafeEqual(stored, hash);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/operatorCredentials.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operatorAccess.ts src/server/operatorCredentials.ts src/db/types.ts src/test/operatorCredentials.test.ts docs/superpowers/plans/2026-11-08-second-operator.md docs/superpowers/specs/2026-11-08-second-operator-design.md
git commit -m "Add PIN and device token helpers for second operator access" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Database adapters

**Files:**
- Modify: `src/db/types.ts` (the `DbAdapter` interface)
- Modify: `src/db/sqliteAdapter.ts`
- Modify: `src/db/firestoreAdapter.ts`
- Modify: `src/db/database.ts`
- Test: `src/test/db/sqliteAdapter.test.ts`
- Test: `src/test/db/firestoreAdapter.test.ts`

**Interfaces:**
- Consumes: `OperatorAccess` from Task 1.
- Produces, exported from `src/db/database.ts`: `getOperatorAccess(operatorId): Promise<OperatorAccess | null>`, `getUserOperatorAccess(userId): Promise<OperatorAccess | null>`, `setOperatorAccess(access): Promise<void>`, `deleteOperatorAccess(userId): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Add the four functions to the import list in `src/test/db/sqliteAdapter.test.ts`, then add inside `describe("sqlite adapter", ...)`:

```ts
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
```

Add the four functions to the import list in `src/test/db/firestoreAdapter.test.ts`, then add inside `describe("firestore adapter", ...)`:

```ts
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

  it("saves operator access as a record plus a user doc field", async () => {
    mockGet.mockResolvedValue({ data: () => ({}) });
    await setOperatorAccess(operatorAccess);
    expect(mockSet).toHaveBeenCalledWith(operatorAccess);
    expect(mockSet).toHaveBeenCalledWith({ operatorId: "op-1" }, { merge: true });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("removes the previous record when an account gets a different link", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-old" }) });
    await setOperatorAccess(operatorAccess);
    expect(docSpy).toHaveBeenCalledWith("op-old");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes operator access and clears the user doc field", async () => {
    mockGet.mockResolvedValue({ data: () => ({ operatorId: "op-1" }) });
    await deleteOperatorAccess("user-1");
    expect(docSpy).toHaveBeenCalledWith("op-1");
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ operatorId: null }, { merge: true });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/db`
Expected: FAIL because the new functions are not exported.

- [ ] **Step 3: Write the implementation**

In `src/db/types.ts`, add to `DbAdapter` after `setUserIdShare`:

```ts
  getOperatorAccess(operatorId: string): Promise<OperatorAccess | null>;
  getUserOperatorAccess(userId: string): Promise<OperatorAccess | null>;
  setOperatorAccess(access: OperatorAccess): Promise<void>;
  deleteOperatorAccess(userId: string): Promise<void>;
```

In `src/db/sqliteAdapter.ts`, change the type import to `import type { OperatorAccess, SavedGame } from "./types.ts";`, add this table inside the `db.exec` block after `user_shares`:

```sql
  CREATE TABLE IF NOT EXISTS operator_access (
    operatorId TEXT PRIMARY KEY,
    userId TEXT UNIQUE,
    pinHash TEXT,
    pinSalt TEXT,
    failedAttempts INTEGER,
    lockedUntil INTEGER,
    tokens TEXT
  );
```

and add after `setUserIdShare`:

```ts
type OperatorAccessRow = Omit<OperatorAccess, "tokens"> & { tokens: string };

const rowToOperatorAccess = (row: OperatorAccessRow | undefined): OperatorAccess | null =>
  row ? { ...row, tokens: JSON.parse(row.tokens) } : null;

export const getOperatorAccess = async (operatorId: string): Promise<OperatorAccess | null> => {
  const stmt = db.prepare("SELECT * FROM operator_access WHERE operatorId = ?");
  return rowToOperatorAccess(stmt.get(operatorId) as OperatorAccessRow | undefined);
};

export const getUserOperatorAccess = async (userId: string): Promise<OperatorAccess | null> => {
  const stmt = db.prepare("SELECT * FROM operator_access WHERE userId = ?");
  return rowToOperatorAccess(stmt.get(userId) as OperatorAccessRow | undefined);
};

export const setOperatorAccess = async (access: OperatorAccess): Promise<void> => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO operator_access (operatorId, userId, pinHash, pinSalt, failedAttempts, lockedUntil, tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    access.operatorId,
    access.userId,
    access.pinHash,
    access.pinSalt,
    access.failedAttempts,
    access.lockedUntil,
    JSON.stringify(access.tokens),
  );
};

export const deleteOperatorAccess = async (userId: string): Promise<void> => {
  const stmt = db.prepare("DELETE FROM operator_access WHERE userId = ?");
  stmt.run(userId);
};
```

In `src/db/firestoreAdapter.ts`, change the type import to `import type { OperatorAccess, SavedGame } from "./types.ts";`, add these two lines to the layout comment after the `users/{userId}.shareId` line:

```ts
//   operators/{operatorId}           OperatorAccess
//   users/{userId}.operatorId        (field on the user doc, avoids a where() query)
```

add below `sharesCollection`:

```ts
const operatorsCollection = () => firestore().collection("operators");
```

and add after `setUserIdShare`:

```ts
export const getOperatorAccess = async (operatorId: string): Promise<OperatorAccess | null> => {
  const snap = await operatorsCollection().doc(operatorId).get();
  const data = snap.data();
  return data ? (data as OperatorAccess) : null;
};

export const getUserOperatorAccess = async (userId: string): Promise<OperatorAccess | null> => {
  const snap = await usersCollection().doc(userId).get();
  const operatorId = snap.data()?.operatorId;
  return typeof operatorId === "string" ? getOperatorAccess(operatorId) : null;
};

export const setOperatorAccess = async (access: OperatorAccess): Promise<void> => {
  const userRef = usersCollection().doc(access.userId);
  const snap = await userRef.get();
  const oldOperatorId = snap.data()?.operatorId;

  const removeOld =
    typeof oldOperatorId === "string" && oldOperatorId !== access.operatorId
      ? operatorsCollection().doc(oldOperatorId).delete()
      : Promise.resolve();

  await Promise.all([
    removeOld,
    operatorsCollection().doc(access.operatorId).set(access),
    userRef.set({ operatorId: access.operatorId }, { merge: true }),
  ]);
};

export const deleteOperatorAccess = async (userId: string): Promise<void> => {
  const userRef = usersCollection().doc(userId);
  const snap = await userRef.get();
  const operatorId = snap.data()?.operatorId;

  await Promise.all([
    typeof operatorId === "string" ? operatorsCollection().doc(operatorId).delete() : Promise.resolve(),
    userRef.set({ operatorId: null }, { merge: true }),
  ]);
};
```

In `src/db/database.ts`, add `OperatorAccess` and `OperatorDeviceToken` to the `export type` line, and add after `setUserIdShare`:

```ts
export const getOperatorAccess = adapter.getOperatorAccess;
export const getUserOperatorAccess = adapter.getUserOperatorAccess;
export const setOperatorAccess = adapter.setOperatorAccess;
export const deleteOperatorAccess = adapter.deleteOperatorAccess;
```

- [ ] **Step 4: Run tests and the type check**

Run: `npx vitest run src/test/db && npm run lint`
Expected: PASS, and `tsc` reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/types.ts src/db/sqliteAdapter.ts src/db/firestoreAdapter.ts src/db/database.ts src/test/db/sqliteAdapter.test.ts src/test/db/firestoreAdapter.test.ts
git commit -m "Store second operator access in both database adapters" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: REST routes

**Files:**
- Create: `src/server/operatorAccess.ts`
- Modify: `serverApp.ts` (import, and a call after `authenticateExpress`)
- Test: `src/test/operatorAccess.test.ts`
- Test: `src/test/operatorAccessFailures.test.ts`
- Test: `src/test/localModeServer.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 database functions.
- Produces: `registerOperatorAccess(options: OperatorAccessOptions): { authenticateHandshake(operatorId: unknown, token: unknown): Promise<string | null> }`. It resolves to the owner's `userId` or `null`. `serverApp.ts` holds the result in `const operatorAccess`.
- Routes: as listed in the spec's API section.

- [ ] **Step 1: Write the failing integration test**

Create `src/test/operatorAccess.test.ts`. Each test gets its own server, so the in-memory rate limiters start at zero. The SQLite file is shared, so each test uses a new user ID.

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { io as createClient, type Socket } from "socket.io-client";
import { createScoreboardServer } from "../../serverApp";

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
      if (token.startsWith("operator-user-")) return { uid: token };
      throw new Error("invalid token");
    }),
  })),
}));

const newUser = () => `operator-user-${randomUUID()}`;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

describe("second operator access", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  let currentTime: number;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    currentTime = Date.now();
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-operator-"));
    server = createScoreboardServer({ dataDir, now: () => currentTime });
    const port = await server.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const owner = (userId: string, method: string) =>
    fetch(`${baseUrl}/api/operator-access`, { method, headers: { Authorization: `Bearer ${userId}` } });

  const createAccess = async (userId = newUser()) => {
    const res = await owner(userId, "POST");
    const { operatorId, pin } = await res.json();
    return { userId, operatorId: operatorId as string, pin: pin as string };
  };

  const postPin = (operatorId: string, pin: unknown) =>
    fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

  const wrongPinFor = (pin: string) => (pin === "000000" ? "000001" : "000000");

  describe("owner routes", () => {
    it("requires the owner's sign-in", async () => {
      expect((await fetch(`${baseUrl}/api/operator-access`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/operator-access`, { method: "POST" })).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/operator-access`, { method: "DELETE" })).status).toBe(401);
    });

    it("reports no access, then the link, and never the PIN", async () => {
      const userId = newUser();
      expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId: null });

      const { operatorId, pin } = await createAccess(userId);
      expect(pin).toMatch(/^\d{6}$/);

      const body = await (await owner(userId, "GET")).json();
      expect(body).toEqual({ operatorId });
    });

    it("keeps the link and replaces the PIN on a new PIN", async () => {
      const userId = newUser();
      const first = await createAccess(userId);
      const second = await createAccess(userId);
      expect(second.operatorId).toBe(first.operatorId);
      expect((await postPin(second.operatorId, second.pin)).status).toBe(200);
      if (first.pin !== second.pin) {
        expect((await postPin(second.operatorId, first.pin)).status).toBe(401);
      }
    });

    it("stops the link working after removal", async () => {
      const { userId, operatorId, pin } = await createAccess();
      expect((await owner(userId, "DELETE")).status).toBe(200);
      expect((await postPin(operatorId, pin)).status).toBe(404);
      expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId: null });
    });

    it("keeps each account's access separate", async () => {
      const first = await createAccess();
      const second = await createAccess();
      expect(second.operatorId).not.toBe(first.operatorId);
      await owner(second.userId, "DELETE");
      expect((await postPin(first.operatorId, first.pin)).status).toBe(200);
    });
  });

  describe("PIN check", () => {
    it("returns a token for the right PIN", async () => {
      const { operatorId, pin } = await createAccess();
      const res = await postPin(operatorId, pin);
      expect(res.status).toBe(200);
      expect(typeof (await res.json()).token).toBe("string");
    });

    it("rejects a malformed PIN without counting an attempt", async () => {
      const { operatorId, pin } = await createAccess();
      expect((await postPin(operatorId, "12")).status).toBe(400);
      expect((await postPin(operatorId, 123456)).status).toBe(400);
      const wrong = await postPin(operatorId, wrongPinFor(pin));
      expect((await wrong.json()).attemptsLeft).toBe(4);
    });

    it("returns 404 for an unknown or badly formed link", async () => {
      expect((await postPin(randomUUID(), "123456")).status).toBe(404);
      expect((await postPin("not-a-uuid", "123456")).status).toBe(404);
    });

    it("locks after five wrong PINs, refuses the right PIN while locked, then recovers", async () => {
      const { operatorId, pin } = await createAccess();
      const wrong = wrongPinFor(pin);

      for (const attemptsLeft of [4, 3, 2, 1]) {
        const res = await postPin(operatorId, wrong);
        expect(res.status).toBe(401);
        expect((await res.json()).attemptsLeft).toBe(attemptsLeft);
      }

      const locked = await postPin(operatorId, wrong);
      expect(locked.status).toBe(429);
      expect((await locked.json()).retryAfterSeconds).toBe(900);
      expect((await postPin(operatorId, pin)).status).toBe(429);

      currentTime += FIFTEEN_MINUTES + 1;
      const afterLock = await postPin(operatorId, wrong);
      expect(afterLock.status).toBe(401);
      expect((await afterLock.json()).attemptsLeft).toBe(4);
      expect((await postPin(operatorId, pin)).status).toBe(200);
    });

    it("resets the count after a correct PIN", async () => {
      const { operatorId, pin } = await createAccess();
      await postPin(operatorId, wrongPinFor(pin));
      await postPin(operatorId, pin);
      const res = await postPin(operatorId, wrongPinFor(pin));
      expect((await res.json()).attemptsLeft).toBe(4);
    });

    it("clears a lock when the owner creates a new PIN", async () => {
      const { userId, operatorId, pin } = await createAccess();
      for (let i = 0; i < 5; i += 1) await postPin(operatorId, wrongPinFor(pin));
      const next = await createAccess(userId);
      expect((await postPin(operatorId, next.pin)).status).toBe(200);
    });

    it("does not let parallel guesses get past the limit", async () => {
      const { operatorId, pin } = await createAccess();
      const results = await Promise.all(
        Array.from({ length: 12 }, () => postPin(operatorId, wrongPinFor(pin))),
      );
      const statuses = results.map((res) => res.status);
      expect(statuses.filter((status) => status === 401)).toHaveLength(4);
      expect(statuses.filter((status) => status === 429)).toHaveLength(8);
    });

    it("does not let a guess in flight write the old PIN back over a new one", async () => {
      const { userId, operatorId, pin } = await createAccess();
      const [, created] = await Promise.all([postPin(operatorId, wrongPinFor(pin)), owner(userId, "POST")]);
      const { pin: newPin } = await created.json();
      if (newPin !== pin) {
        const oldPinResult = await postPin(operatorId, pin);
        expect(oldPinResult.status).toBe(401);
      }
      expect((await postPin(operatorId, newPin)).status).toBe(200);
    });

    it("limits requests per IP", async () => {
      const { operatorId } = await createAccess();
      for (let i = 0; i < 30; i += 1) {
        expect((await postPin(operatorId, "bad")).status).toBe(400);
      }
      const limited = await postPin(operatorId, "bad");
      expect(limited.status).toBe(429);
      expect((await limited.json()).retryAfterSeconds).toBe(900);
    });
  });
});
```

The unused imports (`writeFile`, `Socket`, `createClient`, `ONE_DAY`) are used by Task 4's tests, which go in this same file.

- [ ] **Step 2: Add the failing fault test**

Create `src/test/operatorAccessFailures.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";

const db = vi.hoisted(() => ({
  getOperatorAccess: vi.fn(),
  getUserOperatorAccess: vi.fn(),
  setOperatorAccess: vi.fn(),
  deleteOperatorAccess: vi.fn(),
}));
vi.mock("../db/database.ts", () => db);

import { registerOperatorAccess } from "../server/operatorAccess";
import { hashPin } from "../server/operatorCredentials";

describe("second operator access when the database fails", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  const logError = vi.fn();
  const operatorId = randomUUID();

  const postPin = (pin: string) =>
    fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    const app = express();
    app.use(express.json());
    registerOperatorAccess({
      app,
      io: { in: () => ({ fetchSockets: async () => [] }) } as any,
      authenticate: (_req, _res, next) => next(),
      creationLimiter: (_req, _res, next) => next(),
      localMode: false,
      now: Date.now,
      logError,
    });
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
  });

  const storedAccess = async () => ({
    operatorId,
    userId: "user-1",
    ...(await hashPin("123456")),
    failedAttempts: 0,
    lockedUntil: null,
    tokens: [],
  });

  it("refuses the PIN when a failed attempt can't be saved", async () => {
    db.getOperatorAccess.mockResolvedValue(await storedAccess());
    db.setOperatorAccess.mockRejectedValue(new Error("write failed"));
    expect((await postPin("654321")).status).toBe(500);
    expect(logError).toHaveBeenCalled();
  });

  it("returns 500 and writes nothing when the record can't be read", async () => {
    db.getOperatorAccess.mockRejectedValue(new Error("read failed"));
    expect((await postPin("654321")).status).toBe(500);
    expect(db.setOperatorAccess).not.toHaveBeenCalled();
  });

  it("issues no token when it can't be saved", async () => {
    db.getOperatorAccess.mockResolvedValue(await storedAccess());
    db.setOperatorAccess.mockRejectedValue(new Error("write failed"));
    const res = await postPin("123456");
    expect(res.status).toBe(500);
    expect((await res.json()).token).toBeUndefined();
  });

  it("does not log the PIN, or the link in its context", async () => {
    db.getOperatorAccess.mockRejectedValue(new Error("read failed"));
    await postPin("654321");
    expect(JSON.stringify(logError.mock.calls)).not.toContain("654321");
    expect(JSON.stringify(logError.mock.calls)).not.toContain(operatorId);
  });
});
```

- [ ] **Step 3: Add the failing local mode tests**

Add inside `describe("local mode server auth", ...)` in `src/test/localModeServer.test.ts`:

```ts
  it("returns 404 from every second operator route in local mode", async () => {
    running = await startServer(true);
    const base = `http://127.0.0.1:${running.port}`;
    expect((await fetch(`${base}/api/operator-access`)).status).toBe(404);
    expect((await fetch(`${base}/api/operator-access`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${base}/api/operator-access`, { method: "DELETE" })).status).toBe(404);
    const session = await fetch(`${base}/api/operator/3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "123456" }),
    });
    expect(session.status).toBe(404);
  });
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/test/operatorAccess.test.ts src/test/operatorAccessFailures.test.ts src/test/localModeServer.test.ts`
Expected: FAIL. `operatorAccessFailures` cannot resolve `../server/operatorAccess`, and the others get 200 HTML from the catch-all or a default 404.

- [ ] **Step 5: Write the module**

Create `src/server/operatorAccess.ts`:

```ts
import type { Express, RequestHandler } from "express";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import type { Server } from "socket.io";
import {
  deleteOperatorAccess,
  getOperatorAccess,
  getUserOperatorAccess,
  setOperatorAccess,
} from "../db/database.ts";
import { isValidOperatorPin } from "../lib/operatorAccess.ts";
import {
  MAX_FAILED_PIN_ATTEMPTS,
  PIN_LOCK_MS,
  generatePin,
  hasValidDeviceToken,
  hashPin,
  isValidOperatorId,
  issueDeviceToken,
  verifyPin,
} from "./operatorCredentials.ts";

const SESSION_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_LIMIT = 30;

export interface OperatorAccessOptions {
  app: Express;
  io: Server;
  authenticate: RequestHandler;
  creationLimiter: RequestHandler;
  localMode: boolean;
  now: () => number;
  logError: (msg: string, error: unknown, context?: Record<string, unknown>) => void;
}

export function registerOperatorAccess({
  app,
  io,
  authenticate,
  creationLimiter,
  localMode,
  now,
  logError,
}: OperatorAccessOptions): { authenticateHandshake(operatorId: unknown, token: unknown): Promise<string | null> } {
  // Local mode has one operator and no way to tell two people apart, and its server
  // only listens on loopback. The explicit 404 stops GETs reaching the SPA catch-all.
  if (localMode) {
    app.use(["/api/operator-access", "/api/operator"], (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
    return { authenticateHandshake: async () => null };
  }

  // Every read-then-write of a record runs through this queue. Parallel PIN guesses
  // can't all see the same attempt count, and a guess in flight can't save its stale
  // copy over a new PIN or bring back a removed record.
  const queues = new Map<string, Promise<unknown>>();
  function runExclusive<T>(operatorId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(operatorId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.catch(() => undefined);
    queues.set(operatorId, settled);
    void settled.then(() => {
      if (queues.get(operatorId) === settled) queues.delete(operatorId);
    });
    return run;
  }

  async function disconnectOperators(userId: string) {
    const sockets = await io.in(userId).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.isOperator) socket.disconnect(true);
    }
  }

  const sessionLimiter = rateLimit({
    windowMs: SESSION_LIMIT_WINDOW_MS,
    limit: SESSION_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later.", retryAfterSeconds: SESSION_LIMIT_WINDOW_MS / 1000 },
  });

  app.get("/api/operator-access", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const access = await getUserOperatorAccess(userId);
      res.json({ operatorId: access?.operatorId ?? null });
    } catch (error) {
      logError("Error reading operator access", error, { userId });
      res.status(500).json({ error: "Failed to read operator access" });
    }
  });

  app.post("/api/operator-access", creationLimiter, authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const existing = await getUserOperatorAccess(userId);
      const operatorId = existing?.operatorId ?? randomUUID();
      const pin = generatePin();
      const credentials = await hashPin(pin);
      await runExclusive(operatorId, () =>
        setOperatorAccess({ operatorId, userId, ...credentials, failedAttempts: 0, lockedUntil: null, tokens: [] }),
      );
      await disconnectOperators(userId);
      res.json({ operatorId, pin });
    } catch (error) {
      logError("Error saving operator access", error, { userId });
      res.status(500).json({ error: "Failed to save operator access" });
    }
  });

  app.delete("/api/operator-access", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const existing = await getUserOperatorAccess(userId);
      if (existing) {
        await runExclusive(existing.operatorId, () => deleteOperatorAccess(userId));
      }
      await disconnectOperators(userId);
      res.json({ success: true });
    } catch (error) {
      logError("Error removing operator access", error, { userId });
      res.status(500).json({ error: "Failed to remove operator access" });
    }
  });

  app.post("/api/operator/:operatorId/session", sessionLimiter, async (req, res) => {
    const { operatorId } = req.params;
    if (!isValidOperatorId(operatorId)) {
      res.status(404).json({ error: "Unknown link" });
      return;
    }
    const pin: unknown = req.body?.pin;
    if (!isValidOperatorPin(pin)) {
      res.status(400).json({ error: "PIN must be six digits" });
      return;
    }

    try {
      await runExclusive(operatorId, async () => {
        const access = await getOperatorAccess(operatorId);
        if (!access) {
          res.status(404).json({ error: "Unknown link" });
          return;
        }

        const nowMs = now();
        if (access.lockedUntil !== null && access.lockedUntil > nowMs) {
          res.status(429).json({
            error: "Too many wrong PINs",
            retryAfterSeconds: Math.ceil((access.lockedUntil - nowMs) / 1000),
          });
          return;
        }

        if (await verifyPin(pin, access)) {
          const { token, tokens } = issueDeviceToken(access.tokens, nowMs);
          await setOperatorAccess({ ...access, failedAttempts: 0, lockedUntil: null, tokens });
          res.json({ token });
          return;
        }

        // A lock that has run out starts a new count.
        const failedAttempts = (access.lockedUntil === null ? access.failedAttempts : 0) + 1;
        if (failedAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
          await setOperatorAccess({ ...access, failedAttempts, lockedUntil: nowMs + PIN_LOCK_MS });
          res.status(429).json({ error: "Too many wrong PINs", retryAfterSeconds: PIN_LOCK_MS / 1000 });
          return;
        }
        await setOperatorAccess({ ...access, failedAttempts, lockedUntil: null });
        res.status(401).json({ error: "Wrong PIN", attemptsLeft: MAX_FAILED_PIN_ATTEMPTS - failedAttempts });
      });
    } catch (error) {
      logError("Error checking operator PIN", error);
      res.status(500).json({ error: "Failed to check PIN" });
    }
  });

  return {
    async authenticateHandshake(operatorId: unknown, token: unknown): Promise<string | null> {
      if (!isValidOperatorId(operatorId) || typeof token !== "string") return null;
      const access = await getOperatorAccess(operatorId);
      return access && hasValidDeviceToken(access.tokens, token, now()) ? access.userId : null;
    },
  };
}
```

- [ ] **Step 6: Wire it into the server**

In `serverApp.ts`, add below the `./src/utils/gamePatch.ts` import:

```ts
import { registerOperatorAccess } from "./src/server/operatorAccess.ts";
```

Add directly after the closing `};` of `authenticateExpress`:

```ts
  const operatorAccess = registerOperatorAccess({
    app,
    io,
    authenticate: authenticateExpress,
    creationLimiter: shareCreationLimiter,
    localMode,
    now,
    logError,
  });
```

- [ ] **Step 7: Run tests and the type check**

Run: `npx vitest run src/test/operatorAccess.test.ts src/test/operatorAccessFailures.test.ts src/test/localModeServer.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/operatorAccess.ts serverApp.ts src/test/operatorAccess.test.ts src/test/operatorAccessFailures.test.ts src/test/localModeServer.test.ts
git commit -m "Add routes to create, remove and sign in with second operator access" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Socket access and permissions

**Files:**
- Modify: `serverApp.ts` (`io.use`, `io.on("connection")`, `/api/shortcuts`, `/api/streamdeck`)
- Test: `src/test/operatorAccess.test.ts`
- Test: `src/test/localModeServer.test.ts`

**Interfaces:**
- Consumes: `operatorAccess.authenticateHandshake` from Task 3, `OPERATOR_SESSION_ENDED_ERROR` from Task 1.
- Produces, for the client:
  - Handshake auth `{ operatorId, operatorToken }`. A rejected token fails with `OPERATOR_SESSION_ENDED_ERROR`.
  - Socket event `operatorConfig` with `{ streamDeck: unknown | null; shortcuts: unknown | null }`.

- [ ] **Step 1: Write the failing tests**

Add inside `describe("second operator access", ...)` in `src/test/operatorAccess.test.ts`:

```ts
  describe("operator socket", () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const signIn = async (operatorId: string, pin: string) => {
      const res = await postPin(operatorId, pin);
      return (await res.json()).token as string;
    };

    const connectWith = (auth: Record<string, unknown>) =>
      new Promise<Socket>((resolve, reject) => {
        const socket = createClient(baseUrl, { auth, transports: ["websocket"], reconnection: false });
        openSockets.push(socket);
        socket.once("connect", () => resolve(socket));
        socket.once("connect_error", (error) => reject(error));
      });

    const connectOperator = async (operatorId: string, token: string) => connectWith({ operatorId, operatorToken: token });

    const handshakeError = (auth: Record<string, unknown>) =>
      connectWith(auth).then(
        () => null,
        (error: Error) => error.message,
      );

    const readState = async (userId: string) => {
      const res = await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } });
      const { shareId } = await res.json();
      const read = async () => (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
      return { read, shareId: shareId as string };
    };

    const setup = async () => {
      const { userId, operatorId, pin } = await createAccess();
      const ownerSocket = await connectWith({ token: userId });
      const token = await signIn(operatorId, pin);
      const operator = await connectOperator(operatorId, token);
      const { read, shareId } = await readState(userId);
      return { userId, operatorId, pin, token, ownerSocket, operator, read, shareId };
    };

    const ENDED = "Authentication error: Operator session ended";

    it("rejects missing, wrong and expired tokens", async () => {
      const { operatorId, pin } = await createAccess();
      const token = await signIn(operatorId, pin);
      expect(await handshakeError({ operatorId, operatorToken: "wrong" })).toBe(ENDED);
      expect(await handshakeError({ operatorId })).toBe(ENDED);
      expect(await handshakeError({ operatorId: randomUUID(), operatorToken: token })).toBe(ENDED);

      currentTime += ONE_DAY + 1;
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    it("keeps five device tokens and drops the oldest", async () => {
      const { operatorId, pin } = await createAccess();
      const tokens: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        tokens.push(await signIn(operatorId, pin));
        currentTime += 1;
      }
      expect(await handshakeError({ operatorId, operatorToken: tokens[0] })).toBe(ENDED);
      expect(await handshakeError({ operatorId, operatorToken: tokens[5] })).toBeNull();
    });

    it("doesn't accept a viewer share ID as an operator credential", async () => {
      const { userId } = await createAccess();
      const { shareId } = await readState(userId);
      expect(await handshakeError({ operatorId: shareId, operatorToken: shareId })).toBe(ENDED);
    });

    it("lets the second operator change the owner's live game, and the owner sees it", async () => {
      const { operator, ownerSocket, read } = await setup();
      const seen = new Promise<any>((resolve) => {
        ownerSocket.on("gameState", (state) => {
          if (state.homeTeam.score === 1) resolve(state);
        });
      });

      const ack = await new Promise((resolve) =>
        operator.emit("applyGamePatch", { opId: "op-1", home: { scoreDelta: 1 } }, resolve),
      );

      expect(ack).toEqual({ ok: true });
      await seen;
      expect((await read()).homeTeam.score).toBe(1);
    });

    it("sends the owner's changes to the second operator", async () => {
      const { operator, ownerSocket } = await setup();
      const seen = new Promise<void>((resolve) => {
        operator.on("gameState", (state) => {
          if (state.awayTeam.score === 2) resolve();
        });
      });
      ownerSocket.emit("applyGamePatch", { opId: "own-1", away: { scoreDelta: 2 } }, () => {});
      await seen;
    });

    it("lets the second operator use the clock", async () => {
      const { operator, read } = await setup();
      operator.emit("startClock");
      await sleep(50);
      expect((await read()).clock.isRunning).toBe(true);
      operator.emit("stopClock");
      await sleep(50);
      expect((await read()).clock.isRunning).toBe(false);
      operator.emit("setClock", 90_000);
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(90_000);
      operator.emit("clockIncrease");
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(91_000);
      operator.emit("clockDecrease");
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(90_000);
    });

    it("refuses a full state replacement", async () => {
      const { operator, read } = await setup();
      const before = (await read()).period;
      const replacement = before === "2nd" ? "3rd" : "2nd";
      operator.emit("updateGameState", { period: replacement });
      await sleep(50);
      expect((await read()).period).toBe(before);
    });

    it("refuses starting a new game", async () => {
      const { operator, ownerSocket, read } = await setup();
      await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      await new Promise((resolve) => ownerSocket.emit("applyGamePatch", { opId: "own-2", home: { scoreDelta: 3 } }, resolve));

      operator.emit("startNewGame", undefined);
      await sleep(100);

      expect((await read()).homeTeam.score).toBe(3);
    });

    it("refuses opening a saved game", async () => {
      const { operator, ownerSocket } = await setup();
      const first: any = await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      const opened = vi.fn();
      ownerSocket.on("activeGame", opened);

      operator.emit("openGame", first.gameId);
      await sleep(100);

      expect(opened).not.toHaveBeenCalled();
    });

    it("doesn't accept an operator token on account routes", async () => {
      const { token } = await setup();
      const res = await fetch(`${baseUrl}/api/streamdeck`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(401);
    });

    it("keeps viewer links read-only alongside a second operator", async () => {
      const { shareId, read } = await setup();
      const viewer = await connectWith({ shareId });
      const result = await new Promise((resolve) =>
        viewer.emit("applyGamePatch", { opId: "v-1", home: { scoreDelta: 5 } }, resolve),
      );
      expect(result).toEqual({ ok: false });
      expect((await read()).homeTeam.score).toBe(0);
    });

    it("signs the second operator out on a new PIN, leaving the owner and viewers connected", async () => {
      const { userId, operatorId, token, operator, ownerSocket, shareId } = await setup();
      const viewer = await connectWith({ shareId });
      const ended = new Promise<string>((resolve) => operator.on("disconnect", resolve));

      await owner(userId, "POST");

      expect(await ended).toBe("io server disconnect");
      expect(ownerSocket.connected).toBe(true);
      expect(viewer.connected).toBe(true);
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    it("signs the second operator out on removal", async () => {
      const { userId, operatorId, token, operator } = await setup();
      const ended = new Promise<string>((resolve) => operator.on("disconnect", resolve));

      await owner(userId, "DELETE");

      expect(await ended).toBe("io server disconnect");
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    it("sends the owner's Deck and shortcut config on connect", async () => {
      const { userId, operatorId, pin } = await createAccess();
      const streamDeck = { buttons: [{ id: "1", label: "Goal" }] };
      const shortcuts = [{ key: "g", action: "homeScoreIncrease", description: "Goal" }];
      const save = (route: string, body: unknown) =>
        fetch(`${baseUrl}/api/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${userId}` },
          body: JSON.stringify(body),
        });
      await save("streamdeck", streamDeck);
      await save("shortcuts", shortcuts);
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config).toEqual({ streamDeck, shortcuts });
    });

    it("falls back to the global config files", async () => {
      const { operatorId, pin } = await createAccess();
      const streamDeck = { buttons: [{ id: "global", label: "Global" }] };
      await writeFile(path.join(dataDir, "streamdeck.json"), JSON.stringify(streamDeck));
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config: any = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config.streamDeck).toEqual(streamDeck);
    });

    it("sends null for an unreadable config file, with the connection staying up", async () => {
      const { operatorId, pin } = await createAccess();
      await writeFile(path.join(dataDir, "streamdeck.json"), "{not json");
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config: any = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config.streamDeck).toBeNull();
      expect(socket.connected).toBe(true);
    });

    it("doesn't send operator config to owner or viewer sockets", async () => {
      const { userId, shareId } = await setup();
      const spy = vi.fn();
      const ownerSocket = createClient(baseUrl, { auth: { token: userId }, transports: ["websocket"] });
      const viewer = createClient(baseUrl, { auth: { shareId }, transports: ["websocket"] });
      openSockets.push(ownerSocket, viewer);
      ownerSocket.on("operatorConfig", spy);
      viewer.on("operatorConfig", spy);
      await sleep(150);
      expect(spy).not.toHaveBeenCalled();
    });
  });
```

Add inside `describe("local mode server auth", ...)` in `src/test/localModeServer.test.ts`, and add `import { io as createClient } from "socket.io-client";` at the top:

```ts
  it("rejects an operator handshake in local mode", async () => {
    running = await startServer(true);
    const socket = createClient(`http://127.0.0.1:${running.port}`, {
      auth: { operatorId: "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b", operatorToken: "token" },
      transports: ["websocket"],
      reconnection: false,
    });
    const message = await new Promise<string>((resolve) => socket.once("connect_error", (error) => resolve(error.message)));
    socket.close();
    expect(message).toBe("Authentication error: Operator session ended");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/operatorAccess.test.ts src/test/localModeServer.test.ts`
Expected: FAIL. Operator handshakes are rejected as `Token required`, or accepted as the local operator in local mode.

- [ ] **Step 3: Add the handshake branch**

In `serverApp.ts`, add below the `registerOperatorAccess` import:

```ts
import { OPERATOR_SESSION_ENDED_ERROR } from "./src/lib/operatorAccess.ts";
```

In `io.use`, add between the `if (shareId) { ... }` block and `if (localMode) {`:

```ts
    if (socket.handshake.auth.operatorId) {
      try {
        const ownerId = await operatorAccess.authenticateHandshake(
          socket.handshake.auth.operatorId,
          socket.handshake.auth.operatorToken,
        );
        if (!ownerId) {
          logger.warn({ socketId: socket.id }, "[Socket] Auth failed: operator session ended");
          return next(new Error(OPERATOR_SESSION_ENDED_ERROR));
        }
        socket.data.userId = ownerId;
        socket.data.isViewer = false;
        socket.data.isOperator = true;
        logger.info({ userId: ownerId, socketId: socket.id }, "[Socket] Auth success: second operator connected");
        return next();
      } catch (error) {
        // A different message from a rejected token, so the client keeps its token and retries.
        logger.error({ err: error, socketId: socket.id }, "[Socket] Operator auth error");
        return next(new Error("Authentication error: Could not check operator session"));
      }
    }
```

- [ ] **Step 4: Add the permission checks**

In `io.on("connection", ...)`, add below `const isViewer = ...`:

```ts
    const isOperator = socket.data.isOperator === true;
```

Add at the top of the `updateGameState` handler, after its `isViewer` check:

```ts
      if (isOperator) {
        logger.warn({ userId, socketId: socket.id }, "[Socket] Refused full state update from second operator");
        return;
      }
```

Change the first line of both the `startNewGame` and `openGame` handlers from `if (isViewer) return;` to:

```ts
        if (isViewer || isOperator) return;
```

- [ ] **Step 5: Send the config and share the fallback**

Add this helper directly above `io.use`:

```ts
  // A user's saved config, or the global file for someone who hasn't saved one.
  async function loadConfigWithFallback(userId: string, key: string, fallbackFile: string): Promise<unknown> {
    const dataStr = await getUserConfig(userId, key);
    if (dataStr) return JSON.parse(dataStr);
    return existsSync(fallbackFile) ? JSON.parse(readFileSync(fallbackFile, "utf-8")) : null;
  }

  async function loadOperatorConfigValue(userId: string, key: string, fallbackFile: string): Promise<unknown> {
    try {
      return await loadConfigWithFallback(userId, key, fallbackFile);
    } catch (error) {
      logError("Error reading config for second operator", error, { userId, key });
      return null;
    }
  }
```

Replace the `try` body of `app.get("/api/shortcuts", ...)` with:

```ts
      res.json(await loadConfigWithFallback(userId, "shortcuts", SHORTCUTS_FILE));
```

Replace the `try` body of `app.get("/api/streamdeck", ...)` with:

```ts
      res.json(await loadConfigWithFallback(userId, "streamdeck", STREAMDECK_FILE));
```

Add directly above `socket.on("disconnect", ...)` inside the connection handler, so every event handler is registered first:

```ts
    if (isOperator) {
      const [streamDeck, shortcuts] = await Promise.all([
        loadOperatorConfigValue(userId, "streamdeck", STREAMDECK_FILE),
        loadOperatorConfigValue(userId, "shortcuts", SHORTCUTS_FILE),
      ]);
      socket.emit("operatorConfig", { streamDeck, shortcuts });
    }
```

- [ ] **Step 6: Run the server tests and the type check**

Run: `npx vitest run src/test/operatorAccess.test.ts src/test/localModeServer.test.ts src/test/server.test.ts && npm run lint`
Expected: PASS, including the existing `/api/shortcuts` and `/api/streamdeck` tests.

- [ ] **Step 7: Commit**

```bash
git add serverApp.ts src/test/operatorAccess.test.ts src/test/localModeServer.test.ts
git commit -m "Let a signed-in second operator join the owner's live game" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Store

**Files:**
- Modify: `src/store.ts`
- Test: `src/test/store.test.ts`

**Interfaces:**
- Consumes: `OPERATOR_SESSION_ENDED_ERROR` from Task 1, handshake and `operatorConfig` from Task 4, session route from Task 3.
- Produces, on `StoreState`:
  - `isOperator: boolean`
  - `operatorId: string | null`
  - `operatorAuth: OperatorAuth`
  - `submitOperatorPin(pin: string): Promise<void>`
  - `connectOperator(operatorId: string, token: string): void`
- Exported type:

```ts
export type OperatorAuth =
  | { status: "needs-pin"; sessionEnded?: boolean }
  | { status: "submitting" }
  | { status: "wrong-pin"; attemptsLeft: number }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "connecting" }
  | { status: "connected" };
```

- [ ] **Step 1: Write the failing tests**

Add inside `describe("store", ...)` in `src/test/store.test.ts`:

```ts
  describe("second operator", () => {
    const operatorId = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";
    const tokenKey = `scoreboard:operatorToken:${operatorId}`;

    beforeEach(() => {
      sessionStorage.clear();
      window.history.pushState({}, "", `/operate/${operatorId}`);
      (socketMock as any).connect = vi.fn();
      (socketMock as any).active = false;
    });

    afterEach(() => {
      window.history.pushState({}, "", "/");
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    const respondWith = (status: number, body: unknown) => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    };

    it("asks for the PIN when there is no stored token", async () => {
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.getState().ensureInitialized();
      expect(useStore.getState().isOperator).toBe(true);
      expect(useStore.getState().operatorId).toBe(operatorId);
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin" });
      expect(ioMock).not.toHaveBeenCalled();
    });

    it("reconnects with a stored token, for this link only", async () => {
      sessionStorage.setItem(tokenKey, "stored-token");
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.getState().ensureInitialized();
      expect((ioMock.mock.calls.at(-1) as unknown[])[1]).toMatchObject({
        auth: { operatorId, operatorToken: "stored-token" },
        reconnectionAttempts: Infinity,
      });
    });

    it("uses the PIN flow even when the owner is signed in on this browser", async () => {
      const fetchMock = respondWith(200, {});
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.setState({ user: mockUser as any });
      useStore.getState().ensureInitialized();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin" });
      expect(ioMock).not.toHaveBeenCalled();
      expect(mockUser.getIdToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("stores the token and connects after a correct PIN", async () => {
      const fetchMock = respondWith(200, { token: "new-token" });
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      ioMock.mockClear();

      await useStore.getState().submitOperatorPin("123456");

      expect(fetchMock.mock.calls[0][0]).toContain(`/api/operator/${operatorId}/session`);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ pin: "123456" });
      expect(sessionStorage.getItem(tokenKey)).toBe("new-token");
      expect(useStore.getState().operatorAuth).toEqual({ status: "connecting" });
      expect(ioMock).toHaveBeenCalledTimes(1);

      listeners.get("connect")?.(undefined);
      expect(useStore.getState().operatorAuth).toEqual({ status: "connected" });
      expect(useStore.getState().isConnected).toBe(true);
    });

    it("reports each PIN failure", async () => {
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();

      respondWith(401, { attemptsLeft: 3 });
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "wrong-pin", attemptsLeft: 3 });

      respondWith(429, { retryAfterSeconds: 600 });
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "locked", retryAfterSeconds: 600 });

      respondWith(404, {});
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "not-found" });

      respondWith(500, {});
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "error" });

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "error" });

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
    });

    it("ends the session when the token is rejected", async () => {
      sessionStorage.setItem(tokenKey, "stale");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });

      listeners.get("connect_error")?.(new Error("Authentication error: Operator session ended"));

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin", sessionEnded: true });
      expect(useStore.getState().gameState).toBeNull();
      expect(useStore.getState().socket).toBeNull();
      expect(socketMock.disconnect).toHaveBeenCalled();
    });

    it("ends the session when the server disconnects the socket", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("connect")?.(undefined);

      listeners.get("disconnect")?.("io server disconnect");

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin", sessionEnded: true });
    });

    it("keeps the token through a dropped connection", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("connect")?.(undefined);

      listeners.get("disconnect")?.("transport close");

      expect(sessionStorage.getItem(tokenKey)).toBe("good");
      expect(useStore.getState().operatorAuth).toEqual({ status: "connected" });
      expect(useStore.getState().isConnected).toBe(false);
    });

    it("retries after a server fault during the handshake, keeping the token", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      vi.useFakeTimers();
      useStore.getState().ensureInitialized();

      listeners.get("connect_error")?.(new Error("Authentication error: Could not check operator session"));

      expect(sessionStorage.getItem(tokenKey)).toBe("good");
      expect((socketMock as any).connect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect((socketMock as any).connect).toHaveBeenCalledTimes(1);
    });

    it("leaves retries to Socket.IO when it is already reconnecting", async () => {
      (socketMock as any).active = true;
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      vi.useFakeTimers();
      useStore.getState().ensureInitialized();

      listeners.get("connect_error")?.(new Error("xhr poll error"));
      vi.advanceTimersByTime(2000);

      expect((socketMock as any).connect).not.toHaveBeenCalled();
    });

    it("doesn't touch the owner's local game cache", async () => {
      localStorage.setItem("scoreboard:gameStateCache:v1", '{"period":"owner"}');
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();

      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });
      useStore.getState().updateState({ period: "2nd" });

      expect(useStore.getState().gameState?.period).toBe("2nd");
      expect(localStorage.getItem("scoreboard:gameStateCache:v1")).toBe('{"period":"owner"}');
    });

    it("keeps a change on top of older server state until it is confirmed", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });

      useStore.getState().updateState({ period: "2nd" });
      listeners.get("gameState")?.({ ...baseState, serverTime: 2 });

      expect(useStore.getState().gameState?.period).toBe("2nd");
    });

    it("applies the owner's Deck and shortcut config, adding missing default shortcuts", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      const defaults = useStore.getState().keyboardShortcuts;
      const streamDeck = { buttons: [{ id: "1", label: "Owner" }] };
      const custom = { ...defaults[0], key: "z" };

      listeners.get("operatorConfig")?.({ streamDeck, shortcuts: [custom] });

      expect(useStore.getState().streamDeckConfig).toEqual(streamDeck);
      expect(useStore.getState().keyboardShortcuts).toHaveLength(defaults.length);
      expect(useStore.getState().keyboardShortcuts[0]).toEqual(custom);
    });

    it("keeps the defaults when the config is null", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      const { streamDeckConfig, keyboardShortcuts } = useStore.getState();

      listeners.get("operatorConfig")?.({ streamDeck: null, shortcuts: null });

      expect(useStore.getState().streamDeckConfig).toBe(streamDeckConfig);
      expect(useStore.getState().keyboardShortcuts).toBe(keyboardShortcuts);
    });

    it("tracks the owner's active game", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("activeGame")?.(null);
      expect(useStore.getState().activeGameId).toBeNull();
      listeners.get("activeGame")?.("game-1");
      expect(useStore.getState().activeGameId).toBe("game-1");
    });
  });
```

Change the vitest import at the top of the file to include `afterEach`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/store.test.ts`
Expected: FAIL, with `isOperator` undefined and `submitOperatorPin` not a function. Existing tests still pass.

- [ ] **Step 3: Add the helpers**

In `src/store.ts`, add below the `./lib/localMode` import:

```ts
import { OPERATOR_SESSION_ENDED_ERROR } from "./lib/operatorAccess";
```

Add the exported `OperatorAuth` type from this task's Interfaces block directly above `interface StoreState`.

Replace `saveCachedState(newState);` in `sendPatch` with `cacheGameState(get, newState);`. Add after `saveCachedState`:

```ts
// A second operator may be on the owner's computer, so their session leaves the cached game alone.
const cacheGameState = (get: () => StoreState, state: GameState) => {
  if (!get().isOperator) saveCachedState(state);
};

const receiveGameState = (
  state: GameState,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) => {
  const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
  const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
  // Clock ticks arrive up to 10 times a second, and can be from before the server saw
  // the operator's latest change. Keep that change on top until the server confirms it.
  const oldestPending = Date.now() - PENDING_PATCH_MAX_AGE_MS;
  const pendingPatches = get().pendingPatches.filter((pending) => pending.sentAt >= oldestPending);
  const gameState = pendingPatches.reduce((next, pending) => applyGamePatch(next, pending.patch), state);
  set({ gameState, serverTimeOffsetMs, pendingPatches });
  cacheGameState(get, gameState);
};

const withMissingDefaultShortcuts = (shortcuts: KeyboardShortcut[]): KeyboardShortcut[] => {
  const existingActions = new Set(shortcuts.map((shortcut) => shortcut.action));
  return [...shortcuts, ...defaultShortcuts.filter((shortcut) => !existingActions.has(shortcut.action))];
};

const operatorTokenKey = (operatorId: string) => `scoreboard:operatorToken:${operatorId}`;

const loadOperatorToken = (operatorId: string): string | null => {
  try {
    return sessionStorage.getItem(operatorTokenKey(operatorId));
  } catch {
    return null;
  }
};

const saveOperatorToken = (operatorId: string, token: string) => {
  try {
    sessionStorage.setItem(operatorTokenKey(operatorId), token);
  } catch {
    // The session still works until the page is reloaded.
  }
};

const clearOperatorToken = (operatorId: string) => {
  try {
    sessionStorage.removeItem(operatorTokenKey(operatorId));
  } catch {
    // ignore storage failures
  }
};

const OPERATOR_HANDSHAKE_RETRY_MS = 2000;
```

In `connect`, replace the whole `socket.on("gameState", ...)` handler with:

```ts
      socket.on("gameState", (state: GameState) => {
        receiveGameState(state, get, set);
      });
```

In `loadShortcuts`, replace the three lines after `if (data && Array.isArray(data)) {` with:

```ts
        set({ keyboardShortcuts: withMissingDefaultShortcuts(data) });
```

- [ ] **Step 4: Add the state and actions**

Add to `StoreState`, after `isViewer: boolean;`:

```ts
  isOperator: boolean;
  operatorId: string | null;
  operatorAuth: OperatorAuth;
```

and after `connectViewer: (shareId: string) => void;`:

```ts
  connectOperator: (operatorId: string, token: string) => void;
  submitOperatorPin: (pin: string) => Promise<void>;
```

Add to the initial state, after `isViewer: false,`:

```ts
  isOperator: false,
  operatorId: null,
  operatorAuth: { status: "needs-pin" },
```

Add after the `connect` action:

```ts
  connectOperator: (operatorId: string, token: string) => {
    get().socket?.disconnect();
    set({ operatorAuth: { status: "connecting" } });

    const socketUrl = BASE_URL === window.location.origin ? undefined : BASE_URL;
    const socket = io(socketUrl, {
      auth: { operatorId, operatorToken: token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const endSession = () => {
      clearOperatorToken(operatorId);
      socket.disconnect();
      set({
        socket: null,
        isConnected: false,
        gameState: null,
        activeGameId: undefined,
        undoStack: [],
        pendingPatches: [],
        operatorAuth: { status: "needs-pin", sessionEnded: true },
      });
    };

    socket.on("connect", () => {
      set({ isConnected: true, operatorAuth: { status: "connected" } });
    });

    socket.on("disconnect", (reason: string) => {
      // Socket.IO won't reconnect by itself after this reason, and the owner only
      // disconnects a second operator when signing them out.
      if (reason === "io server disconnect") {
        endSession();
        return;
      }
      set({ isConnected: false, pendingPatches: [] });
    });

    socket.on("connect_error", (error: Error) => {
      if (error.message === OPERATOR_SESSION_ENDED_ERROR) {
        endSession();
        return;
      }
      set({ isConnected: false });
      // An error from server middleware stops Socket.IO retrying, and a database fault
      // during the handshake shouldn't leave the second operator stuck.
      if (!socket.active) {
        setTimeout(() => {
          if (get().socket === socket) socket.connect();
        }, OPERATOR_HANDSHAKE_RETRY_MS);
      }
    });

    socket.on("gameState", (state: GameState) => {
      receiveGameState(state, get, set);
    });

    socket.on("activeGame", (gameId: string | null) => {
      set({ activeGameId: gameId });
    });

    socket.on("operatorConfig", (config: { streamDeck: StreamDeckConfig | null; shortcuts: KeyboardShortcut[] | null }) => {
      if (config.streamDeck?.buttons) set({ streamDeckConfig: config.streamDeck });
      if (Array.isArray(config.shortcuts)) set({ keyboardShortcuts: withMissingDefaultShortcuts(config.shortcuts) });
    });

    set({ socket, isConnected: socket.connected });
  },

  submitOperatorPin: async (pin: string) => {
    const { operatorId } = get();
    if (!operatorId) return;
    set({ operatorAuth: { status: "submitting" } });
    try {
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/operator/${encodeURIComponent(operatorId)}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.token === "string") {
        saveOperatorToken(operatorId, data.token);
        get().connectOperator(operatorId, data.token);
      } else if (response.status === 401) {
        set({ operatorAuth: { status: "wrong-pin", attemptsLeft: data.attemptsLeft } });
      } else if (response.status === 429) {
        set({ operatorAuth: { status: "locked", retryAfterSeconds: data.retryAfterSeconds } });
      } else if (response.status === 404) {
        set({ operatorAuth: { status: "not-found" } });
      } else {
        set({ operatorAuth: { status: "error" } });
      }
    } catch (error) {
      console.error("Failed to check operator PIN:", error);
      set({ operatorAuth: { status: "error" } });
    }
  },
```

In `ensureInitialized`, add directly after `const pathParts = window.location.pathname.split("/");`:

```ts
    // Checked before the signed-in user, so this route never uses the owner's account.
    if (pathParts[1] === "operate" && pathParts[2]) {
      const operatorId = pathParts[2];
      hasInitialized = true;
      set({ isOperator: true, operatorId, authLoading: false });
      const token = loadOperatorToken(operatorId);
      if (token) get().connectOperator(operatorId, token);
      return;
    }

```

- [ ] **Step 5: Run tests and the type check**

Run: `npx vitest run src/test/store.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store.ts src/test/store.test.ts
git commit -m "Add second operator sign-in and connection to the store" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Share sheet section

**Files:**
- Create: `src/components/control-panel/SecondOperatorSection.tsx`
- Modify: `src/components/control-panel/ShareModal.tsx`
- Test: `src/test/components/SecondOperatorSection.test.tsx`
- Test: `src/test/components/ShareModal.test.tsx`

**Interfaces:**
- Consumes: owner routes from Task 3.
- Produces: `SecondOperatorSection`, a default-exported component with no props.

- [ ] **Step 1: Write the failing section test**

Create `src/test/components/SecondOperatorSection.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SecondOperatorSection from "../../components/control-panel/SecondOperatorSection";
import { isLocalMode } from "../../lib/localMode";
import { useStore } from "../../store";

vi.mock("../../store", () => ({ useStore: { getState: vi.fn() } }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-qr-value={value} /> }));
vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  isLocalMode: vi.fn(() => false),
}));

const respond = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
});

describe("SecondOperatorSection", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLocalMode).mockReturnValue(false);
    vi.mocked(useStore.getState).mockReturnValue({
      user: { getIdToken: vi.fn().mockResolvedValue("owner-token") },
    } as any);
    global.fetch = fetchMock as any;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  const lastCall = () => fetchMock.mock.calls.at(-1)!;

  it("offers setup when there is no access yet", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    render(<SecondOperatorSection />);
    expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  });

  it("shows the link and the PIN after setup", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    render(<SecondOperatorSection />);
    const setup = await screen.findByRole("button", { name: "Set up second operator" });

    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "012345" }));
    fireEvent.click(setup);

    expect(await screen.findByText("012345")).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
    expect(screen.getByText(/won't be shown again/i)).toBeInTheDocument();
    expect(lastCall()[1].method).toBe("POST");
  });

  it("never puts the PIN in the link", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    const { container } = render(<SecondOperatorSection />);
    const setup = await screen.findByRole("button", { name: "Set up second operator" });
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "012345" }));
    fireEvent.click(setup);
    await screen.findByText("012345");

    const link = `${window.location.origin}/operate/op-1`;
    expect(container.querySelector("code")?.textContent).toBe(link);
    expect(container.querySelector("svg[data-qr-value]")?.getAttribute("data-qr-value")).toBe(link);
  });

  it("shows the link without a PIN when reopened", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    expect(await screen.findByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
    expect(screen.queryByText(/won't be shown again/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new PIN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove access" })).toBeInTheDocument();
  });

  it("confirms before creating a new PIN, and shows it", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Create new PIN" }));

    expect(screen.getByText("Create a new PIN?")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "999888" }));
    const buttons = screen.getAllByRole("button", { name: "Create new PIN" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("999888")).toBeInTheDocument();
    expect(screen.queryByText("Create a new PIN?")).not.toBeInTheDocument();
  });

  it("does nothing when a confirmation is cancelled", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
  });

  it("removes access after confirmation", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));

    fetchMock.mockResolvedValueOnce(respond(200, { success: true }));
    const buttons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
    expect(lastCall()[1].method).toBe("DELETE");
  });

  it("shows an error when a change fails, keeping the current state", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));

    fetchMock.mockResolvedValueOnce(respond(500, {}));
    const buttons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(/couldn't update second operator access/i)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
  });

  it("copies the link", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByTitle("Copy link"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/operate/op-1`),
    );
  });

  it("is hidden in local mode", () => {
    vi.mocked(isLocalMode).mockReturnValue(true);
    const { container } = render(<SecondOperatorSection />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Update the ShareModal test**

The section makes its own `fetch` call, which would use up the `mockResolvedValueOnce` responses in the existing modal tests. Add to `src/test/components/ShareModal.test.tsx`, below the store mock:

```tsx
vi.mock("../../components/control-panel/SecondOperatorSection", () => ({
  default: () => <div>Second operator section</div>,
}));
```

Add this test inside the `describe`:

```tsx
  it("shows the second operator section with or without viewer links", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false } as any);
    const { unmount } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Second operator section")).toBeInTheDocument();
    unmount();

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "existing-id" }),
    } as any);
    render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    await screen.findByText("existing-id");
    expect(screen.getByText("Second operator section")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/components/SecondOperatorSection.test.tsx src/test/components/ShareModal.test.tsx`
Expected: FAIL because `SecondOperatorSection` does not exist.

- [ ] **Step 4: Write the component**

Create `src/components/control-panel/SecondOperatorSection.tsx`. The PIN lives only in this component's state, and `ShareModal` unmounts its contents on close, so closing the sheet discards it.

```tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Copy, ExternalLink, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getBaseUrl, isLocalMode } from "../../lib/localMode";
import { useStore } from "../../store";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button } from "./ui/primitives";

const CHANGE_ERROR = "Couldn't update second operator access. Check your connection and try again.";
const LOAD_ERROR = "Couldn't load second operator access. Check your connection and reopen this window.";

export default function SecondOperatorSection() {
  const localMode = isLocalMode();
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"new-pin" | "remove" | null>(null);
  const [copied, setCopied] = useState(false);

  const request = async (method: "GET" | "POST" | "DELETE") => {
    const { user } = useStore.getState();
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    const baseUrl = getBaseUrl().replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/operator-access`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Operator access request failed: ${response.status}`);
    return response.json();
  };

  useEffect(() => {
    if (localMode) return;
    request("GET")
      .then((data) => setOperatorId(data.operatorId ?? null))
      .catch((loadError) => {
        console.error("Failed to load operator access:", loadError);
        setError(LOAD_ERROR);
      });
  }, [localMode]);

  const createPin = async () => {
    setConfirming(null);
    setIsBusy(true);
    setError(null);
    try {
      const data = await request("POST");
      setOperatorId(data.operatorId);
      setPin(data.pin);
    } catch (changeError) {
      console.error("Failed to create operator PIN:", changeError);
      setError(CHANGE_ERROR);
    } finally {
      setIsBusy(false);
    }
  };

  const removeAccess = async () => {
    setConfirming(null);
    setIsBusy(true);
    setError(null);
    try {
      await request("DELETE");
      setOperatorId(null);
      setPin(null);
    } catch (changeError) {
      console.error("Failed to remove operator access:", changeError);
      setError(CHANGE_ERROR);
    } finally {
      setIsBusy(false);
    }
  };

  if (localMode) return null;

  const link = operatorId ? `${window.location.origin}/operate/${operatorId}` : null;

  const copyLink = () => {
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="mt-6 pt-6 border-t border-line space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Second operator</h3>
        <p className="text-sm text-muted mt-1">
          {link
            ? "Anyone with this link and the PIN can change the live game from the Controls and Deck tabs."
            : "Give one other person the Controls and Deck tabs for your live game. They need a link and a PIN."}
        </p>
      </div>

      {error && (
        <p className="text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {!link ? (
        <Button onClick={createPin} disabled={isBusy} variant="primary">
          <UserPlus size={16} />
          Set up second operator
        </Button>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="bg-white p-2 rounded-sm self-center shrink-0">
              <QRCodeSVG value={link} size={110} level="M" includeMargin={false} />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-start gap-2 bg-canvas border border-line rounded-sm px-2.5 py-2">
                <code className="text-xs text-muted break-all flex-1 tabular-nums leading-relaxed">{link}</code>
                <button
                  onClick={copyLink}
                  className="text-muted hover:text-ink transition-colors p-1 shrink-0"
                  title="Copy link"
                >
                  {copied ? <Check size={14} className="text-ink" /> : <Copy size={14} />}
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-ink transition-colors p-1 shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              {pin && (
                <div className="bg-surface border border-ink rounded-sm p-3">
                  <p className="text-xs font-semibold text-ink">PIN</p>
                  <p className="text-3xl font-semibold text-ink tabular-nums tracking-widest">{pin}</p>
                  <p className="text-xs text-muted mt-1">
                    Give the PIN to them separately from the link. It won't be shown again once you close this window.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirming("new-pin")} disabled={isBusy} variant="secondary">
              Create new PIN
            </Button>
            <Button onClick={() => setConfirming("remove")} disabled={isBusy} variant="secondary">
              Remove access
            </Button>
          </div>
        </>
      )}

      {/* Portalled because ConfirmDialog must render outside the modal's scrolling panel. */}
      {createPortal(
        <>
          <ConfirmDialog
            open={confirming === "new-pin"}
            title="Create a new PIN?"
            message="The second operator is signed out and needs the new PIN to get back in. The link stays the same."
            confirmLabel="Create new PIN"
            onConfirm={createPin}
            onCancel={() => setConfirming(null)}
          />
          <ConfirmDialog
            open={confirming === "remove"}
            title="Remove second operator access?"
            message="The second operator is signed out and this link stops working."
            confirmLabel="Remove access"
            onConfirm={removeAccess}
            onCancel={() => setConfirming(null)}
          />
        </>,
        document.body,
      )}
    </section>
  );
}
```

- [ ] **Step 5: Add it to the modal**

In `src/components/control-panel/ShareModal.tsx`, add the import:

```tsx
import SecondOperatorSection from "./SecondOperatorSection";
```

On the modal content `div`, replace `overflow-hidden` so that the class list reads:

```tsx
<div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto bg-canvas border border-line rounded-sm duration-200">
```

Add directly after the `{!shareId ? ( ... )}` conditional closes, inside `<div className="p-4 sm:p-6">`:

```tsx
          <SecondOperatorSection />
```

- [ ] **Step 6: Run tests and the type check**

Run: `npx vitest run src/test/components/SecondOperatorSection.test.tsx src/test/components/ShareModal.test.tsx && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/control-panel/SecondOperatorSection.tsx src/components/control-panel/ShareModal.tsx src/test/components/SecondOperatorSection.test.tsx src/test/components/ShareModal.test.tsx
git commit -m "Add second operator controls to the share sheet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Operator route and PIN screen

**Files:**
- Create: `src/components/control-panel/OperatorGate.tsx`
- Modify: `src/App.tsx`
- Test: `src/test/components/OperatorGate.test.tsx`
- Test: `src/test/App.test.tsx`

**Interfaces:**
- Consumes: `operatorAuth`, `submitOperatorPin`, `gameState`, `activeGameId` from Task 5, `OPERATOR_PIN_LENGTH` from Task 1.
- Produces: `OperatorGate`, default export, props `{ children: ReactNode }`, and the route `/operate/:operatorId`.

- [ ] **Step 1: Write the failing gate test**

Create `src/test/components/OperatorGate.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperatorGate from "../../components/control-panel/OperatorGate";
import { useStore } from "../../store";

vi.mock("../../store", () => ({ useStore: vi.fn() }));

describe("OperatorGate", () => {
  const submitOperatorPin = vi.fn();

  const renderWith = (state: Record<string, unknown>) => {
    const full = { submitOperatorPin, gameState: null, activeGameId: undefined, ...state };
    vi.mocked(useStore).mockImplementation((selector: any) => selector(full));
    return render(
      <OperatorGate>
        <div>Controls</div>
      </OperatorGate>,
    );
  };

  beforeEach(() => vi.clearAllMocks());

  const pinInput = () => screen.getByLabelText("PIN") as HTMLInputElement;

  it("asks for the PIN, with a numeric keypad", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    expect(pinInput()).toHaveAttribute("inputmode", "numeric");
    expect(pinInput()).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("submits only a complete PIN", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    const submit = screen.getByRole("button", { name: "Continue" });
    fireEvent.change(pinInput(), { target: { value: "12345" } });
    expect(submit).toBeDisabled();

    fireEvent.change(pinInput(), { target: { value: "123456" } });
    fireEvent.click(submit);
    expect(submitOperatorPin).toHaveBeenCalledWith("123456");
  });

  it("keeps digits only, up to six, from pasted or typed text", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    fireEvent.change(pinInput(), { target: { value: " 123 456 " } });
    expect(pinInput().value).toBe("123456");
    fireEvent.change(pinInput(), { target: { value: "12a4567890" } });
    expect(pinInput().value).toBe("124567");
  });

  it("shows attempts left after a wrong PIN, using the right plural", () => {
    const { unmount } = renderWith({ operatorAuth: { status: "wrong-pin", attemptsLeft: 3 } });
    expect(screen.getByText("That PIN is wrong. 3 attempts left.")).toBeInTheDocument();
    unmount();
    renderWith({ operatorAuth: { status: "wrong-pin", attemptsLeft: 1 } });
    expect(screen.getByText("That PIN is wrong. 1 attempt left.")).toBeInTheDocument();
  });

  it("clears the input after a wrong PIN", () => {
    const state: Record<string, unknown> = { operatorAuth: { status: "needs-pin" } };
    const { rerender } = renderWith(state);
    fireEvent.change(pinInput(), { target: { value: "123456" } });

    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({ submitOperatorPin, gameState: null, activeGameId: undefined, operatorAuth: { status: "wrong-pin", attemptsLeft: 4 } }),
    );
    rerender(
      <OperatorGate>
        <div>Controls</div>
      </OperatorGate>,
    );

    expect(pinInput().value).toBe("");
  });

  it("shows the wait when locked, rounding up to whole minutes", () => {
    const { unmount } = renderWith({ operatorAuth: { status: "locked", retryAfterSeconds: 601 } });
    expect(screen.getByText("Too many wrong PINs. Try again in 11 minutes.")).toBeInTheDocument();
    unmount();
    renderWith({ operatorAuth: { status: "locked", retryAfterSeconds: 30 } });
    expect(screen.getByText("Too many wrong PINs. Try again in 1 minute.")).toBeInTheDocument();
  });

  it("explains a session that ended", () => {
    renderWith({ operatorAuth: { status: "needs-pin", sessionEnded: true } });
    expect(screen.getByText("Your session ended. Enter the current PIN to continue.")).toBeInTheDocument();
  });

  it("explains a connection problem", () => {
    renderWith({ operatorAuth: { status: "error" } });
    expect(screen.getByText("Couldn't reach the server. Check your connection and try again.")).toBeInTheDocument();
  });

  it("disables the form while checking the PIN", () => {
    renderWith({ operatorAuth: { status: "submitting" } });
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("explains an unknown or removed link, without a PIN form", () => {
    renderWith({ operatorAuth: { status: "not-found" } });
    expect(screen.getByText("This link is no longer active")).toBeInTheDocument();
    expect(screen.getByText("Ask the main operator for a new second operator link.")).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
  });

  it("shows a loading state while connecting", () => {
    renderWith({ operatorAuth: { status: "connecting" } });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows a loading state until the game is known", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: undefined });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("waits when no game is open", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: null });
    expect(screen.getByText("Waiting for a game to start")).toBeInTheDocument();
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("shows the control panel when a game is open", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: "game-1" });
    expect(screen.getByText("Controls")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add the failing App tests**

Add to `src/test/App.test.tsx`, below the other component mocks:

```tsx
vi.mock("../components/control-panel/OperatorGate", () => ({ default: () => <div>Operator Gate</div> }));
```

Add inside the `describe`:

```tsx
  describe("second operator route", () => {
    const useOperatorRoute = (state: Record<string, unknown>) => {
      window.history.pushState({}, "Operate", "/operate/op-1");
      vi.mocked(useStore).mockImplementation((selector: any) =>
        selector({
          user: null,
          isViewer: false,
          authLoading: false,
          authError: null,
          gameState: null,
          setUser: vi.fn(),
          setAuthLoading: vi.fn(),
          ensureInitialized: vi.fn(),
          ...state,
        }),
      );
    };

    it("opens the gate with nobody signed in", async () => {
      useOperatorRoute({});
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
      expect(screen.queryByText("Login Screen")).not.toBeInTheDocument();
    });

    it("doesn't wait for Firebase sign-in to finish", async () => {
      useOperatorRoute({ authLoading: true });
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
    });

    it("doesn't show the share link error screen", async () => {
      useOperatorRoute({ authError: "Connection error: offline" });
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
      expect(screen.queryByText("Connection failed")).not.toBeInTheDocument();
    });

    it("leaves the footer off", async () => {
      useOperatorRoute({});
      render(<App />);
      await screen.findByText("Operator Gate");
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/components/OperatorGate.test.tsx src/test/App.test.tsx`
Expected: FAIL because `OperatorGate` does not exist.

- [ ] **Step 4: Write the gate**

Create `src/components/control-panel/OperatorGate.tsx`:

```tsx
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { OPERATOR_PIN_LENGTH } from "../../lib/operatorAccess";
import { useStore, type OperatorAuth } from "../../store";
import { Button, Wordmark, inputClass } from "./ui/primitives";

const SCREEN_CLASS = "ui min-h-screen bg-canvas flex items-center justify-center p-4";
const CARD_CLASS = "w-full max-w-md bg-canvas border border-line rounded-sm p-8 space-y-4";

function pinMessage(auth: OperatorAuth): string | null {
  switch (auth.status) {
    case "wrong-pin":
      return `That PIN is wrong. ${auth.attemptsLeft} ${auth.attemptsLeft === 1 ? "attempt" : "attempts"} left.`;
    case "locked": {
      const minutes = Math.ceil(auth.retryAfterSeconds / 60);
      return `Too many wrong PINs. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "error":
      return "Couldn't reach the server. Check your connection and try again.";
    case "needs-pin":
      return auth.sessionEnded ? "Your session ended. Enter the current PIN to continue." : null;
    default:
      return null;
  }
}

function PinForm({ auth }: { auth: OperatorAuth }) {
  const submitOperatorPin = useStore((state) => state.submitOperatorPin);
  const [pin, setPin] = useState("");
  const isSubmitting = auth.status === "submitting";
  const message = pinMessage(auth);

  useEffect(() => {
    if (auth.status === "wrong-pin") setPin("");
  }, [auth]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (pin.length === OPERATOR_PIN_LENGTH && !isSubmitting) void submitOperatorPin(pin);
  };

  return (
    <div className={SCREEN_CLASS}>
      <form onSubmit={handleSubmit} className={CARD_CLASS}>
        <Wordmark />
        <div>
          <h1 className="text-xl font-semibold text-ink">Enter the PIN</h1>
          <p className="text-sm text-muted mt-1">Ask the main operator for the six-digit PIN.</p>
        </div>
        {message && (
          <p role="alert" className="text-sm text-danger flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{message}</span>
          </p>
        )}
        <div>
          <label htmlFor="operator-pin" className="text-sm font-semibold text-ink">
            PIN
          </label>
          <input
            id="operator-pin"
            className={`${inputClass} mt-1 w-full text-center text-2xl tabular-nums tracking-widest`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, OPERATOR_PIN_LENGTH))}
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={pin.length !== OPERATOR_PIN_LENGTH || isSubmitting}>
          Continue
        </Button>
      </form>
    </div>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={SCREEN_CLASS}>
      <div className={CARD_CLASS}>
        <Wordmark />
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default function OperatorGate({ children }: { children: ReactNode }) {
  const auth = useStore((state) => state.operatorAuth);
  const hasGameState = useStore((state) => state.gameState !== null);
  const activeGameId = useStore((state) => state.activeGameId);

  if (auth.status === "not-found") {
    return <Message title="This link is no longer active" detail="Ask the main operator for a new second operator link." />;
  }

  const isConnecting =
    auth.status === "connecting" || (auth.status === "connected" && (!hasGameState || activeGameId === undefined));
  if (isConnecting) {
    return <div className={SCREEN_CLASS}><p className="text-muted">Connecting...</p></div>;
  }

  if (auth.status === "connected") {
    if (activeGameId === null) {
      return (
        <Message
          title="Waiting for a game to start"
          detail="The controls will appear here when the main operator opens a game."
        />
      );
    }
    return <>{children}</>;
  }

  return <PinForm auth={auth} />;
}
```

- [ ] **Step 5: Wire up the route**

In `src/App.tsx`, add the lazy import after `ResultsPage`:

```tsx
const OperatorGate = lazy(() => import('./components/control-panel/OperatorGate'));
```

Add after `const isShareRoute = ...`:

```tsx
  // A second operator's session runs on its own token, so Firebase's loading state,
  // errors and signed-out screen don't apply here.
  const isOperatorRoute = location.pathname.startsWith('/operate/');
```

Add `!isOperatorRoute &&` as the first condition of `showFooter`, and change these three conditions:

```tsx
  if (authError && !gameState && !isOperatorRoute) {
```

```tsx
  if (authLoading && !gameState && !isOperatorRoute) {
```

```tsx
  if (!user && !isViewer && !isOperatorRoute) {
```

Add after the share routes:

```tsx

          {/* Second operator */}
          <Route path="/operate/:operatorId" element={<OperatorGate><ControlPanel /></OperatorGate>} />
```

- [ ] **Step 6: Run tests and the type check**

Run: `npx vitest run src/test/components/OperatorGate.test.tsx src/test/App.test.tsx && npm run lint`
Expected: PASS. `AppFooter` renders a `<footer>`, so the `contentinfo` check is a real one.

- [ ] **Step 7: Commit**

```bash
git add src/components/control-panel/OperatorGate.tsx src/App.tsx src/test/components/OperatorGate.test.tsx src/test/App.test.tsx
git commit -m "Add the second operator route and PIN screen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Reduced control panel and docs

**Files:**
- Modify: `src/components/control-panel/AppSidebar.tsx`
- Modify: `src/components/ControlPanel.tsx`
- Modify: `src/components/control-panel/ControlPanelHeader.tsx`
- Modify: `src/components/StreamDeckPanel.tsx`
- Modify: `design.md`
- Test: `src/test/components/AppSidebar.test.tsx`
- Test: `src/test/components/ControlPanel.test.tsx`
- Test: `src/test/components/ControlPanelHeader.test.tsx`
- Test: `src/test/components/StreamDeckPanel.test.tsx`

**Interfaces:**
- Consumes: `isOperator` from Task 5.
- Produces: `OPERATOR_TABS: ActiveTab[]` exported from `AppSidebar.tsx`, and an optional `tabs?: ActiveTab[]` prop on `AppSidebar`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/components/AppSidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppSidebar, { OPERATOR_TABS } from "../../components/control-panel/AppSidebar";

describe("AppSidebar", () => {
  it("shows every tab by default", () => {
    render(<AppSidebar activeTab="controls" onSelectTab={vi.fn()} />);
    for (const label of ["Controls", "Settings", "Teams", "Deck"]) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
  });

  it("shows only the given tabs, in both the desktop and mobile navs", () => {
    render(<AppSidebar activeTab="controls" onSelectTab={vi.fn()} tabs={OPERATOR_TABS} />);
    expect(screen.getAllByText("Controls")).toHaveLength(2);
    expect(screen.getAllByText("Deck")).toHaveLength(2);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Teams")).not.toBeInTheDocument();
  });
});
```

Add to `src/test/components/ControlPanel.test.tsx`, inside the `describe`:

```tsx
  describe("second operator", () => {
    const renderAt = (path: string, state: Record<string, unknown> = {}) => {
      vi.mocked(useStore).mockReturnValue({
        gameState: baseGameState,
        updateState: vi.fn(),
        isViewer: false,
        isOperator: true,
        user: null,
        activeGameId: "game-1",
        ensureInitialized: vi.fn(),
        ...state,
      } as any);
      return render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/operate/:operatorId" element={<ControlPanel />} />
            <Route path="/" element={<div>Dashboard page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    };

    it("shows the bar and only the Controls and Deck tabs", () => {
      renderAt("/operate/op-1");
      expect(screen.getByText("Second operator: changes here go live")).toBeInTheDocument();
      expect(screen.getAllByText("Deck")).toHaveLength(2);
      expect(screen.queryByText("Teams")).not.toBeInTheDocument();
    });

    it("stays on Controls when the URL asks for a tab they can't use", () => {
      for (const tab of ["settings", "presets"]) {
        const { unmount } = renderAt(`/operate/op-1?tab=${tab}`);
        expect(screen.getByText("Clock")).toBeInTheDocument();
        expect(screen.queryByText("Presets")).not.toBeInTheDocument();
        expect(screen.queryByText("Settings")).not.toBeInTheDocument();
        unmount();
      }
    });

    it("can open Deck from the URL", () => {
      renderAt("/operate/op-1?tab=streamdeck");
      expect(screen.getByText("StreamDeck")).toBeInTheDocument();
    });

    it("doesn't redirect to the Dashboard when no game is open", () => {
      renderAt("/operate/op-1", { activeGameId: null });
      expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    });

    it("doesn't render the share sheet", () => {
      renderAt("/operate/op-1");
      expect(screen.queryByText("ShareModal")).not.toBeInTheDocument();
    });

    it("keeps the controls interactive", () => {
      const { container } = renderAt("/operate/op-1");
      expect(container.querySelector(".pointer-events-none")).toBeNull();
    });
  });
```

Change the router import at the top of that file to:

```tsx
import { MemoryRouter, Route, Routes } from "react-router-dom";
```

Add to `src/test/components/ControlPanelHeader.test.tsx`, inside the `describe`:

```tsx
  it("shows a second operator only the status and Undo, even with an owner signed in", () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: { displayName: "Owner Name", photoURL: null },
        logout: mockLogout,
        isViewer: false,
        isOperator: true,
        shareId: null,
      }),
    );

    render(<ControlPanelHeader isConnected={true} onUndo={vi.fn()} canUndo={true} />, { wrapper: MemoryRouter });

    expect(screen.getByTitle(/undo last/i)).toBeInTheDocument();
    expect(screen.getByTitle("Connected to server")).toBeInTheDocument();
    for (const label of ["Close", "Overlay", "Jumbotron", "Results", "Share", "Owner Name"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByTitle("Sign out")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Toggle menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
```

Add to `src/test/components/StreamDeckPanel.test.tsx`, inside the `describe`:

```tsx
  it("lets a second operator press buttons but not edit them", async () => {
    const handleAction = vi.fn();
    vi.mocked(useSharedActions).mockReturnValue({ handleAction } as any);
    vi.mocked(useStore).mockReturnValue({
      gameState: mockGameState,
      streamDeckConfig: mockConfig,
      updateStreamDeckButton: vi.fn(),
      updateState: vi.fn(),
      ensureInitialized: vi.fn(),
      isOperator: true,
    } as any);

    render(<StreamDeckPanel />);

    const button = await screen.findByText("Goal Home");
    expect(screen.queryByTitle('Edit "Goal Home"')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledWith("homeScoreIncrease");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/components/AppSidebar.test.tsx src/test/components/ControlPanel.test.tsx src/test/components/ControlPanelHeader.test.tsx src/test/components/StreamDeckPanel.test.tsx`
Expected: FAIL on the new tests. Existing tests still pass.

- [ ] **Step 3: Update the sidebar**

In `src/components/control-panel/AppSidebar.tsx`, add below `NAV_ITEMS`:

```tsx
export const OPERATOR_TABS: ActiveTab[] = ["controls", "streamdeck"];
```

Add `tabs?: ActiveTab[];` to `AppSidebarProps`, then change the start of the component to:

```tsx
export default function AppSidebar({ activeTab, onSelectTab, tabs }: AppSidebarProps) {
  const items = tabs ? NAV_ITEMS.filter((item) => tabs.includes(item.id)) : NAV_ITEMS;
```

and change both `NAV_ITEMS.map(` calls to `items.map(`.

- [ ] **Step 4: Update the control panel**

In `src/components/ControlPanel.tsx`:

Change the sidebar import to `import AppSidebar, { ActiveTab, OPERATOR_TABS } from "./control-panel/AppSidebar";`.

Add `isOperator,` after `isViewer,` in the `useStore()` destructure.

Replace the `validTabs` line with:

```tsx
  const validTabs: ActiveTab[] = isOperator ? OPERATOR_TABS : ["controls", "settings", "presets", "streamdeck"];
```

Change the redirect effect to:

```tsx
  useEffect(() => {
    if (!isViewer && !isOperator && activeGameId === null) {
      navigate("/", { replace: true });
    }
  }, [isViewer, isOperator, activeGameId, navigate]);
```

Change the early return to:

```tsx
  if (!isViewer && !isOperator && activeGameId === null) {
    return null;
  }
```

Change `onShare` on the header to:

```tsx
          onShare={isOperator ? undefined : () => setIsShareModalOpen(true)}
```

Add after the `{isViewer && ( ... )}` bar:

```tsx
        {isOperator && (
          <div className="bg-ink py-1.5 px-4 text-center">
            <p className="text-xs font-semibold text-canvas">Second operator: changes here go live</p>
          </div>
        )}
```

Change the sidebar line to:

```tsx
          {!isViewer && <AppSidebar activeTab={activeTab} onSelectTab={setActiveTab} tabs={isOperator ? OPERATOR_TABS : undefined} />}
```

Change the `<ShareModal ... />` block to:

```tsx
      {!isOperator && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
```

- [ ] **Step 5: Update the header**

In `src/components/control-panel/ControlPanelHeader.tsx`, add below `const isViewer = ...`:

```tsx
  // These checks can't use `user`: an owner signed in on this browser would bring their
  // account menu into a second operator's session.
  const isOperator = useStore((state) => state.isOperator);
  const showsOwnerActions = !isViewer && !isOperator;
```

Change the wordmark condition from `{isViewer ? (` to `{isViewer || isOperator ? (`.

Replace every `{!isViewer && (`, `{!isViewer && onShare && (` and `{user && !isViewer && (` in this file with `{showsOwnerActions && (`, `{showsOwnerActions && onShare && (` and `{user && showsOwnerActions && (`. The desktop and mobile layouts both need this.

Wrap both desktop `<a href={overlayPath}>` and `<a href={jumbotronPath}>` links, as a pair, in `{!isOperator && ( <> ... </> )}`.

Wrap the mobile menu button so a second operator doesn't get an empty menu:

```tsx
          {!isOperator && (
            <button
              onClick={toggleMenu}
              className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
```

- [ ] **Step 6: Update the Deck**

In `src/components/StreamDeckPanel.tsx`, change the store line to:

```tsx
  const { gameState, streamDeckConfig, updateStreamDeckButton, updateState, isOperator } = useStore();
```

Wrap the edit button:

```tsx
              {!isOperator && (
                <button
                  onClick={() => setEditingIndex(index)}
                  className="absolute -top-1.5 -right-1.5 p-1.5 bg-canvas border border-line text-muted rounded-full border border-line opacity-0 group-hover:opacity-100 transition-opacity hover:text-ink hover:bg-surface z-20"
                  title={`Edit "${button.label}"`}
                  aria-label={`Edit "${button.label}"`}
                >
                  <Settings size={14} />
                </button>
              )}
```

- [ ] **Step 7: Update `design.md`**

Change the control panel row in the screens table to:

```markdown
| Control panel | `/game`, `/share/:shareId`, `/operate/:operatorId` | Black icon sidebar, white content |
```

Add below the "Read-only share view" row:

```markdown
| Second operator view | Ink bar with white text saying "Second operator: changes here go live" |
```

- [ ] **Step 8: Run tests and the type check**

Run: `npx vitest run src/test/components && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/control-panel/AppSidebar.tsx src/components/ControlPanel.tsx src/components/control-panel/ControlPanelHeader.tsx src/components/StreamDeckPanel.tsx design.md src/test/components/AppSidebar.test.tsx src/test/components/ControlPanel.test.tsx src/test/components/ControlPanelHeader.test.tsx src/test/components/StreamDeckPanel.test.tsx
git commit -m "Show a second operator only the Controls and Deck tabs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification in the real app

**Files:** none, unless this check finds a defect. Fix any defect with a failing test first, and commit it separately.

**Interfaces:**
- Consumes: everything above.
- Produces: a report of what was checked and what was seen.

- [ ] **Step 1: Run the whole suite and a production build**

Run: `npm run lint && npx vitest run && npm run build`
Expected: no type errors, all tests pass (421 baseline plus the new ones), and the build succeeds.

- [ ] **Step 2: Scan the logging**

Run: `grep -n -E 'logger\.|logError\(' src/server/operatorAccess.ts; grep -n -A3 'operatorId' serverApp.ts | grep -E 'logger\.|logError'`
Expected: no log call passes `pin`, `token`, `operatorToken` or `operatorId`.

- [ ] **Step 3: Start the app**

Use the `run` skill to start the app with `npm run dev`, with `LOCAL_MODE` unset. The owner side needs a Google sign-in. If no session is available, ask the user to sign in, because Claude must not enter their credentials.

- [ ] **Step 4: Check it with two browser sessions**

Use the owner session in one window and a separate tab for the second operator. `sessionStorage` is per tab, so one tab can't reuse another's token. Confirm each of these and record what happens:

1. Share sheet: "Second operator" appears, setup shows link, QR code and PIN, and the modal scrolls on a short window.
2. Operator link: the PIN screen appears, a wrong PIN shows attempts left, and the right PIN opens the controls.
3. No game open: "Waiting for a game to start" appears, then the controls appear when the owner opens a game.
4. Sync: a goal and clock start from each side appear on the other, and on the overlay.
5. Undo on the second operator's tab reverses only their own change.
6. Tabs: only Controls and Deck are shown, `?tab=settings` stays on Controls, and Deck buttons work with no edit button.
7. A reload stays signed in. A stopped and restarted server reconnects without the PIN.
8. Reopening the share sheet hides the PIN. "Create new PIN" signs the second operator out straight away with the session message.
9. "Remove access" signs them out, and a reload shows the PIN screen. Submitting a PIN then shows "This link is no longer active".
10. Viewer links still work and stay read-only throughout.

- [ ] **Step 5: Check local mode**

Run with `LOCAL_MODE=true` and `VITE_LOCAL_MODE=true`, and confirm the share sheet has no "Second operator" section.

- [ ] **Step 6: Report**

Tell the user what passed and quote anything that failed. Use `superpowers:finishing-a-development-branch` to decide how to integrate the work.
