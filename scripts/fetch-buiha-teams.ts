// Downloads this season's BUIHA teams and rosters into .json files: one per team in a
// folder, for the Team library's import button, and one with every team, for `npm run
// teams:import`. Writes nothing unless every club downloads successfully.
//
//   npm run teams:fetch-buiha [-- --out path/to/file.json] [--season 0]
//
// --season counts back from the current season: 0 is this season, 1 is last season.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  CLUBS,
  UNASSIGNED_TEAM,
  assertUniqueAbbreviations,
  clubToTeams,
  type ApiClub,
  type ApiRosterRow,
} from "./teams/buiha";
import type { ImportedTeam } from "../src/utils/teamFile";

const API_BASE = "https://api.buiha.org.uk";
const REQUEST_GAP_MS = 200;

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    season: { type: "string", default: "0" },
  },
});

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function getJson<T>(path: string): Promise<T> {
  await wait(REQUEST_GAP_MS);
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function fetchRoster(stub: string, season: string): Promise<ApiRosterRow[]> {
  const rows: ApiRosterRow[] = [];
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const page: { players: ApiRosterRow[]; nextCursor?: number } = await getJson(
      `/club/${stub}/roster/?offset=${offset}&season=${season}`,
    );
    rows.push(...page.players);
    offset = page.nextCursor;
  }
  return rows;
}

const teams: ImportedTeam[] = [];
let seasonLabel = `season-${values.season}`;
let unassigned = 0;

for (const stub of Object.keys(CLUBS)) {
  const club = await getJson<ApiClub>(`/club/${stub}/`);
  const rows = await fetchRoster(stub, values.season!);
  const label = club.roster_seasons?.find((season) => String(season.value) === values.season)?.season;
  if (label) seasonLabel = label;

  unassigned += rows.filter((row) => row.team === UNASSIGNED_TEAM).length;
  const clubTeams = clubToTeams(club, rows);
  teams.push(...clubTeams);
  console.log(`${stub}: ${clubTeams.map((team) => `${team.name} (${team.players.length})`).join(", ")}`);
}

assertUniqueAbbreviations(teams);

const outPath = resolve(values.out ?? `data/teams/buiha-${seasonLabel}.json`);
const teamsDir = outPath.replace(/\.json$/, "");
rmSync(teamsDir, { recursive: true, force: true });
mkdirSync(teamsDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(teams, null, 2)}\n`);
for (const team of teams) {
  const slug = team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  writeFileSync(join(teamsDir, `${slug}.json`), `${JSON.stringify(team, null, 2)}\n`);
}

const playerCount = teams.reduce((total, team) => total + team.players.length, 0);
console.log(`\nSaved ${teams.length} teams and ${playerCount} players to ${outPath}`);
console.log(`Saved one file per team in ${teamsDir}`);
console.log(`Left out ${unassigned} players who aren't assigned to a team.`);
console.log(`Add them to the app with: npm run teams:import -- ${outPath}`);
