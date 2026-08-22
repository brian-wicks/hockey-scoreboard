import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ControlPanelHeader from "../../components/control-panel/ControlPanelHeader";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
  MAX_UNDO_STEPS: 20,
}));

describe("ControlPanelHeader", () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: { displayName: "Test User", photoURL: null },
        logout: mockLogout,
        isViewer: false,
        shareId: null,
      }),
    );
  });

  it("calls undo and respects canUndo", () => {
    const onUndo = vi.fn();
    const { rerender } = render(<ControlPanelHeader isConnected={true} onUndo={onUndo} canUndo={false} />, {
      wrapper: MemoryRouter,
    });
    fireEvent.click(screen.getByTitle(/undo last/i));
    expect(onUndo).not.toHaveBeenCalled();

    rerender(<ControlPanelHeader isConnected={true} onUndo={onUndo} canUndo={true} />);
    fireEvent.click(screen.getByTitle(/undo last/i));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("opens the mobile menu, triggers share, and closes the menu", () => {
    const onShare = vi.fn();
    render(<ControlPanelHeader isConnected={true} onUndo={() => {}} canUndo={true} onShare={onShare} />, {
      wrapper: MemoryRouter,
    });

    const toggle = screen.getByLabelText("Toggle menu");
    fireEvent.click(toggle);

    const shareBtn = screen.getByText("Share Scoreboard");
    fireEvent.click(shareBtn);
    expect(onShare).toHaveBeenCalledTimes(1);

    // Menu should close after share.
    expect(screen.queryByText("Share Scoreboard")).toBeNull();
  });

  it("logs out from the mobile menu and closes it", () => {
    render(<ControlPanelHeader isConnected={false} onUndo={() => {}} canUndo={true} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByLabelText("Toggle menu"));
    fireEvent.click(screen.getByText("Sign Out"));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sign Out")).toBeNull();
  });
});

