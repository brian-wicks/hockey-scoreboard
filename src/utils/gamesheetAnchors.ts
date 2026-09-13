import type { GamesheetPdfLayout } from "./gamesheetPdf";

/**
 * Describes every draggable point in a gamesheet layout for the visual editor.
 *
 * The layout stores coordinates as a wide, heterogeneous set of named groups
 * (some with a flat `numX`/`nameX`, some with a nested `cols` object), all
 * sharing one `yFromTop` per group. Rather than teach the editor about each
 * shape, every position it can move is flattened into one uniform list of
 * anchors with a get/set pair. Dragging an anchor horizontally moves only that
 * anchor's X; dragging vertically moves its whole group, because a group is a
 * single row or column-set on the sheet and its entries share a baseline.
 */
export interface LayoutAnchor {
  id: string;
  /** Group the anchor belongs to, e.g. "Away roster" — anchors in a group share a Y. */
  group: string;
  /** Column within the group, e.g. "Goals". */
  label: string;
  get(layout: GamesheetPdfLayout): { x: number; yFromTop: number };
  set(layout: GamesheetPdfLayout, pos: { x: number; yFromTop: number }): GamesheetPdfLayout;
}

type Section = string;

/** Anchors for a group whose X keys sit directly on the section (rosters, shots). */
function flatGroup(section: Section, group: string, cols: Array<[string, string]>): LayoutAnchor[] {
  return cols.map(([key, label]) => ({
    id: `${section}.${key}`,
    group,
    label,
    get: (layout) => {
      const s = (layout as any)[section] ?? {};
      return { x: Number(s[key]) || 0, yFromTop: Number(s.yFromTop) || 0 };
    },
    set: (layout, pos) => ({
      ...layout,
      [section]: { ...(layout as any)[section], [key]: pos.x, yFromTop: pos.yFromTop },
    }),
  }));
}

/** Anchors for a group whose X keys sit under section.cols (goals, penalties, totals). */
function colGroup(section: Section, group: string, cols: Array<[string, string]>): LayoutAnchor[] {
  return cols.map(([key, label]) => ({
    id: `${section}.cols.${key}`,
    group,
    label,
    get: (layout) => {
      const s = (layout as any)[section] ?? {};
      return { x: Number(s.cols?.[key]) || 0, yFromTop: Number(s.yFromTop) || 0 };
    },
    set: (layout, pos) => ({
      ...layout,
      [section]: {
        ...(layout as any)[section],
        yFromTop: pos.yFromTop,
        cols: { ...(layout as any)[section]?.cols, [key]: pos.x },
      },
    }),
  }));
}

const ROSTER_COLS: Array<[string, string]> = [
  ["numX", "#"],
  ["nameX", "Name"],
  ["goalsX", "G"],
  ["assistsX", "A"],
  ["pimX", "PIM"],
];

const GOAL_COLS: Array<[string, string]> = [
  ["timeX", "Time"],
  ["scorerX", "Scorer"],
  ["assist1X", "Assist 1"],
  ["assist2X", "Assist 2"],
];

const PENALTY_COLS: Array<[string, string]> = [
  ["playerNumX", "#"],
  ["pimX", "PIM"],
  ["offenceX", "Offence"],
  ["givenX", "Given"],
  ["startX", "Start"],
  ["endX", "End"],
];

const PERIOD_COLS: Array<[string, string]> = [
  ["p1X", "P1"],
  ["p2X", "P2"],
  ["p3X", "P3"],
  ["otX", "OT"],
  ["totalX", "Total"],
];

// The sheet's "NM" block is the netminder (goalie) record — number, name, time
// on ice, and shots against per period — not a list of non-roster players.
const GOALIE_COLS: Array<[string, string]> = [
  ["numX", "#"],
  ["nameX", "Name"],
  ["timeX", "Time on"],
  ["p1X", "P1"],
  ["p2X", "P2"],
  ["p3X", "P3"],
  ["otX", "OT"],
  ["totalX", "Total"],
];

export const LAYOUT_ANCHORS: LayoutAnchor[] = [
  // Team names are the one group where the two sides are stored side by side in
  // a single section with their own Y each, so they can't use the helpers above.
  {
    id: "teamNames.home",
    group: "Team names",
    label: "Home",
    get: (layout) => ({ x: layout.teamNames.homeX, yFromTop: layout.teamNames.homeYFromTop }),
    set: (layout, pos) => ({
      ...layout,
      teamNames: { ...layout.teamNames, homeX: pos.x, homeYFromTop: pos.yFromTop },
    }),
  },
  {
    id: "teamNames.away",
    group: "Team names",
    label: "Away",
    get: (layout) => ({ x: layout.teamNames.awayX, yFromTop: layout.teamNames.awayYFromTop }),
    set: (layout, pos) => ({
      ...layout,
      teamNames: { ...layout.teamNames, awayX: pos.x, awayYFromTop: pos.yFromTop },
    }),
  },

  ...flatGroup("homeRoster", "Home roster", ROSTER_COLS),
  ...flatGroup("awayRoster", "Away roster", ROSTER_COLS),
  ...colGroup("homeGoals", "Home goals", GOAL_COLS),
  ...colGroup("awayGoals", "Away goals", GOAL_COLS),
  ...colGroup("homePenalties", "Home penalties", PENALTY_COLS),
  ...colGroup("awayPenalties", "Away penalties", PENALTY_COLS),
  ...colGroup("homePeriodGoals", "Home goals by period", PERIOD_COLS),
  ...colGroup("awayPeriodGoals", "Away goals by period", PERIOD_COLS),
  ...colGroup("homePeriodPim", "Home PIM by period", PERIOD_COLS),
  ...colGroup("awayPeriodPim", "Away PIM by period", PERIOD_COLS),
  // These place the team's own name against each summary row, not the P1/P2/P3 headings.
  ...flatGroup("homePeriodLabel", "Home summary name", [["goalsX", "Goals row"], ["pimX", "PIM row"]]),
  ...flatGroup("awayPeriodLabel", "Away summary name", [["goalsX", "Goals row"], ["pimX", "PIM row"]]),
  ...colGroup("homeNmRoster", "Home goalies", GOALIE_COLS),
  ...colGroup("awayNmRoster", "Away goalies", GOALIE_COLS),
  ...flatGroup("homeShots", "Home shot total", [["x", "Shots"]]),
  ...flatGroup("awayShots", "Away shot total", [["x", "Shots"]]),
];

export const ANCHOR_GROUPS: string[] = [...new Set(LAYOUT_ANCHORS.map((a) => a.group))];
