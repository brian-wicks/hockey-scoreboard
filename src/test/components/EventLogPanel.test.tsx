import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EventLogPanel from "../../components/control-panel/EventLogPanel";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../../utils/gamesheetPdf", () => ({
  buildGamesheetPdfBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  exportGamesheetPdf: vi.fn(),
  getDefaultGamesheetPdfLayout: vi.fn().mockReturnValue({
    scale: 1, offsetX: 0, offsetY: 0,
    teamNames: { homeX: 0, homeYFromTop: 0, awayX: 0, awayYFromTop: 0, size: 10 },
    awayRoster: { numX: 0, nameX: 0, goalsX: 0, assistsX: 0, pimX: 0, yFromTop: 0, lineHeight: 10, size: 10, maxLines: 20 },
    homeRoster: { numX: 0, nameX: 0, goalsX: 0, assistsX: 0, pimX: 0, yFromTop: 0, lineHeight: 10, size: 10, maxLines: 20 },
    awayNmRoster: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 5, cols: { numX: 0, nameX: 0 } },
    homeNmRoster: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 5, cols: { numX: 0, nameX: 0 } },
    awayGoals: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 15, cols: { timeX: 0, scorerX: 0, assist1X: 0, assist2X: 0 }, aligns: {} },
    homeGoals: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 15, cols: { timeX: 0, scorerX: 0, assist1X: 0, assist2X: 0 }, aligns: {} },
    awayPenalties: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 15, cols: {}, aligns: {} },
    homePenalties: { yFromTop: 0, lineHeight: 10, size: 10, maxLines: 15, cols: {}, aligns: {} },
    homeShots: { x: 0, yFromTop: 0, size: 10 },
    awayShots: { x: 0, yFromTop: 0, size: 10 },
    awayPeriodLabel: { goalsX: 0, size: 10 },
    awayPeriodGoals: { yFromTop: 0, size: 10, cols: {} },
    homePeriodLabel: { goalsX: 0, size: 10 },
    homePeriodGoals: { yFromTop: 0, size: 10, cols: {} },
    awayPeriodPim: { yFromTop: 0, size: 10, cols: {} },
    homePeriodPim: { yFromTop: 0, size: 10, cols: {} },
  }),
}));

describe("EventLogPanel Component", () => {
  const mockUpdateState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      user: null,
    } as any);
  });

  const mockGameState = {
    homeTeam: { name: "Home", abbreviation: "HOM", score: 2, shots: 5, penalties: [], players: [] },
    awayTeam: { name: "Away", abbreviation: "AWY", score: 1, shots: 7, penalties: [], players: [] },
    eventLog: [
      { id: "1", type: "goal", team: "home", period: "1st", clockTime: "10:00", scorer: "10", createdAt: Date.now() },
      { id: "2", type: "penalty_added", team: "away", period: "2nd", clockTime: "05:00", playerNumber: "22", infraction: "Tripping", createdAt: Date.now() },
    ],
  } as any;

  it("renders the event log entries", () => {
    render(
      <EventLogPanel
        eventLog={mockGameState.eventLog}
        homeTeam={mockGameState.homeTeam}
        awayTeam={mockGameState.awayTeam}
        homePlayers={[]}
        awayPlayers={[]}
        updateState={mockUpdateState}
      />
    );

    expect(screen.getByText("Event Log")).toBeInTheDocument();
    
    // Check for goal event by looking for its specific inputs
    expect(screen.getByDisplayValue("10")).toBeInTheDocument(); // Scorer
    expect(screen.getByDisplayValue("10:00")).toBeInTheDocument();

    // Check for penalty event
    expect(screen.getByDisplayValue("22")).toBeInTheDocument(); // Player #
    expect(screen.getByDisplayValue("Tripping")).toBeInTheDocument();
  });

  it("handles event type changes", () => {
    render(
      <EventLogPanel
        eventLog={mockGameState.eventLog}
        homeTeam={mockGameState.homeTeam}
        awayTeam={mockGameState.awayTeam}
        homePlayers={[]}
        awayPlayers={[]}
        updateState={mockUpdateState}
      />
    );

    // Home column renders first: its lone event (id "1") owns the first type select.
    const typeSelects = screen.getAllByRole("combobox");
    fireEvent.change(typeSelects[0], { target: { value: "goal_revoked" } });

    // Should call updateState with updated type
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      eventLog: expect.arrayContaining([
        expect.objectContaining({ id: "1", type: "goal_revoked" })
      ])
    }));
  });

  it("splits events into a Home column and an Away column", () => {
    render(
      <EventLogPanel
        eventLog={mockGameState.eventLog}
        homeTeam={mockGameState.homeTeam}
        awayTeam={mockGameState.awayTeam}
        homePlayers={[]}
        awayPlayers={[]}
        updateState={mockUpdateState}
      />
    );

    const homeHeading = screen.getByText("Home", { selector: "div.uppercase" });
    const awayHeading = screen.getByText("Away", { selector: "div.uppercase" });
    expect(homeHeading).toBeInTheDocument();
    expect(awayHeading).toBeInTheDocument();
    // Home column (and its goal event) must precede the Away column in document order.
    expect(homeHeading.compareDocumentPosition(awayHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const homeColumn = homeHeading.parentElement!;
    const awayColumn = awayHeading.parentElement!;
    expect(homeColumn.contains(screen.getByDisplayValue("10:00"))).toBe(true); // goal event, home
    expect(awayColumn.contains(screen.getByDisplayValue("Tripping"))).toBe(true); // penalty event, away
  });
});
