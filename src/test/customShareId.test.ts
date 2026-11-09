// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { io as createClient } from "socket.io-client";
import { createScoreboardServer } from "../../serverApp";

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(async (token: string) => ({ uid: token })) })),
}));

describe("custom share IDs", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-share-"));
    server = createScoreboardServer({ dataDir });
    baseUrl = `http://127.0.0.1:${await server.start(0)}`;
  });

  afterAll(async () => {
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const uniqueName = () => `team-${randomUUID().slice(0, 12)}`;
  const uniqueUser = () => `share-user-${randomUUID()}`;

  const claim = (userId: string, shareId?: unknown) =>
    fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userId}` },
      body: shareId === undefined ? undefined : JSON.stringify({ shareId }),
    });
  const stateStatus = async (shareId: string) => (await fetch(`${baseUrl}/api/share/${shareId}/state`)).status;

  it("still gives a random ID when no name is asked for", async () => {
    const res = await claim(uniqueUser());
    expect((await res.json()).shareId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses the chosen name, and viewers can reach the game with it", async () => {
    const name = uniqueName();
    const res = await claim(uniqueUser(), name);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shareId: name });
    expect(await stateStatus(name)).toBe(200);
  });

  it("lets a viewer connect with the name, read-only", async () => {
    const name = uniqueName();
    await claim(uniqueUser(), name);
    const viewer = createClient(baseUrl, { auth: { shareId: name }, transports: ["websocket"], reconnection: false });
    await new Promise<void>((resolve, reject) => {
      viewer.once("connect", () => resolve());
      viewer.once("connect_error", reject);
    });
    const result = await new Promise((resolve) => viewer.emit("applyGamePatch", { opId: "v", home: { scoreDelta: 1 } }, resolve));
    viewer.close();
    expect(result).toEqual({ ok: false });
  });

  it("lowercases the name", async () => {
    const name = uniqueName();
    const res = await claim(uniqueUser(), `  ${name.toUpperCase()} `);
    expect((await res.json()).shareId).toBe(name);
  });

  it("rejects a badly formed name, leaving the current link working", async () => {
    const userId = uniqueUser();
    const name = uniqueName();
    await claim(userId, name);
    for (const bad of ["abc", "has space", "a/b/c/d", 1234, "", null]) {
      expect((await claim(userId, bad)).status).toBe(400);
    }
    expect(await stateStatus(name)).toBe(200);
  });

  it("refuses a name another account has, without touching either link", async () => {
    const name = uniqueName();
    const ownerName = uniqueName();
    const owner = uniqueUser();
    const other = uniqueUser();
    await claim(owner, name);
    await claim(other, ownerName);

    const res = await claim(other, name);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("That name is already taken");

    expect(await (await fetch(`${baseUrl}/api/share`, { headers: { Authorization: `Bearer ${owner}` } })).json()).toEqual({ shareId: name });
    expect(await stateStatus(ownerName)).toBe(200);
  });

  it("gives a name to only one of two accounts asking at once", async () => {
    const name = uniqueName();
    const results = await Promise.all([claim(uniqueUser(), name), claim(uniqueUser(), name)]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
  });

  it("is fine with an account asking for the name it already has", async () => {
    const userId = uniqueUser();
    const name = uniqueName();
    await claim(userId, name);
    expect((await claim(userId, name)).status).toBe(200);
    expect(await stateStatus(name)).toBe(200);
  });

  it("stops the old link working when the name changes", async () => {
    const userId = uniqueUser();
    const first = uniqueName();
    const second = uniqueName();
    await claim(userId, first);
    await claim(userId, second);
    expect(await stateStatus(first)).toBe(404);
    expect(await stateStatus(second)).toBe(200);
  });
});
