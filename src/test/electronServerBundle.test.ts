// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

// The packaged server bundle sits in Contents/Resources/server/, where no
// node_modules is reachable — Node's resolver walks up from the importing file
// and never looks inside app.asar. So any bare package import in the bundle is a
// crash in the installed app, even though it resolves fine when the .app happens
// to sit inside this repo (which is how it shipped broken twice).
const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "constants", "crypto", "dgram",
  "dns", "domain", "events", "fs", "http", "http2", "https", "inspector", "module", "net", "os",
  "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "stream",
  "string_decoder", "timers", "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

function isBuiltin(specifier: string): boolean {
  const bare = specifier.replace(/^node:/, "").split("/")[0];
  return NODE_BUILTINS.has(bare);
}

describe("electron server bundle", () => {
  it("imports nothing that a packaged app cannot resolve", async () => {
    const outfile = path.join(await import("fs/promises").then((fs) => fs.mkdtemp(path.join(tmpdir(), "bundle-"))), "server.mjs");
    const { build } = await import("esbuild");
    const config = await import("../../scripts/build-electron-server.config.mjs");

    await build({ ...config.default, outfile, logLevel: "silent" });
    const code = await readFile(outfile, "utf8");
    await rm(path.dirname(outfile), { recursive: true, force: true });

    const specifiers = [...code.matchAll(/^import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
    const unresolvable = specifiers.filter((s) => !s.startsWith(".") && !isBuiltin(s));

    expect(unresolvable, `bundle must not import bare packages: ${unresolvable.join(", ")}`).toEqual([]);
  });
});
