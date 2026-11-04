// Adds the teams in a .json file to a user's team library. Teams already in the library
// are left alone unless --replace is set. See parseTeamsFile for the accepted formats.
//
//   npm run teams:import -- <file.json> [--user <id>] [--replace] [--dry-run] [--data-dir <dir>]
//
// --user defaults to the offline operator. Online accounts use their Firebase user id.
// --data-dir points at another sqlite database folder, such as the desktop app's.
// With DB_BACKEND=firestore, this writes to Firestore, so --user has to be given.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { LOCAL_USER_ID } from "../src/lib/localMode";
import { mergeTeams, parseTeamsFile, type LibraryEntry } from "../src/utils/teamFile";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: "string" },
    replace: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "data-dir": { type: "string" },
  },
});

if (positionals.length !== 1) {
  fail("Usage: npm run teams:import -- <file.json> [--user <id>] [--replace] [--dry-run] [--data-dir <dir>]");
}

const usingFirestore = process.env.DB_BACKEND === "firestore";
if (usingFirestore && !values.user) fail("DB_BACKEND is firestore: pass --user <id> to say whose library to change.");
if (usingFirestore && values["data-dir"]) fail("--data-dir only applies to sqlite, but DB_BACKEND is firestore.");

// Read when the database module loads, so it has to be set before that import.
if (values["data-dir"]) process.env.SCOREBOARD_DATA_DIR = resolve(values["data-dir"]);

const userId = values.user ?? LOCAL_USER_ID;

let teams;
try {
  teams = parseTeamsFile(JSON.parse(readFileSync(resolve(positionals[0]), "utf-8")));
} catch (error) {
  fail(`Couldn't read ${positionals[0]}: ${error instanceof Error ? error.message : String(error)}`);
}

const { getUserConfig, setUserConfig } = await import("../src/db/database.ts");

const stored = await getUserConfig(userId, "team-library");
const parsed = stored ? JSON.parse(stored) : [];
const library: LibraryEntry[] = Array.isArray(parsed) ? parsed : [];

const result = mergeTeams(library, teams, { replace: values.replace });

console.log(`Database: ${usingFirestore ? "firestore" : (process.env.SCOREBOARD_DATA_DIR ?? "data/scoreboard.db")}`);
console.log(`User: ${userId}`);
console.log(`Added: ${result.added.length}`);
if (result.replaced.length > 0) console.log(`Replaced: ${result.replaced.join(", ")}`);
if (result.skipped.length > 0) console.log(`Already in the library, left as they are: ${result.skipped.join(", ")}`);

if (values["dry-run"]) {
  console.log("Dry run: nothing was saved.");
} else {
  await setUserConfig(userId, "team-library", JSON.stringify(result.library));
  console.log(`Saved. The library now has ${result.library.length} teams.`);
}

// Firestore and Sentry keep handles open that would otherwise stop the process exiting.
process.exit(0);
