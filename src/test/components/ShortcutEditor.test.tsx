import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ShortcutEditor from "../../components/control-panel/ShortcutEditor";

describe("ShortcutEditor Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const mockOnUpdate = vi.fn();
  const mockShortcut = {
    key: "g",
    ctrl: true,
    shift: false,
    alt: false,
    action: "homeScoreIncrease",
    description: "Goal Home",
  };

  it("renders correctly with formatted key", () => {
    render(<ShortcutEditor shortcut={mockShortcut as any} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Goal Home")).toBeInTheDocument();
    expect(screen.getByText("Ctrl + G")).toBeInTheDocument();
  });

  it("starts recording when the key button is clicked", () => {
    render(<ShortcutEditor shortcut={mockShortcut as any} onUpdate={mockOnUpdate} />);
    
    fireEvent.click(screen.getByText("Ctrl + G"));
    expect(screen.getByText("Press any key...")).toBeInTheDocument();
  });

  it("captures a new key combination", () => {
    render(<ShortcutEditor shortcut={mockShortcut as any} onUpdate={mockOnUpdate} />);
    
    fireEvent.click(screen.getByText("Ctrl + G"));
    
    // The input is hidden but we can find it
    const input = screen.getByRole("textbox", { hidden: true });
    
    fireEvent.keyDown(input, { key: "a", ctrlKey: false, shiftKey: true, altKey: true });

    expect(mockOnUpdate).toHaveBeenCalledWith({
      ...mockShortcut,
      key: "a",
      ctrl: false,
      shift: true,
      alt: true,
    });
    
    expect(screen.queryByText("Press any key...")).not.toBeInTheDocument();
  });

  it("ignores modifier keys during capture", () => {
    render(<ShortcutEditor shortcut={mockShortcut as any} onUpdate={mockOnUpdate} />);
    
    fireEvent.click(screen.getByText("Ctrl + G"));
    const input = screen.getByRole("textbox", { hidden: true });
    
    fireEvent.keyDown(input, { key: "Control", ctrlKey: true });

    expect(mockOnUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("Press any key...")).toBeInTheDocument();
  });

  it("cancels recording when X button is clicked", () => {
    render(<ShortcutEditor shortcut={mockShortcut as any} onUpdate={mockOnUpdate} />);
    
    fireEvent.click(screen.getByText("Ctrl + G"));
    
    // Find X button (lucide-x)
    const xButton = screen.getAllByRole("button").find(b => b.querySelector("svg.lucide-x"));
    fireEvent.click(xButton!);

    expect(screen.queryByText("Press any key...")).not.toBeInTheDocument();
  });

  it("formats special keys correctly", () => {
    const arrowShortcut = { ...mockShortcut, key: "ArrowUp", ctrl: false };
    const { rerender } = render(<ShortcutEditor shortcut={arrowShortcut as any} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("\u2191")).toBeInTheDocument();

    const spaceShortcut = { ...mockShortcut, key: " ", ctrl: false };
    rerender(<ShortcutEditor shortcut={spaceShortcut as any} onUpdate={mockOnUpdate} />);
    expect(screen.getByText("Space")).toBeInTheDocument();
  });
});
