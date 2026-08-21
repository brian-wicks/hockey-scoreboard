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

  it("handles sharing route", async () => {
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

    expect(await screen.findByText("Control Panel")).toBeInTheDocument();
  });
});
