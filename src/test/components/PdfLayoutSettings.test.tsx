import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PdfLayoutSettings from "../../components/control-panel/PdfLayoutSettings";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../../utils/gamesheetPdf", () => ({
  buildGamesheetPdfBytes: vi.fn().mockResolvedValue(new Uint8Array()),
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

const homeTeam = { name: "Home", abbreviation: "HOM", score: 0, shots: 0, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [] };
const awayTeam = { name: "Away", abbreviation: "AWY", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ffffff", penalties: [], players: [] };

describe("PdfLayoutSettings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useStore).mockReturnValue({ user: null } as any);
  });

  it("renders the PDF layout tweak form on its own, without a toggle", () => {
    render(<PdfLayoutSettings homeTeam={homeTeam as any} awayTeam={awayTeam as any} eventLog={[]} />);

    expect(screen.getByText("PDF layout tweaks")).toBeInTheDocument();
    expect(screen.getByText("Save to file")).toBeInTheDocument();
    expect(screen.getByText("Load from file")).toBeInTheDocument();
    expect(screen.getByText("Reset defaults")).toBeInTheDocument();
  });

  it("persists layout edits to localStorage, the same key the exporter reads", () => {
    render(<PdfLayoutSettings homeTeam={homeTeam as any} awayTeam={awayTeam as any} eventLog={[]} />);

    const scaleInput = screen.getByDisplayValue("1");
    fireEvent.change(scaleInput, { target: { value: "1.5" } });

    const saved = JSON.parse(localStorage.getItem("gamesheetPdfLayoutV1") ?? "{}");
    expect(saved.scale).toBe(1.5);
  });

  it("resets to defaults when the reset button is clicked", () => {
    render(<PdfLayoutSettings homeTeam={homeTeam as any} awayTeam={awayTeam as any} eventLog={[]} />);

    const scaleInput = screen.getByDisplayValue("1");
    fireEvent.change(scaleInput, { target: { value: "2" } });
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reset defaults"));
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });
});
