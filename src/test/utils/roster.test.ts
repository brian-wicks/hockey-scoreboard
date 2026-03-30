import { describe, expect, it } from "vitest";
import { toSkaterLabel } from "../../utils/roster";

describe("roster utils", () => {
  it("renders number and name with position", () => {
    expect(
      toSkaterLabel({
        id: "p1",
        jerseyNumber: "12",
        name: "Alex",
        position: "C",
      }),
    ).toBe("12 Alex (C)");
  });

  it("renders name only when no number", () => {
    expect(
      toSkaterLabel({
        id: "p2",
        jerseyNumber: "",
        name: "Taylor",
        position: "",
      }),
    ).toBe("Taylor");
  });

  it("renders number only when no name", () => {
    expect(
      toSkaterLabel({
        id: "p3",
        jerseyNumber: "9",
        name: "",
        position: "A",
      }),
    ).toBe("9");
  });

  it("hides NM position", () => {
    expect(
      toSkaterLabel({
        id: "p4",
        jerseyNumber: "27",
        name: "Sam",
        position: "NM",
      }),
    ).toBe("27 Sam");
  });
});
