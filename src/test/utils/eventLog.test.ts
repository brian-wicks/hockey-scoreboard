import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoalieChangeEvent, buildPeriodEndEvent, buildShotEvent } from "../../utils/eventLog";
import type { GameState } from "../../store";

const baseState: GameState = {
  homeTeam: {
    name: "Home",
    abbreviation: "HOM",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [],
  },
  awayTeam: {
    name: "Away",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  },
  clock: {
    timeRemaining: 90500,
    isRunning: false,
    lastUpdate: 0,
  },
  period: "2nd",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  overlayCorner: "top-left",
  jumbotronGradientsEnabled: true,
  jumbotronGoalHighlight: null,
};

describe("event log utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("builds shot events with correct delta and clock time", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const event = buildShotEvent(baseState, "home", 1);
    expect(event.type).toBe("shot_on_goal");
    expect(event.team).toBe("home");
    expect(event.shotDelta).toBe(1);
    expect(event.clockTime).toBe("1:30");
  });

  it("builds goalie change events", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const event = buildGoalieChangeEvent(baseState, "away", "Jordan");
    expect(event.type).toBe("goalie_change");
    expect(event.goalie).toBe("Jordan");
  });

  it("builds period end events with read-only metadata", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const event = buildPeriodEndEvent(baseState, "3rd");
    expect(event.type).toBe("period_end");
    expect(event.readOnly).toBe(true);
    expect(event.note).toBe("End of period");
    expect(event.clockTime).toBe("0:00");
  });
});
