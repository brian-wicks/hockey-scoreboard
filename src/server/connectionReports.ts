// Checks and sorts the connection reports screens send (see src/lib/connectionDiagnostics.ts).
// Every report is logged. The serious ones also go to Sentry, within a budget that keeps even
// a bad night well inside the free plan's monthly event allowance.
import type { ConnectionReport, DiagnosticIncident } from "../lib/connectionDiagnostics.ts";
import { maskOperatorLinks } from "../lib/operatorAccess.ts";

const MAX_INCIDENTS = 30;

const text = (value: unknown, max: number): string | undefined =>
  typeof value === "string" ? maskOperatorLinks(value.slice(0, max)) : undefined;

const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

function sanitizeIncident(raw: unknown): DiagnosticIncident | null {
  if (!raw || typeof raw !== "object") return null;
  const incident = raw as Record<string, unknown>;
  const at = count(incident.at);
  if (at === undefined) return null;
  switch (incident.type) {
    case "disconnect": {
      const offlineMs = count(incident.offlineMs);
      const transport = text(incident.transport, 20);
      return {
        type: "disconnect",
        at,
        reason: text(incident.reason, 60) ?? "unknown",
        ...(transport ? { transport } : {}),
        ...(offlineMs !== undefined ? { offlineMs } : {}),
      };
    }
    case "connect_error":
      return { type: "connect_error", at, message: text(incident.message, 200) ?? "" };
    case "stall": {
      const gapMs = count(incident.gapMs);
      return gapMs === undefined ? null : { type: "stall", at, gapMs };
    }
    case "error": {
      const source = text(incident.source, 200);
      return { type: "error", at, message: text(incident.message, 300) ?? "", ...(source ? { source } : {}) };
    }
    default:
      return null;
  }
}

/** Only the fields a report can have, cut to size. null when it isn't a report at all. */
export function sanitizeConnectionReport(raw: unknown): ConnectionReport | null {
  if (!raw || typeof raw !== "object") return null;
  const report = raw as Record<string, unknown>;
  const sessionId = text(report.sessionId, 40);
  const role = report.role;
  if (!sessionId || (role !== "owner" && role !== "operator" && role !== "viewer")) return null;
  if (!Array.isArray(report.incidents)) return null;
  const shareId = text(report.shareId, 60);
  const transport = text(report.transport, 20);
  return {
    sessionId,
    role,
    screen: text(report.screen, 60) ?? "unknown",
    appVersion: text(report.appVersion, 20) ?? "unknown",
    userAgent: text(report.userAgent, 200) ?? "",
    ...(shareId ? { shareId } : {}),
    socketIds: Array.isArray(report.socketIds)
      ? report.socketIds.slice(0, 5).map((id) => text(id, 40)).filter((id): id is string => Boolean(id))
      : [],
    ...(transport ? { transport } : {}),
    online: report.online !== false,
    incidents: report.incidents
      .slice(0, MAX_INCIDENTS)
      .map(sanitizeIncident)
      .filter((incident): incident is DiagnosticIncident => incident !== null),
  };
}

// Short blips are normal on wifi and the screen recovers by itself. These are long enough
// that someone at the rink would have seen a frozen or wrong scoreboard.
export const SERIOUS_OFFLINE_MS = 10_000;
export const SERIOUS_STALL_MS = 10_000;
export const SERIOUS_DISCONNECT_COUNT = 3;

export interface ReportAssessment {
  serious: boolean;
  /** Groups reports into a few Sentry issues rather than one per screen. */
  kind: "page-error" | "offline" | "stalled" | "unstable" | "minor";
  headline: string;
  disconnects: number;
  longestOfflineMs: number;
  longestStallMs: number;
}

export function assessConnectionReport(report: ConnectionReport): ReportAssessment {
  const disconnects = report.incidents.filter((incident) => incident.type === "disconnect");
  const longestOfflineMs = Math.max(0, ...disconnects.map((incident) => incident.offlineMs ?? 0));
  const longestStallMs = Math.max(
    0,
    ...report.incidents.map((incident) => (incident.type === "stall" ? incident.gapMs : 0)),
  );
  const pageError = report.incidents.find((incident) => incident.type === "error");
  const seconds = (ms: number) => `${Math.round(ms / 1000)}s`;
  const base = { disconnects: disconnects.length, longestOfflineMs, longestStallMs };

  if (pageError) {
    return { ...base, serious: true, kind: "page-error", headline: `${report.screen} page error: ${pageError.message}` };
  }
  if (longestOfflineMs >= SERIOUS_OFFLINE_MS) {
    return { ...base, serious: true, kind: "offline", headline: `${report.screen} offline for ${seconds(longestOfflineMs)}` };
  }
  if (longestStallMs >= SERIOUS_STALL_MS) {
    return { ...base, serious: true, kind: "stalled", headline: `${report.screen} got no updates for ${seconds(longestStallMs)}` };
  }
  if (disconnects.length >= SERIOUS_DISCONNECT_COUNT) {
    return { ...base, serious: true, kind: "unstable", headline: `${report.screen} dropped its connection ${disconnects.length} times` };
  }
  return { ...base, serious: false, kind: "minor", headline: `${report.screen} connection report` };
}

/**
 * Decides whether a serious report can go to Sentry. Sentry's free plan allows 5,000 events a
 * month, shared with the server's own errors, so this allows one event per screen per half
 * hour, 10 an hour and 40 a day. Reports over the budget are still in the server log.
 */
export function createSentryBudget({
  now = Date.now,
  perSessionMs = 30 * 60_000,
  perHour = 10,
  perDay = 40,
}: { now?: () => number; perSessionMs?: number; perHour?: number; perDay?: number } = {}) {
  const lastBySession = new Map<string, number>();
  let sent: number[] = [];

  return (sessionId: string): boolean => {
    const at = now();
    sent = sent.filter((time) => at - time < 24 * 60 * 60_000);
    for (const [session, time] of lastBySession) {
      if (at - time >= perSessionMs) lastBySession.delete(session);
    }
    if (lastBySession.has(sessionId)) return false;
    if (sent.length >= perDay) return false;
    if (sent.filter((time) => at - time < 60 * 60_000).length >= perHour) return false;
    sent.push(at);
    lastBySession.set(sessionId, at);
    return true;
  };
}
