// The teams .json format, shared by the Team library's import button and `npm run
// teams:import`, and how a file's teams are merged into a library. Free of I/O so both can use it.

export type PlayerPosition = "" | "C" | "A" | "NM";

export interface ImportedPlayer {
  id: string;
  jerseyNumber: string;
  name: string;
  position: PlayerPosition;
}

export interface ImportedTeam {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  players: ImportedPlayer[];
}

export interface LibraryEntry {
  name: string;
  team: ImportedTeam;
  updatedAt: number;
}

const DEFAULT_COLOR = "#3b82f6";

function normalizePlayer(raw: unknown, teamName: string, index: number): ImportedPlayer {
  const player = (raw ?? {}) as Record<string, unknown>;
  const name = String(player.name ?? "").trim();
  const jerseyNumber = String(player.jerseyNumber ?? "").replace(/\D/g, "").slice(0, 2);
  if (!name && !jerseyNumber) {
    throw new Error(`"${teamName}": player ${index + 1} needs a name or a jersey number`);
  }
  const position = String(player.position ?? "").toUpperCase();
  return {
    id: String(player.id ?? "").trim() || `${teamName}-${index + 1}`,
    jerseyNumber,
    name,
    position: position === "C" || position === "A" || position === "NM" ? position : "",
  };
}

function normalizeTeam(raw: unknown, index: number): ImportedTeam {
  // Accepts both a library entry ({ name, team: {...} }) and a bare team ({ name, players, ... }).
  const entry = (raw ?? {}) as Record<string, unknown>;
  const team = (entry.team && typeof entry.team === "object" ? entry.team : entry) as Record<string, unknown>;
  const name = String(team.name ?? entry.name ?? "").trim();
  if (!name) throw new Error(`Team ${index + 1} has no name`);

  const color = String(team.color ?? "").trim();
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error(`"${name}": color "${color}" isn't a hex color like #002444`);
  }
  if (team.players !== undefined && !Array.isArray(team.players)) {
    throw new Error(`"${name}": players must be a list`);
  }

  return {
    name,
    abbreviation: String(team.abbreviation ?? "").trim().toUpperCase(),
    logo: String(team.logo ?? "").trim(),
    color: color || DEFAULT_COLOR,
    players: ((team.players as unknown[] | undefined) ?? []).map((player, i) => normalizePlayer(player, name, i)),
  };
}

/** Reads a parsed teams file: a list of teams, `{ "teams": [...] }`, or one team on its own. */
export function parseTeamsFile(data: unknown): ImportedTeam[] {
  const wrapped = (data as { teams?: unknown } | null)?.teams;
  const list = Array.isArray(data) ? data : Array.isArray(wrapped) ? wrapped : data && typeof data === "object" ? [data] : null;
  if (!list) throw new Error("Expected a list of teams");

  const teams = list.map(normalizeTeam);
  const seen = new Set<string>();
  for (const team of teams) {
    const key = team.name.toLowerCase();
    if (seen.has(key)) throw new Error(`"${team.name}" appears more than once in the file`);
    seen.add(key);
  }
  return teams;
}

export interface MergeResult {
  library: LibraryEntry[];
  added: string[];
  replaced: string[];
  skipped: string[];
}

/** Adds teams to a library. A team whose name is already there is kept as it is unless `replace` is set. */
export function mergeTeams(
  library: LibraryEntry[],
  teams: ImportedTeam[],
  { replace = false, now = Date.now() }: { replace?: boolean; now?: number } = {},
): MergeResult {
  const next = library.slice();
  const result: MergeResult = { library: next, added: [], replaced: [], skipped: [] };

  for (const team of teams) {
    const entry: LibraryEntry = { name: team.name, team, updatedAt: now };
    const index = next.findIndex((existing) => existing.name.toLowerCase() === team.name.toLowerCase());
    if (index < 0) {
      next.push(entry);
      result.added.push(team.name);
    } else if (replace) {
      next[index] = entry;
      result.replaced.push(team.name);
    } else {
      result.skipped.push(team.name);
    }
  }
  return result;
}
