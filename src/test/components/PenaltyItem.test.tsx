import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PenaltyItem from "../../components/control-panel/PenaltyItem";

describe("PenaltyItem", () => {
  const mockPenalty = { id: "p1", playerNumber: "10", timeRemaining: 120000, duration: 120000, infraction: "Tripping" };
  const mockRoster = [
    { id: "1", jerseyNumber: "10", name: "Player 10", position: "C" as const },
    { id: "2", jerseyNumber: "20", name: "Player 20", position: "A" as const },
  ];

  it("renders penalty details correctly", () => {
    render(<PenaltyItem penalty={mockPenalty} onChange={() => {}} onRemove={() => {}} rosterPlayers={mockRoster} />);
    expect(screen.getByDisplayValue("10")).toBeDefined();
    expect(screen.getByText("2:00")).toBeDefined();
  });

  it("toggles edit mode for time and commits change", () => {
    const onChange = vi.fn();
    render(<PenaltyItem penalty={mockPenalty} onChange={onChange} onRemove={() => {}} rosterPlayers={mockRoster} />);
    
    const timeDisplay = screen.getByText("2:00");
    fireEvent.click(timeDisplay);
    
    const input = screen.getByPlaceholderText("M:SS");
    fireEvent.change(input, { target: { value: "1:30" } });
    fireEvent.blur(input);
    
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeRemaining: 90000 }));
  });

  it("handles player number search and selection", () => {
    const onChange = vi.fn();
    render(<PenaltyItem penalty={mockPenalty} onChange={onChange} onRemove={() => {}} rosterPlayers={mockRoster} />);
    
    const playerInput = screen.getByDisplayValue("10");
    fireEvent.focus(playerInput);
    fireEvent.change(playerInput, { target: { value: "20" } });
    
    const playerOption = screen.getByText("Player 20 (A)", { exact: false });
    fireEvent.mouseDown(playerOption);
    
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ playerNumber: "20" }));
  });

  it("calls onRemove when minus button is clicked", () => {
    const onRemove = vi.fn();
    render(<PenaltyItem penalty={mockPenalty} onChange={() => {}} onRemove={onRemove} rosterPlayers={mockRoster} />);
    
    const removeBtn = screen.getByRole("button", { name: "" }); // lucide-react icons don't always have names, but I'll find it by class or role
    fireEvent.click(screen.getAllByRole("button").pop()!); // It's the last button
    
    expect(onRemove).toHaveBeenCalled();
  });
});