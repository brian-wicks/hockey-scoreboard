import { describe, expect, it } from "vitest";
import { formatReleaseNotes } from "../../scripts/release-notes";
import type { ChangelogEntry } from "../data/changelog";

describe("formatReleaseNotes", () => {
  it("renders each non-empty section as a heading with bullet items", () => {
    const entry: ChangelogEntry = {
      version: "9.9.9",
      date: "2026-01-01",
      sections: {
        added: ["Add a thing."],
        fixed: ["Fix a bug."],
      },
    };

    expect(formatReleaseNotes(entry)).toBe(
      "## Added\n- Add a thing.\n\n## Fixed\n- Fix a bug."
    );
  });

  it("omits sections with no items", () => {
    const entry: ChangelogEntry = {
      version: "9.9.9",
      date: "2026-01-01",
      sections: { changed: ["Change a thing."] },
    };

    const notes = formatReleaseNotes(entry);
    expect(notes).not.toContain("Added");
    expect(notes).not.toContain("Fixed");
    expect(notes).not.toContain("Removed");
    expect(notes).toBe("## Changed\n- Change a thing.");
  });
});
