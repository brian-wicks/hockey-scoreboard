import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REPORT_INTERVAL_MS,
  screenName,
  trackConnection,
  type ConnectionDiagnostics,
  type ConnectionReport,
} from "../lib/connectionDiagnostics";

const fakeSocket = () => {
  const handlers = new Map<string, (arg?: any) => void>();
  return {
    connected: true,
    id: "socket-1",
    io: { engine: { transport: { name: "websocket" } } },
    on: vi.fn((event: string, handler: (arg?: any) => void) => {
      handlers.set(event, handler);
    }),
    fire(event: string, arg?: unknown) {
      handlers.get(event)?.(arg);
    },
  };
};

describe("connection diagnostics", () => {
  let time: number;
  let socket: ReturnType<typeof fakeSocket>;
  let sent: { report: ConnectionReport; leaving: boolean }[];
  let tracker: ConnectionDiagnostics;

  beforeEach(() => {
    vi.useFakeTimers();
    time = 1_000_000;
    socket = fakeSocket();
    sent = [];
    window.history.pushState({}, "", "/share/rink-1/jumbotron");
    tracker = trackConnection(socket as any, {
      role: "viewer",
      shareId: "rink-1",
      now: () => time,
      send: (report, { leaving }) => sent.push({ report, leaving }),
    });
    socket.fire("connect");
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  const drop = (reason = "transport close", forMs = 12_000) => {
    socket.connected = false;
    socket.fire("disconnect", reason);
    time += forMs;
    vi.advanceTimersByTime(forMs);
    socket.connected = true;
    socket.fire("connect");
  };

  it("sends nothing while all is well", () => {
    tracker.noteMessage(true);
    time += 1_000;
    tracker.noteMessage(true);
    vi.advanceTimersByTime(REPORT_INTERVAL_MS * 2);
    expect(sent).toEqual([]);
  });

  it("reports a dropped connection once it's back, with how long it was down", () => {
    drop("ping timeout", 12_000);
    vi.advanceTimersByTime(0);

    expect(sent).toHaveLength(1);
    const { report } = sent[0];
    expect(report).toMatchObject({ role: "viewer", screen: "jumbotron", shareId: "rink-1", transport: "websocket" });
    expect(report.incidents).toEqual([
      { type: "disconnect", at: 1_000_000, reason: "ping timeout", transport: "websocket", offlineMs: 12_000 },
    ]);
  });

  it("ignores the page closing its own connection", () => {
    socket.fire("disconnect", "io client disconnect");
    vi.advanceTimersByTime(REPORT_INTERVAL_MS);
    expect(sent).toEqual([]);
  });

  it("reports updates that stopped while the clock was running", () => {
    tracker.noteMessage(true);
    time += 8_000;
    tracker.noteMessage(true);
    vi.advanceTimersByTime(0);

    expect(sent[0].report.incidents).toEqual([{ type: "stall", at: 1_000_000, gapMs: 8_000 }]);
  });

  it("expects no updates while the clock is stopped", () => {
    tracker.noteMessage(false);
    time += 60_000;
    tracker.noteMessage(true);
    vi.advanceTimersByTime(0);

    expect(sent).toEqual([]);
  });

  it("reports an error in the page, without a second operator's link", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "Failed to load /operate/secret-id/chunk.js" }));
    vi.advanceTimersByTime(0);

    expect(sent[0].report.incidents).toEqual([
      { type: "error", at: 1_000_000, message: "Failed to load /operate/[hidden]/chunk.js" },
    ]);
  });

  it("sends at most one report every 30 seconds", () => {
    drop();
    vi.advanceTimersByTime(0);
    drop("transport error", 1_000);
    vi.advanceTimersByTime(0);
    expect(sent).toHaveLength(1);

    time += REPORT_INTERVAL_MS;
    vi.advanceTimersByTime(REPORT_INTERVAL_MS);
    expect(sent).toHaveLength(2);
    expect(sent[1].report.incidents[0]).toMatchObject({ reason: "transport error" });
  });

  it("sends what it has when the page closes, even while offline", () => {
    socket.connected = false;
    socket.fire("disconnect", "transport close");

    window.dispatchEvent(new Event("pagehide"));

    expect(sent).toHaveLength(1);
    expect(sent[0].leaving).toBe(true);
    expect(sent[0].report.incidents[0]).toMatchObject({ type: "disconnect", reason: "transport close" });
  });
});

describe("screen names", () => {
  it("names each screen from its address", () => {
    expect(screenName("/share/rink-1/jumbotron")).toBe("jumbotron");
    expect(screenName("/overlay")).toBe("overlay");
    expect(screenName("/game")).toBe("control-panel");
    expect(screenName("/")).toBe("dashboard");
    expect(screenName("/operate/secret-id")).toBe("second-operator");
  });
});
