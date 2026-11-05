import { describe, expect, it } from "vitest";
import {
  CLUBS,
  clubToTeams,
  teamAbbreviation,
  type ApiClub,
  type ApiRosterRow,
} from "../../scripts/teams/buiha";
import { mergeTeams, parseTeamsFile } from "../utils/teamFile";

const club: ApiClub = {
  stub: "newcastle",
  name: "Newcastle Wildcats",
  primary_color: "053065",
  logo: { md: "https://example.test/club.png" },
  teams: [
    {
      name: "Newcastle Wildcats",
      rank: 1,
      logo: { "150": "https://example.test/a.png" },
      committee: [
        { role: "Captain", img: 1 },
        { role: "Coach", img: 2 },
      ],
    },
    { name: "Newcastle Wildcats B", rank: 2, committee: [{ role: "Assistant Captain", img: 3 }] },
  ],
};

const row = (id: number, team: string, forename: string, surname: string, number: number | null): ApiRosterRow => ({
  team,
  player: { id, forename, surname, number },
});

describe("clubToTeams", () => {
  const rows = [
    row(2, "Newcastle Wildcats", "Zoe ", "Young ", 19),
    row(1, "Newcastle Wildcats", "Amy", "Adams", 7),
    row(4, "Newcastle Wildcats", "No", "Number", null),
    row(3, "Newcastle Wildcats B", "Ben", "Brown", 123),
    row(5, "Unassigned", "Not", "Placed", 9),
  ];

  it("makes one team per rostered team and leaves out unassigned players", () => {
    const teams = clubToTeams(club, rows);
    expect(teams.map((team) => team.name)).toEqual(["Newcastle Wildcats", "Newcastle Wildcats B"]);
    expect(teams.flatMap((team) => team.players).some((player) => player.name === "Not Placed")).toBe(false);
  });

  it("maps identity, trims names, sorts by jersey and sets captains", () => {
    const [first, second] = clubToTeams(club, rows);
    expect(first).toMatchObject({ abbreviation: "NEW", color: "#053065", logo: "https://example.test/a.png" });
    expect(second.abbreviation).toBe("NEW");
    expect(first.players).toEqual([
      { id: "buiha-1", jerseyNumber: "7", name: "Amy Adams", position: "C" },
      { id: "buiha-2", jerseyNumber: "19", name: "Zoe Young", position: "" },
      { id: "buiha-4", jerseyNumber: "", name: "No Number", position: "" },
    ]);
    expect(second.logo).toBe("https://example.test/club.png");
    expect(second.players[0]).toMatchObject({ jerseyNumber: "12", position: "A" });
  });

  it("lists a player once when the roster repeats them", () => {
    const [team] = clubToTeams(club, [row(1, "Newcastle Wildcats", "Amy", "Adams", 7), row(1, "Newcastle Wildcats", "Amy", "Adams", 7)]);
    expect(team.players).toHaveLength(1);
  });

  it("still gives a club with no assigned players its first team, empty", () => {
    const teams = clubToTeams(club, [row(5, "Unassigned", "Not", "Placed", 9)]);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ name: "Newcastle Wildcats", players: [] });
  });
});

describe("teamAbbreviation", () => {
  it("gives every team in a club the club's code", () => {
    expect(teamAbbreviation("newcastle")).toBe("NEW");
    expect(teamAbbreviation("oxford")).toBe("OXF");
  });

  it("rejects an unknown club", () => {
    expect(() => teamAbbreviation("nowhere")).toThrow(/Unknown club/);
  });

  it("gives every club a different three-letter code", () => {
    const codes = Object.values(CLUBS);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => code.length === 3)).toBe(true);
  });
});

describe("parseTeamsFile", () => {
  const bare = { name: "Hawks", abbreviation: "hwk", color: "#112233", players: [{ jerseyNumber: "No. 12", name: " Sam ", position: "c" }] };

  it("accepts a list, a teams wrapper, a single team and library entries", () => {
    const expected = parseTeamsFile([bare]);
    expect(parseTeamsFile({ teams: [bare] })).toEqual(expected);
    expect(parseTeamsFile(bare)).toEqual(expected);
    expect(parseTeamsFile([{ name: "Hawks", team: bare }])).toEqual(expected);
  });

  it("normalizes fields to what the app stores", () => {
    expect(parseTeamsFile(bare)[0]).toEqual({
      name: "Hawks",
      abbreviation: "HWK",
      logo: "",
      color: "#112233",
      players: [{ id: "Hawks-1", jerseyNumber: "12", name: "Sam", position: "C" }],
    });
  });

  it.each([
    ["a missing name", [{ abbreviation: "X" }], /no name/],
    ["a bad color", [{ name: "A", color: "blue" }], /isn't a hex color/],
    ["players that aren't a list", [{ name: "A", players: "x" }], /must be a list/],
    ["an empty player", [{ name: "A", players: [{}] }], /needs a name or a jersey number/],
    ["a repeated team", [{ name: "A" }, { name: "a" }], /more than once/],
    ["something that isn't teams", 5, /Expected a list/],
  ])("rejects %s", (_label, data, message) => {
    expect(() => parseTeamsFile(data)).toThrow(message);
  });
});

describe("mergeTeams", () => {
  const incoming = parseTeamsFile([
    { name: "newcastle wildcats", abbreviation: "NEW" },
    { name: "Hawks", abbreviation: "HWK" },
  ]);
  const existing = [{ name: "Newcastle Wildcats", team: parseTeamsFile({ name: "Newcastle Wildcats", color: "#002444" })[0], updatedAt: 1 }];

  it("keeps a team already in the library by default, matching names regardless of case", () => {
    const result = mergeTeams(existing, incoming, { now: 5 });
    expect(result.added).toEqual(["Hawks"]);
    expect(result.skipped).toEqual(["newcastle wildcats"]);
    expect(result.library[0]).toBe(existing[0]);
    expect(result.library).toHaveLength(2);
  });

  it("overwrites it with replace, and leaves the original list untouched", () => {
    const result = mergeTeams(existing, incoming, { replace: true, now: 5 });
    expect(result.replaced).toEqual(["newcastle wildcats"]);
    expect(result.library[0].updatedAt).toBe(5);
    expect(existing[0].updatedAt).toBe(1);
  });
});
