// @vitest-environment node
import { afterAll, describe, expect, it, beforeAll, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { io as createClient } from "socket.io-client";
import { createScoreboardServer } from "../../serverApp";

// Mock firebase-admin
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
      if (token === "token-a") return { uid: "user-a" };
      if (token === "token-b") return { uid: "user-b" };
      if (token === "test-token") return { uid: "test-user" };
      if (token === "token-shortcuts") return { uid: "user-shortcuts" };
      if (token === "token-pdf") return { uid: "user-pdf" };
      if (token === "token-streamdeck") return { uid: "user-streamdeck" };
      return { uid: token };
    }),
  })),
}));

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    auth: () => ({
      verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
        if (token === "token-a") return { uid: "user-a" };
        if (token === "token-b") return { uid: "user-b" };
        return { uid: token };
      }),
    }),
  },
}));

describe("server API", () => {
  const dataDir = path.join(process.cwd(), "src/test/.tmp/server-data");
  let server: any;
  let port: number;

  const createShare = async (baseUrl: string, userId: string) => {
    const res = await fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${userId}` },
    });
    const data = await res.json();
    return data.shareId as string;
  };

  beforeAll(async () => {
    await mkdir(dataDir, { recursive: true });
    server = createScoreboardServer(dataDir);
    port = await server.start(0);
  });

  afterAll(async () => {
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("serves static files", async () => {
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<!doctype html>");
  });

  it("handles shortcuts API", async () => {
    const baseUrl = `http://localhost:${port}`;
    const shortcuts = [{ key: "g", action: "homeScoreIncrease", description: "Goal Home" }];
    
    const save = await fetch(`${baseUrl}/api/shortcuts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer token-a"
      },
      body: JSON.stringify(shortcuts),
    });
    expect(save.ok).toBe(true);

    const loaded = await fetch(`${baseUrl}/api/shortcuts`, {
      headers: { "Authorization": "Bearer token-a" }
    });
    expect(await loaded.json()).toEqual(shortcuts);
  });

  it("handles pdf-layout API", async () => {
    const baseUrl = `http://localhost:${port}`;
    const layout = { version: 2, homePeriodGoals: { yFromTop: 100 } };
    
    const save = await fetch(`${baseUrl}/api/pdf-layout`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer token-a"
      },
      body: JSON.stringify(layout),
    });
    expect(save.ok).toBe(true);

    const loaded = await fetch(`${baseUrl}/api/pdf-layout`, {
      headers: { "Authorization": "Bearer token-a" }
    });
    expect(await loaded.json()).toMatchObject(layout);
  });

  it("manages public shares", async () => {
    const baseUrl = `http://localhost:${port}`;
    
    const resCreate = await fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Authorization": "Bearer token-b" }
    });
    const data = await resCreate.json();
    expect(data.shareId).toBeDefined();

    const resLoad = await fetch(`${baseUrl}/api/share/${data.shareId}/state`);
    expect(resLoad.status).toBe(200);
    const state = await resLoad.json();
    expect(state.homeTeam).toBeDefined();

    const resLoadBad = await fetch(`${baseUrl}/api/share/non-existent/state`);
    expect(resLoadBad.status).toBe(404);
  });

  it("enforces authentication on sensitive endpoints", async () => {
    const baseUrl = `http://localhost:${port}`;
    const res = await fetch(`${baseUrl}/api/shortcuts`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("handles viewer state updates (ignoring them if unauthorized)", async () => {
    const baseUrl = `http://localhost:${port}`;
    
    const resCreate = await fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Authorization": "Bearer token-a" }
    });
    const { shareId } = await resCreate.json();

    const client = createClient(baseUrl, { 
      transports: ["websocket"],
      auth: { shareId }
    });

    client.emit("updateGameState", { homeTeam: { score: 99 } as any });
    
    await new Promise(r => setTimeout(r, 200));

    const resFinal = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const finalState = await resFinal.json();
    expect(finalState.homeTeam.score).not.toBe(99);

    client.close();
  });

  it("logs penalties when added via socket updates", async () => {
    const userId = "user-penalty-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));
    const newPenalty = { id: "p1", duration: 120000, timeRemaining: 120000, playerNumber: "99", infraction: "Tripping" };
    client.emit("updateGameState", {
      homeTeam: { penalties: [newPenalty] } as any,
    });
     
    await new Promise(r => setTimeout(r, 200));
    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(state.eventLog.some((e: any) => e.type === "penalty_added")).toBe(true);
    client.close();
  });

  it("logs goal revocation when score decreases", async () => {
    const userId = "user-goal-revoke-test";
    const baseUrl = `http://localhost:${port}`;
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    const resCreate = await fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${userId}` }
    });
    const shareData = await resCreate.json();
    const shareId = shareData.shareId;

    await new Promise(r => client.on("connect", r));
    client.emit("updateGameState", { homeTeam: { score: 1 } as any });
    await new Promise(r => setTimeout(r, 100));
    client.emit("updateGameState", { homeTeam: { score: 0 } as any });
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(state.eventLog.some((e: any) => e.type === "goal_revoked")).toBe(true);
    client.close();
  });

  it("undo removes the event it created instead of logging a revocation", async () => {
    const userId = "user-undo-erase-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));

    client.emit("updateGameState", { homeTeam: { score: 1 } as any });
    await new Promise(r => setTimeout(r, 100));

    const afterGoal = await (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
    expect(afterGoal.homeTeam.score).toBe(1);
    expect(afterGoal.eventLog).toHaveLength(1);
    expect(afterGoal.eventLog[0].type).toBe("goal");
    // Simulate the store's undoLastUpdate: revert the team AND the eventLog together,
    // exactly as if the goal had never happened.
    client.emit("updateGameState", {
      homeTeam: { ...afterGoal.homeTeam, score: 0 },
      eventLog: [],
    } as any);
    await new Promise(r => setTimeout(r, 100));

    const afterUndo = await (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
    expect(afterUndo.homeTeam.score).toBe(0);
    expect(afterUndo.eventLog).toHaveLength(0);
    expect(afterUndo.eventLog.some((e: any) => e.type === "goal_revoked")).toBe(false);

    client.close();
  });

  it("reconciles a clock left running when a saved game / gamesheet is loaded", async () => {
    const userId = "user-load-stale-clock-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));

    // Simulate loading a saved game (or imported gamesheet) whose clock was left
    // running with a stale lastUpdate — e.g. saved a minute ago, only 5s remained.
    const staleClock = { isRunning: true, timeRemaining: 5000, lastUpdate: Date.now() - 60000 };
    client.emit("updateGameState", { clock: staleClock } as any);
    await new Promise(r => setTimeout(r, 150));

    const state = await (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
    // Reconciled immediately against the stale timestamp, not left frozen at
    // isRunning:true forever, nor overshooting negative on some later natural tick.
    expect(state.clock.isRunning).toBe(false);
    expect(state.clock.timeRemaining).toBe(0);
    expect(state.eventLog.some((e: any) => e.type === "period_end")).toBe(true);

    client.close();
  });

  it("handles clock control socket events (set, increase, decrease)", async () => {
    const userId = "user-clock-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));
    client.emit("setClock", 300000); // 5 min
    await new Promise(r => setTimeout(r, 100));
    client.emit("clockIncrease");
    await new Promise(r => setTimeout(r, 100));
    client.emit("clockDecrease");
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(state.clock.timeRemaining).toBe(300000);
    client.close();
  });

  it("returns 401 for unauthenticated requests", async () => {
    const baseUrl = `http://localhost:${port}`;
    const endpoints = [
      "/api/shortcuts",
      "/api/pdf-layout",
      "/api/team-defaults",
      "/api/team-presets",
      "/api/teams",
      "/api/share"
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      expect(res.status).toBe(401);
    }
  });

  it("handles missing user config (falling back to global or null)", async () => {
    const baseUrl = `http://localhost:${port}`;
    const resShortcuts = await fetch(`${baseUrl}/api/shortcuts`, {
      headers: { "Authorization": "Bearer token-new-user" }
    });
    expect(resShortcuts.ok).toBe(true);

    const resStreamDeck = await fetch(`${baseUrl}/api/streamdeck`, {
      headers: { "Authorization": "Bearer token-new-user" }
    });
    expect(resStreamDeck.ok).toBe(true);
  });

  it("logs penalty removal when removed via socket updates", async () => {
    const userId = "user-penalty-remove-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));
    const newPenalty = { id: "p2", duration: 120000, timeRemaining: 120000, playerNumber: "99", infraction: "Tripping" };
    client.emit("updateGameState", { homeTeam: { penalties: [newPenalty] } as any });
    await new Promise(r => setTimeout(r, 100));
    client.emit("updateGameState", { homeTeam: { penalties: [] } as any });
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(
      state.eventLog.some((e: any) => e.type === "penalty_over_notice" && e.penaltyId === "p2" && e.removalReason === "manual"),
    ).toBe(true);
    client.close();
  });

  it("ticks penalties when clock is running and then stopped", async () => {
    const userId = "user-clock-tick-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));
    const newPenalty = { id: "p3", duration: 120000, timeRemaining: 120000, playerNumber: "99", infraction: "Tripping" };
    client.emit("updateGameState", { homeTeam: { penalties: [newPenalty] } as any });
    await new Promise(r => setTimeout(r, 100));
    client.emit("startClock");
    await new Promise(r => setTimeout(r, 200));
    client.emit("stopClock");
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(state.homeTeam.penalties[0].timeRemaining).toBeLessThan(120000);
    client.close();
  });

  it("syncs penalty state when eventLog is updated directly", async () => {
    const userId = "user-eventlog-sync-test";
    const baseUrl = `http://localhost:${port}`;
    const shareId = await createShare(baseUrl, userId);
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: userId }
    });

    await new Promise(r => client.on("connect", r));
    const penaltyEvent = {
      id: "e1",
      type: "penalty_added",
      team: "home",
      penaltyId: "p4",
      penaltyDurationMs: 120000,
      playerNumber: "99",
      infraction: "Tripping",
      timestamp: Date.now(),
      period: "1st",
      gameTime: "20:00"
    };
    client.emit("updateGameState", { eventLog: [penaltyEvent] });
    await new Promise(r => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const state = await res.json();
    expect(state.homeTeam.penalties.some((p: any) => p.id === "p4")).toBe(true);
    client.close();
  });

  it("survives a malformed updateGameState payload without crashing or affecting other users", async () => {
    // homeTeam.penalties as a non-array (or an array containing null) used to crash
    // the whole process synchronously — every connected user, not just this socket —
    // because nothing caught the throw from code that assumes penalties is always an
    // array of objects (e.g. `penalty.id`, `.forEach`, `.map`). Socket.IO dispatches
    // event listeners synchronously from within its own internal event handling, so
    // a throw there becomes a process-level uncaughtException, not something await-ing
    // the emit() call would ever see — listen for it directly rather than relying on
    // requests-after-the-fact to notice the process died.
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => uncaught.push(error);
    process.on("uncaughtException", onUncaught);

    try {
      const baseUrl = `http://localhost:${port}`;
      const attackerId = "user-malformed-payload-test";
      const victimId = "user-unaffected-bystander-test";

      const attacker = createClient(baseUrl, { transports: ["websocket"], forceNew: true, auth: { token: attackerId } });
      const victim = createClient(baseUrl, { transports: ["websocket"], forceNew: true, auth: { token: victimId } });
      await Promise.all([new Promise((r) => attacker.on("connect", r)), new Promise((r) => victim.on("connect", r))]);

      attacker.emit("updateGameState", { homeTeam: { penalties: "not-an-array" } } as any);
      attacker.emit("updateGameState", { homeTeam: { penalties: [null] } } as any);
      victim.emit("updateGameState", { homeTeam: { score: 1 } } as any);
      await new Promise((r) => setTimeout(r, 200));

      expect(uncaught).toEqual([]);

      // The server process (and this victim's own session) must still be alive and
      // responsive — a crash would make every request below hang/fail.
      const health = await fetch(`${baseUrl}/api/health`);
      expect(health.ok).toBe(true);

      const victimShareId = await createShare(baseUrl, victimId);
      const victimState = await (await fetch(`${baseUrl}/api/share/${victimShareId}/state`)).json();
      expect(victimState.homeTeam.score).toBe(1);

      attacker.close();
      victim.close();
    } finally {
      process.off("uncaughtException", onUncaught);
    }
  });

  it("persists and reads streamdeck config", async () => {
    const baseUrl = `http://localhost:${port}`;
    const config = { buttons: [{ id: "1", action: "test" }] };
    
    await fetch(`${baseUrl}/api/streamdeck`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify(config),
    });

    const res = await fetch(`${baseUrl}/api/streamdeck`, {
      headers: { "Authorization": "Bearer test-token" }
    });
    expect(await res.json()).toMatchObject(config);
  });
});
