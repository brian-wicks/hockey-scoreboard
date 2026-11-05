import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EventLogPanel from "../../components/control-panel/EventLogPanel";
import { useStore } from "../../store";
import { exportGamesheetPdf, getGoalMismatches } from "../../utils/gamesheetPdf";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../../utils/gamesheetPdf", () => ({
  buildGamesheetPdfBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  exportGamesheetPdf: vi.fn(),
  getGoalMismatches: vi.fn().mockReturnValue([]),
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

    expect(screen.getByText("Event log")).toBeInTheDocument();
    
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

    const homeHeading = screen.getByText("Home", { selector: "div.text-xs" });
    const awayHeading = screen.getByText("Away", { selector: "div.text-xs" });
    expect(homeHeading).toBeInTheDocument();
    expect(awayHeading).toBeInTheDocument();
    // Home column (and its goal event) must precede the Away column in document order.
    expect(homeHeading.compareDocumentPosition(awayHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const homeColumn = homeHeading.parentElement!;
    const awayColumn = awayHeading.parentElement!;
    expect(homeColumn.contains(screen.getByDisplayValue("10:00"))).toBe(true); // goal event, home
    expect(awayColumn.contains(screen.getByDisplayValue("Tripping"))).toBe(true); // penalty event, away
  });

  describe("exporting and deleting", () => {
    const team = (name: string, score: number) => ({ name, abbreviation: "T", score, shots: 0, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [] }) as any;
    const deleteEvent = vi.fn();
    const renderPanel = (eventLog: any[] = []) => {
      vi.mocked(useStore).mockImplementation(((selector?: (state: any) => unknown) => {
        const state = { deleteEvent };
        return selector ? selector(state) : state;
      }) as any);
      vi.mocked(getGoalMismatches).mockReturnValue([]);
      return render(
        <EventLogPanel eventLog={eventLog} homeTeam={team("Home", 1)} awayTeam={team("Away", 0)} homePlayers={[]} awayPlayers={[]} updateState={mockUpdateState} />,
      );
    };

    it("exports straight away when the sheet matches the score", () => {
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
      expect(exportGamesheetPdf).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Goals don't match the score")).toBeNull();
    });

    it("asks first when they differ, and Cancel doesn't export", () => {
      renderPanel();
      vi.mocked(getGoalMismatches).mockReturnValue([{ name: "Home", score: 1, sheetGoals: 0 }]);
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));

      expect(exportGamesheetPdf).not.toHaveBeenCalled();
      expect(screen.getByText("Home: 0 on the gamesheet, 1 on the scoreboard")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(exportGamesheetPdf).not.toHaveBeenCalled();
      expect(screen.queryByText("Goals don't match the score")).toBeNull();
    });

    it("exports when told to go ahead anyway", () => {
      renderPanel();
      vi.mocked(getGoalMismatches).mockReturnValue([{ name: "Home", score: 1, sheetGoals: 0 }]);
      fireEvent.click(screen.getByRole("button", { name: /Export PDF/ }));
      fireEvent.click(screen.getByRole("button", { name: "Export anyway" }));
      expect(exportGamesheetPdf).toHaveBeenCalledTimes(1);
    });

    it("deletes the event whose button was clicked", () => {
      renderPanel([{ id: "g1", type: "goal", team: "home", period: "1st", clockTime: "15:00" }]);
      fireEvent.click(screen.getByRole("button", { name: "Delete event at 15:00" }));
      expect(deleteEvent).toHaveBeenCalledWith("g1");
    });

    it("shows period rows once, in order, with each team's older events below them", () => {
      const note = (id: string, team: string, text: string) => ({ id, type: "goalie_change", team, period: "1st", clockTime: "19:00", readOnly: true, note: text });
      renderPanel([
        { id: "s1", type: "period_start", team: "home", period: "1st", clockTime: "20:00", readOnly: true },
        note("h1", "home", "Home first"),
        note("a1", "away", "Away first"),
        { id: "e1", type: "period_end", team: "home", period: "1st", clockTime: "0:00", readOnly: true },
        { id: "s2", type: "period_start", team: "home", period: "OT", clockTime: "5:00", readOnly: true },
        note("h2", "home", "Home second"),
        note("a2", "away", "Away second"),
      ]);

      const position = (text: string) => screen.getByText(text);
      const above = (a: string, b: string) =>
        Boolean(position(a).compareDocumentPosition(position(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(above("Home second", "Start of overtime")).toBe(true);
      expect(above("Away second", "Start of overtime")).toBe(true);
      expect(above("Start of overtime", "End of 1st period")).toBe(true);
      expect(above("End of 1st period", "Home first")).toBe(true);
      expect(above("End of 1st period", "Away first")).toBe(true);
      expect(above("Away first", "Start of 1st period")).toBe(true);
    });

    it("says when a team has no events, even with only period rows logged", () => {
      renderPanel([{ id: "s1", type: "period_start", team: "home", period: "1st", clockTime: "20:00", readOnly: true }]);
      expect(screen.getByText("No home events logged yet.")).toBeInTheDocument();
      expect(screen.getByText("No away events logged yet.")).toBeInTheDocument();
      expect(screen.getAllByText("Start of 1st period")).toHaveLength(1);
    });

    it("offers no delete button on a period row or a penalty's over note", () => {
      renderPanel([
        { id: "s1", type: "period_start", team: "home", period: "1st", clockTime: "20:00", readOnly: true },
        { id: "e1", type: "period_end", team: "home", period: "1st", clockTime: "0:00", readOnly: true },
        { id: "e2", type: "period_end", team: "home", period: "2nd", clockTime: "0:00" },
        { id: "n1", type: "penalty_over_notice", team: "home", period: "1st", clockTime: "12:00", readOnly: true },
      ]);
      expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
    });
  });
});
