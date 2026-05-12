import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ControlPanel from "../../components/ControlPanel";
import { useStore } from "../../store";

const baseGameState = {
  homeTeam: { name: "Home", abbreviation: "HOM", score: 0, shots: 0, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [] },
  awayTeam: { name: "Away", abbreviation: "AWY", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ffffff", penalties: [], players: [] },
  clock: { timeRemaining: 1200000, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  jumbotronGradientsEnabled: true,
};

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

// Mock child components to isolate ControlPanel
vi.mock("../../components/control-panel/ControlPanelHeader", () => ({ default: () => <div>Header</div> }));
vi.mock("../../components/control-panel/ClockControl", () => ({ default: () => <div>Clock</div> }));
vi.mock("../../components/control-panel/TeamControls", () => ({ default: () => <div>Team</div> }));
vi.mock("../../components/control-panel/GameActionsPanel", () => ({ default: () => <div>Actions</div> }));
vi.mock("../../components/control-panel/EventLogPanel", () => ({ default: () => <div>Log</div> }));
vi.mock("../../components/control-panel/OverlayControlsPanel", () => ({ default: () => <div>Overlay Controls</div> }));
vi.mock("../../components/control-panel/SettingsPanel", () => ({ default: () => <div>Settings</div> }));
vi.mock("../../components/control-panel/PresetsPanel", () => ({ default: () => <div>Presets</div> }));
vi.mock("../../components/StreamDeckPanel", () => ({ default: () => <div>StreamDeck</div> }));
vi.mock("../../components/control-panel/ShareModal", () => ({ default: () => <div>ShareModal</div> }));

describe("ControlPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the control panel with its sub-components", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: false,
      user: { uid: "123" },
      ensureInitialized: vi.fn(),
    } as any);

    render(<ControlPanel />);

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Clock")).toBeInTheDocument();
    expect(screen.getAllByText("Team")).toHaveLength(2);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("shows viewer mode message when isViewer is true", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: true,
      user: null,
      ensureInitialized: vi.fn(),
    } as any);

    render(<ControlPanel />);

    expect(screen.getByText(/Viewer Mode/i)).toBeInTheDocument();
  });

  it("switches tabs correctly", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: false,
      user: { uid: "123" },
      ensureInitialized: vi.fn(),
    } as any);

    render(<ControlPanel />);

    // Initially shows Controls
    expect(screen.getByText("Clock")).toBeInTheDocument();

    // Switch to Settings
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));
    // The Settings component (mocked) renders <div>Settings</div>
    // The tab button has a <span>Settings</span>
    // So we check if the mocked component is there
    expect(screen.getByText("Settings", { selector: 'div' })).toBeInTheDocument();
    expect(screen.queryByText("Clock")).not.toBeInTheDocument();

    // Switch to Presets
    fireEvent.click(screen.getByRole("button", { name: /Presets/i }));
    expect(screen.getByText("Presets", { selector: 'div' })).toBeInTheDocument();

    // Switch to Stream Deck
    fireEvent.click(screen.getByRole("button", { name: /Stream Deck/i }));
    expect(screen.getByText("StreamDeck")).toBeInTheDocument();
  });

  it("renders nothing if gameState is null", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: null,
      ensureInitialized: vi.fn(),
    } as any);

    render(<ControlPanel />);

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });
});
