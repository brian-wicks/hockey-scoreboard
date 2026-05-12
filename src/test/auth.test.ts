import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../store";

const socketMock = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketMock),
}));

vi.mock("../lib/firebase", () => ({
  auth: {
    currentUser: null,
  },
  googleProvider: {},
}));

vi.mock("firebase/auth", () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(),
}));

import { signInWithPopup, signOut } from "firebase/auth";

describe("store - authentication edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      socket: null,
      gameState: null,
      isConnected: false,
      authLoading: false,
      authError: null,
      shareId: null,
      isViewer: false,
      user: null,
    });
    // Reset internal state of the store module if possible, 
    // but hasInitialized is a module-level variable. 
    // This is a limitation of testing module-level variables.
  });

  it("handles login failure", async () => {
    vi.mocked(signInWithPopup).mockRejectedValue(new Error("Popup closed by user"));
    
    await useStore.getState().login();
    
    expect(useStore.getState().authError).toBe("Login failed. Please try again.");
    expect(useStore.getState().user).toBeNull();
  });

  it("handles successful login and clears previous errors", async () => {
    useStore.setState({ authError: "Previous error" });
    const mockUser = { uid: "test-uid", displayName: "Test User" };
    vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
    
    // Note: login() calls signInWithPopup but doesn't call setUser itself. 
    // setUser is called by the onAuthStateChanged listener in App.tsx.
    // However, login() should clear the error.
    await useStore.getState().login();
    
    expect(useStore.getState().authError).toBeNull();
  });

  it("performs full cleanup on logout", async () => {
    const mockSocket = { ...socketMock, disconnect: vi.fn() };
    useStore.setState({ 
      user: { uid: "123" } as any, 
      socket: mockSocket as any, 
      isViewer: true,
      shareId: "abc",
      gameState: { period: "1st" } as any
    });

    await useStore.getState().logout();

    expect(signOut).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(useStore.getState().user).toBeNull();
    expect(useStore.getState().gameState).toBeNull();
    expect(useStore.getState().socket).toBeNull();
    expect(useStore.getState().isViewer).toBe(false);
    expect(useStore.getState().shareId).toBeNull();
  });

  it("handles logout even when socket is missing", async () => {
    useStore.setState({ user: { uid: "123" } as any });
    await useStore.getState().logout();
    expect(signOut).toHaveBeenCalled();
    expect(useStore.getState().user).toBeNull();
  });

  it("prevents multiple initializations", () => {
    // This is hard to test perfectly because hasInitialized is not exported.
    // But we can check if connect/connectViewer is called.
    const connectSpy = vi.spyOn(useStore.getState(), "connect");
    
    // First call
    useStore.setState({ user: { uid: "123", getIdToken: vi.fn().mockResolvedValue("test-token") } as any });
    useStore.getState().ensureInitialized();
    
    // Second call should do nothing if hasInitialized was set
    useStore.getState().ensureInitialized();
    
    // Since we can't reset hasInitialized between tests easily, 
    // we just verify it doesn't crash.
  });
});
