import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommitInput } from "../../components/control-panel/ui/CommitInput";

function setup(value = "Start") {
  const onCommit = vi.fn();
  const view = render(<CommitInput value={value} onCommit={onCommit} placeholder="Box" />);
  const input = screen.getByPlaceholderText("Box") as HTMLInputElement;
  return { onCommit, input, rerender: (next: string) => view.rerender(<CommitInput value={next} onCommit={onCommit} placeholder="Box" />) };
}

describe("CommitInput", () => {
  it("sends nothing while typing", () => {
    const { onCommit, input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Start and more" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("Start and more");
  });

  it("keeps what's being typed when the server sends another value", () => {
    const { input, rerender } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Typing" } });
    rerender("Something else");
    expect(input.value).toBe("Typing");
  });

  it("sends the text once on blur", () => {
    const { onCommit, input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Done" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Done");
  });

  it("sends nothing if the text didn't change", () => {
    const { onCommit, input } = setup();
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the server's value again after blur", () => {
    const { input, rerender } = setup();
    fireEvent.focus(input);
    fireEvent.blur(input);
    rerender("From the server");
    expect(input.value).toBe("From the server");
  });

  it("sends the text on Enter", () => {
    function Wrapper({ onCommit }: { onCommit: (value: string) => void }) {
      const [value, setValue] = useState("Start");
      return (
        <CommitInput
          value={value}
          placeholder="Box"
          onCommit={(next) => {
            setValue(next);
            onCommit(next);
          }}
        />
      );
    }
    const onCommit = vi.fn();
    render(<Wrapper onCommit={onCommit} />);
    const input = screen.getByPlaceholderText("Box") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "Entered" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("Entered");
  });

  it("cancels on Esc", async () => {
    const { onCommit, input } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: "Oops" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("Start");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
