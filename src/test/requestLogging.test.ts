// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { Writable } from "stream";
import { serializeRequest } from "../server/requestLogging";


describe("request logging", () => {
  let httpServer: HttpServer;
  afterEach(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it("keeps the operator link out of real pino-http output", async () => {
    const id = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";
    let output = "";
    const stream = new Writable({
      write(chunk, _enc, done) {
        output += chunk.toString();
        done();
      },
    });
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: "info" }, stream), serializers: { req: serializeRequest } }));
    app.get("/operate/:operatorId", (_req, res) => res.send("page"));
    app.post("/api/operator/:operatorId/session", (_req, res) => res.json({}));
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

    await fetch(`${base}/operate/${id}`, { headers: { Referer: `${base}/operate/${id}` } });
    await fetch(`${base}/api/operator/${id}/session`, { method: "POST" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(output).not.toContain(id);
    expect(output).not.toContain("3f2b8c1e");
    expect(output).toContain("/operate/[hidden]");
    expect(output).toContain("/api/operator/[hidden]/session");
  });
});
