import { describe, expect, it } from "vitest";
import { getReadableTextColor } from "../../utils/color";

describe("color utils", () => {
  it("picks white text for dark backgrounds", () => {
    expect(getReadableTextColor("#000000")).toBe("#ffffff");
    expect(getReadableTextColor("#3b82f6")).toBe("#ffffff");
    expect(getReadableTextColor("#991b1b")).toBe("#ffffff");
  });

  it("picks black text for light backgrounds", () => {
    expect(getReadableTextColor("#ffffff")).toBe("#000000");
    expect(getReadableTextColor("#ffff00")).toBe("#000000");
    expect(getReadableTextColor("#fde047")).toBe("#000000");
  });

  it("handles input without a leading #", () => {
    expect(getReadableTextColor("ffffff")).toBe("#000000");
  });

  it("handles 3-digit shorthand hex", () => {
    expect(getReadableTextColor("#fff")).toBe("#000000");
    expect(getReadableTextColor("#000")).toBe("#ffffff");
  });

  it("falls back to white for unparseable input", () => {
    expect(getReadableTextColor("not-a-color")).toBe("#ffffff");
    expect(getReadableTextColor("")).toBe("#ffffff");
  });
});
