import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppFooter from "../../components/AppFooter";

// Mock global variable
vi.stubGlobal("__APP_VERSION__", "1.7.0");

describe("AppFooter Component", () => {
  it("renders the app version and link to changelog", () => {
    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>
    );

    const versionLink = screen.getByText("v1.7.0");
    expect(versionLink).toBeInTheDocument();
    expect(versionLink.closest("a")).toHaveAttribute("href", "/changelog");
  });

  it("dodges the mobile bottom nav bar only on /game", () => {
    const { container: rootContainer } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppFooter />
      </MemoryRouter>,
    );
    expect(rootContainer.querySelector("footer")).toHaveClass("bottom-3");
    expect(rootContainer.querySelector("footer")).not.toHaveClass("bottom-16");

    const { container: gameContainer } = render(
      <MemoryRouter initialEntries={["/game"]}>
        <AppFooter />
      </MemoryRouter>,
    );
    expect(gameContainer.querySelector("footer")).toHaveClass("bottom-16");
  });
});
