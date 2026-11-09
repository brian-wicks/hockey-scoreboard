import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import App from "../App";
import { useStore } from "../store";

vi.mock("../store", () => ({
  useStore: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  getAuth: vi.fn(),
  GoogleAuthProvider: class {},
}));

// Mock lazy-loaded components to speed up tests and avoid complexity
vi.mock("../components/Dashboard", () => ({ default: () => <div>Dashboard</div> }));
vi.mock("../components/ControlPanel", () => ({ default: () => <div>Control Panel</div> }));
vi.mock("../components/Overlay", () => ({ default: () => <div>Overlay</div> }));
vi.mock("../components/JumbotronScoreboard", () => ({ default: () => <div>Jumbotron</div> }));
vi.mock("../components/Login", () => ({ Login: () => <div>Login Screen</div> }));
vi.mock("../components/ResultsPage", () => ({ default: () => <div>Results Page</div> }));
vi.mock("../components/PreshowPage", () => ({ default: () => <div>Preshow Page</div> }));
vi.mock("../components/ChangelogPage", () => ({ default: () => <div>Changelog Page</div> }));
vi.mock("../components/control-panel/OperatorGate", () => ({ default: () => <div>Operator Gate</div> }));

describe("App Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset path
    window.history.pushState({}, "Home", "/");
  });

  it("shows login screen when not authenticated and not a viewer", async () => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(screen.getByText("Login Screen")).toBeInTheDocument();
  });

  it("shows loading screen when auth is loading", () => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: false,
        authLoading: true,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(screen.getByText(/Connecting.../i)).toBeInTheDocument();
  });

  it("shows error screen when authError exists", () => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: true,
        authLoading: false,
        authError: "Failed to connect",
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(screen.getByText(/Connection Failed/i)).toBeInTheDocument();
    expect(screen.getByText("Failed to connect")).toBeInTheDocument();
  });

  it("shows 'Share Link Not Found' when authError contains 'not found'", () => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: true,
        authLoading: false,
        authError: "Share ID not found",
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(screen.getByText(/Share Link Not Found/i)).toBeInTheDocument();
  });

  describe.each(["overlay", "jumbotron", "results", "preshow"])("a failed link to the %s screen", (screenName) => {
    const renderError = (authError: string) => {
      window.history.pushState({}, "Share", `/share/gone/${screenName}`);
      vi.mocked(useStore).mockImplementation((selector: any) =>
        selector({
          user: null,
          isViewer: true,
          authLoading: false,
          authError,
          setUser: vi.fn(),
          setAuthLoading: vi.fn(),
          ensureInitialized: vi.fn(),
        }),
      );
      return render(<App />);
    };

    it.each(["Share ID not found", "Failed to connect"])("follows the app's theme for %s", (authError) => {
      const { container } = renderError(authError);
      const button = screen.getByRole("button", { name: "Go to the home page" });
      expect(container.querySelector(".ui.bg-canvas")).toBeInTheDocument();
      expect(button).toHaveClass("bg-action");
      expect(container.innerHTML).not.toMatch(/zinc|indigo|slate-900|rounded-2xl/);
    });
  });

  it("keeps the broadcast connecting screen on those routes", () => {
    window.history.pushState({}, "Share", "/share/gone/overlay");
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: null,
        isViewer: true,
        authLoading: true,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      }),
    );
    const { container } = render(<App />);
    expect(container.querySelector(".bg-slate-900")).toBeInTheDocument();
  });

  it("renders the Dashboard at the root route when authenticated", async () => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: { uid: "123" },
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("renders ControlPanel at /game", async () => {
    window.history.pushState({}, "Game", "/game");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: { uid: "123" },
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Control Panel")).toBeInTheDocument();
  });

  it("renders Overlay route", async () => {
    window.history.pushState({}, "Overlay", "/overlay");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: { uid: "123" },
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Overlay")).toBeInTheDocument();
  });

  it("renders Jumbotron route", async () => {
    window.history.pushState({}, "Jumbotron", "/jumbotron");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: { uid: "123" },
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Jumbotron")).toBeInTheDocument();
  });

  it("renders Results route", async () => {
    window.history.pushState({}, "Results", "/results");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: { uid: "123" },
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Results Page")).toBeInTheDocument();
  });

  it("renders the changelog when signed out, instead of gating it behind login", async () => {
    window.history.pushState({}, "Changelog", "/changelog");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: false,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("Changelog Page")).toBeInTheDocument();
    expect(screen.queryByText("Login Screen")).not.toBeInTheDocument();
  });

  it("no longer opens the control panel from a share link", async () => {
    window.history.pushState({}, "Share", "/share/test-share");
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        user: null,
        isViewer: true,
        authLoading: false,
        authError: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      };
      return selector(state);
    });

    render(<App />);

    expect(await screen.findByText("This link is no longer available")).toBeInTheDocument();
    expect(screen.queryByText("Control Panel")).not.toBeInTheDocument();
  });

  it("opens results from a share link with nobody signed in", async () => {
    window.history.pushState({}, "Results", "/share/share-1/results");
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        user: null,
        isViewer: true,
        authLoading: false,
        authError: null,
        gameState: null,
        setUser: vi.fn(),
        setAuthLoading: vi.fn(),
        ensureInitialized: vi.fn(),
      }),
    );
    render(<App />);
    expect(await screen.findByText("Results Page")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  describe("pre-show route", () => {
    const stateWith = (overrides: Record<string, unknown>) => ({
      user: null,
      isViewer: false,
      authLoading: false,
      authError: null,
      gameState: null,
      setUser: vi.fn(),
      setAuthLoading: vi.fn(),
      ensureInitialized: vi.fn(),
      ...overrides,
    });

    it("opens for the signed-in owner, with no footer", async () => {
      window.history.pushState({}, "Pre-show", "/preshow");
      vi.mocked(useStore).mockImplementation((selector: any) => selector(stateWith({ user: { uid: "owner" } })));
      render(<App />);
      expect(await screen.findByText("Preshow Page")).toBeInTheDocument();
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    });

    it("opens from a share link with nobody signed in", async () => {
      window.history.pushState({}, "Pre-show", "/share/share-1/preshow");
      vi.mocked(useStore).mockImplementation((selector: any) => selector(stateWith({ isViewer: true })));
      render(<App />);
      expect(await screen.findByText("Preshow Page")).toBeInTheDocument();
    });

    it("uses the broadcast connecting screen", () => {
      window.history.pushState({}, "Pre-show", "/share/share-1/preshow");
      vi.mocked(useStore).mockImplementation((selector: any) => selector(stateWith({ isViewer: true, authLoading: true })));
      const { container } = render(<App />);
      expect(container.querySelector(".bg-slate-900")).toBeInTheDocument();
    });
  });

  describe("second operator route", () => {
    const useOperatorRoute = (state: Record<string, unknown>) => {
      window.history.pushState({}, "Operate", "/operate/op-1");
      vi.mocked(useStore).mockImplementation((selector: any) =>
        selector({
          user: null,
          isViewer: false,
          authLoading: false,
          authError: null,
          gameState: null,
          setUser: vi.fn(),
          setAuthLoading: vi.fn(),
          ensureInitialized: vi.fn(),
          ...state,
        }),
      );
    };

    it("opens the gate with nobody signed in", async () => {
      useOperatorRoute({});
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
      expect(screen.queryByText("Login Screen")).not.toBeInTheDocument();
    });

    it("doesn't wait for Firebase sign-in to finish", async () => {
      useOperatorRoute({ authLoading: true });
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
    });

    it("doesn't show the share link error screen", async () => {
      useOperatorRoute({ authError: "Connection error: offline" });
      render(<App />);
      expect(await screen.findByText("Operator Gate")).toBeInTheDocument();
      expect(screen.queryByText("Connection failed")).not.toBeInTheDocument();
    });

    it("leaves the footer off", async () => {
      useOperatorRoute({});
      render(<App />);
      await screen.findByText("Operator Gate");
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    });
  });
});
