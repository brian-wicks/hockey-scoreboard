import { describe, expect, it } from "vitest";
import type { GameState, TeamPlayer } from "../store";
import {
  DEFAULT_PRESHOW,
  ROSTER_PAGE_SIZE,
  faceoffTimeInputValue,
  formatCountdown,
  getCurrentSlide,
  getPreshow,
  getRotationSlides,
  getRosterPage,
  getRosterPageCount,
  msUntilNextSlide,
  nextFaceoffTime,
  rotationStartFor,
  sortRoster,
} from "../utils/preshow";

const player = (jerseyNumber: string, name = `Player ${jerseyNumber}`, position: TeamPlayer["position"] = ""): TeamPlayer => ({
  id: `id-${jerseyNumber}-${name}`,
  jerseyNumber,
  name,
  position,
});

describe("getPreshow", () => {
  it("uses the defaults for a game saved before pre-show existed", () => {
    expect(getPreshow({} as GameState)).toEqual(DEFAULT_PRESHOW);
  });

  it("keeps valid settings", () => {
    const rotation = { enabled: true, intervalSeconds: 45, startedAt: 1000 };
    const preshow = { view: "away", rosterPage: 2, faceoffAt: 5000, rotation } as const;
    expect(getPreshow({ preshow } as GameState)).toEqual(preshow);
  });

  it("replaces invalid settings with the defaults", () => {
    const preshow = { view: "sideways", rosterPage: -1, faceoffAt: "soon" };
    expect(getPreshow({ preshow } as unknown as GameState)).toEqual(DEFAULT_PRESHOW);
  });

  it("replaces a fractional or non-finite page", () => {
    expect(getPreshow({ preshow: { view: "home", rosterPage: 1.5, faceoffAt: null } } as GameState).rosterPage).toBe(0);
    expect(getPreshow({ preshow: { view: "home", rosterPage: Infinity, faceoffAt: null } } as GameState).rosterPage).toBe(0);
  });
});

describe("rotation settings", () => {
  const rotationOf = (rotation: unknown) =>
    getPreshow({ preshow: { view: "teams", rosterPage: 0, faceoffAt: null, rotation } } as unknown as GameState).rotation;

  it("is off, at 30 seconds a slide, by default", () => {
    expect(DEFAULT_PRESHOW.rotation).toEqual({ enabled: false, intervalSeconds: 30, startedAt: 0 });
    expect(getPreshow({ preshow: { view: "teams", rosterPage: 0, faceoffAt: null } } as GameState).rotation).toEqual(
      DEFAULT_PRESHOW.rotation,
    );
  });

  it("uses the default for an out-of-range or non-numeric duration", () => {
    for (const intervalSeconds of [4, 121, "30", NaN]) {
      expect(rotationOf({ enabled: true, intervalSeconds, startedAt: 1 }).intervalSeconds).toBe(30);
    }
  });

  it("accepts the shortest and longest durations", () => {
    expect(rotationOf({ enabled: true, intervalSeconds: 5, startedAt: 1 }).intervalSeconds).toBe(5);
    expect(rotationOf({ enabled: true, intervalSeconds: 120, startedAt: 1 }).intervalSeconds).toBe(120);
  });

  it("stays off without a usable start time", () => {
    expect(rotationOf({ enabled: true, intervalSeconds: 30, startedAt: "soon" }).enabled).toBe(false);
  });

  it("only treats a real true as on", () => {
    expect(rotationOf({ enabled: "yes", intervalSeconds: 30, startedAt: 1 }).enabled).toBe(false);
  });
});

