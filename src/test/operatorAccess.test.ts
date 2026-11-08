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
