import type React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreshowPage, { FADE_MS } from "../../components/PreshowPage";
import { useStore } from "../../store";
import { ROSTER_PAGE_SIZE } from "../../utils/preshow";

vi.mock("../../store", () => ({ useStore: vi.fn() }));

const NOW = new Date(2026, 10, 9, 18, 0, 0).getTime();

const players = [
  { id: "a", jerseyNumber: "10", name: "Casey Cole", position: "C" },
  { id: "b", jerseyNumber: "2", name: "Ash Ames", position: "A" },
  { id: "c", jerseyNumber: "30", name: "Nic Net", position: "NM" },
  { id: "d", jerseyNumber: "7", name: "Rob Reed", position: "" },
];

const baseGame = {
  homeTeam: { name: "Ice Bears", abbreviation: "IB", logo: "home.png", color: "#123456", players },
  awayTeam: { name: "Wolves", abbreviation: "WOL", logo: "", color: "#654321", players: [] },
  eventLog: [],
};

describe("PreshowPage", () => {
  const ensureInitialized = vi.fn();

  const renderWith = (preshow?: object, overrides: object = {}, serverTimeOffsetMs = 0) => {
    vi.mocked(useStore).mockReturnValue({
      gameState: { ...baseGame, preshow, ...overrides },
      ensureInitialized,
      serverTimeOffsetMs,
    } as any);
    return render(<PreshowPage />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the game while connecting", () => {
    vi.mocked(useStore).mockReturnValue({ gameState: null, ensureInitialized, serverTimeOffsetMs: 0 } as any);
    render(<PreshowPage />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(ensureInitialized).toHaveBeenCalled();
  });

  describe("teams view", () => {
    it("is the default, for a game saved before pre-show existed", () => {
      renderWith(undefined);
      expect(screen.getByText("Coming up")).toBeInTheDocument();
      expect(screen.getByText("Ice Bears")).toBeInTheDocument();
      expect(screen.getByText("Wolves")).toBeInTheDocument();
      expect(screen.getByText("VS")).toBeInTheDocument();
      expect(screen.queryByText("Casey Cole")).not.toBeInTheDocument();
    });

    it("uses the abbreviation for a team with no name", () => {
      renderWith(undefined, { homeTeam: { ...baseGame.homeTeam, name: "" } });
      expect(screen.getByText("IB")).toBeInTheDocument();
    });

    it("shows each team's logo, or a placeholder without one", () => {
      const { container } = renderWith(undefined);
      expect(screen.getByAltText("Ice Bears")).toHaveAttribute("src", "home.png");
      expect(container.querySelector(".results-logo-fallback")).toBeInTheDocument();
    });

    it("doesn't show goalies", () => {
      renderWith(undefined);
      expect(screen.queryByText(/Goalie/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Nic Net/)).not.toBeInTheDocument();
    });
  });

  describe("roster view", () => {
    it("shows the chosen team's players in number order", () => {
      renderWith({ view: "home", rosterPage: 0, faceoffAt: null });
      expect(screen.getByText("Ice Bears")).toBeInTheDocument();
      expect(screen.queryByText("Wolves")).not.toBeInTheDocument();
      const names = screen.getAllByRole("listitem").map((item) => within(item).getByTestId("player-name").textContent);
      expect(names).toEqual(["Ash Ames", "Rob Reed", "Casey Cole", "Nic Net"]);
    });

    it("marks captains, assistants and netminders, and nobody else", () => {
      renderWith({ view: "home", rosterPage: 0, faceoffAt: null });
      const row = (name: string) => screen.getByText(name).closest("li")!;
      expect(within(row("Casey Cole")).getByText("C")).toBeInTheDocument();
      expect(within(row("Ash Ames")).getByText("A")).toBeInTheDocument();
      expect(within(row("Nic Net")).getByText("NM")).toBeInTheDocument();
      expect(row("Rob Reed").querySelector(".preshow-player-badge")).toBeNull();
    });

    it("says so when a team has no roster", () => {
      renderWith({ view: "away", rosterPage: 0, faceoffAt: null });
      expect(screen.getByText("Wolves")).toBeInTheDocument();
      expect(screen.getByText("No roster added")).toBeInTheDocument();
    });

    describe("with more than one page", () => {
      const long = Array.from({ length: ROSTER_PAGE_SIZE + 2 }, (_, i) => ({
        id: String(i),
        jerseyNumber: String(i + 1),
        name: `Player ${i + 1}`,
        position: "",
      }));
      const longGame = { homeTeam: { ...baseGame.homeTeam, players: long } };

      it("shows only the chosen page, with no page count", () => {
        renderWith({ view: "home", rosterPage: 1, faceoffAt: null }, longGame);
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText(`Player ${ROSTER_PAGE_SIZE + 1}`)).toBeInTheDocument();
        expect(screen.queryByText(/^Page /)).not.toBeInTheDocument();
      });

      it("shows the last page when the saved page no longer exists", () => {
        renderWith({ view: "home", rosterPage: 9, faceoffAt: null }, longGame);
        expect(screen.getByText(`Player ${ROSTER_PAGE_SIZE + 2}`)).toBeInTheDocument();
      });
    });
  });

  describe("rotation", () => {
    const rotating = (intervalSeconds = 10) => ({
      view: "teams",
      rosterPage: 0,
      faceoffAt: null,
      rotation: { enabled: true, intervalSeconds, startedAt: NOW },
    });
    const advance = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });

    it("moves to the next slide when the time is up", () => {
      renderWith(rotating());
      expect(screen.getByText("VS")).toBeInTheDocument();
      advance(9_999);
      expect(screen.queryByText("Casey Cole")).not.toBeInTheDocument();
      advance(1);
      expect(screen.getByText("Casey Cole")).toBeInTheDocument();
    });

    it("skips a team with no players and returns to the teams slide", () => {
      renderWith(rotating());
      advance(10_000);
      advance(FADE_MS);
      expect(screen.getByText("Casey Cole")).toBeInTheDocument();
      advance(10_000 - FADE_MS);
      advance(FADE_MS);
      expect(screen.getByText("VS")).toBeInTheDocument();
      expect(screen.queryByText("No roster added")).not.toBeInTheDocument();
    });

    it("rejoins at the right slide after a reload", () => {
      vi.setSystemTime(NOW + 15_000);
      renderWith(rotating());
      expect(screen.getByText("Casey Cole")).toBeInTheDocument();
    });

    it("doesn't fade in on first load", () => {
      const { container } = renderWith(rotating());
      expect(container.querySelector(".preshow-slide-entering")).toBeNull();
    });

    it("stays still when rotation is off", () => {
      renderWith({ view: "teams", rosterPage: 0, faceoffAt: null });
      advance(120_000);
      expect(screen.getByText("VS")).toBeInTheDocument();
    });

    it("works from server time, so screens stay in step", () => {
      renderWith(rotating(), {}, 15_000);
      expect(screen.getByText("Casey Cole")).toBeInTheDocument();
    });
  });

  describe("fade", () => {
    const rotating = {
      view: "teams",
      rosterPage: 0,
      faceoffAt: null,
      rotation: { enabled: true, intervalSeconds: 10, startedAt: NOW },
    };

    it("shows both slides while fading, with the old one hidden from screen readers", () => {
      const { container } = renderWith(rotating);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      const entering = container.querySelector(".preshow-slide-entering")!;
      const leaving = container.querySelector(".preshow-slide-leaving")!;
      expect(within(entering as HTMLElement).getByText("Casey Cole")).toBeInTheDocument();
      expect(within(leaving as HTMLElement).getByText("VS")).toBeInTheDocument();
      expect(leaving).toHaveAttribute("aria-hidden", "true");
    });

    it("removes the old slide when the fade ends", () => {
      const { container } = renderWith(rotating);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      act(() => {
        vi.advanceTimersByTime(FADE_MS);
      });
      expect(container.querySelector(".preshow-slide-leaving")).toBeNull();
      expect(screen.queryByText("VS")).not.toBeInTheDocument();
      expect(screen.getByText("Casey Cole")).toBeInTheDocument();
    });

    it("also fades when a view is chosen by hand", () => {
      const { container, rerender } = renderWith({ view: "teams", rosterPage: 0, faceoffAt: null });
      vi.mocked(useStore).mockReturnValue({
        gameState: { ...baseGame, preshow: { view: "home", rosterPage: 0, faceoffAt: null } },
        ensureInitialized,
        serverTimeOffsetMs: 0,
      } as any);
      rerender(<PreshowPage />);
      expect(container.querySelector(".preshow-slide-entering")).toBeInTheDocument();
      expect(container.querySelector(".preshow-slide-leaving")).toBeInTheDocument();
    });

    describe("between pages of one team's roster", () => {
      const long = Array.from({ length: ROSTER_PAGE_SIZE + 2 }, (_, i) => ({
        id: String(i),
        jerseyNumber: String(i + 1),
        name: `Player ${i + 1}`,
        position: "",
      }));
      const longGame = { homeTeam: { ...baseGame.homeTeam, players: long } };
      const onPage = (rosterPage: number) => ({ view: "home", rosterPage, faceoffAt: null });
      const switchToPage = (rerender: (ui: React.ReactElement) => void, rosterPage: number) => {
        vi.mocked(useStore).mockReturnValue({
          gameState: { ...baseGame, ...longGame, preshow: onPage(rosterPage) },
          ensureInitialized,
          serverTimeOffsetMs: 0,
        } as any);
        rerender(<PreshowPage />);
      };

      it("fades only the players, with one logo and name that never leave", () => {
        const { container, rerender } = renderWith(onPage(0), longGame);
        const logo = screen.getByAltText("Ice Bears");
        switchToPage(rerender, 1);

        expect(screen.getByAltText("Ice Bears")).toBe(logo);
        expect(screen.getAllByText("Ice Bears")).toHaveLength(1);
        expect(logo.closest(".preshow-slide-leaving, .preshow-slide-entering")).toBeNull();

        const leaving = container.querySelector<HTMLElement>(".preshow-slide-leaving")!;
        const entering = container.querySelector<HTMLElement>(".preshow-slide-entering")!;
        expect(within(leaving).getByText("Player 1")).toBeInTheDocument();
        expect(within(entering).getByText(`Player ${ROSTER_PAGE_SIZE + 1}`)).toBeInTheDocument();
      });

      it("removes the old page when the fade ends", () => {
        const { container, rerender } = renderWith(onPage(0), longGame);
        switchToPage(rerender, 1);
        act(() => {
          vi.advanceTimersByTime(FADE_MS);
        });
        expect(container.querySelector(".preshow-slide-leaving")).toBeNull();
        expect(screen.queryByText("Player 1")).not.toBeInTheDocument();
      });

      it("does the same while rotating", () => {
        const { container } = renderWith(
          { view: "teams", rosterPage: 0, faceoffAt: null, rotation: { enabled: true, intervalSeconds: 10, startedAt: NOW - 10_000 } },
          longGame,
        );
        const logo = screen.getByAltText("Ice Bears");
        act(() => {
          vi.advanceTimersByTime(10_000);
        });
        expect(screen.getByAltText("Ice Bears")).toBe(logo);
        expect(logo.closest(".preshow-slide-leaving, .preshow-slide-entering")).toBeNull();
        expect(within(container.querySelector<HTMLElement>(".preshow-slide-entering")!).getByText(`Player ${ROSTER_PAGE_SIZE + 1}`)).toBeInTheDocument();
      });

      it("still fades the whole slide when the team changes", () => {
        const { container, rerender } = renderWith(onPage(0), longGame);
        vi.mocked(useStore).mockReturnValue({
          gameState: { ...baseGame, ...longGame, preshow: { view: "away", rosterPage: 0, faceoffAt: null } },
          ensureInitialized,
          serverTimeOffsetMs: 0,
        } as any);
        rerender(<PreshowPage />);
        const leaving = container.querySelector<HTMLElement>(".preshow-slide-leaving")!;
        const entering = container.querySelector<HTMLElement>(".preshow-slide-entering")!;
        expect(within(leaving).getByText("Ice Bears")).toBeInTheDocument();
        expect(within(entering).getByText("Wolves")).toBeInTheDocument();
      });

      it("doesn't fade when a saved page beyond the end changes to the last page", () => {
        const { container, rerender } = renderWith(onPage(9), longGame);
        switchToPage(rerender, 1);
        expect(container.querySelector(".preshow-slide-leaving")).toBeNull();
      });
    });

    it("keeps the title and countdown outside the fading slides", () => {
      const { container } = renderWith({ ...rotating, faceoffAt: NOW + 60_000 });
      expect(container.querySelector(".preshow-slide .results-title")).toBeNull();
      expect(container.querySelector(".preshow-slide .preshow-countdown")).toBeNull();
      expect(screen.getByText("Coming up")).toBeInTheDocument();
    });
  });

  describe("countdown", () => {
    it("shows nothing with no face-off time, but keeps its space so the layout doesn't move", () => {
      const { container } = renderWith({ view: "teams", rosterPage: 0, faceoffAt: null });
      expect(screen.queryByText(/Face-off in/)).not.toBeInTheDocument();
      expect(screen.queryByText("Starting soon")).not.toBeInTheDocument();
      const reserved = container.querySelector(".preshow-countdown")!;
      expect(reserved).toHaveClass("preshow-countdown-empty");
      expect(reserved).toHaveAttribute("aria-hidden", "true");
    });

    it("uses that same space when a time is set", () => {
      const { container } = renderWith({ view: "teams", rosterPage: 0, faceoffAt: NOW + 60_000 });
      expect(container.querySelector(".preshow-countdown")).not.toHaveClass("preshow-countdown-empty");
    });

    it("counts down on the teams view", () => {
      renderWith({ view: "teams", rosterPage: 0, faceoffAt: NOW + 754_000 });
      expect(screen.getByText("Face-off in 12:34")).toBeInTheDocument();
    });

    it("also shows on a roster view", () => {
      renderWith({ view: "home", rosterPage: 0, faceoffAt: NOW + 60_000 });
      expect(screen.getByText("Face-off in 1:00")).toBeInTheDocument();
    });

    it("keeps ticking, then says the game is starting soon at zero", () => {
      renderWith({ view: "teams", rosterPage: 0, faceoffAt: NOW + 2_000 });
      expect(screen.getByText("Face-off in 0:02")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByText("Face-off in 0:01")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByText("Starting soon")).toBeInTheDocument();
      expect(screen.queryByText(/Face-off in/)).not.toBeInTheDocument();
    });

    it("says the game is starting soon when the time has already passed", () => {
      renderWith({ view: "teams", rosterPage: 0, faceoffAt: NOW - 5_000 });
      expect(screen.getByText("Starting soon")).toBeInTheDocument();
    });

    it("uses server time, so a wrong local clock doesn't change it", () => {
      renderWith({ view: "teams", rosterPage: 0, faceoffAt: NOW + 120_000 }, {}, 60_000);
      expect(screen.getByText("Face-off in 1:00")).toBeInTheDocument();
    });
  });
});
