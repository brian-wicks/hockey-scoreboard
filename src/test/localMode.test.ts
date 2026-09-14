import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalUser,
  getBaseUrl,
  isLocalModeEnv,
  LOCAL_AUTH_TOKEN,
  LOCAL_USER_ID,
} from "../lib/localMode";

describe("local mode flag", () => {
  it("is off when nothing is set", () => {
    expect(isLocalModeEnv({})).toBe(false);
  });

  it("turns on from either the server or client variable", () => {
    expect(isLocalModeEnv({ LOCAL_MODE: "true" })).toBe(true);
    expect(isLocalModeEnv({ VITE_LOCAL_MODE: "true" })).toBe(true);
  });

  it("only accepts the exact string 'true'", () => {
    // A bypass this significant shouldn't switch on for "1", "yes", or an
    // accidental empty assignment.
    for (const value of ["1", "yes", "TRUE", "", "false", " true"]) {
      expect(isLocalModeEnv({ LOCAL_MODE: value }), value).toBe(false);
      expect(isLocalModeEnv({ VITE_LOCAL_MODE: value }), value).toBe(false);
    }
  });
});

describe("getBaseUrl", () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    delete import.meta.env.VITE_LOCAL_MODE;
    vi.unstubAllGlobals();
  });

  it("ignores VITE_BASE_URL in local mode, even when one is baked in", () => {
    // The whole point: Electron binds a random port each launch specifically so
    // a stray process already on the "usual" port can't block startup. A baked-in
    // VITE_BASE_URL would point at that stale port instead of wherever the app
    // actually ended up — and if something else is listening there, the app
    // would silently talk to the wrong backend rather than failing obviously.
    import.meta.env.VITE_LOCAL_MODE = "true";
    import.meta.env.VITE_BASE_URL = "http://localhost:3969";
    vi.stubGlobal("window", { location: { origin: "http://localhost:54321" } });

    expect(getBaseUrl()).toBe("http://localhost:54321");
  });

  it("uses VITE_BASE_URL outside local mode", () => {
    delete import.meta.env.VITE_LOCAL_MODE;
    import.meta.env.VITE_BASE_URL = "https://scoreboard.example.com";
    vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });

    expect(getBaseUrl()).toBe("https://scoreboard.example.com");
  });

  it("falls back to the page origin when VITE_BASE_URL is unset", () => {
    delete import.meta.env.VITE_LOCAL_MODE;
    delete import.meta.env.VITE_BASE_URL;
    vi.stubGlobal("window", { location: { origin: "https://scoreboard.example.com" } });

    expect(getBaseUrl()).toBe("https://scoreboard.example.com");
  });
});

describe("local user", () => {
  it("supplies the identity the server accepts in local mode", async () => {
    const user = createLocalUser();
    expect(user.uid).toBe(LOCAL_USER_ID);
    await expect(user.getIdToken()).resolves.toBe(LOCAL_AUTH_TOKEN);
  });

  it("has the fields the app reads off a signed-in user", () => {
    const user = createLocalUser();
    expect(user.displayName).toBeTruthy();
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("photoURL");
  });
});
