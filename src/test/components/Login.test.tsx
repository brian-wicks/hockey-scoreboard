import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Login } from "../../components/Login";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("Login Component", () => {
  it("renders the landing page and calls login when a sign-in button is clicked", () => {
    const mockLogin = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockLogin);

    render(<Login />);

    expect(screen.getByText("Hockey Scoreboard")).toBeInTheDocument();
    expect(screen.getByText(/Sign in with your Google account/i)).toBeInTheDocument();

    // The header and the closer both offer a sign-in button.
    const buttons = screen.getAllByRole("button", { name: /Sign in with Google/i });
    expect(buttons.length).toBeGreaterThan(1);
    fireEvent.click(buttons[0]);

    expect(mockLogin).toHaveBeenCalled();
  });

  it("highlights the app's real-time broadcast capabilities", () => {
    vi.mocked(useStore).mockReturnValue(vi.fn());

    render(<Login />);

    expect(screen.getByText("Score, clock, and penalties in one place")).toBeInTheDocument();
    expect(screen.getByText("Overlay for OBS, vMix, or any capture setup")).toBeInTheDocument();
    expect(screen.getByText("Jumbotron view for the rink")).toBeInTheDocument();
    expect(screen.getByText("Read-only links for anyone following along")).toBeInTheDocument();
  });
});
