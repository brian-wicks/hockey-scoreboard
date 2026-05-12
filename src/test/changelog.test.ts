import { describe, expect, it } from "vitest";
import { changelogEntries } from "../data/changelog";

describe("Changelog Data", () => {
  it("has valid entries", () => {
    expect(Array.isArray(changelogEntries)).toBe(true);
    expect(changelogEntries.length).toBeGreaterThan(0);
    
    // Check first entry structure
    const first = changelogEntries[0];
    expect(first.version).toBeDefined();
    expect(first.date).toBeDefined();
    expect(first.sections).toBeDefined();
  });
});
