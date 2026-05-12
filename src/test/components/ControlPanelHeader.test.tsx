import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ControlPanelHeader from "../../components/control-panel/ControlPanelHeader";
import { useStore } from "../../store";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("ControlPanelHeader Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    isConnected: true,
    onUndo: vi.fn(),
    canUndo: true,
    isViewer: false,
    shareId: "test-share",
    onShare: vi.fn(),
  };

  it("renders the app title and undo button", () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: { displayName: "John Doe", photoURL: "http://example.com/photo.jpg" },
        logout: vi.fn(),
        isViewer: false,
        shareId: "test-share",
      })
    );

    render(
      <MemoryRouter>
        <ControlPanelHeader {...baseProps} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Hockey Scoreboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Undo/i)).toBeInTheDocument();
  });

  it("handles profile image loading and fallback", () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: { displayName: "John Doe", photoURL: "http://example.com/photo.jpg" },
        logout: vi.fn(),
        isViewer: false,
        shareId: "test-share",
      })
    );

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <ControlPanelHeader {...baseProps} />
      </MemoryRouter>
    );

    const imgs = screen.getAllByRole("img");
    const img = imgs.find(i => i.getAttribute("alt") === "John Doe");
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer");
    expect(img).toHaveAttribute("crossOrigin", "anonymous");

    // Simulate error
    act(() => {
      fireEvent.error(img!);
    });

    // Fallback icon (lucide-user) should be present
    // We can't easily check for the specific SVG, but we can check if img is gone
    expect(screen.queryByAltText("John Doe")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("calls logout when sign out button is clicked", () => {
    const mockLogout = vi.fn();
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: { displayName: "John Doe" },
        logout: mockLogout,
        isViewer: false,
        shareId: "test-share",
      })
    );

    render(
      <MemoryRouter>
        <ControlPanelHeader {...baseProps} />
      </MemoryRouter>
    );

    const signOutButtons = screen.getAllByTitle(/Sign out/i);
    fireEvent.click(signOutButtons[0]);

    expect(mockLogout).toHaveBeenCalled();
  });
});
