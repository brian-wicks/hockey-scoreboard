import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SecondOperatorSection from "../../components/control-panel/SecondOperatorSection";
import { isLocalMode } from "../../lib/localMode";
import { useStore } from "../../store";

vi.mock("../../store", () => ({ useStore: { getState: vi.fn() } }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-qr-value={value} /> }));
vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  isLocalMode: vi.fn(() => false),
}));

const respond = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
});

describe("SecondOperatorSection", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLocalMode).mockReturnValue(false);
    vi.mocked(useStore.getState).mockReturnValue({
      user: { getIdToken: vi.fn().mockResolvedValue("owner-token") },
    } as any);
    global.fetch = fetchMock as any;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  const lastCall = () => fetchMock.mock.calls.at(-1)!;

  it("offers setup when there is no access yet", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    render(<SecondOperatorSection />);
    expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  });

  it("shows the link and the PIN after setup", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    render(<SecondOperatorSection />);
    const setup = await screen.findByRole("button", { name: "Set up second operator" });

    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "012345" }));
    fireEvent.click(setup);

    expect(await screen.findByText("012345")).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
    expect(screen.getByText(/Send them separately/i)).toBeInTheDocument();
    expect(screen.queryByText(/won't be shown again/i)).not.toBeInTheDocument();
    expect(lastCall()[1].method).toBe("POST");
  });

  it("never puts the PIN in the link", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: null }));
    const { container } = render(<SecondOperatorSection />);
    const setup = await screen.findByRole("button", { name: "Set up second operator" });
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "012345" }));
    fireEvent.click(setup);
    await screen.findByText("012345");

    const link = `${window.location.origin}/operate/op-1`;
    expect(container.querySelector("code")?.textContent).toBe(link);
    expect(container.querySelector("svg[data-qr-value]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "QR code for Second operator link" }));
    expect(container.querySelector("svg[data-qr-value]")?.getAttribute("data-qr-value")).toBe(link);
  });

  it("hides setup until the first load succeeds", async () => {
    let resolveLoad: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (resolveLoad = resolve)));
    render(<SecondOperatorSection />);
    expect(screen.queryByRole("button", { name: "Set up second operator" })).not.toBeInTheDocument();
    expect(screen.getByText("Loading second operator access...")).toBeInTheDocument();

    await act(async () => resolveLoad(respond(200, { operatorId: null })));
    expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
    expect(screen.queryByText("Loading second operator access...")).not.toBeInTheDocument();
  });

  it("shows no setup button when the load responds with an error", async () => {
    fetchMock.mockResolvedValueOnce(respond(500, {}));
    render(<SecondOperatorSection />);
    expect(await screen.findByText(/couldn't load second operator access/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up second operator" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading second operator access...")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("shows no setup button when the load request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<SecondOperatorSection />);
    expect(await screen.findByText(/couldn't load second operator access/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up second operator" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading second operator access...")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("shows the current PIN when reopened, without having to create one", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", needsPin: false, pin: "012345" }));
    render(<SecondOperatorSection />);
    expect(await screen.findByText("012345")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a PIN created before PINs were kept, and offers a new one", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", needsPin: false, pin: null }));
    render(<SecondOperatorSection />);
    expect(await screen.findByText(/can't be shown/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new PIN" })).toBeInTheDocument();
  });

  it("shows the management buttons when reopened", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    expect(await screen.findByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new PIN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove access" })).toBeInTheDocument();
  });

  it("confirms before creating a new PIN, and shows it", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Create new PIN" }));

    expect(screen.getByText("Create a new PIN?")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "999888" }));
    const buttons = screen.getAllByRole("button", { name: "Create new PIN" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("999888")).toBeInTheDocument();
    expect(screen.queryByText("Create a new PIN?")).not.toBeInTheDocument();
  });

  describe("when the current game has no PIN", () => {
    const NO_PIN_TEXT = "This game has no PIN yet. Create one and give it to the second operator.";

    const renderNeedingPin = async () => {
      fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", needsPin: true }));
      const view = render(<SecondOperatorSection />);
      await screen.findByText(NO_PIN_TEXT);
      return view;
    };

    it("says so, with the link and QR code", async () => {
      const { container } = await renderNeedingPin();
      const link = `${window.location.origin}/operate/op-1`;
      expect(screen.getByText(link)).toBeInTheDocument();
      expect(container.querySelector("svg[data-qr-value]")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "QR code for Second operator link" }));
      expect(container.querySelector("svg[data-qr-value]")?.getAttribute("data-qr-value")).toBe(link);
      expect(screen.queryByText(/anyone with this link/i)).not.toBeInTheDocument();
    });

    it("creates the PIN straight away, with no confirm dialog", async () => {
      await renderNeedingPin();
      fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "424242" }));

      fireEvent.click(screen.getByRole("button", { name: "Create new PIN" }));

      expect(screen.queryByText("Create a new PIN?")).not.toBeInTheDocument();
      expect(await screen.findByText("424242")).toBeInTheDocument();
      expect(lastCall()[1].method).toBe("POST");
      expect(screen.queryByText(NO_PIN_TEXT)).not.toBeInTheDocument();
    });

    it("confirms the next new PIN once one has been created", async () => {
      await renderNeedingPin();
      fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1", pin: "424242" }));
      fireEvent.click(screen.getByRole("button", { name: "Create new PIN" }));
      await screen.findByText("424242");

      fireEvent.click(screen.getByRole("button", { name: "Create new PIN" }));

      expect(screen.getByText("Create a new PIN?")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("keeps the message and shows an error when creating fails", async () => {
      await renderNeedingPin();
      fetchMock.mockResolvedValueOnce(respond(500, {}));
      fireEvent.click(screen.getByRole("button", { name: "Create new PIN" }));
      expect(await screen.findByText(/couldn't update second operator access/i)).toBeInTheDocument();
      expect(screen.getByText(NO_PIN_TEXT)).toBeInTheDocument();
    });

    it("still confirms before removing access", async () => {
      await renderNeedingPin();
      fireEvent.click(screen.getByRole("button", { name: "Remove access" }));
      expect(screen.getByText("Remove second operator access?")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("offers setup again after removal, not the no-PIN message", async () => {
      await renderNeedingPin();
      fireEvent.click(screen.getByRole("button", { name: "Remove access" }));
      fetchMock.mockResolvedValueOnce(respond(200, { success: true }));
      const buttons = screen.getAllByRole("button", { name: "Remove access" });
      fireEvent.click(buttons[buttons.length - 1]);
      expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
      expect(screen.queryByText(NO_PIN_TEXT)).not.toBeInTheDocument();
    });
  });

  it("does nothing when a confirmation is cancelled", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
  });

  it("removes access after confirmation", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));

    fetchMock.mockResolvedValueOnce(respond(200, { success: true }));
    const buttons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("button", { name: "Set up second operator" })).toBeInTheDocument();
    expect(lastCall()[1].method).toBe("DELETE");
  });

  it("shows an error when a change fails, keeping the current state", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove access" }));

    fetchMock.mockResolvedValueOnce(respond(500, {}));
    const buttons = screen.getAllByRole("button", { name: "Remove access" });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(/couldn't update second operator access/i)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/operate/op-1`)).toBeInTheDocument();
  });

  it("copies the link", async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { operatorId: "op-1" }));
    render(<SecondOperatorSection />);
    fireEvent.click(await screen.findByTitle("Copy link"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/operate/op-1`),
    );
  });

  it("is hidden in local mode", () => {
    vi.mocked(isLocalMode).mockReturnValue(true);
    const { container } = render(<SecondOperatorSection />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
