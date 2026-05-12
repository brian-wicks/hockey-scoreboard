import { describe, expect, it, vi } from "vitest";
import { buildGamesheetPdfBytes, getDefaultGamesheetPdfLayout } from "../../utils/gamesheetPdf";

// Mock pdf-lib
vi.mock("pdf-lib", () => {
  const mockPage = {
    drawText: vi.fn(),
    getHeight: vi.fn().mockReturnValue(842), // A4 height
    getWidth: vi.fn().mockReturnValue(595), // A4 width
    getSize: vi.fn().mockReturnValue({ width: 595, height: 842 }),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    drawRectangle: vi.fn(),
    drawImage: vi.fn(),
  };
  const mockDoc = {
    getPages: vi.fn().mockReturnValue([mockPage]),
    getPage: vi.fn().mockReturnValue(mockPage),
    save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    embedFont: vi.fn().mockResolvedValue({}),
    embedPng: vi.fn().mockResolvedValue({}),
    embedJpg: vi.fn().mockResolvedValue({}),
  };
  return {
    PDFDocument: {
      load: vi.fn().mockResolvedValue(mockDoc),
    },
    rgb: vi.fn(),
    StandardFonts: {
      Helvetica: "Helvetica",
      HelveticaBold: "Helvetica-Bold",
    },
  };
});

describe("Gamesheet PDF Utility", () => {
  const mockGameState = {
    homeTeam: { name: "Home", abbreviation: "HOM", score: 2, shots: 5, penalties: [], players: [] },
    awayTeam: { name: "Away", abbreviation: "AWY", score: 1, shots: 7, penalties: [], players: [] },
    eventLog: [
      { id: "1", type: "goal", team: "home", period: "1st", clockTime: "10:00", scorer: "10", assist1: "11", createdAt: Date.now() },
      { id: "2", type: "penalty_added", team: "away", period: "2nd", clockTime: "05:00", playerNumber: "22", infraction: "Tripping", penaltyDurationMs: 120000, createdAt: Date.now() },
    ],
    period: "3rd",
  } as any;

  it("returns default layout", () => {
    const layout = getDefaultGamesheetPdfLayout();
    expect(layout).toBeDefined();
    expect(layout.version).toBe(2);
  });

  it("builds PDF bytes", async () => {
    // Mock fetch for the template
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    } as any);

    const layout = getDefaultGamesheetPdfLayout();
    
    const result = await buildGamesheetPdfBytes(
      {
        homeTeam: mockGameState.homeTeam,
        awayTeam: mockGameState.awayTeam,
        eventLog: mockGameState.eventLog,
      },
      { layout }
    );

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
  });
});
