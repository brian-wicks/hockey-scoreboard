import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ShareModal from "../../components/control-panel/ShareModal";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-qr-value={value} /> }));
vi.mock("../../components/control-panel/SecondOperatorSection", () => ({
  default: () => <div>Second operator section</div>,
}));

describe("ShareModal Component", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a default so StrictMode/double-effects don't exhaust `mockResolvedValueOnce` queues.
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as any);
    
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  const mockUser = {
    getIdToken: vi.fn().mockResolvedValue("test-token"),
  };

  it("renders nothing when closed", () => {
    const { container } = render(<ShareModal isOpen={false} onClose={mockOnClose} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows empty state and allows generating share ID", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    
    // First call (loadShareId) returns 404
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText("No share links yet.")).toBeInTheDocument();

    // Mock POST for generation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "new-share-id" }),
    } as any);

    fireEvent.click(screen.getByText("Create share links"));

    await waitFor(() => {
      expect(screen.getByText("Overlay")).toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/share/new-share-id/overlay`)).toBeInTheDocument();
    });
  });

  it("loads existing share ID on open", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "existing-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(`${window.location.origin}/share/existing-id/overlay`)).toBeInTheDocument();
    });
  });

  it("doesn't offer the control panel as a share link", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "test-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    expect(await screen.findByText("Overlay")).toBeInTheDocument();
    expect(screen.queryByText("Control Panel")).not.toBeInTheDocument();
    expect(screen.queryByText(`${window.location.origin}/share/test-id`)).not.toBeInTheDocument();
  });

  describe("link name", () => {
    const UUID = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";
    const fetchMock = () => vi.mocked(global.fetch);
    const respond = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as any;
    const posts = () => fetchMock().mock.calls.filter(([, init]) => init?.method === "POST");

    const openWith = async (shareId: string | null) => {
      vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
      fetchMock().mockResolvedValueOnce(respond(200, { shareId }));
      render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      if (shareId) await screen.findByText(`${window.location.origin}/share/${shareId}/overlay`);
    };
    const nameBox = () => screen.getByLabelText("Link name");

    it("creates the first links with a chosen name, lowercased", async () => {
      await openWith(null);
      fireEvent.change(nameBox(), { target: { value: "New-Cats" } });
      fetchMock().mockResolvedValueOnce(respond(200, { shareId: "new-cats" }));
      fireEvent.click(screen.getByText("Create share links"));

      expect(await screen.findByText(`${window.location.origin}/share/new-cats/overlay`)).toBeInTheDocument();
      expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ shareId: "new-cats" });
    });

    it("creates random links when no name is given", async () => {
      await openWith(null);
      fetchMock().mockResolvedValueOnce(respond(200, { shareId: UUID }));
      fireEvent.click(screen.getByText("Create share links"));
      await screen.findByText(`${window.location.origin}/share/${UUID}/overlay`);
      expect(posts()[0][1]!.body).toBeUndefined();
    });

    it("explains a badly formed name without sending it", async () => {
      await openWith(null);
      fireEvent.change(nameBox(), { target: { value: "no spaces" } });
      fireEvent.click(screen.getByText("Create share links"));
      expect(await screen.findByText("Use 4 to 40 letters, numbers and hyphens.")).toBeInTheDocument();
      expect(posts()).toHaveLength(0);
    });

    it("says when a name is taken, keeping what was typed", async () => {
      await openWith(null);
      fireEvent.change(nameBox(), { target: { value: "taken-name" } });
      fetchMock().mockResolvedValueOnce(respond(409, { error: "That name is already taken" }));
      fireEvent.click(screen.getByText("Create share links"));
      expect(await screen.findByText("That name is already taken")).toBeInTheDocument();
      expect(nameBox()).toHaveValue("taken-name");
      expect(screen.getByText("No share links yet.")).toBeInTheDocument();
    });

    it("explains a failure to save", async () => {
      await openWith(null);
      fireEvent.change(nameBox(), { target: { value: "good-name" } });
      fetchMock().mockRejectedValueOnce(new Error("offline"));
      fireEvent.click(screen.getByText("Create share links"));
      expect(await screen.findByText("Couldn't save the link name. Check your connection and try again.")).toBeInTheDocument();
    });

    it("warns that guessable names can be viewed", async () => {
      await openWith(null);
      expect(screen.getByText(/Anyone who guesses the name/)).toBeInTheDocument();
    });

    it("leaves the box empty for a random ID, and shows a custom name", async () => {
      await openWith(UUID);
      expect(nameBox()).toHaveValue("");
      cleanup();
      await openWith("my-name");
      expect(nameBox()).toHaveValue("my-name");
    });

    it("only offers saving once the name has changed", async () => {
      await openWith("my-name");
      expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
      fireEvent.change(nameBox(), { target: { value: "MY-NAME" } });
      expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
      fireEvent.change(nameBox(), { target: { value: "other-name" } });
      expect(screen.getByRole("button", { name: "Save name" })).toBeEnabled();
    });

    it("confirms before changing a name, because old links stop working", async () => {
      await openWith("my-name");
      fireEvent.change(nameBox(), { target: { value: "other-name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));

      expect(screen.getByText("Change the link name?")).toBeInTheDocument();
      expect(posts()).toHaveLength(0);

      fetchMock().mockResolvedValueOnce(respond(200, { shareId: "other-name" }));
      fireEvent.click(screen.getByRole("button", { name: "Change name" }));
      expect(await screen.findByText(`${window.location.origin}/share/other-name/overlay`)).toBeInTheDocument();
      expect(screen.queryByText("Change the link name?")).not.toBeInTheDocument();
    });

    it("sends nothing when the change is cancelled", async () => {
      await openWith("my-name");
      fireEvent.change(nameBox(), { target: { value: "other-name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(posts()).toHaveLength(0);
      expect(screen.getByText(`${window.location.origin}/share/my-name/overlay`)).toBeInTheDocument();
    });

    it("keeps the current links when the new name is taken", async () => {
      await openWith("my-name");
      fireEvent.change(nameBox(), { target: { value: "taken-name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));
      fetchMock().mockResolvedValueOnce(respond(409, { error: "That name is already taken" }));
      fireEvent.click(screen.getByRole("button", { name: "Change name" }));
      expect(await screen.findByText("That name is already taken")).toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/share/my-name/overlay`)).toBeInTheDocument();
    });
  });

  describe("layout", () => {
    const openWithLinks = async () => {
      vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ shareId: "test-id" }),
      } as any);
      const view = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      await screen.findByText("Overlay");
      return view;
    };

    it("hides QR codes until asked for", async () => {
      const { container } = await openWithLinks();
      expect(container.querySelector("svg[data-qr-value]")).toBeNull();
    });

    it("shows and hides one link's QR code", async () => {
      const { container } = await openWithLinks();
      const toggle = screen.getByRole("button", { name: "QR code for Results" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggle);
      const codes = container.querySelectorAll("svg[data-qr-value]");
      expect(codes).toHaveLength(1);
      expect(codes[0].getAttribute("data-qr-value")).toBe(`${window.location.origin}/share/test-id/results`);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(toggle);
      expect(container.querySelector("svg[data-qr-value]")).toBeNull();
    });

    it("explains the links in one line, without a warning box or separate ID", async () => {
      await openWithLinks();
      expect(screen.getByText(/can view these screens, but can't change anything/)).toBeInTheDocument();
      expect(screen.queryByText(/^Share ID/)).not.toBeInTheDocument();
      expect(screen.queryByText("Full-screen display for the rink")).not.toBeInTheDocument();
    });

    it("still offers replacing the links", async () => {
      await openWithLinks();
      expect(screen.getByRole("button", { name: "Replace with new links" })).toBeInTheDocument();
    });
  });

  it("offers a results share link", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "test-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    expect(await screen.findByText("Results")).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/share/test-id/results`)).toBeInTheDocument();
  });

  it("offers a pre-show share link", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "test-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    expect(await screen.findByText("Pre-show")).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/share/test-id/preshow`)).toBeInTheDocument();
  });

  it("copies link to clipboard", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "test-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(`${window.location.origin}/share/test-id/overlay`)).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle("Copy link");
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/share/test-id/overlay`);
  });

  it("shows the second operator section with or without viewer links", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false } as any);
    const { unmount } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Second operator section")).toBeInTheDocument();
    unmount();

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "existing-id" }),
    } as any);
    render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    await screen.findByText(`${window.location.origin}/share/existing-id/overlay`);
    expect(screen.getByText("Second operator section")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    
    // Find backdrop by its class
    const backdrop = container.querySelector(".bg-ink\\/60");
    fireEvent.click(backdrop!);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
