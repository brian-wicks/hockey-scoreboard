import { describe, expect, it } from "vitest";
import { isValidShareName, normalizeShareName } from "../lib/shareNames";

describe("share names", () => {
  it("lowercases and trims", () => {
    expect(normalizeShareName("  Newcastle-Wildcats ")).toBe("newcastle-wildcats");
  });

  it("accepts letters, numbers and hyphens from 4 to 40 characters", () => {
    for (const name of ["abcd", "game-2026", "1234", "a".repeat(40)]) {
      expect(isValidShareName(name)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const name of ["abc", "a".repeat(41), "has space", "under_score", "a/b/c/d", "caps-NAME", "ünicode", "", 12345, null]) {
      expect(isValidShareName(name)).toBe(false);
    }
  });
});
