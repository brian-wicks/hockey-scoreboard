/**
 * Local mode: run the whole app on one machine with no internet.
 *
 * At a rink with poor wifi, Google sign-in is the hard blocker — ID tokens
 * expire hourly and refreshing them needs a live connection, so an operator who
 * loses signal mid-game loses the app. In local mode the client skips Firebase
 * entirely and presents a fixed local operator, and the server accepts that one
 * identity instead of verifying tokens. Data goes to the local sqlite file
 * (DB_BACKEND's default), so nothing leaves the machine.
 *
 * This is an authentication bypass, so it is opt-in via an explicit env flag and
 * the server refuses to start with it enabled in production (see server.ts).
 */

/** Identity every local-mode request runs as. */
export const LOCAL_USER_ID = "local-operator";

/** Sent as the bearer token / socket auth token when local mode is on. */
export const LOCAL_AUTH_TOKEN = "local-mode";

export const LOCAL_USER_DISPLAY_NAME = "Local operator";

/** Reads the flag from a plain env bag — shared by the client and the server. */
export function isLocalModeEnv(env: Record<string, string | undefined>): boolean {
  return env.VITE_LOCAL_MODE === "true" || env.LOCAL_MODE === "true";
}

/** Client-side check, reading Vite's compiled-in env. */
export function isLocalMode(): boolean {
  return isLocalModeEnv(import.meta.env as Record<string, string | undefined>);
}

/**
 * The origin the app should talk to for its API/socket connection.
 *
 * Normally VITE_BASE_URL — baked in at build time — matches wherever the app is
 * actually deployed, so it's a safe override. In local mode it isn't: Electron
 * deliberately binds a random OS-assigned port each launch (so a stray process
 * already on the usual port can't block startup — see electron/main.cjs), so a
 * baked-in URL is very likely stale. Worse, if something else happens to be
 * listening on that stale port — like a developer's own dev server — the app
 * would silently connect to the wrong backend instead of failing obviously.
 * window.location.origin is always correct: it's wherever this page was
 * actually loaded from.
 */
export function getBaseUrl(): string {
  if (isLocalMode()) return window.location.origin;
  return (import.meta.env.VITE_BASE_URL as string | undefined) || window.location.origin;
}

/**
 * Stand-in for Firebase's User. The app calls getIdToken() in a dozen places;
 * returning a fixed token here means every one of those call sites keeps working
 * unchanged, with the server-side check being what actually differs.
 */
export function createLocalUser() {
  return {
    uid: LOCAL_USER_ID,
    displayName: LOCAL_USER_DISPLAY_NAME,
    email: null,
    photoURL: null,
    getIdToken: async () => LOCAL_AUTH_TOKEN,
  };
}
