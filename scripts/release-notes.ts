// Formats one changelog.ts entry as GitHub release notes markdown, so a tagged
// release's notes match what ships on the in-app Changelog page instead of
// electron-builder's default (empty) body. See .github/workflows/release.yml.
import { changelogEntries, type ChangelogEntry } from '../src/data/changelog';

const sectionTitles: Record<keyof ChangelogEntry['sections'], string> = {
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  removed: 'Removed',
};

export function formatReleaseNotes(entry: ChangelogEntry): string {
  const blocks: string[] = [];
  for (const key of Object.keys(sectionTitles) as (keyof ChangelogEntry['sections'])[]) {
    const items = entry.sections[key];
    if (items && items.length > 0) {
      blocks.push([`## ${sectionTitles[key]}`, ...items.map((item) => `- ${item}`)].join('\n'));
    }
  }
  return blocks.join('\n\n');
}

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: tsx scripts/release-notes.ts <version>');
    process.exit(1);
  }

  const entry = changelogEntries.find((e) => e.version === version);
  if (!entry) {
    console.error(`No changelog entry found for version ${version}.`);
    process.exit(1);
  }

  process.stdout.write(formatReleaseNotes(entry) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
