// @vitest-environment node
import { afterAll, describe, expect, it, beforeAll } from "vitest";
import { mkdir, rm } from "fs/promises";
import path from "path";
import { io as createClient } from "socket.io-client";
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
    const initial = await fetch(`${baseUrl}/api/shortcuts`);
    expect(await initial.json()).toBeNull();

    const save = await fetch(`${baseUrl}/api/shortcuts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ key: " ", action: "toggleClock", description: "Toggle Clock" }]),
    });
    expect(save.ok).toBe(true);
  });

  it("validates and persists PDF layouts", async () => {
    const baseUrl = `http://localhost:${port}`;
    const missing = await fetch(`${baseUrl}/api/pdf-layout`);
    expect(missing.status).toBe(404);

    const invalid = await fetch(`${baseUrl}/api/pdf-layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    expect(invalid.status).toBe(400);

    const layout = { rows: [{ id: "a", x: 1 }] };
    const save = await fetch(`${baseUrl}/api/pdf-layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    expect(save.ok).toBe(true);

    const loaded = await fetch(`${baseUrl}/api/pdf-layout`);
    expect(await loaded.json()).toMatchObject(layout);
  });

  it("updates team defaults", async () => {
    const baseUrl = `http://localhost:${port}`;
    const response = await fetch(`${baseUrl}/api/team-defaults`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeam: { name: "Blades", abbreviation: "BLD", logo: "logo.png", color: "#112233", players: [] },
      }),
    });
    expect(response.ok).toBe(true);

    const readBack = await fetch(`${baseUrl}/api/team-defaults`);
    const data = await readBack.json();
    expect(data.homeTeam.name).toBe("Blades");
    expect(data.homeTeam.abbreviation).toBe("BLD");
  });

  it("manages team presets lifecycle", async () => {
    const baseUrl = `http://localhost:${port}`;
    const invalid = await fetch(`${baseUrl}/api/team-presets`, { method: "POST" });
    expect(invalid.status).toBe(400);

    const create = await fetch(`${baseUrl}/api/team-presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Home vs Away" }),
    });
    expect(create.ok).toBe(true);

    const list = await fetch(`${baseUrl}/api/team-presets`);
    const presets = await list.json();
    expect(presets.some((preset: { name: string }) => preset.name === "Home vs Away")).toBe(true);

    const remove = await fetch(`${baseUrl}/api/team-presets/${encodeURIComponent("Home vs Away")}`, { method: "DELETE" });
    expect(remove.ok).toBe(true);
  });

  it("manages team library lifecycle", async () => {
    const baseUrl = `http://localhost:${port}`;
    const invalid = await fetch(`${baseUrl}/api/teams`, { method: "POST" });
    expect(invalid.status).toBe(400);

    const create = await fetch(`${baseUrl}/api/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ice Wolves" }),
    });
    expect(create.ok).toBe(true);

    const list = await fetch(`${baseUrl}/api/teams`);
    const teams = await list.json();
    expect(teams.some((entry: { name: string }) => entry.name === "Ice Wolves")).toBe(true);

    const remove = await fetch(`${baseUrl}/api/teams/${encodeURIComponent("Ice Wolves")}`, { method: "DELETE" });
    expect(remove.ok).toBe(true);
  });

  it("logs goals when scores increase via socket updates", async () => {
    const baseUrl = `http://localhost:${port}`;
    const client = createClient(baseUrl, { transports: ["websocket"], forceNew: true });

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
});
