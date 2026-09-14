// Electron entry point for the offline rink build.
//
// This exists so an operator can double-click one app at a rink with no usable
// wifi. It starts the normal Express/Socket.IO server inside Electron's main
// process, points it at a writable data directory, and loads it in a window —
// the renderer is the same web app served in the cloud, just talking to
// localhost. Authentication is off in this build (see src/lib/localMode.ts).
const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// Must be set before the server module loads: it decides auth behaviour and the
// database location at import time.
process.env.LOCAL_MODE = "true";
process.env.VITE_LOCAL_MODE = "true";
process.env.DB_BACKEND = "sqlite";
delete process.env.NODE_ENV; // never "production" — server.ts rejects that with LOCAL_MODE.

const dataDir = path.join(app.getPath("userData"), "data");
fs.mkdirSync(dataDir, { recursive: true });
process.env.SCOREBOARD_DATA_DIR = dataDir;

let mainWindow = null;

// Overlay/Jumbotron/Results/Share links (see ControlPanelHeader.tsx and
// ShareModal.tsx) are all target="_blank" links to the app's own server.
// Electron would otherwise hand every window.open() to the OS default browser,
// which is unnecessary here — there's no separate browser install to rely on at
// a rink, and a second in-app window is enough for a second monitor or preview.
// Keyed by URL so clicking the same link twice focuses the existing window
// instead of spawning a duplicate.
const secondaryWindows = new Map();

function openSecondaryWindow(url) {
  const existing = secondaryWindows.get(url);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#18181b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(url);
  win.on("closed", () => secondaryWindows.delete(url));
  win.on("page-title-updated", (event) => event.preventDefault()); // keep "Hockey Scoreboard", not the route's own <title>
  secondaryWindows.set(url, win);
}

function resolveServerBundle() {
  // Packaged: the bundle sits in resources/. Unpackaged (npm run electron:dev):
  // it's in the repo's build output.
  const packaged = path.join(process.resourcesPath || "", "server", "server.mjs");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "dist-electron", "server.mjs");
}

function resolveClientDir() {
  const packaged = path.join(process.resourcesPath || "", "dist");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "dist");
}

async function startServer() {
  // Resolved here, inside the asar, because the server bundle can't resolve it
  // from its own location — see electron/stubs/better-sqlite3.mjs.
  try {
    process.env.BETTER_SQLITE3_PATH = require.resolve("better-sqlite3");
  } catch {
    // Unpackaged runs fall back to ordinary resolution.
  }

  const bundlePath = resolveServerBundle();
  if (!fs.existsSync(bundlePath)) {
    throw new Error(
      `Server bundle missing at ${bundlePath}. Run "npm run build:electron" before starting.`,
    );
  }

  // The bundle is ESM (the db module resolves its adapter with a top-level
  // await), so it loads by URL rather than require().
  const { pathToFileURL } = require("url");
  const { createScoreboardServer } = await import(pathToFileURL(bundlePath).href);
  // Port 0 lets the OS pick a free one, so a second copy of the app — or
  // anything else already on the usual port — can't stop it from starting.
  const server = createScoreboardServer({ dataDir, clientDir: resolveClientDir() });
  const port = await server.start(0);
  return port;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#18181b",
    title: "Hockey Scoreboard",
    webPreferences: {
      // The renderer is ordinary web content talking to localhost over HTTP; it
      // needs no Node access, so it doesn't get any.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Same-origin (overlay/jumbotron/results/share previews): open as a real
    // window inside the app. Anything else — there's nothing else today, but a
    // future external link shouldn't silently open inside the app's own
    // frameless-auth context — goes to the system browser as before.
    let isOwnOrigin = false;
    try {
      isOwnOrigin = new URL(url).origin === new URL(mainWindow.webContents.getURL()).origin;
    } catch {
      isOwnOrigin = false;
    }

    if (isOwnOrigin) {
      openSecondaryWindow(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    createWindow(port);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  } catch (error) {
    dialog.showErrorBox(
      "Hockey Scoreboard could not start",
      String((error && error.stack) || error),
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // Quitting on last window close matches what an operator expects from a
  // single-purpose app, on every platform including macOS.
  app.quit();
});