describe("rotation slides", () => {
  const home = Array.from({ length: ROSTER_PAGE_SIZE + 1 }, (_, i) => player(String(i + 1)));
  const away = [player("9")];
  const settings = (rotation: object, view: "teams" | "home" | "away" = "teams", rosterPage = 0) =>
    getPreshow({ preshow: { view, rosterPage, faceoffAt: null, rotation } } as unknown as GameState);
  const on = { enabled: true, intervalSeconds: 10, startedAt: 1000 };

  it("goes through teams, then each home page, then each away page", () => {
    expect(getRotationSlides(home, away)).toEqual([
      { view: "teams", rosterPage: 0 },
      { view: "home", rosterPage: 0 },
      { view: "home", rosterPage: 1 },
      { view: "away", rosterPage: 0 },
    ]);
  });

  it("skips a team with no players", () => {
    expect(getRotationSlides([], away)).toEqual([
      { view: "teams", rosterPage: 0 },
      { view: "away", rosterPage: 0 },
    ]);
  });

  it("is just the teams slide with no rosters at all", () => {
    expect(getRotationSlides([], [])).toEqual([{ view: "teams", rosterPage: 0 }]);
  });

  it("shows the chosen view when rotation is off", () => {
    expect(getCurrentSlide(settings({ ...on, enabled: false }, "away", 2), home, away, 999_999)).toEqual({
      view: "away",
      rosterPage: 2,
    });
  });

  it("starts on the first slide", () => {
    expect(getCurrentSlide(settings(on), home, away, 1000)).toEqual({ view: "teams", rosterPage: 0 });
  });

  it("holds a slide until its time is up, then moves on", () => {
    expect(getCurrentSlide(settings(on), home, away, 10_999)).toEqual({ view: "teams", rosterPage: 0 });
    expect(getCurrentSlide(settings(on), home, away, 11_000)).toEqual({ view: "home", rosterPage: 0 });
  });

  it("goes back to the first slide after the last", () => {
    expect(getCurrentSlide(settings(on), home, away, 1000 + 40_000)).toEqual({ view: "teams", rosterPage: 0 });
  });

  it("stays on the first slide if the clock reads before the start", () => {
    expect(getCurrentSlide(settings(on), home, away, 0)).toEqual({ view: "teams", rosterPage: 0 });
  });

  describe("starting from the slide on screen", () => {
    const NOW = 500_000;
    const startedOn = (view: "teams" | "home" | "away", rosterPage: number, seconds = 10) =>
      settings({ enabled: true, intervalSeconds: seconds, startedAt: rotationStartFor({ view, rosterPage }, home, away, seconds, NOW) });

    it("stays on that slide, then moves to the one after it", () => {
      const preshow = startedOn("home", 1);
      expect(getCurrentSlide(preshow, home, away, NOW)).toEqual({ view: "home", rosterPage: 1 });
      expect(getCurrentSlide(preshow, home, away, NOW + 9_999)).toEqual({ view: "home", rosterPage: 1 });
      expect(getCurrentSlide(preshow, home, away, NOW + 10_000)).toEqual({ view: "away", rosterPage: 0 });
    });

    it("gives that slide its full time", () => {
      expect(msUntilNextSlide(startedOn("away", 0).rotation, NOW)).toBe(10_000);
    });

    it("uses the last real page when the saved page no longer exists", () => {
      expect(getCurrentSlide(startedOn("home", 9), home, away, NOW)).toEqual({ view: "home", rosterPage: 1 });
    });

    it("starts from the teams slide when the current view isn't in the rotation", () => {
      const start = rotationStartFor({ view: "away", rosterPage: 0 }, home, [], 10, NOW);
      expect(start).toBe(NOW);
    });
  });

  it("gives the time left on the current slide", () => {
    expect(msUntilNextSlide(on, 1000)).toBe(10_000);
    expect(msUntilNextSlide(on, 4_000)).toBe(7_000);
    expect(msUntilNextSlide(on, 11_000)).toBe(10_000);
  });

  it("gives the whole wait if the clock reads before the start", () => {
    expect(msUntilNextSlide(on, 0)).toBe(11_000);
  });
});

describe("sortRoster", () => {
  it("orders players by jersey number as a number", () => {
    const sorted = sortRoster([player("10"), player("2"), player("33")]);
    expect(sorted.map((p) => p.jerseyNumber)).toEqual(["2", "10", "33"]);
  });

  it("puts players with no usable number last, by name", () => {
    const sorted = sortRoster([player("", "Zed"), player("7"), player("", "Amy")]);
    expect(sorted.map((p) => p.name)).toEqual(["Player 7", "Amy", "Zed"]);
  });

  it("does not change the roster it was given", () => {
    const roster = [player("10"), player("2")];
    sortRoster(roster);
    expect(roster[0].jerseyNumber).toBe("10");
  });
});

describe("roster pages", () => {
  const roster = Array.from({ length: ROSTER_PAGE_SIZE + 1 }, (_, i) => player(String(i + 1)));

  it("counts one page for an empty or exactly full roster", () => {
    expect(getRosterPageCount([])).toBe(1);
    expect(getRosterPageCount(roster.slice(0, ROSTER_PAGE_SIZE))).toBe(1);
  });

  it("starts a new page after a full one", () => {
    expect(getRosterPageCount(roster)).toBe(2);
    expect(getRosterPage(roster, 0)).toHaveLength(ROSTER_PAGE_SIZE);
    expect(getRosterPage(roster, 1).map((p) => p.jerseyNumber)).toEqual([String(ROSTER_PAGE_SIZE + 1)]);
  });

  it("shows the last page when the saved page no longer exists", () => {
    expect(getRosterPage(roster, 9).map((p) => p.jerseyNumber)).toEqual([String(ROSTER_PAGE_SIZE + 1)]);
  });
});

describe("nextFaceoffTime", () => {
  const now = new Date(2026, 10, 9, 18, 0, 0).getTime();

  it("uses today for a time still to come", () => {
    expect(nextFaceoffTime("19:30", now)).toBe(new Date(2026, 10, 9, 19, 30, 0).getTime());
  });

  it("uses tomorrow for a time already passed", () => {
    expect(nextFaceoffTime("17:30", now)).toBe(new Date(2026, 10, 10, 17, 30, 0).getTime());
  });

  it("uses tomorrow for the current minute", () => {
    expect(nextFaceoffTime("18:00", now)).toBe(new Date(2026, 10, 10, 18, 0, 0).getTime());
  });

  it("returns null for anything that isn't a time", () => {
    for (const value of ["", "soon", "25:00", "19:75"]) {
      expect(nextFaceoffTime(value, now)).toBeNull();
    }
  });
});

describe("faceoffTimeInputValue", () => {
  it("gives the local time a time input expects", () => {
    expect(faceoffTimeInputValue(new Date(2026, 10, 9, 7, 5, 0).getTime())).toBe("07:05");
  });

  it("is empty when no time is set", () => {
    expect(faceoffTimeInputValue(null)).toBe("");
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatCountdown(754_000)).toBe("12:34");
  });

  it("includes hours from an hour upwards", () => {
    expect(formatCountdown(3_723_000)).toBe("1:02:03");
  });

  it("rounds up, so it doesn't reach zero early", () => {
    expect(formatCountdown(500)).toBe("0:01");
  });
});
