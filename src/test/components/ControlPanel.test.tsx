import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ControlPanel from "../../components/ControlPanel";
import { useStore } from "../../store";

const renderControlPanel = () => render(<ControlPanel />, { wrapper: MemoryRouter });

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
vi.mock("../../components/control-panel/PreshowControlsPanel", () => ({ default: () => <div>Pre-show Controls</div> }));
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

    renderControlPanel();

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Clock")).toBeInTheDocument();
    expect(screen.getAllByText("Team")).toHaveLength(2);
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("has the pre-show controls on the Controls tab", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: false,
      user: { uid: "123" },
      ensureInitialized: vi.fn(),
    } as any);

    renderControlPanel();

    expect(screen.getByText("Pre-show Controls")).toBeInTheDocument();
  });

  it("gives a second operator the pre-show controls", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: false,
      isOperator: true,
      activeGameId: "game-1",
      ensureInitialized: vi.fn(),
    } as any);

    renderControlPanel();

    expect(screen.getByText("Pre-show Controls")).toBeInTheDocument();
  });

  it("switches tabs correctly", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      updateState: vi.fn(),
      isViewer: false,
      user: { uid: "123" },
      ensureInitialized: vi.fn(),
    } as any);

    renderControlPanel();

    // Initially shows Controls
    expect(screen.getByText("Clock")).toBeInTheDocument();

    // AppSidebar renders both a desktop rail and a mobile bottom bar (visibility is
    // CSS-media-query-driven, so both exist in the DOM in jsdom) — click the first match.
    // Switch to Settings
    fireEvent.click(screen.getAllByRole("button", { name: /Settings/i })[0]);
    // The Settings component (mocked) renders <div>Settings</div>
    // The tab button has a <span>Settings</span>
    // So we check if the mocked component is there
    expect(screen.getByText("Settings", { selector: 'div' })).toBeInTheDocument();
    expect(screen.queryByText("Clock")).not.toBeInTheDocument();

    // Switch to Teams
    fireEvent.click(screen.getAllByRole("button", { name: /Teams/i })[0]);
    expect(screen.getByText("Presets", { selector: 'div' })).toBeInTheDocument();

    // Switch to Stream Deck (sidebar label is shortened to "Deck" to stay one line)
    fireEvent.click(screen.getAllByRole("button", { name: /^Deck$/i })[0]);
    expect(screen.getByText("StreamDeck")).toBeInTheDocument();
  });

  it("renders nothing if gameState is null", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: null,
      ensureInitialized: vi.fn(),
    } as any);

    renderControlPanel();

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  describe("second operator", () => {
    const renderAt = (path: string, state: Record<string, unknown> = {}) => {
      vi.mocked(useStore).mockReturnValue({
        gameState: baseGameState,
        updateState: vi.fn(),
        isViewer: false,
        isOperator: true,
        user: null,
        activeGameId: "game-1",
        ensureInitialized: vi.fn(),
        ...state,
      } as any);
      return render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/operate/:operatorId" element={<ControlPanel />} />
            <Route path="/" element={<div>Dashboard page</div>} />
          </Routes>
        </MemoryRouter>,
      );
    };

    it("shows only the Controls and Deck tabs, with no banner", () => {
      renderAt("/operate/op-1");
      expect(screen.queryByText("Second operator: changes here go live")).not.toBeInTheDocument();
      expect(screen.getAllByText("Deck")).toHaveLength(2);
      expect(screen.queryByText("Teams")).not.toBeInTheDocument();
    });

    it("stays on Controls when the URL asks for a tab they can't use", () => {
      for (const tab of ["settings", "presets"]) {
        const { unmount } = renderAt(`/operate/op-1?tab=${tab}`);
        expect(screen.getByText("Clock")).toBeInTheDocument();
        expect(screen.queryByText("Presets")).not.toBeInTheDocument();
        expect(screen.queryByText("Settings")).not.toBeInTheDocument();
        unmount();
      }
    });

    it("can open Deck from the URL", () => {
      renderAt("/operate/op-1?tab=streamdeck");
      expect(screen.getByText("StreamDeck")).toBeInTheDocument();
    });

    it("doesn't redirect to the Dashboard when no game is open", () => {
      renderAt("/operate/op-1", { activeGameId: null });
      expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    });

    it("doesn't render the share sheet", () => {
      renderAt("/operate/op-1");
      expect(screen.queryByText("ShareModal")).not.toBeInTheDocument();
    });

    it("keeps the controls interactive", () => {
      const { container } = renderAt("/operate/op-1");
      expect(container.querySelector(".pointer-events-none")).toBeNull();
    });
  });

});
