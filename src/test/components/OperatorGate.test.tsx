import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperatorGate from "../../components/control-panel/OperatorGate";
import { useStore } from "../../store";

vi.mock("../../store", () => ({ useStore: vi.fn() }));

describe("OperatorGate", () => {
  const submitOperatorPin = vi.fn();

  const renderWith = (state: Record<string, unknown>) => {
    const full = { submitOperatorPin, gameState: null, activeGameId: undefined, ...state };
    vi.mocked(useStore).mockImplementation((selector: any) => selector(full));
    return render(
      <OperatorGate>
        <div>Controls</div>
      </OperatorGate>,
    );
  };

  beforeEach(() => vi.clearAllMocks());

  const pinInput = () => screen.getByLabelText("PIN") as HTMLInputElement;

  it("asks for the PIN, with a numeric keypad", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    expect(pinInput()).toHaveAttribute("inputmode", "numeric");
    expect(pinInput()).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("submits only a complete PIN", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    const submit = screen.getByRole("button", { name: "Continue" });
    fireEvent.change(pinInput(), { target: { value: "12345" } });
    expect(submit).toBeDisabled();

    fireEvent.change(pinInput(), { target: { value: "123456" } });
    fireEvent.click(submit);
    expect(submitOperatorPin).toHaveBeenCalledWith("123456");
  });

  it("keeps digits only, up to six, from pasted or typed text", () => {
    renderWith({ operatorAuth: { status: "needs-pin" } });
    fireEvent.change(pinInput(), { target: { value: " 123 456 " } });
    expect(pinInput().value).toBe("123456");
    fireEvent.change(pinInput(), { target: { value: "12a4567890" } });
    expect(pinInput().value).toBe("124567");
  });

  it("shows attempts left after a wrong PIN, using the right plural", () => {
    const { unmount } = renderWith({ operatorAuth: { status: "wrong-pin", attemptsLeft: 3 } });
    expect(screen.getByText("That PIN is wrong. 3 attempts left.")).toBeInTheDocument();
    unmount();
    renderWith({ operatorAuth: { status: "wrong-pin", attemptsLeft: 1 } });
    expect(screen.getByText("That PIN is wrong. 1 attempt left.")).toBeInTheDocument();
  });

  it("says the game needs a new PIN, and keeps the form usable", () => {
    renderWith({ operatorAuth: { status: "no-pin" } });
    expect(screen.getByRole("alert")).toHaveTextContent("This game needs a new PIN. Ask the main operator for it.");

    fireEvent.change(pinInput(), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(submitOperatorPin).toHaveBeenCalledWith("654321");
  });

  it("clears the input after a wrong PIN", () => {
    const state: Record<string, unknown> = { operatorAuth: { status: "needs-pin" } };
    const { rerender } = renderWith(state);
    fireEvent.change(pinInput(), { target: { value: "123456" } });

    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({ submitOperatorPin, gameState: null, activeGameId: undefined, operatorAuth: { status: "wrong-pin", attemptsLeft: 4 } }),
    );
    rerender(
      <OperatorGate>
        <div>Controls</div>
      </OperatorGate>,
    );

    expect(pinInput().value).toBe("");
  });

  it("shows the wait when locked, rounding up to whole minutes", () => {
    const { unmount } = renderWith({ operatorAuth: { status: "locked", retryAfterSeconds: 601 } });
    expect(screen.getByText("Too many wrong PINs. Try again in 11 minutes.")).toBeInTheDocument();
    unmount();
    renderWith({ operatorAuth: { status: "locked", retryAfterSeconds: 30 } });
    expect(screen.getByText("Too many wrong PINs. Try again in 1 minute.")).toBeInTheDocument();
  });

  it("explains a session that ended", () => {
    renderWith({ operatorAuth: { status: "needs-pin", sessionEnded: true } });
    expect(screen.getByText("Your session ended. Enter the current PIN to continue.")).toBeInTheDocument();
  });

  it("explains a PIN check that failed", () => {
    renderWith({ operatorAuth: { status: "error" } });
    expect(screen.getByText("Couldn't check the PIN. Try again in a moment.")).toBeInTheDocument();
  });

  it("ignores submits while checking the PIN", () => {
    const { rerender } = renderWith({ operatorAuth: { status: "needs-pin" } });
    fireEvent.change(pinInput(), { target: { value: "123456" } });

    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({ submitOperatorPin, gameState: null, activeGameId: undefined, operatorAuth: { status: "submitting" } }),
    );
    rerender(
      <OperatorGate>
        <div>Controls</div>
      </OperatorGate>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(pinInput().value).toBe("123456");
    fireEvent.submit(pinInput().closest("form") as HTMLFormElement);
    expect(submitOperatorPin).not.toHaveBeenCalled();
  });

  it("explains an unknown or removed link, without a PIN form", () => {
    renderWith({ operatorAuth: { status: "not-found" } });
    expect(screen.getByText("This link is no longer active")).toBeInTheDocument();
    expect(screen.getByText("Ask the main operator for a new second operator link.")).toBeInTheDocument();
    expect(screen.queryByLabelText("PIN")).not.toBeInTheDocument();
  });

  it("shows a loading state while connecting", () => {
    renderWith({ operatorAuth: { status: "connecting" } });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows a loading state until the game is known", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: undefined });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("waits when no game is open", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: null });
    expect(screen.getByText("Waiting for a game to start")).toBeInTheDocument();
    expect(screen.queryByText("Controls")).not.toBeInTheDocument();
  });

  it("shows the control panel when a game is open", () => {
    renderWith({ operatorAuth: { status: "connected" }, gameState: {}, activeGameId: "game-1" });
    expect(screen.getByText("Controls")).toBeInTheDocument();
  });
});
