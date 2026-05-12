import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Login } from "../../components/Login";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("Login Component", () => {
  it("renders the login button and calls login on click", () => {
    const mockLogin = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockLogin);

    render(<Login />);

    expect(screen.getByText("Hockey Scoreboard")).toBeInTheDocument();
    expect(screen.getByText(/Sign in with your Google account/i)).toBeInTheDocument();
    
    const button = screen.getByRole("button", { name: /Sign in with Google/i });
    fireEvent.click(button);

    expect(mockLogin).toHaveBeenCalled();
  });
});
