// Records how a screen's connection to the server behaves during a game, and sends a short
// report to the server when something goes wrong: a dropped connection, updates that stopped
// arriving while the clock ran, or an error in the page. The server logs every report and
// passes the serious ones on to Sentry, so a problem at the rink can be looked at afterwards.
import type { Socket } from "socket.io-client";
import { getBaseUrl } from "./localMode";
import { maskOperatorLinks } from "./operatorAccess";

export type DiagnosticIncident =
  | { type: "disconnect"; at: number; reason: string; transport?: string; offlineMs?: number }
  | { type: "connect_error"; at: number; message: string }
  | { type: "stall"; at: number; gapMs: number }
  | { type: "error"; at: number; message: string; source?: string };

export interface ConnectionReport {
  sessionId: string;
  role: "owner" | "operator" | "viewer";
  screen: string;
  appVersion: string;
  userAgent: string;
  shareId?: string;
  socketIds: string[];
  transport?: string;
  online: boolean;
  incidents: DiagnosticIncident[];
}

// While the clock runs the server sends the time every second, so a longer gap means
// updates stopped reaching this screen even though the connection looked open.
export const STALL_THRESHOLD_MS = 5_000;
// At most one report this often, so a connection that keeps dropping doesn't flood the server.
export const REPORT_INTERVAL_MS = 30_000;
// Each kind of incident is capped, so a long bad game still makes a small report.
const MAX_INCIDENTS_PER_REPORT = 30;
const MAX_ERRORS_PER_PAGE = 5;
const MAX_SOCKET_IDS = 5;

const REPORT_PATH = "/api/diagnostics/connection";

/** Which screen this is, from the page's address. Second operator links are secret, so they are masked. */
export function screenName(pathname: string): string {
  if (pathname.startsWith("/operate/")) return "second-operator";
  const match = pathname.match(/\/(overlay|jumbotron|results|preshow)$/);
  if (match) return match[1];
  if (pathname === "/game") return "control-panel";
  if (pathname === "/" || pathname === "") return "dashboard";
  return maskOperatorLinks(pathname);
}

const newSessionId = () => Math.random().toString(36).slice(2, 12);

interface DiagnosticsOptions {
  role: ConnectionReport["role"];
  shareId?: string;
  send?: (report: ConnectionReport, options: { leaving: boolean }) => void;
  now?: () => number;
}

export interface ConnectionDiagnostics {
  /** Call for every update from the server, with whether the clock is running in it. */
  noteMessage: (clockRunning: boolean) => void;
  /** Stops listening and sends anything not yet reported. */
  stop: () => void;
}

const defaultSend = (report: ConnectionReport, { leaving }: { leaving: boolean }) => {
  const base = getBaseUrl().replace(/\/+$/, "");
  const url = `${base === window.location.origin ? "" : base}${REPORT_PATH}`;
  const body = JSON.stringify(report);
  // A page being closed can't wait for fetch, but sendBeacon still goes out.
  if (leaving && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
    // Reporting is best effort, and the next report includes anything still unsent.
  });
};

export function trackConnection(socket: Socket, options: DiagnosticsOptions): ConnectionDiagnostics {
  const now = options.now ?? Date.now;
  const send = options.send ?? defaultSend;
  const sessionId = newSessionId();
  const socketIds: string[] = [];
  let unsent: DiagnosticIncident[] = [];
  let errorsRecorded = 0;
  let lastSentAt = -Infinity;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let lastMessageAt: number | null = null;
  let clockWasRunning = false;
  let openDisconnect: Extract<DiagnosticIncident, { type: "disconnect" }> | null = null;

  const transport = () => socket.io?.engine?.transport?.name;

  const buildReport = (): ConnectionReport => ({
    sessionId,
    role: options.role,
    screen: screenName(window.location.pathname),
    appVersion: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown",
    userAgent: navigator.userAgent.slice(0, 200),
    ...(options.shareId ? { shareId: options.shareId } : {}),
    socketIds: [...socketIds],
    transport: transport(),
    online: navigator.onLine,
    incidents: unsent.slice(0, MAX_INCIDENTS_PER_REPORT),
  });

  const flush = (leaving = false) => {
    if (reportTimer) {
      clearTimeout(reportTimer);
      reportTimer = null;
    }
    if (unsent.length === 0) return;
    // A drop that hasn't recovered yet is sent once it has, with how long it lasted,
    // unless the page is closing.
    if (!leaving && !socket.connected) return;
    const report = buildReport();
    unsent = [];
    lastSentAt = now();
    try {
      send(report, { leaving });
    } catch {
      // Reporting must never get in the way of the screen.
    }
  };

  const scheduleReport = () => {
    if (reportTimer) return;
    const wait = Math.max(0, lastSentAt + REPORT_INTERVAL_MS - now());
    reportTimer = setTimeout(() => flush(), wait);
  };

  const record = (incident: DiagnosticIncident) => {
    if (unsent.length < MAX_INCIDENTS_PER_REPORT) unsent.push(incident);
    scheduleReport();
  };

  socket.on("connect", () => {
    if (socket.id && !socketIds.includes(socket.id)) {
      socketIds.push(socket.id);
      if (socketIds.length > MAX_SOCKET_IDS) socketIds.shift();
    }
    if (openDisconnect) {
      openDisconnect.offlineMs = now() - openDisconnect.at;
      openDisconnect = null;
    }
    // The clock may have stopped while this screen was offline, so the gap starts again.
    lastMessageAt = null;
    scheduleReport();
  });

  socket.on("disconnect", (reason: string) => {
    // Closing the screen or switching games isn't a connection problem.
    if (reason === "io client disconnect") return;
    openDisconnect = { type: "disconnect", at: now(), reason, transport: transport() };
    record(openDisconnect);
  });

  socket.on("connect_error", (error: Error) => {
    record({ type: "connect_error", at: now(), message: String(error?.message ?? error).slice(0, 200) });
  });

  const recordError = (message: string, source?: string) => {
    if (errorsRecorded >= MAX_ERRORS_PER_PAGE) return;
    errorsRecorded += 1;
    record({ type: "error", at: now(), message: maskOperatorLinks(message.slice(0, 300)), ...(source ? { source: maskOperatorLinks(source.slice(0, 200)) } : {}) });
  };
  const onError = (event: ErrorEvent) => {
    recordError(event.message || String(event.error), event.filename ? `${event.filename}:${event.lineno}` : undefined);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    recordError(reason instanceof Error ? reason.message : String(reason));
  };
  const onLeave = () => flush(true);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onLeave);

  return {
    noteMessage: (clockRunning: boolean) => {
      const at = now();
      if (lastMessageAt !== null && clockWasRunning && at - lastMessageAt > STALL_THRESHOLD_MS) {
        record({ type: "stall", at: lastMessageAt, gapMs: at - lastMessageAt });
      }
      lastMessageAt = at;
      clockWasRunning = clockRunning;
    },
    stop: () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", onLeave);
      flush(true);
    },
  };
}
