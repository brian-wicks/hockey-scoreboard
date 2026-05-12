import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StreamDeckPanel from "../../components/StreamDeckPanel";
import { useStore } from "../../store";
import { useSharedActions } from "../../hooks/useSharedActions";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("../../hooks/useSharedActions", () => ({
  useSharedActions: vi.fn(),
}));

describe("StreamDeckPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockConfig = {
    buttons: [
      { id: "1", label: "Goal Home", action: "homeScoreIncrease", color: "#ff0000" },
      { id: "2", label: "Stop Clock", action: "clockStop", color: "#0000ff" },
    ],
  };

  const mockGameState = {
    homeTeam: { name: "Home", color: "#ff0000", penalties: [] },
    awayTeam: { name: "Away", color: "#0000ff", penalties: [] },
    clock: { isRunning: false, timeRemaining: 1200000 },
    eventLog: [],
  };

  it("renders the stream deck buttons", async () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: mockGameState,
      streamDeckConfig: mockConfig,
      loadStreamDeckConfig: vi.fn(),
      updateStreamDeckButton: vi.fn(),
      ensureInitialized: vi.fn(),
    } as any);

    vi.mocked(useSharedActions).mockReturnValue({
      handleAction: vi.fn(),
    } as any);

    render(<StreamDeckPanel />);

    expect(await screen.findByText("Goal Home")).toBeInTheDocument();
    expect(screen.getByText("Stop Clock")).toBeInTheDocument();
  });

  it("calls handleAction when a button is clicked", async () => {
    const mockHandleAction = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      gameState: mockGameState,
      streamDeckConfig: mockConfig,
      loadStreamDeckConfig: vi.fn(),
      updateStreamDeckButton: vi.fn(),
      ensureInitialized: vi.fn(),
    } as any);

    vi.mocked(useSharedActions).mockReturnValue({
      handleAction: mockHandleAction,
    } as any);

    render(<StreamDeckPanel />);

    const button = (await screen.findByText("Goal Home")).closest("button");
    fireEvent.click(button!);

    expect(mockHandleAction).toHaveBeenCalledWith("homeScoreIncrease");
  });

  it("opens the editor when the settings button is clicked", async () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: mockGameState,
      streamDeckConfig: mockConfig,
      loadStreamDeckConfig: vi.fn(),
      updateStreamDeckButton: vi.fn(),
      ensureInitialized: vi.fn(),
    } as any);

    vi.mocked(useSharedActions).mockReturnValue({
      handleAction: vi.fn(),
    } as any);

    render(<StreamDeckPanel />);

    // Find the settings button for the first stream deck button
    // It's the one with the lucide-settings icon
    const settingsButtons = screen.getAllByRole("button").filter(b => b.querySelector("svg.lucide-settings"));
    fireEvent.click(settingsButtons[0]);

    expect(await screen.findByText(/Edit Button 1/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Goal Home")).toBeInTheDocument();
  });
});
