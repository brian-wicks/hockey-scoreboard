// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  assessConnectionReport,
  createSentryBudget,
  sanitizeConnectionReport,
} from "../server/connectionReports";

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/node")>()),
  captureMessage,
}));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));

const report = (incidents: unknown[], overrides: Record<string, unknown> = {}) => ({
  sessionId: "abc123",
  role: "viewer",
  screen: "jumbotron",
  appVersion: "1.15.2",
  userAgent: "Test",
  socketIds: ["s1"],
  transport: "polling",
  online: true,
  incidents,
  ...overrides,
});

describe("connection reports", () => {
  describe("checking a report", () => {
    it("keeps only the fields a report has", () => {
      const clean = sanitizeConnectionReport(
        report([{ type: "disconnect", at: 5, reason: "ping timeout", offlineMs: 12_000, extra: "x" }], { token: "secret" }),
      );
      expect(clean).not.toHaveProperty("token");
      expect(clean?.incidents).toEqual([{ type: "disconnect", at: 5, reason: "ping timeout", offlineMs: 12_000 }]);
    });

    it("refuses something that isn't a report", () => {
      expect(sanitizeConnectionReport(null)).toBeNull();
      expect(sanitizeConnectionReport({ sessionId: "a", role: "admin", incidents: [] })).toBeNull();
      expect(sanitizeConnectionReport({ sessionId: "a", role: "viewer" })).toBeNull();
    });

    it("drops unknown incidents and caps how many it keeps", () => {
      const many = Array.from({ length: 50 }, (_, at) => ({ type: "stall", at, gapMs: 6_000 }));
      const clean = sanitizeConnectionReport(report([{ type: "mystery", at: 1 }, ...many]));
      expect(clean?.incidents).toHaveLength(29);
    });

    it("hides a second operator's link", () => {
      const clean = sanitizeConnectionReport(report([{ type: "error", at: 1, message: "at /operate/secret-id" }]));
      expect(clean?.incidents[0]).toMatchObject({ message: "at /operate/[hidden]" });
    });
  });

  describe("deciding what's serious", () => {
    const assess = (incidents: unknown[]) => assessConnectionReport(sanitizeConnectionReport(report(incidents))!);

    it("treats a short blip as minor", () => {
      expect(assess([{ type: "disconnect", at: 1, reason: "transport close", offlineMs: 2_000 }]).serious).toBe(false);
    });

    it("flags a screen that was offline for 10 seconds or more", () => {
      expect(assess([{ type: "disconnect", at: 1, reason: "ping timeout", offlineMs: 42_000 }])).toMatchObject({
        serious: true,
        kind: "offline",
        headline: "jumbotron offline for 42s",
      });
    });

    it("flags updates that stopped for 10 seconds or more", () => {
      expect(assess([{ type: "stall", at: 1, gapMs: 15_000 }])).toMatchObject({ serious: true, kind: "stalled" });
    });

    it("flags a connection that keeps dropping", () => {
      const drop = { type: "disconnect", at: 1, reason: "transport close", offlineMs: 1_000 };
      expect(assess([drop, drop, drop])).toMatchObject({ serious: true, kind: "unstable" });
    });

    it("flags an error in the page above anything else", () => {
      expect(
        assess([
          { type: "disconnect", at: 1, reason: "ping timeout", offlineMs: 42_000 },
          { type: "error", at: 2, message: "boom" },
        ]),
      ).toMatchObject({ kind: "page-error", headline: "jumbotron page error: boom" });
    });
  });

  describe("the Sentry budget", () => {
    it("allows one event per screen per half hour", () => {
      let time = 0;
      const allow = createSentryBudget({ now: () => time });
      expect(allow("a")).toBe(true);
      expect(allow("a")).toBe(false);
      expect(allow("b")).toBe(true);
      time += 30 * 60_000;
      expect(allow("a")).toBe(true);
    });

    it("allows 10 an hour and 40 a day across all screens", () => {
      let time = 0;
      const allow = createSentryBudget({ now: () => time });
      const allowed = () => Array.from({ length: 20 }, (_, i) => allow(`s-${time}-${i}`)).filter(Boolean).length;

      expect(allowed()).toBe(10);
      let total = 10;
      for (let hour = 1; hour < 24; hour++) {
        time = hour * 60 * 60_000;
        total += allowed();
      }
      expect(total).toBe(40);
      time = 24 * 60 * 60_000;
      expect(allowed()).toBe(10);
    });
  });

  describe("the report endpoint", () => {
    let server: any;
    let baseUrl: string;
    let dataDir: string;
    let budgetAllows = true;

    beforeAll(async () => {
      const { createScoreboardServer } = await import("../../serverApp");
      dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-reports-"));
      server = createScoreboardServer({ dataDir, sentryBudget: () => budgetAllows });
      baseUrl = `http://127.0.0.1:${await server.start(0)}`;
    });

    afterAll(async () => {
      await server.stop();
      await rm(dataDir, { recursive: true, force: true });
    });

    const post = (body: unknown) =>
      fetch(`${baseUrl}/api/diagnostics/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("accepts a report", async () => {
      captureMessage.mockClear();
      const res = await post(report([{ type: "disconnect", at: 1, reason: "transport close", offlineMs: 1_000 }]));
      expect(res.status).toBe(204);
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("sends a serious report to Sentry, grouped by screen and kind", async () => {
      captureMessage.mockClear();
      budgetAllows = true;
      await post(report([{ type: "disconnect", at: 1, reason: "ping timeout", offlineMs: 42_000 }]));

      expect(captureMessage).toHaveBeenCalledWith(
        "Screen connection problem: jumbotron offline for 42s",
        expect.objectContaining({ level: "warning", fingerprint: ["connection-report", "jumbotron", "offline"] }),
      );
    });

    it("only logs a serious report once the budget is spent", async () => {
      captureMessage.mockClear();
      budgetAllows = false;
      const res = await post(report([{ type: "disconnect", at: 1, reason: "ping timeout", offlineMs: 42_000 }]));

      expect(res.status).toBe(204);
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("refuses something that isn't a report", async () => {
      expect((await post({ hello: "world" })).status).toBe(400);
    });
  });
});
