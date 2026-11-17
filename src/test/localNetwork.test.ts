// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { createServer as createNetServer } from "net";
import { request as httpRequest } from "http";
import { tmpdir } from "os";
import path from "path";
import { io as createClient, type Socket } from "socket.io-client";
import { lanAddresses } from "../server/localNetwork";

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn().mockRejectedValue(new Error("offline")) })),
}));

// A device on the network is simulated by connecting to the network listener. Its address is
// then 127.0.0.1 too, which is the point: arriving through that listener is what keeps a
// connection from acting as the owner, whatever address it comes from.
describe("network access in the desktop app", () => {
  let dataDir: string;
  let server: { start: (port: number) => Promise<number>; stop: () => Promise<void> };
  let base: string;
  const openSockets: Socket[] = [];
  const previousDataDir = process.env.SCOREBOARD_DATA_DIR;

  const startServer = async (lanPort = 0) => {
    vi.resetModules();
    const { createScoreboardServer } = await import("../../serverApp");
    server = createScoreboardServer({ dataDir, lanPort });
    base = `http://localhost:${await server.start(0)}`;
  };

  beforeEach(async () => {
    process.env.LOCAL_MODE = "true";
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-lan-"));
    // The database module reads this when it loads, so the saved setting stays in this test's folder.
    process.env.SCOREBOARD_DATA_DIR = dataDir;
    await startServer();
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
    delete process.env.LOCAL_MODE;
    if (previousDataDir === undefined) delete process.env.SCOREBOARD_DATA_DIR;
    else process.env.SCOREBOARD_DATA_DIR = previousDataDir;
  });

  const setNetwork = async (enabled: boolean) => {
    const res = await fetch(`${base}/api/local-network`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    expect(res.status).toBe(200);
    return res.json() as Promise<{ enabled: boolean; port: number | null; urls: string[] }>;
  };

  const turnOn = async () => `http://127.0.0.1:${(await setNetwork(true)).port}`;

  const connect = (url: string, auth: Record<string, unknown>) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = createClient(url, { auth, transports: ["websocket"], reconnection: false });
      openSockets.push(socket);
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });

  const createShare = async () => (await (await fetch(`${base}/api/share`, { method: "POST" })).json()).shareId as string;

  it("is off until turned on", async () => {
    const res = await fetch(`${base}/api/local-network`);
    expect(await res.json()).toEqual({ enabled: false, port: null, urls: [] });
  });

  it("listens on the network once turned on, and lists this computer's addresses", async () => {
    const status = await setNetwork(true);
    expect(status.enabled).toBe(true);
    expect(status.port).toEqual(expect.any(Number));
    expect(status.urls).toEqual(lanAddresses().map((address) => `http://${address}:${status.port}`));

    const lan = `http://127.0.0.1:${status.port}`;
    expect((await fetch(`${lan}/api/health`)).status).toBe(200);
  });

  describe("a device on the network", () => {
    it("can't use the owner's routes", async () => {
      const lan = await turnOn();
      expect((await fetch(`${lan}/api/shortcuts`)).status).toBe(401);
      expect((await fetch(`${lan}/api/local-network`)).status).toBe(401);
      expect((await fetch(`${lan}/api/share`, { method: "POST" })).status).toBe(401);
      expect((await fetch(`${lan}/api/local-upload`, { method: "POST", headers: { "Content-Type": "image/png" }, body: "x" })).status).toBe(401);
      // The same request on this computer is the owner's.
      expect((await fetch(`${base}/api/shortcuts`)).status).toBe(200);
    });

    it("can't open the owner's connection", async () => {
      const lan = await turnOn();
      await expect(connect(lan, { token: "local-mode" })).rejects.toThrow(
        "Authentication error: Only the computer running the app can open the control panel",
      );
    });

    it("can open a share link", async () => {
      const lan = await turnOn();
      const shareId = await createShare();

      const viewer = createClient(lan, { auth: { shareId }, transports: ["websocket"], reconnection: false });
      openSockets.push(viewer);
      const state = await new Promise<any>((resolve) => viewer.once("gameState", resolve));

      expect(state.clock).toBeDefined();
      expect((await fetch(`${lan}/api/share/${shareId}/state`)).status).toBe(200);
    });

    it("can run the game as a second operator with the link and PIN", async () => {
      const lan = await turnOn();
      const owner = await connect(base, { token: "local-mode" });
      await new Promise((resolve) => owner.emit("startNewGame", undefined, resolve));
      const { operatorId, pin } = await (await fetch(`${base}/api/operator-access`, { method: "POST" })).json();

      const session = await fetch(`${lan}/api/operator/${operatorId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      expect(session.status).toBe(200);
      const operator = await connect(lan, { operatorId, operatorToken: (await session.json()).token });
      const patched = new Promise<any>((resolve) => owner.on("gameState", (state) => state.homeTeam.score === 1 && resolve(state)));
      operator.emit("applyGamePatch", { opId: "lan-goal", home: { scoreDelta: 1 } });

      expect((await patched).homeTeam.score).toBe(1);
    });

    it("is cut off when network access is turned off", async () => {
      const lan = await turnOn();
      const shareId = await createShare();
      const viewer = await connect(lan, { shareId });
      const disconnected = new Promise((resolve) => viewer.once("disconnect", resolve));

      await setNetwork(false);

      await disconnected;
      await expect(fetch(`${lan}/api/health`)).rejects.toThrow();
    });
  });

  it("keeps second operator access off while network access is off", async () => {
    expect((await fetch(`${base}/api/operator-access`)).status).toBe(404);
    await turnOn();
    expect((await fetch(`${base}/api/operator-access`)).status).toBe(200);
    await setNetwork(false);
    expect((await fetch(`${base}/api/operator-access`)).status).toBe(404);
  });

  it("refuses the owner's routes to a page using another name for this computer", async () => {
    // A web page can point its own domain at 127.0.0.1 and then send requests from this
    // computer's browser. Its Host header still names that domain.
    const port = new URL(base).port;
    const status = await new Promise<number>((resolve) => {
      httpRequest({ host: "127.0.0.1", port, path: "/api/shortcuts", headers: { Host: `attacker.example:${port}` } }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      }).end();
    });
    expect(status).toBe(401);
  });

  it("only allows a page on the network to call the API from its own address", async () => {
    const lan = await turnOn();
    const host = new URL(lan).host;
    const fromOwnPage = await fetch(`${lan}/api/health`, { headers: { Origin: `http://${host}` } });
    const fromElsewhere = await fetch(`${lan}/api/diagnostics/connection`, {
      method: "POST",
      headers: { Origin: "http://attacker.example", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(fromOwnPage.status).toBe(200);
    expect(fromElsewhere.status).toBe(403);
  });

  it("lets a device on the network load the app over plain HTTP", async () => {
    const lan = await turnOn();
    const res = await fetch(`${lan}/`);

    // Asking the browser to switch to HTTPS would leave the tablet with a blank page.
    expect(res.headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });

  it("rate limits a device on the network by its real address, whatever it claims", async () => {
    const lan = await turnOn();
    const statuses: number[] = [];
    // The report endpoint allows 120 requests in 15 minutes from one address.
    for (let i = 0; i < 121; i++) {
      const res = await fetch(`${lan}/api/diagnostics/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.9.${Math.floor(i / 250)}.${i % 250}` },
        body: "{}",
      });
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("uses another port when the usual one is taken", async () => {
    const blocker = createNetServer();
    await new Promise<void>((resolve) => blocker.listen(0, "0.0.0.0", resolve));
    const taken = (blocker.address() as { port: number }).port;
    await server.stop();
    await startServer(taken);

    try {
      const status = await setNetwork(true);
      expect(status.port).not.toBe(taken);
      expect((await fetch(`http://127.0.0.1:${status.port}/api/health`)).status).toBe(200);
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });

  it("stays on after the app restarts", async () => {
    await turnOn();
    await server.stop();

    await startServer();

    const status = await (await fetch(`${base}/api/local-network`)).json();
    expect(status.enabled).toBe(true);
  });
});

describe("this computer's network addresses", () => {
  it("lists IPv4 addresses on real networks, the usual home and venue ranges first", () => {
    const entry = (address: string, internal = false, family = "IPv4") => ({ address, internal, family }) as any;
    expect(
      lanAddresses({
        lo0: [entry("127.0.0.1", true)],
        en5: [entry("169.254.10.2")],
        en0: [entry("fe80::1", false, "IPv6"), entry("10.0.0.4")],
        en1: [entry("192.168.1.20")],
      }),
    ).toEqual(["192.168.1.20", "10.0.0.4", "169.254.10.2"]);
  });
});
