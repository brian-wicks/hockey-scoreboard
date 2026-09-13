import { describe, expect, it } from "vitest";
import { getSampleGamesheetInput } from "../../utils/gamesheetSampleData";
import { buildGoalieStats } from "../../utils/gamesheetPdf";

describe("gamesheet sample data", () => {
  it("fills both rosters so no roster region renders empty", () => {
    const { homeTeam, awayTeam } = getSampleGamesheetInput();
    expect(homeTeam.players.length).toBeGreaterThan(10);
    expect(awayTeam.players.length).toBeGreaterThan(10);
    for (const player of [...homeTeam.players, ...awayTeam.players]) {
      expect(player.jerseyNumber).not.toBe("");
      expect(player.name).not.toBe("");
    }
  });

  it("fills the goalie block with time on ice and shots against", () => {
    // The sheet's "NM" block is the netminder record, driven by goalie_change
    // and opposing shot_on_goal events rather than by roster position alone —
    // a roster with NM players but no events renders the rows empty.
    const { homeTeam, awayTeam, eventLog } = getSampleGamesheetInput();

    for (const [team, roster] of [["home", homeTeam], ["away", awayTeam]] as const) {
      const stats = buildGoalieStats(eventLog, roster.players, team);
      expect(stats.length, `${team} goalies`).toBeGreaterThanOrEqual(2);
      for (const goalie of stats) {
        expect(goalie.label, `${team} goalie label`).toBeTruthy();
        expect(goalie.timeOn, `${team} goalie time on`).toBeGreaterThan(0);
      }
      // Shots against should land in more than one period, not pile into one cell.
      const periodsWithShots = ["1", "2", "3", "OT"].filter((p) =>
        stats.some((g) => g.shots[p as "1" | "2" | "3" | "OT"] > 0),
      );
      expect(periodsWithShots.length, `${team} periods with shots`).toBeGreaterThan(1);
    }
  });

  it("covers every period for both teams, including overtime", () => {
    const { eventLog } = getSampleGamesheetInput();
    for (const period of ["1", "2", "3", "OT"]) {
      expect(eventLog.some((e) => e.period === period), `period ${period}`).toBe(true);
    }
    expect(eventLog.some((e) => e.type === "goal" && e.team === "home")).toBe(true);
    expect(eventLog.some((e) => e.type === "goal" && e.team === "away")).toBe(true);
    expect(eventLog.some((e) => e.type === "penalty_added" && e.team === "home")).toBe(true);
    expect(eventLog.some((e) => e.type === "penalty_added" && e.team === "away")).toBe(true);
  });

  it("keeps team scores consistent with the goals in the event log", () => {
    const { homeTeam, awayTeam, eventLog } = getSampleGamesheetInput();
    const goals = (team: "home" | "away") =>
      eventLog.filter((e) => e.type === "goal" && e.team === team).length;
    expect(homeTeam.score).toBe(goals("home"));
    expect(awayTeam.score).toBe(goals("away"));
  });

  it("keeps each team's shot total equal to the shots its opponent faced", () => {
    const { homeTeam, awayTeam, eventLog } = getSampleGamesheetInput();
    const logged = (team: "home" | "away") =>
      eventLog
        .filter((e) => e.type === "shot_on_goal" && e.team === team)
        .reduce((sum, e) => sum + (e.shotDelta ?? 1), 0);
    expect(homeTeam.shots).toBe(logged("home"));
    expect(awayTeam.shots).toBe(logged("away"));
    expect(homeTeam.shots).toBeGreaterThan(0);
  });

  it("gives penalties a duration so PIM totals are non-zero", () => {
    const { eventLog } = getSampleGamesheetInput();
    const penalties = eventLog.filter((e) => e.type === "penalty_added");
    expect(penalties.length).toBeGreaterThan(0);
    for (const p of penalties) {
      expect(p.penaltyDurationMs).toBeGreaterThan(0);
      expect(p.playerNumber).toBeTruthy();
      expect(p.infraction).toBeTruthy();
    }
  });

  it("returns a fresh object each call with stable event ids", () => {
    const first = getSampleGamesheetInput();
    const second = getSampleGamesheetInput();
    expect(first.eventLog).not.toBe(second.eventLog);
    expect(first.eventLog.map((e) => e.id)).toEqual(second.eventLog.map((e) => e.id));
  });
});
