import type { GameEvent, TeamPlayer, TeamState } from "../store";

/**
 * A fully-populated fake game used by the PDF layout editor's "sample data"
 * toggle. Real games are usually sparse — an empty roster slot or an unused
 * penalty row leaves that part of the sheet blank, which is exactly where a
 * misplaced column hides. This fills every region the renderer can draw into
 * (full rosters, goals for both teams, penalties, and all four periods) so the
 * operator can see whether the layout actually lines up under load.
 */

const SAMPLE_NAMES = [
  "Alvarez", "Bennett", "Chen", "Delgado", "Everett", "Fontaine", "Gallagher",
  "Hoffman", "Ishikawa", "Jarvis", "Kowalski", "Lindqvist", "Mancini", "Novak",
  "O'Rourke", "Petrov", "Quinlan", "Rasmussen", "Suzuki", "Thibault",
];

function buildPlayers(offset: number, count: number): TeamPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sample-player-${offset}-${i}`,
    jerseyNumber: String(offset + i * 2 + 1),
    name: SAMPLE_NAMES[(offset + i) % SAMPLE_NAMES.length],
    // A captain, an alternate, and two netminders (position "NM"), which is what
    // drives the sheet's goalie block — starter plus backup, so a goalie change
    // has somewhere to go.
    position: i === 0 ? "C" : i === 1 ? "A" : i >= count - 2 ? "NM" : "",
  }));
}

function buildTeam(name: string, abbreviation: string, color: string, offset: number, count: number): TeamState {
  return {
    name,
    abbreviation,
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color,
    penalties: [],
    players: buildPlayers(offset, count),
  };
}

let counter = 0;
function event(partial: Omit<GameEvent, "id" | "createdAt">): GameEvent {
  counter += 1;
  return { id: `sample-event-${counter}`, createdAt: counter, ...partial };
}

export function getSampleGamesheetInput(): {
  homeTeam: TeamState;
  awayTeam: TeamState;
  eventLog: GameEvent[];
} {
  counter = 0;

  const homeTeam = buildTeam("Riverside Rockets", "RIV", "#38bdf8", 2, 18);
  const awayTeam = buildTeam("Northgate Narwhals", "NOR", "#f97316", 5, 18);

  const goal = (team: "home" | "away", period: string, clockTime: string, scorer: string, assist1: string, assist2: string) =>
    event({ type: "goal", team, period, clockTime, scorer, assist1, assist2 });

  const penalty = (team: "home" | "away", period: string, clockTime: string, endClockTime: string, playerNumber: string, infraction: string, minutes: number) =>
    event({
      type: "penalty_added",
      team,
      period,
      clockTime,
      endClockTime,
      playerNumber,
      infraction,
      penaltyDurationMs: minutes * 60_000,
      penaltyId: `sample-penalty-${counter}`,
    });

  const goalieChange = (team: "home" | "away", period: string, clockTime: string, goalie: string) =>
    event({ type: "goalie_change", team, period, clockTime, goalie });

  // Shots against are attributed to whichever netminder was in at that point, so
  // these are what put time-on-ice and per-period numbers in the goalie block.
  const shots = (team: "home" | "away", period: string, clockTime: string, shotDelta: number) =>
    event({ type: "shot_on_goal", team, period, clockTime, shotDelta });

  const homeGoalies = homeTeam.players.filter((p) => p.position === "NM");
  const awayGoalies = awayTeam.players.filter((p) => p.position === "NM");

  const eventLog: GameEvent[] = [
    goalieChange("home", "1", "20:00", homeGoalies[0].jerseyNumber),
    goalieChange("away", "1", "20:00", awayGoalies[0].jerseyNumber),
    goal("home", "1", "14:22", "3", "7", "11"),
    goal("away", "1", "9:05", "9", "15", ""),
    penalty("away", "1", "6:41", "4:41", "21", "Tripping", 2),
    goal("home", "1", "2:18", "9", "3", "21"),
    penalty("home", "2", "17:56", "15:56", "7", "Hooking", 2),
    goal("away", "2", "12:30", "17", "9", "23"),
    penalty("away", "2", "8:12", "3:12", "13", "Roughing", 5),
    goal("home", "2", "4:47", "15", "11", "5"),
    goal("away", "3", "16:09", "23", "17", "9"),
    penalty("home", "3", "11:34", "9:34", "19", "Interference", 2),
    goal("home", "3", "5:52", "11", "9", "7"),
    penalty("away", "3", "1:40", "0:00", "25", "Slashing", 2),
    goal("away", "OT", "3:11", "15", "21", ""),
    goal("home", "OT", "0:48", "7", "3", "15"),

    // Shots spread across every period for both teams, with each side pulling its
    // starter at a different point so both goalies show time on ice.
    shots("away", "1", "15:00", 9),
    shots("home", "1", "15:00", 11),
    goalieChange("home", "2", "10:00", homeGoalies[1].jerseyNumber),
    shots("away", "2", "9:00", 12),
    shots("home", "2", "9:00", 8),
    goalieChange("away", "3", "14:00", awayGoalies[1].jerseyNumber),
    shots("away", "3", "6:00", 10),
    shots("home", "3", "6:00", 13),
    shots("away", "OT", "2:00", 3),
    shots("home", "OT", "2:00", 2),
  ];

  // Keep the summary numbers on the sheet consistent with the event log above.
  homeTeam.score = eventLog.filter((e) => e.type === "goal" && e.team === "home").length;
  awayTeam.score = eventLog.filter((e) => e.type === "goal" && e.team === "away").length;
  const shotsAgainst = (team: "home" | "away") =>
    eventLog
      .filter((e) => e.type === "shot_on_goal" && e.team === team)
      .reduce((sum, e) => sum + (e.shotDelta ?? 1), 0);
  homeTeam.shots = shotsAgainst("home");
  awayTeam.shots = shotsAgainst("away");

  return { homeTeam, awayTeam, eventLog };
}
