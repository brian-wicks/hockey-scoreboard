// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("offline")),
  })),
}));

// Local mode is an authentication bypass, so these tests pin both halves of it:
// that it lets the local operator through, and that it stays off by default.
async function startServer(localMode: boolean) {
  if (localMode) {
    process.env.LOCAL_MODE = "true";
  } else {
    delete process.env.LOCAL_MODE;
  }
  vi.resetModules();
  const dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-local-"));
  const { createScoreboardServer } = await import("../../serverApp");
  const server = createScoreboardServer({ dataDir });
  const port = await server.start(0);
  return { server, port, dataDir };
}

describe("local mode server auth", () => {
  let running: Awaited<ReturnType<typeof startServer>> | null = null;

  beforeEach(() => {
    delete process.env.LOCAL_MODE;
  });

  afterEach(async () => {
    if (running) {
      await running.server.stop();
      await rm(running.dataDir, { recursive: true, force: true });
      running = null;
    }
    delete process.env.LOCAL_MODE;
  });

  it("serves authenticated routes with no token at all", async () => {
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/shortcuts`);
    expect(res.status).toBe(200);
  });

  it("rejects the same request when local mode is off", async () => {
    running = await startServer(false);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/shortcuts`);
    expect(res.status).toBe(401);
  });

  it("still rejects an unverifiable token when local mode is off", async () => {
    running = await startServer(false);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/shortcuts`, {
      headers: { Authorization: "Bearer whatever" },
    });
    expect(res.status).toBe(401);
  });

  it("binds only the loopback interface in local mode", async () => {
    running = await startServer(true);
    const address = running.server.httpServer.address();
    expect(typeof address === "object" && address?.address).toBe("127.0.0.1");
  });

  it("binds all interfaces when local mode is off", async () => {
    running = await startServer(false);
    const address = running.server.httpServer.address();
    expect(typeof address === "object" && address?.address).toBe("0.0.0.0");
  });

  it("accepts a request from its own dynamically-assigned origin", async () => {
    // Local mode is started with port 0 so the OS picks a free port — the exact
    // origin the Electron window ends up loading can't be known ahead of time,
    // so it can't be baked into a static allowlist. This is the same origin-check
    // path Socket.IO's CORS option uses, exercised here over plain HTTP since
    // that's enough to prove the allowlist was actually updated.
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/shortcuts`, {
      headers: { Origin: `http://localhost:${running.port}` },
    });
    expect(res.status).toBe(200);
  });

  it("still rejects a request claiming an origin that isn't this server", async () => {
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/shortcuts`, {
      headers: { Origin: "http://localhost:1" },
    });
    expect(res.status).toBe(403);
  });

  it("stores an uploaded image and serves it back", async () => {
    running = await startServer(true);
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const upload = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
    expect(upload.status).toBe(200);
    const { url } = (await upload.json()) as { url: string };
    expect(url).toMatch(/^\/uploads\/[a-zA-Z0-9_-]+\/[^/]+\.png$/);

    const fetched = await fetch(`http://127.0.0.1:${running.port}${url}`);
    expect(fetched.status).toBe(200);
    expect(Buffer.from(await fetched.arrayBuffer()).equals(png)).toBe(true);
  });

  it("stores an uploaded PDF template", async () => {
    running = await startServer(true);
    const upload = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from("%PDF-1.4 fake"),
    });
    expect(upload.status).toBe(200);
    const { url } = (await upload.json()) as { url: string };
    expect(url.endsWith(".pdf")).toBe(true);
  });

  it("rejects file types that could execute in the app's own origin", async () => {
    running = await startServer(true);
    for (const type of ["image/svg+xml", "text/html", "application/javascript"]) {
      const res = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
        method: "POST",
        headers: { "Content-Type": type },
        body: Buffer.from("<svg onload=alert(1)>"),
      });
      expect(res.status, type).toBe(415);
    }
  });

  it("rejects an empty upload", async () => {
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.alloc(0),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an image over the size cap", async () => {
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.alloc(4 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it("does not expose the upload endpoint outside local mode", async () => {
    // It writes files for an unauthenticated caller, so it must not exist in a
    // normal deployment at all.
    running = await startServer(false);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/local-upload`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from("x"),
    });
    expect(res.status).toBe(404);
  });

  it("serves no file content from /uploads outside local mode", async () => {
    // The path still resolves, but only because every unmatched GET falls
    // through to the SPA's index.html. What matters is that no stored file is
    // handed back, so assert the response is the app shell and not an image.
    running = await startServer(false);
    const res = await fetch(`http://127.0.0.1:${running.port}/uploads/local-operator/any.png`);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("serves the client shell when given a relative client directory", async () => {
    // res.sendFile rejects relative paths, so clientDir has to be resolved —
    // otherwise every non-API route 500s instead of loading the app.
    process.env.LOCAL_MODE = "true";
    vi.resetModules();
    const dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-local-"));
    const { createScoreboardServer } = await import("../../serverApp");
    const server = createScoreboardServer({ dataDir, clientDir: "dist" });
    const port = await server.start(0);
    running = { server, port, dataDir };

    const res = await fetch(`http://127.0.0.1:${port}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("does not serve files from outside the uploads directory", async () => {
    running = await startServer(true);
    const http = await import("http");
    // Sent raw so the client doesn't normalise the traversal away before it
    // reaches the server. Unmatched paths fall through to the SPA shell, so the
    // check is that no real file content comes back — not the status code.
    for (const target of ["/uploads/..%2f..%2fpackage.json", "/uploads/%2e%2e/%2e%2e/package.json"]) {
      const body = await new Promise<string>((resolveBody) => {
        http
          .request({ host: "127.0.0.1", port: running!.port, path: target }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolveBody(data));
          })
          .end();
      });
      expect(body, target).not.toContain("hockey-scoreboard");
      expect(body, target).not.toContain("devDependencies");
    }
  });

  it("writes local-mode data under the data directory it was given", async () => {
    running = await startServer(true);
    const res = await fetch(`http://127.0.0.1:${running.port}/api/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ok" });
  });
});
