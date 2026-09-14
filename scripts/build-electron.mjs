// Builds both bundles the offline desktop app needs.
//
// Client: `import.meta.env.VITE_*` values are inlined by Vite at build time, not
// read at runtime — so VITE_LOCAL_MODE has to be set before vite's build() runs
// here, not just before Electron's main process starts. (electron/main.cjs also
// sets process.env.VITE_LOCAL_MODE, but that only reaches the server — it starts
// as a separate process long after this client bundle has already been built.)
// Building in-process, via vite's JS API rather than shelling out to a `vite
// build` binary, keeps this env change local to this script.
process.env.VITE_LOCAL_MODE = "true";

const { build } = await import("vite");
await build();

// Server: bundled because tsx isn't available inside a packaged Electron app.
// See build-electron-server.config.mjs for why nothing is left external.
const { build: esbuild } = await import("esbuild");
const { default: serverConfig } = await import("./build-electron-server.config.mjs");
await esbuild({ ...serverConfig, outfile: "dist-electron/server.mjs", logLevel: "info" });
