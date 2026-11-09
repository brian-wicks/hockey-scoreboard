import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreshowControlsPanel from "../../components/control-panel/PreshowControlsPanel";
import type { TeamPlayer } from "../../store";
import { DEFAULT_PRESHOW, ROSTER_PAGE_SIZE } from "../../utils/preshow";

const roster = (count: number): TeamPlayer[] =>
  Array.from({ length: count }, (_, i) => ({ id: String(i), jerseyNumber: String(i + 1), name: `P${i + 1}`, position: "" }));

describe("PreshowControlsPanel", () => {
  const updateState = vi.fn();

  const renderPanel = (preshow?: object, homeCount = 3, awayCount = 3, serverTimeOffsetMs = 0) =>
    render(
      <PreshowControlsPanel
        preshow={preshow as any}
        homePlayers={roster(homeCount)}
        awayPlayers={roster(awayCount)}
        updateState={updateState}
        serverTimeOffsetMs={serverTimeOffsetMs}
      />,
    );

  beforeEach(() => vi.clearAllMocks());

  it("keeps to short labels, without paragraphs of explanation", () => {
    const { container } = renderPanel(undefined);
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByText("Pre-show")).toBeInTheDocument();
  });

  it("marks the current view", () => {
    renderPanel({ view: "away", rosterPage: 0, faceoffAt: null });
    expect(screen.getByRole("button", { name: "Away roster" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Teams" })).toHaveAttribute("aria-pressed", "false");
  });

  it("starts on Teams for a game saved before pre-show existed", () => {
    renderPanel(undefined);
    expect(screen.getByRole("button", { name: "Teams" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches view and goes back to the first page", () => {
    renderPanel({ view: "home", rosterPage: 1, faceoffAt: 5000 }, ROSTER_PAGE_SIZE + 1);
    fireEvent.click(screen.getByRole("button", { name: "Away roster" }));
    expect(updateState).toHaveBeenCalledWith({ preshow: { view: "away", rosterPage: 0, faceoffAt: 5000, rotation: DEFAULT_PRESHOW.rotation } });
  });

  describe("paging controls stay in place, disabled when there's nothing to page", () => {
    const expectInactive = () => {
      expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    };

    it("on the teams view", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
      expectInactive();
    });

    it("for a one-page roster", () => {
      renderPanel({ view: "home", rosterPage: 0, faceoffAt: null }, ROSTER_PAGE_SIZE);
      expectInactive();
    });

    it("while rotating, whatever page was last chosen", () => {
      renderPanel(
        { view: "home", rosterPage: 1, faceoffAt: null, rotation: { enabled: true, intervalSeconds: 10, startedAt: 0 } },
        ROSTER_PAGE_SIZE + 1,
      );
      expectInactive();
    });

    it("with a multi-page roster, only the direction it can go is enabled", () => {
      renderPanel({ view: "home", rosterPage: 0, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
      expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    });
  });

  it("uses the roster of the team being shown for paging", () => {
    renderPanel({ view: "away", rosterPage: 0, faceoffAt: null }, 3, ROSTER_PAGE_SIZE + 1);
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("moves forward a page and stops at the last", () => {
    renderPanel({ view: "home", rosterPage: 0, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(updateState).toHaveBeenCalledWith({ preshow: { view: "home", rosterPage: 1, faceoffAt: null, rotation: DEFAULT_PRESHOW.rotation } });
  });

  it("moves back a page and can't go past the last", () => {
    renderPanel({ view: "home", rosterPage: 1, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(updateState).toHaveBeenCalledWith({ preshow: { view: "home", rosterPage: 0, faceoffAt: null, rotation: DEFAULT_PRESHOW.rotation } });
  });

  it("pages from the last real page when the saved page no longer exists", () => {
    renderPanel({ view: "home", rosterPage: 9, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(updateState).toHaveBeenCalledWith({ preshow: { view: "home", rosterPage: 0, faceoffAt: null, rotation: DEFAULT_PRESHOW.rotation } });
  });

  describe("rotation", () => {
    const NOW = 1_000_000;
    const rotating = { enabled: true, intervalSeconds: 10, startedAt: NOW };
    const lastSave = () => updateState.mock.calls.at(-1)![0].preshow;
    const rotateButton = () => screen.getByRole("button", { name: "Rotate slides" });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      return () => vi.useRealTimers();
    });

    it("is off by default, showing 30 seconds a slide", () => {
      renderPanel(undefined);
      expect(rotateButton()).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByLabelText("Seconds per slide")).toHaveValue(30);
    });

    it("turns on keeping the chosen duration, and stays on the slide showing", () => {
      renderPanel({ view: "away", rosterPage: 0, faceoffAt: null, rotation: { enabled: false, intervalSeconds: 45, startedAt: 0 } });
      fireEvent.click(rotateButton());
      const { rotation } = lastSave();
      expect(rotation).toMatchObject({ enabled: true, intervalSeconds: 45 });
      // Teams, home, away: the away roster is the third slide, with two slide lengths behind it.
      expect(rotation.startedAt).toBe(NOW - 2 * 45_000);
    });

    it("stays on the roster page showing when turned on", () => {
      renderPanel({ view: "home", rosterPage: 1, faceoffAt: null }, ROSTER_PAGE_SIZE + 1);
      fireEvent.click(rotateButton());
      expect(lastSave().rotation.startedAt).toBe(NOW - 2 * 30_000);
    });

    it("starts from server time", () => {
      renderPanel(undefined, 3, 3, 5000);
      fireEvent.click(rotateButton());
      expect(lastSave().rotation.startedAt).toBe(NOW + 5000);
    });

    it("shows that it is rotating with no view chosen, and paging disabled", () => {
      renderPanel({ view: "home", rosterPage: 0, faceoffAt: null, rotation: rotating }, ROSTER_PAGE_SIZE + 1);
      expect(rotateButton()).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Home roster" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    });

    it("stays on the slide showing when turned off", () => {
      vi.setSystemTime(NOW + 10_000);
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null, rotation: rotating }, ROSTER_PAGE_SIZE + 1);
      fireEvent.click(rotateButton());
      expect(lastSave()).toEqual({
        view: "home",
        rosterPage: 0,
        faceoffAt: null,
        rotation: { ...rotating, enabled: false },
      });
    });

    it("turns off when a view is chosen by hand", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null, rotation: rotating });
      fireEvent.click(screen.getByRole("button", { name: "Away roster" }));
      expect(lastSave().view).toBe("away");
      expect(lastSave().rotation.enabled).toBe(false);
    });

    const changeSeconds = (value: string) => {
      const input = screen.getByLabelText("Seconds per slide");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    };

    it("stays on the slide showing when the duration changes while rotating", () => {
      // 50 seconds in at 10 a slide, with three slides, is the third: the away roster.
      vi.setSystemTime(NOW + 50_000);
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null, rotation: rotating });
      changeSeconds("20");
      expect(lastSave().rotation).toEqual({ enabled: true, intervalSeconds: 20, startedAt: NOW + 50_000 - 2 * 20_000 });
    });

    it("saves the duration without starting when off", () => {
      renderPanel(undefined);
      changeSeconds("20");
      expect(lastSave().rotation).toEqual({ enabled: false, intervalSeconds: 20, startedAt: 0 });
    });

    it("keeps a duration within the allowed range", () => {
      renderPanel(undefined);
      changeSeconds("2");
      expect(lastSave().rotation.intervalSeconds).toBe(5);
      changeSeconds("500");
      expect(lastSave().rotation.intervalSeconds).toBe(120);
    });

    it("ignores an empty duration", () => {
      renderPanel(undefined);
      changeSeconds("");
      expect(updateState).not.toHaveBeenCalled();
    });
  });

  describe("face-off time", () => {
    const NOW = new Date(2026, 10, 9, 18, 0, 0).getTime();
    const commit = (value: string) => {
      const input = screen.getByLabelText("Face-off time");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      return () => vi.useRealTimers();
    });

    it("saves the next time that clock time comes round", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null });
      commit("19:30");
      expect(updateState).toHaveBeenCalledWith({
        preshow: { view: "teams", rosterPage: 0, faceoffAt: new Date(2026, 10, 9, 19, 30).getTime(), rotation: DEFAULT_PRESHOW.rotation },
      });
    });

    it("works from server time when choosing today or tomorrow", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: null }, 3, 3, 2 * 60 * 60 * 1000);
      commit("19:30");
      expect(updateState).toHaveBeenCalledWith({
        preshow: { view: "teams", rosterPage: 0, faceoffAt: new Date(2026, 10, 10, 19, 30).getTime(), rotation: DEFAULT_PRESHOW.rotation },
      });
    });

    it("shows the saved time", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: new Date(2026, 10, 9, 19, 30).getTime() });
      expect(screen.getByLabelText("Face-off time")).toHaveValue("19:30");
    });

    it("clears the time when the box is emptied", () => {
      renderPanel({ view: "teams", rosterPage: 0, faceoffAt: NOW + 1000 });
      commit("");
      expect(updateState).toHaveBeenCalledWith({ preshow: { view: "teams", rosterPage: 0, faceoffAt: null, rotation: DEFAULT_PRESHOW.rotation } });
    });

    it("clears the time with the button, which only shows when one is set", () => {
      const { unmount } = renderPanel({ view: "home", rosterPage: 0, faceoffAt: NOW + 1000 });
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(updateState).toHaveBeenCalledWith({ preshow: { view: "home", rosterPage: 0, faceoffAt: null, rotation: DEFAULT_PRESHOW.rotation } });
      unmount();
      renderPanel({ view: "home", rosterPage: 0, faceoffAt: null });
      expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    });
  });
});
