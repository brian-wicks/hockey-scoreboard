import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import React from "react";
import { PenaltyReasonInput, SearchDropdownInput, useDropdownPlacement } from "../../components/control-panel/DropdownInputs";

beforeEach(() => {
  // Make requestAnimationFrame deterministic for scrollOptionIntoView.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0 as any;
  });

  // jsdom doesn't implement this; components call it while navigating options.
  if (!HTMLElement.prototype.scrollIntoView) {
    // @ts-expect-error - not present in jsdom types
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

describe("useDropdownPlacement", () => {
  it("drops up when there is not enough space below", async () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        top: 300,
        bottom: 380,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as any;

    Object.defineProperty(window, "innerHeight", { value: 420, configurable: true });

    function Harness() {
      const { containerRef, dropUp, maxHeight } = useDropdownPlacement(true);
      return (
        <div>
          <div ref={containerRef} data-testid="container" />
          <div data-testid="dropUp">{String(dropUp)}</div>
          <div data-testid="maxHeight">{String(maxHeight)}</div>
        </div>
      );
    }

    render(<Harness />);

    // allow effect to run
    await act(async () => {});
    expect(screen.getByTestId("dropUp").textContent).toBe("true");
    expect(Number(screen.getByTestId("maxHeight").textContent)).toBeGreaterThanOrEqual(120);

    HTMLElement.prototype.getBoundingClientRect = original;
  });
});

describe("PenaltyReasonInput", () => {
  it("filters and selects an option with keyboard", () => {
    const onChange = vi.fn();
    render(<PenaltyReasonInput value="" onChange={onChange} inputClassName="x" />);

    const input = screen.getByPlaceholderText("Infraction");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "TRI" } });

    // should have matches; select with Enter
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
    // most penalty codes are 2-4 letters; selection should be short
    expect(String(onChange.mock.calls.at(-1)?.[0] ?? "")).toMatch(/^[A-Z0-9]{2,6}$/);
  });

  it("shows 'No matches' when filter eliminates all options", () => {
    const onChange = vi.fn();
    render(<PenaltyReasonInput value="" onChange={onChange} inputClassName="x" />);
    const input = screen.getByPlaceholderText("Infraction");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzz-not-a-penalty" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});

describe("SearchDropdownInput", () => {
  it("allows selecting an option with mouse and commits on blur", () => {
    const onChange = vi.fn();
    render(
      <SearchDropdownInput
        value=""
        onChange={onChange}
        inputClassName="x"
        placeholder="Player"
        options={[
          { value: "99", label: "Gretzky" },
          { value: "66", label: "Lemieux" },
        ]}
      />,
    );

    const input = screen.getByPlaceholderText("Player");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "gre" } });

    // Click the option (onMouseDown is used to avoid blur)
    fireEvent.mouseDown(screen.getByText(/99/i));
    expect(onChange).toHaveBeenCalledWith("99");

    // Blur should also commit whatever is in the inputValue.
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalled();
  });
});
