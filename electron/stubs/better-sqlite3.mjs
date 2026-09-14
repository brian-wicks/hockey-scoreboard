// The bundled server lives in Contents/Resources/server/, but its dependencies
// are packed inside app.asar. Node's ESM resolver walks up from the importing
// file and never looks inside the asar, so `import "better-sqlite3"` fails in an
// installed app. (It appears to work when the .app happens to sit inside the
// repo, because the resolver finds the project's own node_modules on the way up
// — which is exactly how this got missed the first time.)
//
// electron/main.cjs runs from inside the asar, where require.resolve does find
// the module, and passes the absolute path through the environment. Electron's
// patched fs transparently redirects the native .node file to app.asar.unpacked.
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const resolved = process.env.BETTER_SQLITE3_PATH;

// Unpackaged (npm run electron:dev, tests, plain node) there's no override and
// ordinary resolution works.
const Database = require(resolved || "better-sqlite3");

export default Database.default || Database;
