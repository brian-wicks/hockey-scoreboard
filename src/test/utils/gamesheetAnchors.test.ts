import { describe, expect, it } from "vitest";
import { ANCHOR_GROUPS, LAYOUT_ANCHORS } from "../../utils/gamesheetAnchors";
import { getDefaultGamesheetPdfLayout } from "../../utils/gamesheetPdf";

describe("gamesheet layout anchors", () => {
  it("gives every anchor a unique id", () => {
    const ids = LAYOUT_ANCHORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists every group exactly once", () => {
    expect(new Set(ANCHOR_GROUPS).size).toBe(ANCHOR_GROUPS.length);
    expect(ANCHOR_GROUPS).toContain("Home roster");
    expect(ANCHOR_GROUPS).toContain("Away penalties");
  });

  it("round-trips a position through set/get for every anchor", () => {
    const layout = getDefaultGamesheetPdfLayout();
    for (const anchor of LAYOUT_ANCHORS) {
      const moved = anchor.set(layout, { x: 123.4, yFromTop: 234.5 });
      expect(anchor.get(moved), anchor.id).toEqual({ x: 123.4, yFromTop: 234.5 });
    }
  });

  it("does not mutate the layout it is given", () => {
    const layout = getDefaultGamesheetPdfLayout();
    const before = JSON.stringify(layout);
    const anchor = LAYOUT_ANCHORS.find((a) => a.id === "homeRoster.nameX")!;
    anchor.set(layout, { x: 999, yFromTop: 999 });
    expect(JSON.stringify(layout)).toBe(before);
  });

  it("moves the whole group vertically but only one column horizontally", () => {
    const layout = getDefaultGamesheetPdfLayout();
    const nameAnchor = LAYOUT_ANCHORS.find((a) => a.id === "homeRoster.nameX")!;
    const goalsAnchor = LAYOUT_ANCHORS.find((a) => a.id === "homeRoster.goalsX")!;

    const before = { name: nameAnchor.get(layout), goals: goalsAnchor.get(layout) };
    const moved = nameAnchor.set(layout, { x: before.name.x + 40, yFromTop: before.name.yFromTop + 25 });

    // Sibling column keeps its own X...
    expect(goalsAnchor.get(moved).x).toBe(before.goals.x);
    // ...but follows the shared baseline.
    expect(goalsAnchor.get(moved).yFromTop).toBe(before.goals.yFromTop + 25);
    expect(nameAnchor.get(moved).x).toBe(before.name.x + 40);
  });

  it("keeps the two team-name anchors independent of each other", () => {
    const layout = getDefaultGamesheetPdfLayout();
    const home = LAYOUT_ANCHORS.find((a) => a.id === "teamNames.home")!;
    const away = LAYOUT_ANCHORS.find((a) => a.id === "teamNames.away")!;
    const awayBefore = away.get(layout);

    const moved = home.set(layout, { x: 10, yFromTop: 20 });
    expect(away.get(moved)).toEqual(awayBefore);
  });

  it("preserves sibling fields on the section it edits", () => {
    const layout = getDefaultGamesheetPdfLayout();
    const anchor = LAYOUT_ANCHORS.find((a) => a.id === "homePenalties.cols.offenceX")!;
    const moved = anchor.set(layout, { x: 5, yFromTop: 6 });
    expect(moved.homePenalties.size).toBe(layout.homePenalties.size);
    expect(moved.homePenalties.maxLines).toBe(layout.homePenalties.maxLines);
    expect(moved.homePenalties.aligns).toEqual(layout.homePenalties.aligns);
    expect(moved.homePenalties.cols.pimX).toBe(layout.homePenalties.cols.pimX);
  });
});
