import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OverlayControlsPanel from "../../components/control-panel/OverlayControlsPanel";

describe("OverlayControlsPanel Component", () => {
  const mockUpdateState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(
      <OverlayControlsPanel
        overlayVisible={true}
        jumbotronGradientsEnabled={true}
        updateState={mockUpdateState}
      />
    );

    expect(screen.getByText("Overlay")).toBeInTheDocument();
    expect(screen.getByText("Hide Overlay")).toBeInTheDocument();
    expect(screen.getByText("Disable Jumbotron Gradients")).toBeInTheDocument();
  });

  it("toggles overlay visibility", () => {
    render(
      <OverlayControlsPanel
        overlayVisible={true}
        jumbotronGradientsEnabled={true}
        updateState={mockUpdateState}
      />
    );

    fireEvent.click(screen.getByText("Hide Overlay"));
    expect(mockUpdateState).toHaveBeenCalledWith({ overlayVisible: false });
  });

  it("toggles jumbotron gradients", () => {
    render(
      <OverlayControlsPanel
        overlayVisible={true}
        jumbotronGradientsEnabled={false}
        updateState={mockUpdateState}
      />
    );

    fireEvent.click(screen.getByText("Enable Jumbotron Gradients"));
    expect(mockUpdateState).toHaveBeenCalledWith({ jumbotronGradientsEnabled: true });
  });

  it("handles lower third inputs and toggle", () => {
    const lowerThird = { active: false, title: "Initial Title", subtitle: "Initial Subtitle" };
    render(
      <OverlayControlsPanel
        overlayVisible={true}
        jumbotronGradientsEnabled={true}
        updateState={mockUpdateState}
        lowerThird={lowerThird}
      />
    );

    // Toggle show
    fireEvent.click(screen.getByText("Show"));
    expect(mockUpdateState).toHaveBeenCalledWith({
      lowerThird: expect.objectContaining({ active: true }),
    });

    // Update title
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "New Title" } });
    expect(mockUpdateState).toHaveBeenCalledWith({
      lowerThird: expect.objectContaining({ title: "New Title" }),
    });

    // Clear
    fireEvent.click(screen.getByText("Clear"));
    expect(mockUpdateState).toHaveBeenCalledWith({
      lowerThird: { active: false, title: "", subtitle: "" },
    });
  });
});
