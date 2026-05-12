import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ShareModal from "../../components/control-panel/ShareModal";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: {
    getState: vi.fn(),
  },
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

    expect(screen.getByText("No share link generated yet.")).toBeInTheDocument();

    // Mock POST for generation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "new-share-id" }),
    } as any);

    fireEvent.click(screen.getByText("Generate Public Share Link"));

    await waitFor(() => {
      expect(screen.getByText("Public Overlay")).toBeInTheDocument();
      expect(screen.getByText("new-share-id")).toBeInTheDocument();
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
      expect(screen.getByText("existing-id")).toBeInTheDocument();
    });
  });

  it("copies link to clipboard", async () => {
    vi.mocked(useStore.getState).mockReturnValue({ user: mockUser } as any);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shareId: "test-id" }),
    } as any);

    render(<ShareModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("test-id")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle("Copy to clipboard");
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(<ShareModal isOpen={true} onClose={mockOnClose} />);
    
    // Find backdrop by its class
    const backdrop = container.querySelector(".bg-black\\/80");
    fireEvent.click(backdrop!);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});
