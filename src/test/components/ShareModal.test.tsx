import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ShareModal from "../../components/control-panel/ShareModal";
import { isLocalMode } from "../../lib/localMode";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-qr-value={value} /> }));
vi.mock("../../components/control-panel/SecondOperatorSection", () => ({
  default: ({ linkOrigin }: { linkOrigin?: string }) => <div>Second operator section for {linkOrigin}</div>,
}));
vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  isLocalMode: vi.fn(() => false),
}));

describe("ShareModal Component", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLocalMode).mockReturnValue(false);
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
    expect(screen.getByText(`Second operator section for ${window.location.origin}`)).toBeInTheDocument();
    unmount();

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "existing-id" }),
    } as any);
    render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    await screen.findByText(`${window.location.origin}/share/existing-id/overlay`);
    expect(screen.getByText(`Second operator section for ${window.location.origin}`)).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    
    // Find backdrop by its class
    const backdrop = container.querySelector(".bg-ink\\/60");
    fireEvent.click(backdrop!);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  describe("in the desktop app", () => {
    const lan = "http://192.168.1.20:3696";
    let network: { enabled: boolean; port: number | null; urls: string[] };

    beforeEach(() => {
      vi.mocked(isLocalMode).mockReturnValue(true);
      vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
      network = { enabled: false, port: null, urls: [] };
      global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).endsWith("/api/local-network")) {
          if (init?.method === "POST") {
            const { enabled } = JSON.parse(String(init.body));
            network = enabled ? { enabled: true, port: 3696, urls: [lan] } : { enabled: false, port: null, urls: [] };
          }
          return { ok: true, status: 200, json: () => Promise.resolve(network) };
        }
        return { ok: true, status: 200, json: () => Promise.resolve({ shareId: "rink" }) };
      }) as any;
    });

    const open = async () => {
      const view = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
      await screen.findByText("Overlay");
      return view;
    };

    it("offers network access, with no second operator until it's on", async () => {
      await open();
      expect(await screen.findByRole("button", { name: "Turn on network access" })).toBeInTheDocument();
      expect(screen.queryByText(/Second operator section/)).not.toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/share/rink/jumbotron`)).toBeInTheDocument();
    });

    it("shares links by this computer's network address once it's on", async () => {
      const { container } = await open();
      fireEvent.click(await screen.findByRole("button", { name: "Turn on network access" }));

      expect(await screen.findByText(`${lan}/share/rink/jumbotron`)).toBeInTheDocument();
      expect(screen.getByText("192.168.1.20:3696")).toBeInTheDocument();
      expect(screen.getByText(`Second operator section for ${lan}`)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "QR code for Jumbotron" }));
      expect(container.querySelector("svg[data-qr-value]")?.getAttribute("data-qr-value")).toBe(`${lan}/share/rink/jumbotron`);
      // Opened here, it stays on this computer's own address.
      expect(screen.getByRole("link", { name: "Open Jumbotron in a new tab" })).toHaveAttribute(
        "href",
        `${window.location.origin}/share/rink/jumbotron`,
      );
    });

    it("lets you pick the address when this computer is on more than one network", async () => {
      network = { enabled: true, port: 3696, urls: [lan, "http://10.0.0.4:3696"] };
      await open();
      const select = await screen.findByLabelText("Address for links");

      fireEvent.change(select, { target: { value: "http://10.0.0.4:3696" } });

      expect(screen.getByText("http://10.0.0.4:3696/share/rink/jumbotron")).toBeInTheDocument();
    });

    it("says when this computer isn't on a network", async () => {
      network = { enabled: true, port: 3696, urls: [] };
      await open();
      expect(await screen.findByText(/isn't on a network/)).toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/share/rink/jumbotron`)).toBeInTheDocument();
    });

    it("says when it can't check network access", async () => {
      const shareOnly = global.fetch;
      global.fetch = vi.fn(async (url: string, init?: RequestInit) =>
        String(url).endsWith("/api/local-network")
          ? { ok: false, status: 500, json: () => Promise.resolve({}) }
          : (shareOnly as any)(url, init),
      ) as any;
      await open();

      expect(await screen.findByText("Couldn't check network access. Reopen this window to try again.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Turn on network access" })).not.toBeInTheDocument();
    });

    it("says when it can't turn network access on, and leaves the links alone", async () => {
      const working = global.fetch;
      global.fetch = vi.fn(async (url: string, init?: RequestInit) =>
        init?.method === "POST" && String(url).endsWith("/api/local-network")
          ? { ok: false, status: 500, json: () => Promise.resolve({}) }
          : (working as any)(url, init),
      ) as any;
      await open();

      fireEvent.click(await screen.findByRole("button", { name: "Turn on network access" }));

      expect(await screen.findByText("Couldn't change network access. Try again, or restart the app.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Turn on network access" })).not.toBeDisabled();
      expect(screen.getByText(`${window.location.origin}/share/rink/jumbotron`)).toBeInTheDocument();
      expect(screen.queryByText(/Second operator section/)).not.toBeInTheDocument();
    });

    it("asks before turning it off, because other devices lose their connection", async () => {
      network = { enabled: true, port: 3696, urls: [lan] };
      await open();
      fireEvent.click(await screen.findByRole("button", { name: "Turn off network access" }));
      expect(screen.getByText("Turn off network access?")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Turn off" }));

      expect(await screen.findByRole("button", { name: "Turn on network access" })).toBeInTheDocument();
      expect(screen.getByText(`${window.location.origin}/share/rink/jumbotron`)).toBeInTheDocument();
    });
  });

  it("has no network access on the website", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Devices on this network")).not.toBeInTheDocument();
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => String(url).includes("local-network"))).toBe(false);
  });
});
