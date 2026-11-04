import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameEvent, GameState } from "../../store";
import GoalReviewPanel from "../../components/control-panel/GoalReviewPanel";

const baseState: GameState = {
  homeTeam: {
    name: "Home team",
    abbreviation: "HOM",
    score: 1,
    shots: 2,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [],
  },
  awayTeam: {
    name: "Away team",
    abbreviation: "AWY",
    score: 2,
    shots: 4,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  },
  clock: {
    timeRemaining: 18 * 60 * 1000,
    isRunning: false,
    lastUpdate: 0,
  },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  overlayCorner: "top-left",
  jumbotronGradientsEnabled: true,
  lowerThird: { active: false, title: "", subtitle: "" },
  jumbotronGoalHighlight: null,
};

describe("GoalReviewPanel", () => {
  it("shows a lower third when pushing a goal to the jumbotron", () => {
    const updateState = vi.fn();
    const eventLog: GameEvent[] = [
      {
        id: "g1",
        type: "goal",
        team: "home",
        period: "1st",
        clockTime: "19:00",
        scorer: "John Doe",
        assist1: "A1",
        assist2: "A2",
        createdAt: 1,
      },
    ];

    render(
      <GoalReviewPanel
        team="home"
        gameState={baseState}
        eventLog={eventLog}
        rosterPlayers={[]}
        updateState={updateState}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show on jumbotron/i }));

    expect(updateState).toHaveBeenCalledWith(
      expect.objectContaining({
        jumbotronGoalHighlight: expect.objectContaining({
          team: "home",
          scorer: "John Doe",
        }),
        lowerThird: expect.objectContaining({
          active: true,
          title: expect.stringMatching(/home team/i),
          subtitle: expect.stringMatching(/john doe \| assists: a1, a2/i),
        }),
      }),
    );
  });

  it("collapses and expands the list of goals", () => {
    const eventLog = [
      { id: "g1", type: "goal", team: "home", period: "1st", clockTime: "18:00", scorer: "" },
      { id: "g2", type: "goal", team: "home", period: "1st", clockTime: "18:30", scorer: "" },
    ] as GameEvent[];
    render(
      <GoalReviewPanel team="home" gameState={baseState} eventLog={eventLog} rosterPlayers={[]} updateState={vi.fn()} />,
    );

    const toggle = screen.getByRole("button", { name: /Goal review/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByPlaceholderText("Scorer")[0]).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("2");
    const scorer = screen.getAllByPlaceholderText("Scorer")[0];
    expect(scorer).not.toBeVisible();

    fireEvent.click(toggle);
    expect(scorer).toBeVisible();
  });
});
