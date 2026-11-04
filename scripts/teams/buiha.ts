// Turns BUIHA API responses into teams. See scripts/fetch-buiha-teams.ts.
import type { ImportedPlayer, ImportedTeam, PlayerPosition } from "../../src/utils/teamFile";

const LOGO_BASE = "https://buiha.org.uk/assets/img/icon/md";

// Club stub -> the club's first team abbreviation. `prefix` starts the abbreviations of
// its other teams (NEW, then NEB and NEC), set where two clubs would otherwise clash.
export const CLUBS: Record<string, { code: string; prefix?: string }> = {
  birmingham: { code: "BIR" },
  bradford: { code: "BRA" },
  bristol: { code: "BRS" },
  cambridge: { code: "CAM" },
  cardiff: { code: "CAR", prefix: "CD" },
  edinburgh: { code: "EDI" },
  glasgow: { code: "GLA" },
  hull: { code: "HUL" },
  imperial: { code: "IMP" },
  kent: { code: "KEN" },
  leeds: { code: "LEE" },
  london: { code: "LON" },
  manchester: { code: "MAN" },
  newcastle: { code: "NEW" },
  northeast: { code: "NEA", prefix: "NA" },
  northumbria: { code: "NOR", prefix: "NR" },
  nottingham: { code: "NOT", prefix: "NT" },
  oxford: { code: "OXF" },
  sheffield: { code: "SHE", prefix: "SF" },
  southampton: { code: "SOU" },
  southern: { code: "SRN" },
  standrews: { code: "STA" },
  stirling: { code: "STI" },
  uclu: { code: "UCL" },
  uea: { code: "UEA" },
  aberdeen: { code: "ABD" },
  "warwick-coventry": { code: "WAR" },
};

// Teams whose names don't follow the club's usual pattern.
const TEAM_CODES: Record<string, string> = {
  "Cambridge Huskies": "CAH",
  "Cambridge Narwhals": "CAN",
  "Oxford Vikings": "OXV",
  "Oxford Vikings B": "OVB",
  "Oxford Vikings C": "OVC",
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

export function teamAbbreviation(stub: string, teamName: string, clubName: string): string {
  if (TEAM_CODES[teamName]) return TEAM_CODES[teamName];
  const club = CLUBS[stub];
  if (!club) throw new Error(`Unknown club "${stub}"`);
  const prefix = club.prefix ?? club.code.slice(0, 2);
  if (/\bwomen/i.test(teamName)) return `${prefix}W`;
  if (/\balumni\b/i.test(teamName)) return `${prefix}L`;
  const suffix = teamName.startsWith(clubName) ? teamName.slice(clubName.length).trim() : teamName.match(/ ([B-Z])$/)?.[1];
  return suffix && /^[B-Z]$/.test(suffix) ? `${prefix}${suffix}` : club.code;
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
      abbreviation: teamAbbreviation(club.stub, name, club.name),
      logo: teamLogo(club, apiTeam),
      color: teamColor(club),
      players: [...roster.values()].map((row) => toPlayer(row, positions)).sort(byJerseyThenName),
    };
  });
}

/** Throws if two teams would share an abbreviation, since they'd be hard to tell apart on the overlay. */
export function assertUniqueAbbreviations(teams: ImportedTeam[]): void {
  const seen = new Map<string, string>();
  for (const team of teams) {
    const other = seen.get(team.abbreviation);
    if (other) throw new Error(`"${team.name}" and "${other}" are both ${team.abbreviation}`);
    seen.set(team.abbreviation, team.name);
  }
}
