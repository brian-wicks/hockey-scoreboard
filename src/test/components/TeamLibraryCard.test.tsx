import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedTeam } from "../../store";
import TeamLibraryCard from "../../components/team/TeamLibraryCard";

const name = "Warwick and Coventry Panthers B";
const entry = { name, team: { name, abbreviation: "WAR", logo: "", color: "#000000", players: [] } } as unknown as SavedTeam;
const popup = () => screen.queryByTestId("truncated-text-popup");

function hoverName(scrollWidth: number, clientWidth: number) {
  render(<TeamLibraryCard entry={entry} onDeleteRequest={vi.fn()} actions={null} />);
  const element = screen.getByText(name);
  Object.defineProperty(element, "scrollWidth", { value: scrollWidth });
  Object.defineProperty(element, "clientWidth", { value: clientWidth });
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  return element;
}

describe("TeamLibraryCard color", () => {
  it("shows the team's color", () => {
    const colored = { ...entry, team: { ...entry.team, color: "#053065" } } as SavedTeam;
    render(<TeamLibraryCard entry={colored} onDeleteRequest={vi.fn()} actions={null} />);
    expect(screen.getByRole("img", { name: "Team color #053065" })).toHaveStyle({ backgroundColor: "#053065" });
  });
});

describe("TeamLibraryCard team name", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the full name in a popup on hover when the name is cut off", () => {
    const element = hoverName(300, 200);
    expect(popup()).toHaveTextContent(name);
    expect(element).not.toHaveAttribute("title");
    // .ui sets the text black and outranks text-canvas, so it has to stay on a parent.
    expect(popup()).not.toHaveClass("ui");
    expect(popup()).toHaveClass("text-canvas");
  });

  it("shows no popup when the whole name fits", () => {
    hoverName(200, 200);
    expect(popup()).toBeNull();
  });

  it("hides the popup when the mouse leaves", () => {
    const element = hoverName(300, 200);
    fireEvent.mouseLeave(element);
    expect(popup()).toBeNull();
  });

  it("doesn't show the popup if the mouse leaves before the delay ends", () => {
    render(<TeamLibraryCard entry={entry} onDeleteRequest={vi.fn()} actions={null} />);
    const element = screen.getByText(name);
    Object.defineProperty(element, "scrollWidth", { value: 300 });
    Object.defineProperty(element, "clientWidth", { value: 200 });
    fireEvent.mouseEnter(element);
    fireEvent.mouseLeave(element);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(popup()).toBeNull();
  });

  it("hides the popup on Escape and on scroll", () => {
    const element = hoverName(300, 200);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(popup()).toBeNull();

    fireEvent.mouseEnter(element);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(popup()).not.toBeNull();
    fireEvent.scroll(window);
    expect(popup()).toBeNull();
  });
});
