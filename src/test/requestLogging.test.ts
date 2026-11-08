// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { Writable } from "stream";
import { requestLogSerializers, serializeRequest } from "../server/requestLogging";

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

  it("keeps the client address and leaves the live request alone", async () => {
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
    let liveReferer: unknown;
    app.get("/operate/:operatorId", (req, res) => {
      liveReferer = req.headers.referer;
      res.send("page");
    });
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

    await fetch(`${base}/operate/${id}`, { headers: { Referer: `${base}/operate/${id}` } });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { req } = JSON.parse(output.trim().split("\n")[0]);
    expect(req.remoteAddress).toBe("127.0.0.1");
    expect(req.remotePort).toEqual(expect.any(Number));
    expect(req.headers.referer).toBe(`${base}/operate/[hidden]`);
    expect(liveReferer).toBe(`${base}/operate/${id}`);
  });

  describe("sign-in credentials", () => {
    const idToken = "firebase-id-token-value";
    const sessionCookie = "session-cookie-value";
    const issuedCookie = "issued-cookie-value";

    // Sends one signed-in request through real pino-http, on a route with nothing to do
    // with second operators, and returns what was logged and what the route saw.
    const logSignedInRequest = async () => {
      let output = "";
      const stream = new Writable({
        write(chunk, _enc, done) {
          output += chunk.toString();
          done();
        },
      });
      const app = express();
      app.use(pinoHttp({ logger: pino({ level: "info" }, stream), serializers: requestLogSerializers }));
      const live: { authorization?: string; cookie?: string } = {};
      app.get("/api/shortcuts", (req, res) => {
        live.authorization = req.headers.authorization;
        live.cookie = req.headers.cookie;
        res.setHeader("Set-Cookie", [`session=${issuedCookie}`]);
        res.setHeader("X-Kept", "kept-value");
        res.json({});
      });
      httpServer = createServer(app);
      await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
      await fetch(`${base}/api/shortcuts`, {
        headers: { Authorization: `Bearer ${idToken}`, Cookie: `session=${sessionCookie}` },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { output, line: JSON.parse(output.trim().split("\n")[0]), live };
    };

    it("masks the credentials in request headers and keeps the client address", async () => {
      const { output, line } = await logSignedInRequest();
      expect(output).not.toContain(idToken);
      expect(output).not.toContain(sessionCookie);
      expect(line.req.headers.authorization).toBe("[hidden]");
      expect(line.req.headers.cookie).toBe("[hidden]");
      expect(line.req.remoteAddress).toBe("127.0.0.1");
    });

    it("leaves the live request's headers alone", async () => {
      const { live } = await logSignedInRequest();
      expect(live.authorization).toBe(`Bearer ${idToken}`);
      expect(live.cookie).toBe(`session=${sessionCookie}`);
    });

    it("masks a cookie the response sets and keeps its other headers", async () => {
      const { output, line } = await logSignedInRequest();
      expect(output).not.toContain(issuedCookie);
      expect(line.res.headers["set-cookie"]).toBe("[hidden]");
      expect(line.res.headers["x-kept"]).toBe("kept-value");
      expect(line.res.statusCode).toBe(200);
    });
  });
});
