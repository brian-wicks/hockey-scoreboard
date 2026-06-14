import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ChangelogPage from "../../components/ChangelogPage";

// Mock global variable
vi.stubGlobal("__APP_VERSION__", "1.7.0");

// Mock changelog data
vi.mock("../../data/changelog", () => ({
  changelogEntries: [
    {
      version: "1.7.0",
      date: "2026-05-11",
      sections: {
        added: ["New feature A"],
        fixed: ["Bug fix B"],
      },
    },
    {
      version: "1.6.0",
      date: "2026-04-01",
      sections: {
        changed: ["Change C"],
        removed: ["Removal D"],
      },
    },
  ],
}));

describe("ChangelogPage Component", () => {
  it("renders all changelog entries", () => {
    render(
      <MemoryRouter>
        <ChangelogPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Changelog")).toBeInTheDocument();
    
    // Check for version 1.7.0
    expect(screen.getByText(/v1.7.0/)).toBeInTheDocument();
    expect(screen.getByText("New feature A")).toBeInTheDocument();
    expect(screen.getByText("Bug fix B")).toBeInTheDocument();
    expect(screen.getAllByText("Added").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fixed").length).toBeGreaterThan(0);

    // Check for version 1.6.0
    expect(screen.getByText(/v1.6.0/)).toBeInTheDocument();
    expect(screen.getByText("Change C")).toBeInTheDocument();
    expect(screen.getByText("Removal D")).toBeInTheDocument();
    expect(screen.getAllByText("Changed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Removed").length).toBeGreaterThan(0);
  });

  it("links back to control panel", () => {
    render(
      <MemoryRouter>
        <ChangelogPage />
      </MemoryRouter>
    );

    const backLink = screen.getByText("Back to Control Panel");
    expect(backLink.closest("a")).toHaveAttribute("href", "/");
  });
});
