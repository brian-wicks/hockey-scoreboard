// esbuild config for the packaged server bundle, kept separate from the build
// script so the test suite can assert properties of it (see
// src/test/electronServerBundle.test.ts).
/** @type {import('esbuild').BuildOptions} */
export default {
  entryPoints: ["serverApp.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Nothing is left external: an external import would have to be resolvable
  // from Contents/Resources/server/, which nothing in a packaged app is.
  // better-sqlite3 is native so it still can't be inlined — it goes through a
  // shim that require()s it by absolute path instead (electron/stubs).
  external: [],
  // serverApp.ts imports .ts paths directly (allowImportingTsExtensions).
  resolveExtensions: [".ts", ".js", ".mjs", ".json"],
  alias: {
    "better-sqlite3": "./electron/stubs/better-sqlite3.mjs",
    // Firebase Admin and Sentry are cloud-only: the offline build never
    // authenticates, never uses Firestore, and can't reach an error reporter.
    // Aliasing them to stubs keeps them out of the package entirely.
    "firebase-admin/app": "./electron/stubs/firebase-admin-app.mjs",
    "firebase-admin/auth": "./electron/stubs/firebase-admin-auth.mjs",
    "firebase-admin/firestore": "./electron/stubs/firebase-admin-firestore.mjs",
    "@sentry/node": "./electron/stubs/sentry-node.mjs",
  },
  // Bundled CommonJS dependencies (debug, body-parser, …) call require() for
  // node builtins at runtime. ESM has no require in scope, so supply a real one.
  banner: {
    js: [
      "import { createRequire as __nodeCreateRequire } from 'module';",
      "const require = __nodeCreateRequire(import.meta.url);",
    ].join("\n"),
  },
};
