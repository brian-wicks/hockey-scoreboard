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

    fireEvent.click(screen.getByText("Create new team"));
    expect(screen.getByText("Create new team", { selector: "h2" })).toBeInTheDocument();

    // The library grid's own search box is also an empty text input underneath the
    // modal overlay, so target the Name field via its adjacent label instead of by value.
    const nameInput = screen.getByText("Team name").nextElementSibling as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Team" } });
    fireEvent.blur(nameInput);

    fireEvent.click(screen.getByText("Save team"));

    await waitFor(() => {
      expect(saveTeamToLibrary).toHaveBeenCalledWith("New Team", expect.objectContaining({ name: "New Team" }));
    });
  });

  it("opens the edit modal pre-filled for an existing team", async () => {
    render(<TeamManagerPage />, { wrapper: MemoryRouter });

    fireEvent.click(await screen.findByText("Edit"));
    expect(screen.getByText("Edit team")).toBeInTheDocument();
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

  describe("importing teams", () => {
    const file = (name: string, content: unknown) => ({ name, text: async () => (typeof content === "string" ? content : JSON.stringify(content)) });
    const choose = async (files: ReturnType<typeof file>[]) => {
      render(<TeamManagerPage />, { wrapper: MemoryRouter });
      fireEvent.click(await screen.findByRole("button", { name: "Import teams" }));
      fireEvent.change(screen.getByLabelText("Team files"), { target: { files } });
    };
    const hawks = { name: "Hawks", abbreviation: "HWK", players: [{ jerseyNumber: "9", name: "Sam" }] };

    it("adds teams from several files and keeps one already in the library", async () => {
      await choose([file("hawks.json", hawks), file("bruins.json", { name: "Boston Bruins", abbreviation: "NEW" })]);

      expect(await screen.findByText("2 teams found.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Import 1 team" }));

      expect(await screen.findByText("Imported 1 team.")).toBeInTheDocument();
      expect(saveTeamToLibrary).toHaveBeenCalledTimes(1);
      expect(saveTeamToLibrary).toHaveBeenCalledWith("Hawks", expect.objectContaining({ abbreviation: "HWK" }));
    });

    it("replaces a team already in the library when asked", async () => {
      await choose([file("bruins.json", { name: "boston bruins", abbreviation: "BOB" })]);

      fireEvent.click(await screen.findByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Import 1 team" }));

      await screen.findByText("Imported 1 team.");
      expect(saveTeamToLibrary).toHaveBeenCalledWith("boston bruins", expect.objectContaining({ abbreviation: "BOB" }));
    });

    it("names a file it can't read and still offers the others", async () => {
      await choose([file("broken.json", "{not json"), file("hawks.json", hawks)]);

      expect(await screen.findByRole("alert")).toHaveTextContent("broken.json: This isn't valid JSON.");
      expect(screen.getByRole("button", { name: "Import 1 team" })).toBeEnabled();
    });

    it("carries on after a save fails and says which team failed", async () => {
      saveTeamToLibrary.mockRejectedValueOnce(new Error("nope"));
      await choose([file("teams.json", [hawks, { name: "Owls" }])]);

      fireEvent.click(await screen.findByRole("button", { name: "Import 2 teams" }));

      expect(await screen.findByText("Imported 1 team.")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save Hawks");
      expect(saveTeamToLibrary).toHaveBeenCalledTimes(2);
    });
  });
});
