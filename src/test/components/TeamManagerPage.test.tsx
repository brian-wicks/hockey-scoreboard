import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeamManagerPage from "../../components/team/TeamManagerPage";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

const libraryEntry = {
  name: "Boston Bruins",
  team: { name: "Boston Bruins", abbreviation: "BOS", logo: "", color: "#ffb81c", players: [] },
  updatedAt: Date.now(),
};

describe("TeamManagerPage", () => {
  const saveTeamToLibrary = vi.fn().mockResolvedValue(undefined);
  const deleteTeamFromLibrary = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      isViewer: false,
      user: { uid: "123", displayName: "Test User", getIdToken: vi.fn().mockResolvedValue("token") },
      isConnected: true,
      logout: vi.fn(),
      teamLibrary: [libraryEntry],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      saveTeamToLibrary,
      deleteTeamFromLibrary,
    } as any);
  });

  it("lists library teams and creates a new one", async () => {
    render(<TeamManagerPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Boston Bruins")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Create New Team"));
    expect(screen.getByText("Create New Team", { selector: "h2" })).toBeInTheDocument();

    // The library grid's own search box is also an empty text input underneath the
    // modal overlay, so target the Name field via its adjacent label instead of by value.
    const nameInput = screen.getByText("Team Name").nextElementSibling as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Team" } });
    fireEvent.blur(nameInput);

    fireEvent.click(screen.getByText("Save Team"));

    await waitFor(() => {
      expect(saveTeamToLibrary).toHaveBeenCalledWith("New Team", expect.objectContaining({ name: "New Team" }));
    });
  });

  it("opens the edit modal pre-filled for an existing team", async () => {
    render(<TeamManagerPage />, { wrapper: MemoryRouter });

    fireEvent.click(await screen.findByText("Edit"));
    expect(screen.getByText("Edit Team")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boston Bruins")).toBeInTheDocument();
  });

  it("returns nothing for a viewer session", () => {
    vi.mocked(useStore).mockReturnValue({
      isViewer: true,
      user: null,
      teamLibrary: [],
    } as any);

    const { container } = render(<TeamManagerPage />, { wrapper: MemoryRouter });
    expect(container).toBeEmptyDOMElement();
  });
});
