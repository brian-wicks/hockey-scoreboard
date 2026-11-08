import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppSidebar, { OPERATOR_TABS } from "../../components/control-panel/AppSidebar";

describe("AppSidebar", () => {
  it("shows every tab by default", () => {
    render(<AppSidebar activeTab="controls" onSelectTab={vi.fn()} />);
    for (const label of ["Controls", "Settings", "Teams", "Deck"]) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
  });

  it("shows only the given tabs, in both the desktop and mobile navs", () => {
    render(<AppSidebar activeTab="controls" onSelectTab={vi.fn()} tabs={OPERATOR_TABS} />);
    expect(screen.getAllByText("Controls")).toHaveLength(2);
    expect(screen.getAllByText("Deck")).toHaveLength(2);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Teams")).not.toBeInTheDocument();
  });
});
