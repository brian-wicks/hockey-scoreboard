// @vitest-environment node
import { afterAll, describe, expect, it, beforeAll, vi } from "vitest";
import { mkdir, rm } from "fs/promises";
import path from "path";
import { io as createClient } from "socket.io-client";

// Mock firebase-admin
vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    auth: () => ({
      verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
        if (token === "token-a") return { uid: "user-a" };
        if (token === "token-b") return { uid: "user-b" };
        return { uid: "test-user-id" };
      }),
    }),
  },
}));

import { createScoreboardServer } from "@/serverApp.ts";

const originalFetch = globalThis.fetch;
let dataDir: string;
let server: ReturnType<typeof createScoreboardServer>;
let port: number;

describe("server API", () => {
  beforeAll(async () => {
    dataDir = path.join(process.cwd(), "src", "test", ".tmp", `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await mkdir(dataDir, { recursive: true });
    server = createScoreboardServer({ dataDir });
    port = await server.start(0);
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("handles shortcuts persistence", async () => {
    const baseUrl = `http://localhost:${port}`;
    
    // User A saves shortcuts
    const shortcutsA = [{ key: "A", action: "toggleClock", description: "User A" }];
    await fetch(`${baseUrl}/api/shortcuts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer token-a"
      },
      body: JSON.stringify(shortcutsA),
    });

    // User B saves different shortcuts
    const shortcutsB = [{ key: "B", action: "toggleClock", description: "User B" }];
    await fetch(`${baseUrl}/api/shortcuts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer token-b"
      },
      body: JSON.stringify(shortcutsB),
    });

    // Verify User A sees User A's shortcuts
    const resA = await fetch(`${baseUrl}/api/shortcuts`, {
      headers: { "Authorization": "Bearer token-a" }
    });
    expect(await resA.json()).toMatchObject(shortcutsA);

    // Verify User B sees User B's shortcuts
    const resB = await fetch(`${baseUrl}/api/shortcuts`, {
      headers: { "Authorization": "Bearer token-b" }
    });
    expect(await resB.json()).toMatchObject(shortcutsB);
  });

  it("validates and persists PDF layouts", async () => {
    const baseUrl = `http://localhost:${port}`;

    const layout = { rows: [{ id: "a", x: 1 }] };
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

  it("updates team defaults", async () => {
    const baseUrl = `http://localhost:${port}`;
    const response = await fetch(`${baseUrl}/api/team-defaults`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify({
        homeTeam: { name: "Blades", abbreviation: "BLD", logo: "logo.png", color: "#112233", players: [] },
      }),
    });
    expect(response.ok).toBe(true);

    const readBack = await fetch(`${baseUrl}/api/team-defaults`, {
      headers: { "Authorization": "Bearer test-token" }
    });
    const data = await readBack.json();
    expect(data.homeTeam.name).toBe("Blades");
    expect(data.homeTeam.abbreviation).toBe("BLD");
  });

  it("manages team presets lifecycle", async () => {
    const baseUrl = `http://localhost:${port}`;
    const invalid = await fetch(`${baseUrl}/api/team-presets`, { 
      method: "POST",
      headers: { "Authorization": "Bearer test-token" }
    });
    expect(invalid.status).toBe(400);

    const create = await fetch(`${baseUrl}/api/team-presets`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify({ name: "Home vs Away" }),
    });
    expect(create.ok).toBe(true);

    const list = await fetch(`${baseUrl}/api/team-presets`, {
      headers: { "Authorization": "Bearer test-token" }
    });
    const presets = await list.json();
    expect(presets.some((preset: { name: string }) => preset.name === "Home vs Away")).toBe(true);

    const remove = await fetch(`${baseUrl}/api/team-presets/${encodeURIComponent("Home vs Away")}`, { 
      method: "DELETE",
      headers: { "Authorization": "Bearer test-token" }
    });
    expect(remove.ok).toBe(true);
  });

  it("manages team library lifecycle", async () => {
    const baseUrl = `http://localhost:${port}`;
    const invalid = await fetch(`${baseUrl}/api/teams`, { 
      method: "POST",
      headers: { "Authorization": "Bearer test-token" }
    });
    expect(invalid.status).toBe(400);

    const create = await fetch(`${baseUrl}/api/teams`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify({ name: "Ice Wolves" }),
    });
    expect(create.ok).toBe(true);

    const list = await fetch(`${baseUrl}/api/teams`, {
      headers: { "Authorization": "Bearer test-token" }
    });
    const teams = await list.json();
    expect(teams.some((entry: { name: string }) => entry.name === "Ice Wolves")).toBe(true);

    const remove = await fetch(`${baseUrl}/api/teams/${encodeURIComponent("Ice Wolves")}`, { 
      method: "DELETE",
      headers: { "Authorization": "Bearer test-token" }
    });
    expect(remove.ok).toBe(true);
  });

  it("logs goals when scores increase via socket updates", async () => {
    const baseUrl = `http://localhost:${port}`;
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: "test-token" }
    });

    const states: any[] = [];
    await new Promise<void>((resolve) => {
      client.on("gameState", (state) => {
        states.push(state);
        if (states.length === 1) {
          client.emit("updateGameState", {
            homeTeam: { ...state.homeTeam, score: state.homeTeam.score + 1 },
          });
        } else {
          resolve();
        }
      });
    });

    const latest = states[states.length - 1];
    expect(latest.eventLog.some((event: { type: string; team: string }) => event.type === "goal" && event.team === "home")).toBe(true);
    client.close();
  });

  it("handles clock control via socket", async () => {
    const baseUrl = `http://localhost:${port}`;
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { token: "test-token" }
    });

    await new Promise<void>((resolve) => {
      client.on("gameState", (state) => {
        if (!state.clock.isRunning) {
          client.emit("startClock");
        } else {
          resolve();
        }
      });
    });

    // Wait a bit for clock to tick
    await new Promise(resolve => setTimeout(resolve, 300));

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.off("gameState", checkState);
        reject(new Error("Timeout waiting for clock to stop"));
      }, 2000);

      const checkState = (state: any) => {
        if (!state.clock.isRunning) {
          clearTimeout(timeout);
          client.off("gameState", checkState);
          expect(state.clock.timeRemaining).toBeLessThan(20 * 60 * 1000);
          resolve();
        }
      };

      client.on("gameState", checkState);
      client.emit("stopClock");
    });

    client.close();
  });

  it("manages public shares", async () => {
    const baseUrl = `http://localhost:${port}`;
    
    // Generate share
    const resCreate = await fetch(`${baseUrl}/api/share`, {
      method: "POST",
      headers: { "Authorization": "Bearer test-token" }
    });
    const { shareId } = await resCreate.json();
    expect(shareId).toBeDefined();

    // Read share ID
    const resRead = await fetch(`${baseUrl}/api/share`, {
      headers: { "Authorization": "Bearer test-token" }
    });
    expect((await resRead.json()).shareId).toBe(shareId);

    // Read state via share ID (unauthenticated)
    const resState = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    expect(resState.ok).toBe(true);
    const state = await resState.json();
    expect(state.homeTeam).toBeDefined();

    // Connect via socket as viewer
    const client = createClient(baseUrl, { 
      transports: ["websocket"], 
      forceNew: true,
      auth: { shareId }
    });

    await new Promise<void>((resolve) => {
      client.on("gameState", (state) => {
        expect(state.homeTeam).toBeDefined();
        resolve();
      });
    });

    // Attempt unauthorized update
    client.emit("updateGameState", { homeTeam: { score: 99 } } as any);
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify update was ignored
    const resFinal = await fetch(`${baseUrl}/api/share/${shareId}/state`);
    const finalState = await resFinal.json();
    expect(finalState.homeTeam.score).not.toBe(99);

    client.close();
  });
});
