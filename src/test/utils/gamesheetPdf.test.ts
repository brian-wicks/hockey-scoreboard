import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { GameEvent } from "../../store";
import { buildGamesheetPdfBytes, getDefaultGamesheetPdfLayout, getGoalMismatches, getPeriodTotals } from "../../utils/gamesheetPdf";

// Mock pdf-lib
vi.mock("pdf-lib", () => {
  const mockPage = {
    drawText: vi.fn(),
    getHeight: vi.fn().mockReturnValue(842), // A4 height
    getWidth: vi.fn().mockReturnValue(595), // A4 width
    getSize: vi.fn().mockReturnValue({ width: 595, height: 842 }),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    drawRectangle: vi.fn(),
    drawImage: vi.fn(),
    drawLine: vi.fn(),
    drawCircle: vi.fn(),
  };
  const mockDoc = {
    getPages: vi.fn().mockReturnValue([mockPage]),
    getPage: vi.fn().mockReturnValue(mockPage),
    save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    embedFont: vi.fn().mockResolvedValue({}),
    embedPng: vi.fn().mockResolvedValue({}),
    embedJpg: vi.fn().mockResolvedValue({}),
  };
  return {
    PDFDocument: {
      load: vi.fn().mockResolvedValue(mockDoc),
    },
    rgb: vi.fn(),
    StandardFonts: {
      Helvetica: "Helvetica",
      HelveticaBold: "Helvetica-Bold",
    },
  };
});

