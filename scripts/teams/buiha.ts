// Turns BUIHA API responses into teams. See scripts/fetch-buiha-teams.ts.
import type { ImportedPlayer, ImportedTeam, PlayerPosition } from "../../src/utils/teamFile";

const LOGO_BASE = "https://buiha.org.uk/assets/img/icon/md";

// Club stub -> the abbreviation shared by all of the club's teams.
export const CLUBS: Record<string, string> = {
  birmingham: "BIR",
  bradford: "BRA",
  bristol: "BRS",
  cambridge: "CAM",
  cardiff: "CAR",
  edinburgh: "EDI",
  glasgow: "GLA",
  hull: "HUL",
  imperial: "IMP",
  kent: "KEN",
  leeds: "LEE",
  london: "LON",
  manchester: "MAN",
  newcastle: "NEW",
  northeast: "NEA",
  northumbria: "NOR",
  nottingham: "NOT",
  oxford: "OXF",
  sheffield: "SHE",
  southampton: "SOU",
  southern: "SRN",
  standrews: "STA",
  stirling: "STI",
  uclu: "UCL",
  uea: "UEA",
  aberdeen: "ABD",
  "warwick-coventry": "WAR",
};

export interface ApiRosterRow {
  team: string;
  player: { id: number; forename: string; surname: string; number: number | null };
}

export interface ApiTeam {
  name: string;
  rank?: number;
  logo?: Record<string, string>;
  committee?: { role: string; img: number }[];
}

export interface ApiClub {
  stub: string;
  name: string;
  primary_color?: string | null;
  logo?: Record<string, string>;
  teams?: ApiTeam[];
  roster_seasons?: { season: string; value: number }[];
}

export const UNASSIGNED_TEAM = "Unassigned";

export function teamAbbreviation(stub: string): string {
  const code = CLUBS[stub];
  if (!code) throw new Error(`Unknown club "${stub}"`);
  return code;
}

function teamColor(club: ApiClub): string {
  const hex = String(club.primary_color ?? "").trim();
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : "#3b82f6";
}

function teamLogo(club: ApiClub, team?: ApiTeam): string {
  return team?.logo?.["150"] || club.logo?.md || `${LOGO_BASE}/${club.stub}.png`;
}

function leadershipPositions(team?: ApiTeam): Map<number, PlayerPosition> {
  const positions = new Map<number, PlayerPosition>();
  for (const member of team?.committee ?? []) {
    if (member.role === "Captain") positions.set(member.img, "C");
    else if (member.role === "Assistant Captain" && !positions.has(member.img)) positions.set(member.img, "A");
  }
  return positions;
}

function toPlayer(row: ApiRosterRow, positions: Map<number, PlayerPosition>): ImportedPlayer {
  const { id, forename, surname, number } = row.player;
  return {
    id: `buiha-${id}`,
    jerseyNumber: number === null || number === undefined ? "" : String(number).replace(/\D/g, "").slice(0, 2),
    name: `${String(forename ?? "").trim()} ${String(surname ?? "").trim()}`.trim(),
    position: positions.get(id) ?? "",
  };
}

function byJerseyThenName(a: ImportedPlayer, b: ImportedPlayer): number {
  const aNumber = a.jerseyNumber === "" ? Infinity : Number(a.jerseyNumber);
  const bNumber = b.jerseyNumber === "" ? Infinity : Number(b.jerseyNumber);
  return aNumber === bNumber ? a.name.localeCompare(b.name) : aNumber - bNumber;
}

/**
 * One team per team named in the club's roster. A club with nobody on a team yet still
 * gets its first team, empty, so it can be picked as an opponent.
 */
export function clubToTeams(club: ApiClub, rows: ApiRosterRow[]): ImportedTeam[] {
  const apiTeams = new Map((club.teams ?? []).map((team) => [team.name, team]));
  const rostersByTeam = new Map<string, Map<number, ApiRosterRow>>();
  for (const row of rows) {
    if (row.team === UNASSIGNED_TEAM) continue;
    if (!rostersByTeam.has(row.team)) rostersByTeam.set(row.team, new Map());
    rostersByTeam.get(row.team)!.set(row.player.id, row);
  }

  if (rostersByTeam.size === 0) {
    const firstTeam = club.teams?.find((team) => team.name === club.name)
      ?? club.teams?.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99))[0];
    rostersByTeam.set(firstTeam?.name ?? club.name, new Map());
  }

  return [...rostersByTeam.entries()].map(([name, roster]) => {
    const apiTeam = apiTeams.get(name);
    const positions = leadershipPositions(apiTeam);
    return {
      name,
      abbreviation: teamAbbreviation(club.stub),
      logo: teamLogo(club, apiTeam),
      color: teamColor(club),
      players: [...roster.values()].map((row) => toPlayer(row, positions)).sort(byJerseyThenName),
    };
  });
}