describe("Gamesheet PDF Utility", () => {
  const mockGameState = {
    homeTeam: { name: "Home", abbreviation: "HOM", score: 2, shots: 5, penalties: [], players: [] },
    awayTeam: { name: "Away", abbreviation: "AWY", score: 1, shots: 7, penalties: [], players: [] },
    eventLog: [
      { id: "1", type: "goal", team: "home", period: "1st", clockTime: "10:00", scorer: "10", assist1: "11", createdAt: Date.now() },
      { id: "2", type: "penalty_added", team: "away", period: "2nd", clockTime: "05:00", playerNumber: "22", infraction: "Tripping", penaltyDurationMs: 120000, createdAt: Date.now() },
      { id: "3", type: "shot_on_goal", team: "home", period: "1st", clockTime: "15:00", shotDelta: 1 },
      { id: "4", type: "shot_on_goal", team: "away", period: "1st", clockTime: "14:00", shotDelta: 1 },
      { id: "5", type: "penalty_added", team: "home", period: "1st", clockTime: "10:00", playerNumber: "55", infraction: "Hooking", penaltyDurationMs: 120000 },
      { id: "6", type: "penalty_closed", team: "home", penaltyId: "p55", reason: "goal" },
      { id: "7", type: "goal", team: "away", period: "OT", clockTime: "01:00", scorer: "99" },
    ],
    period: "OT",
  } as any;

  it("returns default layout", () => {
    const layout = getDefaultGamesheetPdfLayout();
    expect(layout).toBeDefined();
    expect(layout.version).toBe(2);
  });

  it("default layout matches the tuned gamesheet-layout.json", () => {
    const tuned = JSON.parse(readFileSync(`${process.cwd()}/gamesheet-layout.json`, "utf-8"));
    expect(getDefaultGamesheetPdfLayout()).toEqual(tuned);
  });

  it("builds PDF bytes", async () => {
    // Mock fetch for the template
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    
    const result = await buildGamesheetPdfBytes(
      {
        homeTeam: mockGameState.homeTeam,
        awayTeam: mockGameState.awayTeam,
        eventLog: mockGameState.eventLog,
      },
      { layout }
    );

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
  });

  it("handles empty event log and teams", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    const result = await buildGamesheetPdfBytes(
      {
        homeTeam: { name: "", abbreviation: "", score: 0, shots: 0, timeouts: 0, logo: "", color: "", penalties: [], players: [] },
        awayTeam: { name: "", abbreviation: "", score: 0, shots: 0, timeouts: 0, logo: "", color: "", penalties: [], players: [] },
        eventLog: [],
      },
      { layout }
    );
    expect(result).toBeDefined();
  });

  it("handles goal revoked events", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    const result = await buildGamesheetPdfBytes(
      {
        ...mockGameState,
        eventLog: [
          ...mockGameState.eventLog,
          { id: "3", type: "goal", team: "home", period: "1st", clockTime: "05:00", scorer: "10" },
          { id: "4", type: "goal_revoked", team: "home", period: "1st", clockTime: "04:50", scorer: "10" },
        ]
      },
      { layout }
    );
    expect(result).toBeDefined();
  });

  it("handles many players and events exceeding maxLines", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const manyPlayers = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      jerseyNumber: String(i),
      name: `Player ${i}`,
      position: "F"
    }));

    const manyEvents = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      type: "goal",
      team: "home",
      period: "1st",
      clockTime: "10:00",
      scorer: "1"
    })) as any[];

    const layout = getDefaultGamesheetPdfLayout();
    const result = await buildGamesheetPdfBytes(
      {
        homeTeam: { ...mockGameState.homeTeam, players: manyPlayers },
        awayTeam: { ...mockGameState.awayTeam, players: manyPlayers },
        eventLog: manyEvents,
      },
      { layout }
    );
    expect(result).toBeDefined();
  });

  it("handles legacy layout (v1)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    delete layout.version; // Make it v1
    
    const result = await buildGamesheetPdfBytes(mockGameState, { layout });
    expect(result).toBeDefined();
  });

  it("handles debug mode", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    const result = await buildGamesheetPdfBytes(mockGameState, { layout, debug: true } as any);
    expect(result).toBeDefined();
  });

  describe("getPeriodTotals with revoked goals", () => {
    const goal = (id: string, period: string, clockTime: string, scorer = "", createdAt = Number(id)) =>
      ({ id, type: "goal", team: "home", period, clockTime, scorer, createdAt }) as GameEvent;
    // The server stamps a revoke with the clock when it happened and the latest goal's details.
    const revoke = (id: string, period: string, clockTime: string, scorer = "", createdAt = Number(id)) =>
      ({ id, type: "goal_revoked", team: "home", period, clockTime, scorer, assist1: "", assist2: "", createdAt }) as GameEvent;
    const homeGoals = (eventLog: GameEvent[]) => getPeriodTotals(eventLog).home.goals;

    it("cancels a goal revoked with the clock stopped", () => {
      expect(homeGoals([goal("1", "1st", "15:00"), revoke("2", "1st", "15:00")])).toMatchObject({ "1": 0, total: 0 });
    });

    it("cancels a goal revoked after the clock has moved", () => {
      expect(homeGoals([goal("1", "1st", "15:00"), revoke("2", "1st", "14:30")])).toMatchObject({ "1": 0, total: 0 });
    });

    it("takes the goal off its own period when revoked in a later one", () => {
      const totals = homeGoals([goal("1", "1st", "15:00"), goal("2", "2nd", "18:00"), revoke("3", "2nd", "17:00", "")]);
      expect(totals).toMatchObject({ "1": 1, "2": 0, total: 1 });
      expect(homeGoals([goal("1", "1st", "02:00"), revoke("2", "2nd", "19:00")])).toMatchObject({ "1": 0, "2": 0, total: 0 });
    });

    it("cancels a goal given a scorer after it was logged", () => {
      expect(homeGoals([goal("1", "1st", "15:00", "10"), revoke("2", "1st", "14:30", "")])).toMatchObject({ total: 0 });
    });

    it("works back through goals when revoking twice", () => {
      const log = [goal("1", "1st", "15:00", "10"), goal("2", "2nd", "15:00", "11"), revoke("3", "2nd", "14:00", "11"), revoke("4", "2nd", "13:00", "11")];
      expect(homeGoals(log)).toMatchObject({ "1": 0, "2": 0, total: 0 });
    });

    it("counts a goal scored after a revoke", () => {
      const log = [goal("1", "1st", "15:00"), revoke("2", "1st", "14:30"), goal("3", "1st", "10:00")];
      expect(homeGoals(log)).toMatchObject({ "1": 1, total: 1 });
    });

    it("prefers an earlier goal whose details match the revoke exactly", () => {
      const log = [goal("1", "1st", "15:00", "10"), goal("2", "2nd", "15:00", "11"), revoke("3", "1st", "15:00", "10")];
      expect(homeGoals(log)).toMatchObject({ "1": 0, "2": 1, total: 1 });
    });

    it("leaves the other team's goals alone", () => {
      const away = { ...goal("1", "1st", "15:00"), team: "away" } as GameEvent;
      const totals = getPeriodTotals([away, revoke("2", "1st", "14:30")]);
      expect(totals.away.goals.total).toBe(1);
      expect(totals.home.goals.total).toBe(0);
    });
  });

  describe("getGoalMismatches", () => {
    const goal = (id: string, period = "1st") => ({ id, type: "goal", team: "home", period, clockTime: "15:00", createdAt: Number(id) }) as GameEvent;
    const input = (score: number, eventLog: GameEvent[]) => ({
      homeTeam: { name: "Home", score } as any,
      awayTeam: { name: "Away", score: 0 } as any,
      eventLog,
    });

    it("finds nothing when the sheet and score agree", () => {
      expect(getGoalMismatches(input(2, [goal("1"), goal("2")]))).toEqual([]);
    });

    it("names a team with fewer goals on the sheet than the score", () => {
      expect(getGoalMismatches(input(2, [goal("1")]))).toEqual([{ name: "Home", score: 2, sheetGoals: 1 }]);
    });

    it("counts revoked goals as gone", () => {
      const revoke = { id: "2", type: "goal_revoked", team: "home", period: "1st", clockTime: "14:00", createdAt: 2 } as GameEvent;
      expect(getGoalMismatches(input(0, [goal("1"), revoke]))).toEqual([]);
    });

    it("catches a goal the sheet can't place because of a mistyped period", () => {
      expect(getGoalMismatches(input(1, [goal("1", "oops")]))).toEqual([{ name: "Home", score: 1, sheetGoals: 0 }]);
    });
  });
});
