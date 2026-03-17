import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { GameEvent, TeamState } from "../store";

export type GamesheetPdfLayout = {
  // v2: X from LEFT, Y from TOP, in PDF points. If missing, layout is treated as legacy (v1) at render-time.
  version?: 2;
  scale: number;
  offsetX: number;
  offsetY: number;
  // X values support either absolute PDF points (> 1) or width ratios (0..1) for backward compatibility.
  teamNames: {
    homeX: number;
    homeYFromTop: number;
    awayX: number;
    awayYFromTop: number;
    size: number;
    align: "left" | "center" | "right";
  };
  // Legacy (v1) used right-column origin; kept for backward compatibility.
  rightColumnXRatio?: number;

  awayRoster: {
    numX: number;
    nameX: number;
    goalsX: number;
    assistsX: number;
    pimX: number;
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    numAlign: "left" | "center" | "right";
    nameAlign: "left" | "center" | "right";
    goalsAlign: "left" | "center" | "right";
    assistsAlign: "left" | "center" | "right";
    pimAlign: "left" | "center" | "right";
  };
  homeRoster: {
    numX: number;
    nameX: number;
    goalsX: number;
    assistsX: number;
    pimX: number;
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    numAlign: "left" | "center" | "right";
    nameAlign: "left" | "center" | "right";
    goalsAlign: "left" | "center" | "right";
    assistsAlign: "left" | "center" | "right";
    pimAlign: "left" | "center" | "right";
  };

  awayGoals: {
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    cols: { timeX: number; scorerX: number; assist1X: number; assist2X: number };
    aligns: { time: "left" | "center" | "right"; scorer: "left" | "center" | "right"; assist1: "left" | "center" | "right"; assist2: "left" | "center" | "right" };
  };
  homeGoals: {
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    cols: { timeX: number; scorerX: number; assist1X: number; assist2X: number };
    aligns: { time: "left" | "center" | "right"; scorer: "left" | "center" | "right"; assist1: "left" | "center" | "right"; assist2: "left" | "center" | "right" };
  };

  awayPenalties: {
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    cols: { playerNumX: number; pimX: number; offenceX: number; givenX: number; startX: number; endX: number };
    aligns: { playerNum: "left" | "center" | "right"; pim: "left" | "center" | "right"; offence: "left" | "center" | "right"; given: "left" | "center" | "right"; start: "left" | "center" | "right"; end: "left" | "center" | "right" };
  };
  homePenalties: {
    yFromTop: number;
    lineHeight: number;
    size: number;
    maxLines: number;
    cols: { playerNumX: number; pimX: number; offenceX: number; givenX: number; startX: number; endX: number };
    aligns: { playerNum: "left" | "center" | "right"; pim: "left" | "center" | "right"; offence: "left" | "center" | "right"; given: "left" | "center" | "right"; start: "left" | "center" | "right"; end: "left" | "center" | "right" };
  };

  awayPeriodGoals: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    cols: { p1X: number; p2X: number; p3X: number; otX: number; totalX?: number };
  };
  homePeriodGoals: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    cols: { p1X: number; p2X: number; p3X: number; otX: number; totalX?: number };
  };
  awayPeriodPim: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    cols: { p1X: number; p2X: number; p3X: number; otX: number; totalX?: number };
  };
  homePeriodPim: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    cols: { p1X: number; p2X: number; p3X: number; otX: number; totalX?: number };
  };
  awayPeriodLabel: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    pimAlign?: "left" | "center" | "right";
    goalsX: number;
    pimX: number;
  };
  homePeriodLabel: {
    yFromTop: number;
    size: number;
    align: "left" | "center" | "right";
    pimAlign?: "left" | "center" | "right";
    goalsX: number;
    pimX: number;
  };

  // X values support either absolute PDF points (> 1) or width ratios (0..1) for backward compatibility.
  awayShots: { x: number; yFromTop: number; size: number; align: "left" | "center" | "right" };
  homeShots: { x: number; yFromTop: number; size: number; align: "left" | "center" | "right" };

  debugGridStep: number;
};

export function getDefaultGamesheetPdfLayout(): GamesheetPdfLayout {
  return {
    version: 2,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rightColumnXRatio: 0.54,
    // Best-effort defaults for this template (adjust via editor).
    teamNames: { homeX: 116, homeYFromTop: 676, awayX: 378, awayYFromTop: 676, size: 11, align: "left" },
    awayRoster: {
      numX: 48,
      nameX: 68,
      goalsX: 250,
      assistsX: 270,
      pimX: 290,
      yFromTop: 138,
      lineHeight: 12,
      size: 8.5,
      maxLines: 18,
      numAlign: "right",
      nameAlign: "left",
      goalsAlign: "center",
      assistsAlign: "center",
      pimAlign: "center",
    },
    homeRoster: {
      numX: 48,
      nameX: 68,
      goalsX: 250,
      assistsX: 270,
      pimX: 290,
      yFromTop: 452,
      lineHeight: 12,
      size: 8.5,
      maxLines: 18,
      numAlign: "right",
      nameAlign: "left",
      goalsAlign: "center",
      assistsAlign: "center",
      pimAlign: "center",
    },

    // Initial guesses (adjust via editor).
    awayGoals: {
      yFromTop: 590,
      lineHeight: 12,
      size: 8.5,
      maxLines: 12,
      cols: { timeX: 332, scorerX: 392, assist1X: 418, assist2X: 444 },
      aligns: { time: "left", scorer: "center", assist1: "center", assist2: "center" },
    },
    homeGoals: {
      yFromTop: 590,
      lineHeight: 12,
      size: 8.5,
      maxLines: 12,
      cols: { timeX: 332, scorerX: 392, assist1X: 418, assist2X: 444 },
      aligns: { time: "left", scorer: "center", assist1: "center", assist2: "center" },
    },
    awayPenalties: {
      yFromTop: 430,
      lineHeight: 12,
      size: 8.5,
      maxLines: 12,
      cols: { playerNumX: 0, pimX: 34, offenceX: 66, givenX: 210, startX: 278, endX: 330 },
      aligns: { playerNum: "right", pim: "center", offence: "left", given: "left", start: "center", end: "center" },
    },
    homePenalties: {
      yFromTop: 430,
      lineHeight: 12,
      size: 8.5,
      maxLines: 12,
      cols: { playerNumX: 0, pimX: 34, offenceX: 66, givenX: 210, startX: 278, endX: 330 },
      aligns: { playerNum: "right", pim: "center", offence: "left", given: "left", start: "center", end: "center" },
    },

    awayPeriodGoals: {
      yFromTop: 110,
      size: 9,
      align: "center",
      cols: { p1X: 420, p2X: 440, p3X: 460, otX: 480, totalX: 0 },
    },
    homePeriodGoals: {
      yFromTop: 98,
      size: 9,
      align: "center",
      cols: { p1X: 420, p2X: 440, p3X: 460, otX: 480, totalX: 0 },
    },
    awayPeriodPim: {
      yFromTop: 130,
      size: 9,
      align: "center",
      cols: { p1X: 420, p2X: 440, p3X: 460, otX: 480, totalX: 0 },
    },
    homePeriodPim: {
      yFromTop: 118,
      size: 9,
      align: "center",
      cols: { p1X: 420, p2X: 440, p3X: 460, otX: 480, totalX: 0 },
    },
    awayPeriodLabel: {
      yFromTop: 110,
      size: 9,
      align: "right",
      pimAlign: "right",
      goalsX: 404,
      pimX: 404,
    },
    homePeriodLabel: {
      yFromTop: 98,
      size: 9,
      align: "right",
      pimAlign: "right",
      goalsX: 404,
      pimX: 404,
    },

    awayShots: { x: 343, yFromTop: 702, size: 10, align: "center" },
    homeShots: { x: 208, yFromTop: 702, size: 10, align: "center" },
    debugGridStep: 50,
  };
}

function extractJerseyNumber(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,3})\b/);
  return match?.[1] ?? "";
}
function sortChronological(a: Pick<GameEvent, "createdAt">, b: Pick<GameEvent, "createdAt">) {
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

function matchesRevokedGoal(goal: GameEvent, revoked: GameEvent) {
  const sameTeam = goal.team === revoked.team;
  if (!sameTeam) return false;
  // If the revoke has details, try to match them; otherwise fall back to "most recent goal for team".
  const revokedHasAnyDetails =
    Boolean(revoked.period?.trim()) ||
    Boolean(revoked.clockTime?.trim()) ||
    Boolean(revoked.scorer?.trim()) ||
    Boolean(revoked.assist1?.trim()) ||
    Boolean(revoked.assist2?.trim());
  if (!revokedHasAnyDetails) return true;

  const norm = (v: string | undefined) => (v ?? "").trim();
  return (
    norm(goal.period) === norm(revoked.period) &&
    norm(goal.clockTime) === norm(revoked.clockTime) &&
    norm(goal.scorer) === norm(revoked.scorer) &&
    norm(goal.assist1) === norm(revoked.assist1) &&
    norm(goal.assist2) === norm(revoked.assist2)
  );
}

function getEffectiveGoals(eventLog: GameEvent[]) {
  const sorted = eventLog.slice().sort(sortChronological);
  const homeGoals: GameEvent[] = [];
  const awayGoals: GameEvent[] = [];

  for (const e of sorted) {
    if (e.type === "goal") {
      (e.team === "home" ? homeGoals : awayGoals).push(e);
      continue;
    }
    if (e.type === "goal_revoked") {
      const list = e.team === "home" ? homeGoals : awayGoals;
      // Prefer removing a matching goal if details exist; otherwise remove latest.
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (matchesRevokedGoal(list[i], e)) {
          list.splice(i, 1);
          break;
        }
      }
    }
  }

  return { homeGoals, awayGoals };
}

function getRosterStats(eventLog: GameEvent[]) {
  const effective = getEffectiveGoals(eventLog);
  const byTeam = { home: effective.homeGoals, away: effective.awayGoals };

  const goalsByTeamNumber: Record<"home" | "away", Map<string, number>> = {
    home: new Map(),
    away: new Map(),
  };
  const assistsByTeamNumber: Record<"home" | "away", Map<string, number>> = {
    home: new Map(),
    away: new Map(),
  };
  const pimByTeamNumber: Record<"home" | "away", Map<string, number>> = {
    home: new Map(),
    away: new Map(),
  };

  const inc = (m: Map<string, number>, key: string, delta = 1) => {
    if (!key) return;
    m.set(key, (m.get(key) ?? 0) + delta);
  };

  for (const team of ["home", "away"] as const) {
    for (const g of byTeam[team]) {
      inc(goalsByTeamNumber[team], extractJerseyNumber(g.scorer));
      inc(assistsByTeamNumber[team], extractJerseyNumber(g.assist1));
      inc(assistsByTeamNumber[team], extractJerseyNumber(g.assist2));
    }
  }

  const penaltyEvents = eventLog.filter((e) => e.type === "penalty_added");
  for (const p of penaltyEvents) {
    const team = p.team;
    const num = (p.playerNumber ?? "").trim();
    const mins = typeof p.penaltyDurationMs === "number" ? Math.round(p.penaltyDurationMs / 60000) : 0;
    if (!num || !mins) continue;
    inc(pimByTeamNumber[team], num, mins);
  }

  return { goalsByTeamNumber, assistsByTeamNumber, pimByTeamNumber };
}

function drawLines(params: {
  page: PDFPage;
  font: any;
  x: number;
  y: number;
  lineHeight: number;
  lines: string[];
  size?: number;
  maxLines?: number;
  align?: "left" | "center" | "right";
}) {
  const { page, font, x, y, lineHeight, lines, size = 9, maxLines = lines.length, align = "left" } = params;
  const clipped = lines.slice(0, maxLines);
  for (let i = 0; i < clipped.length; i++) {
    const line = clipped[i];
    if (!line) continue;
    const textWidth = typeof font?.widthOfTextAtSize === "function" ? font.widthOfTextAtSize(line, size) : 0;
    const drawX = align === "center" ? x - textWidth / 2 : align === "right" ? x - textWidth : x;
    page.drawText(line, { x: drawX, y: y - i * lineHeight, size, color: rgb(0, 0, 0) });
  }
}

function drawDebugGrid(page: PDFPage, width: number, height: number, step: number) {
  const color = rgb(0.85, 0.15, 0.15);
  const thin = 0.25;
  for (let x = 0; x <= width; x += step) {
    page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: thin, color });
  }
  for (let y = 0; y <= height; y += step) {
    page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: thin, color });
  }
  page.drawText(`w:${Math.round(width)} h:${Math.round(height)}`, { x: 12, y: height - 18, size: 10, color });
}

function drawDebugAnchor(page: PDFPage, x: number, y: number, label: string) {
  const color = rgb(0.1, 0.35, 0.85);
  page.drawCircle({ x, y, size: 2.2, color });
  page.drawText(label, { x: x + 4, y: y + 2, size: 8, color });
}

function drawTextAligned(params: {
  page: PDFPage;
  font: any;
  text: string;
  x: number;
  y: number;
  size: number;
  align?: "left" | "center" | "right";
}) {
  const { page, font, text, x, y, size, align = "left" } = params;
  const textWidth = typeof font?.widthOfTextAtSize === "function" ? font.widthOfTextAtSize(text, size) : 0;
  const drawX = align === "center" ? x - textWidth / 2 : align === "right" ? x - textWidth : x;
  page.drawText(text, { x: drawX, y, size, color: rgb(0, 0, 0) });
}

function resolveX(x: number, width: number) {
  if (x >= 0 && x <= 1) return width * x;
  return x;
}

function resolveLegacyRightX(x: number, width: number, layout: GamesheetPdfLayout) {
  const ratio = layout.rightColumnXRatio;
  if (typeof ratio !== "number") return x;
  if (layout.version === 2) return x;
  // v1 stored some Xs "from right column origin"; treat small-ish values as relative.
  if (x >= -150 && x <= 600) return width * ratio + x;
  return x;
}

function parseClockTimeSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const mins = Number(m[1]);
  const secs = Number(m[2]);
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
  return mins * 60 + secs;
}

function formatClockSeconds(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function normalizePeriodKey(period: string | undefined): "1" | "2" | "3" | "OT" | null {
  const raw = (period ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith("1")) return "1";
  if (raw.startsWith("2")) return "2";
  if (raw.startsWith("3")) return "3";
  if (raw.startsWith("OT")) return "OT";
  return null;
}

const PERIOD_SECONDS = 20 * 60;
const OT_DEFAULT_SECONDS = 5 * 60;

function formatGamesheetClockTime(event: Pick<GameEvent, "period" | "clockTime">): string {
  const remainingSeconds = parseClockTimeSeconds(event.clockTime);
  if (remainingSeconds === null) return (event.clockTime ?? "").trim();

  const periodKey = normalizePeriodKey(event.period);
  if (!periodKey) return (event.clockTime ?? "").trim();

  let baseSeconds = 0;
  let periodLengthSeconds = PERIOD_SECONDS;

  if (periodKey === "2") baseSeconds = PERIOD_SECONDS;
  if (periodKey === "3") baseSeconds = PERIOD_SECONDS * 2;
  if (periodKey === "OT") {
    baseSeconds = PERIOD_SECONDS * 3;
    periodLengthSeconds = OT_DEFAULT_SECONDS;
  }

  // If the stored time already exceeds the period length, assume it is already count-up.
  if (remainingSeconds > periodLengthSeconds) return (event.clockTime ?? "").trim();

  const elapsedSeconds = Math.max(0, periodLengthSeconds - remainingSeconds);
  return formatClockSeconds(baseSeconds + elapsedSeconds);
}

function formatGivenFromTimes(startClockTime?: string, endClockTime?: string): string {
  const start = parseClockTimeSeconds(startClockTime);
  const end = parseClockTimeSeconds(endClockTime);
  if (start === null || end === null) return "";
  const diffSeconds = Math.abs(start - end);
  const mins = Math.floor(diffSeconds / 60);
  const secs = diffSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPimMinutesFromDuration(durationMs: number | undefined): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) return "";
  const mins = Math.round(durationMs / 60000);
  if (![2, 5, 10].includes(mins)) return `${mins}`;
  return `${mins}`;
}
type PeriodTotals = { "1": number; "2": number; "3": number; "OT": number; total: number };

function createPeriodTotals(): PeriodTotals {
  return { "1": 0, "2": 0, "3": 0, OT: 0, total: 0 };
}

function getPeriodTotals(eventLog: GameEvent[]) {
  const homeGoals = createPeriodTotals();
  const awayGoals = createPeriodTotals();
  const homePim = createPeriodTotals();
  const awayPim = createPeriodTotals();

  const effectiveGoals = getEffectiveGoals(eventLog);
  for (const g of effectiveGoals.homeGoals) {
    const key = normalizePeriodKey(g.period);
    if (!key) continue;
    homeGoals[key] += 1;
    homeGoals.total += 1;
  }
  for (const g of effectiveGoals.awayGoals) {
    const key = normalizePeriodKey(g.period);
    if (!key) continue;
    awayGoals[key] += 1;
    awayGoals.total += 1;
  }

  const penaltyEvents = eventLog.filter((e) => e.type === "penalty_added");
  for (const p of penaltyEvents) {
    const key = normalizePeriodKey(p.period);
    if (!key) continue;
    const mins = typeof p.penaltyDurationMs === "number" ? Math.round(p.penaltyDurationMs / 60000) : 0;
    if (!mins) continue;
    if (p.team === "home") {
      homePim[key] += mins;
      homePim.total += mins;
    } else {
      awayPim[key] += mins;
      awayPim.total += mins;
    }
  }

  return {
    home: { goals: homeGoals, pim: homePim },
    away: { goals: awayGoals, pim: awayPim },
  };
}

function t(layout: GamesheetPdfLayout, x: number, y: number) {
  return { x: layout.offsetX + layout.scale * x, y: layout.offsetY + layout.scale * y };
}

function s(layout: GamesheetPdfLayout, v: number) {
  return layout.scale * v;
}

export async function exportGamesheetPdf(
  input: { homeTeam: TeamState; awayTeam: TeamState; eventLog: GameEvent[] },
  opts?: { layout?: GamesheetPdfLayout; debug?: boolean },
) {
  const outBytes = await buildGamesheetPdfBytes(input, opts);
  const blob = new Blob([outBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `gamesheet-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function buildGamesheetPdfBytes(
  input: { homeTeam: TeamState; awayTeam: TeamState; eventLog: GameEvent[] },
  opts?: { layout?: GamesheetPdfLayout; debug?: boolean },
) {
  const templateBytes = await fetch("/Blank Paper Gamesheet-1.pdf").then((r) => {
    if (!r.ok) throw new Error(`Failed to load template PDF (${r.status})`);
    return r.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.setFont(font);

  const layout = opts?.layout ?? getDefaultGamesheetPdfLayout();

  if (opts?.debug) {
    drawDebugGrid(page, width, height, layout.debugGridStep || 50);
  }

  const home = input.homeTeam;
  const away = input.awayTeam;

  // Team names near the bottom labels.
  {
    const legacyHomeY =
      typeof (layout.teamNames as any).homeY === "number" ? (layout.teamNames as any).homeY : null;
    const legacyAwayY =
      typeof (layout.teamNames as any).awayY === "number" ? (layout.teamNames as any).awayY : null;

    const homeYFromTop = legacyHomeY === null ? layout.teamNames.homeYFromTop : legacyHomeY;
    const awayYFromTop = legacyAwayY === null ? layout.teamNames.awayYFromTop : legacyAwayY;

    const homePos = t(layout, resolveX(layout.teamNames.homeX, width), height - homeYFromTop);
    const awayPos = t(layout, resolveX(layout.teamNames.awayX, width), height - awayYFromTop);
    if (opts?.debug) {
      drawDebugAnchor(page, homePos.x, homePos.y, "homeTeamName");
      drawDebugAnchor(page, awayPos.x, awayPos.y, "awayTeamName");
    }
    const nameSize = s(layout, layout.teamNames.size);
    drawTextAligned({ page, font, text: home.name || "Home", x: homePos.x, y: homePos.y, size: nameSize, align: layout.teamNames.align ?? "left" });
    drawTextAligned({ page, font, text: away.name || "Away", x: awayPos.x, y: awayPos.y, size: nameSize, align: layout.teamNames.align ?? "left" });
  }

  // Period goals/PIM totals.
  {
    const totals = getPeriodTotals(input.eventLog);

    const drawPeriodTotals = (
      label: "awayPeriodGoals" | "homePeriodGoals" | "awayPeriodPim" | "homePeriodPim",
      cfg: GamesheetPdfLayout["awayPeriodGoals"],
      values: PeriodTotals,
    ) => {
      const y = t(layout, 0, height - cfg.yFromTop).y;
      const size = s(layout, cfg.size);
      const align = cfg.align ?? "center";

      const resolveCol = (x: number) => t(layout, resolveX(x, width), 0).x;
      const hasTotal = typeof cfg.cols.totalX === "number" && cfg.cols.totalX > 0;
      const xs = {
        p1: resolveCol(cfg.cols.p1X),
        p2: resolveCol(cfg.cols.p2X),
        p3: resolveCol(cfg.cols.p3X),
        ot: resolveCol(cfg.cols.otX),
        total: hasTotal ? resolveCol(cfg.cols.totalX as number) : null,
      };

      if (opts?.debug) {
        drawDebugAnchor(page, xs.p1, y, `${label}.p1`);
        drawDebugAnchor(page, xs.p2, y, `${label}.p2`);
        drawDebugAnchor(page, xs.p3, y, `${label}.p3`);
        drawDebugAnchor(page, xs.ot, y, `${label}.ot`);
        if (xs.total !== null) drawDebugAnchor(page, xs.total, y, `${label}.total`);
      }

      drawTextAligned({ page, font, text: `${values["1"]}`, x: xs.p1, y, size, align });
      drawTextAligned({ page, font, text: `${values["2"]}`, x: xs.p2, y, size, align });
      drawTextAligned({ page, font, text: `${values["3"]}`, x: xs.p3, y, size, align });
      drawTextAligned({ page, font, text: `${values.OT}`, x: xs.ot, y, size, align });
      if (xs.total !== null) {
        drawTextAligned({ page, font, text: `${values.total}`, x: xs.total, y, size, align });
      }
    };

    drawPeriodTotals("awayPeriodGoals", layout.awayPeriodGoals, totals.away.goals);
    drawPeriodTotals("homePeriodGoals", layout.homePeriodGoals, totals.home.goals);
    drawPeriodTotals("awayPeriodPim", layout.awayPeriodPim, totals.away.pim);
    drawPeriodTotals("homePeriodPim", layout.homePeriodPim, totals.home.pim);

    const drawPeriodLabel = (
      label: "awayPeriodLabel" | "homePeriodLabel",
      cfg: GamesheetPdfLayout["awayPeriodLabel"],
      goalsCfg: GamesheetPdfLayout["awayPeriodGoals"],
      pimCfg: GamesheetPdfLayout["awayPeriodPim"],
      text: string,
    ) => {
      const goalsY = t(layout, 0, height - goalsCfg.yFromTop).y;
      const pimY = t(layout, 0, height - pimCfg.yFromTop).y;
      const size = s(layout, cfg.size);
      const align = cfg.align ?? "right";
      const pimAlign = cfg.pimAlign ?? align;
      const goalsX = t(layout, resolveX(cfg.goalsX, width), 0).x;
      const pimX = t(layout, resolveX(cfg.pimX, width), 0).x;

      if (opts?.debug) {
        drawDebugAnchor(page, goalsX, goalsY, `${label}.goals`);
        drawDebugAnchor(page, pimX, pimY, `${label}.pim`);
      }

      drawTextAligned({ page, font, text, x: goalsX, y: goalsY, size, align });
      drawTextAligned({ page, font, text, x: pimX, y: pimY, size, align: pimAlign });
    };

    drawPeriodLabel("awayPeriodLabel", layout.awayPeriodLabel, layout.awayPeriodGoals, layout.awayPeriodPim, away.name || "Away");
    drawPeriodLabel("homePeriodLabel", layout.homePeriodLabel, layout.homePeriodGoals, layout.homePeriodPim, home.name || "Home");
  }

  // Rosters (number and name are drawn in separate columns).
  const awayRosterNumbers = (away.players ?? []).map((p) => p.jerseyNumber.trim());
  const awayRosterNames = (away.players ?? []).map((p) => p.name.trim());
  const homeRosterNumbers = (home.players ?? []).map((p) => p.jerseyNumber.trim());
  const homeRosterNames = (home.players ?? []).map((p) => p.name.trim());
  const stats = getRosterStats(input.eventLog);
  const awayRosterGoals = (away.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.goalsByTeamNumber.away.get(n) ?? 0;
    return v ? String(v) : "";
  });
  const awayRosterAssists = (away.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.assistsByTeamNumber.away.get(n) ?? 0;
    return v ? String(v) : "";
  });
  const awayRosterPim = (away.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.pimByTeamNumber.away.get(n) ?? 0;
    return v ? String(v) : "";
  });
  const homeRosterGoals = (home.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.goalsByTeamNumber.home.get(n) ?? 0;
    return v ? String(v) : "";
  });
  const homeRosterAssists = (home.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.assistsByTeamNumber.home.get(n) ?? 0;
    return v ? String(v) : "";
  });
  const homeRosterPim = (home.players ?? []).map((p) => {
    const n = p.jerseyNumber.trim();
    const v = stats.pimByTeamNumber.home.get(n) ?? 0;
    return v ? String(v) : "";
  });

  // Away roster table (upper-left block).
  {
    const y = height - layout.awayRoster.yFromTop;
    const numPos = t(layout, layout.awayRoster.numX, y);
    const namePos = t(layout, layout.awayRoster.nameX, y);
    const goalsPos = t(layout, layout.awayRoster.goalsX, y);
    const assistsPos = t(layout, layout.awayRoster.assistsX, y);
    const pimPos = t(layout, layout.awayRoster.pimX, y);
    if (opts?.debug) {
      drawDebugAnchor(page, numPos.x, numPos.y, "awayRoster.num");
      drawDebugAnchor(page, namePos.x, namePos.y, "awayRoster.name");
      drawDebugAnchor(page, goalsPos.x, goalsPos.y, "awayRoster.goals");
      drawDebugAnchor(page, assistsPos.x, assistsPos.y, "awayRoster.assists");
      drawDebugAnchor(page, pimPos.x, pimPos.y, "awayRoster.pim");
    }
    drawLines({
      page,
      font,
      x: numPos.x,
      y: numPos.y,
      lineHeight: s(layout, layout.awayRoster.lineHeight),
      lines: awayRosterNumbers,
      size: s(layout, layout.awayRoster.size),
      maxLines: layout.awayRoster.maxLines,
      align: layout.awayRoster.numAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: namePos.x,
      y: namePos.y,
      lineHeight: s(layout, layout.awayRoster.lineHeight),
      lines: awayRosterNames,
      size: s(layout, layout.awayRoster.size),
      maxLines: layout.awayRoster.maxLines,
      align: layout.awayRoster.nameAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: goalsPos.x,
      y: goalsPos.y,
      lineHeight: s(layout, layout.awayRoster.lineHeight),
      lines: awayRosterGoals,
      size: s(layout, layout.awayRoster.size),
      maxLines: layout.awayRoster.maxLines,
      align: layout.awayRoster.goalsAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: assistsPos.x,
      y: assistsPos.y,
      lineHeight: s(layout, layout.awayRoster.lineHeight),
      lines: awayRosterAssists,
      size: s(layout, layout.awayRoster.size),
      maxLines: layout.awayRoster.maxLines,
      align: layout.awayRoster.assistsAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: pimPos.x,
      y: pimPos.y,
      lineHeight: s(layout, layout.awayRoster.lineHeight),
      lines: awayRosterPim,
      size: s(layout, layout.awayRoster.size),
      maxLines: layout.awayRoster.maxLines,
      align: layout.awayRoster.pimAlign ?? "left",
    });
  }

  // Home roster table (lower-left block).
  {
    const y = height - layout.homeRoster.yFromTop;
    const numPos = t(layout, layout.homeRoster.numX, y);
    const namePos = t(layout, layout.homeRoster.nameX, y);
    const goalsPos = t(layout, layout.homeRoster.goalsX, y);
    const assistsPos = t(layout, layout.homeRoster.assistsX, y);
    const pimPos = t(layout, layout.homeRoster.pimX, y);
    if (opts?.debug) {
      drawDebugAnchor(page, numPos.x, numPos.y, "homeRoster.num");
      drawDebugAnchor(page, namePos.x, namePos.y, "homeRoster.name");
      drawDebugAnchor(page, goalsPos.x, goalsPos.y, "homeRoster.goals");
      drawDebugAnchor(page, assistsPos.x, assistsPos.y, "homeRoster.assists");
      drawDebugAnchor(page, pimPos.x, pimPos.y, "homeRoster.pim");
    }
    drawLines({
      page,
      font,
      x: numPos.x,
      y: numPos.y,
      lineHeight: s(layout, layout.homeRoster.lineHeight),
      lines: homeRosterNumbers,
      size: s(layout, layout.homeRoster.size),
      maxLines: layout.homeRoster.maxLines,
      align: layout.homeRoster.numAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: namePos.x,
      y: namePos.y,
      lineHeight: s(layout, layout.homeRoster.lineHeight),
      lines: homeRosterNames,
      size: s(layout, layout.homeRoster.size),
      maxLines: layout.homeRoster.maxLines,
      align: layout.homeRoster.nameAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: goalsPos.x,
      y: goalsPos.y,
      lineHeight: s(layout, layout.homeRoster.lineHeight),
      lines: homeRosterGoals,
      size: s(layout, layout.homeRoster.size),
      maxLines: layout.homeRoster.maxLines,
      align: layout.homeRoster.goalsAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: assistsPos.x,
      y: assistsPos.y,
      lineHeight: s(layout, layout.homeRoster.lineHeight),
      lines: homeRosterAssists,
      size: s(layout, layout.homeRoster.size),
      maxLines: layout.homeRoster.maxLines,
      align: layout.homeRoster.assistsAlign ?? "left",
    });
    drawLines({
      page,
      font,
      x: pimPos.x,
      y: pimPos.y,
      lineHeight: s(layout, layout.homeRoster.lineHeight),
      lines: homeRosterPim,
      size: s(layout, layout.homeRoster.size),
      maxLines: layout.homeRoster.maxLines,
      align: layout.homeRoster.pimAlign ?? "left",
    });
  }

  const buildGoalColumns = (events: GameEvent[]) => {
    const times: string[] = [];
    const scorers: string[] = [];
    const a1s: string[] = [];
    const a2s: string[] = [];

    for (const e of events) {
      times.push(formatGamesheetClockTime(e));
      scorers.push(extractJerseyNumber(e.scorer));
      a1s.push(extractJerseyNumber(e.assist1));
      a2s.push(extractJerseyNumber(e.assist2));
    }

    return { times, scorers, a1s, a2s };
  };

  const effectiveGoals = getEffectiveGoals(input.eventLog);
  const awayGoalCols = buildGoalColumns(effectiveGoals.awayGoals);
  const homeGoalCols = buildGoalColumns(effectiveGoals.homeGoals);

  // Penalties are rendered as column tables; see below.

  // Write goals and penalties into configured areas.
  {
    const drawGoalTable = (
      label: "awayGoals" | "homeGoals",
      cfg: GamesheetPdfLayout["awayGoals"],
      cols: ReturnType<typeof buildGoalColumns>,
    ) => {
      const baseY = height - cfg.yFromTop;
      const y = t(layout, 0, baseY).y;
      const lineHeight = s(layout, cfg.lineHeight);
      const size = s(layout, cfg.size);

      // Back-compat: older layouts stored a single x (possibly from right column origin).
      const legacyAny = cfg as any;
      const legacyBaseX = typeof legacyAny.x === "number" ? resolveLegacyRightX(legacyAny.x, width, layout) : null;

      const colX = (key: keyof GamesheetPdfLayout["awayGoals"]["cols"], fallback: number) => {
        const x = (cfg.cols?.[key] ?? fallback) as number;
        return legacyBaseX !== null ? legacyBaseX + fallback : x;
      };

      const xs = {
        time: t(layout, colX("timeX", 0), 0).x,
        scorer: t(layout, colX("scorerX", 60), 0).x,
        a1: t(layout, colX("assist1X", 86), 0).x,
        a2: t(layout, colX("assist2X", 112), 0).x,
      };

      if (opts?.debug) {
        drawDebugAnchor(page, xs.time, y, `${label}.time`);
        drawDebugAnchor(page, xs.scorer, y, `${label}.scorer`);
        drawDebugAnchor(page, xs.a1, y, `${label}.assist1`);
        drawDebugAnchor(page, xs.a2, y, `${label}.assist2`);
      }

      const aligns = (cfg as any).aligns ?? {};
      drawLines({ page, font, x: xs.time, y, lineHeight, lines: cols.times, size, maxLines: cfg.maxLines, align: aligns.time ?? "left" });
      drawLines({ page, font, x: xs.scorer, y, lineHeight, lines: cols.scorers, size, maxLines: cfg.maxLines, align: aligns.scorer ?? "left" });
      drawLines({ page, font, x: xs.a1, y, lineHeight, lines: cols.a1s, size, maxLines: cfg.maxLines, align: aligns.assist1 ?? "left" });
      drawLines({ page, font, x: xs.a2, y, lineHeight, lines: cols.a2s, size, maxLines: cfg.maxLines, align: aligns.assist2 ?? "left" });
    };

    drawGoalTable("awayGoals", layout.awayGoals, awayGoalCols);
    drawGoalTable("homeGoals", layout.homeGoals, homeGoalCols);

    const buildPenaltyColumns = (events: GameEvent[]) => {
      const playerNums: string[] = [];
      const pims: string[] = [];
      const offences: string[] = [];
      const givens: string[] = [];
      const starts: string[] = [];
      const ends: string[] = [];

      for (const e of events) {
        const playerNum = (e.playerNumber || "").trim();
        const offence = (e.infraction || "").trim();
        const start = formatGamesheetClockTime(e);
        const end = e.endClockTime ? formatGamesheetClockTime({ period: e.period, clockTime: e.endClockTime }) : "";
        const pim = formatPimMinutesFromDuration(e.penaltyDurationMs);
        const givenServed = formatGivenFromTimes(start, end);
        const given = givenServed || "";

        playerNums.push(playerNum);
        pims.push(pim);
        offences.push(offence);
        givens.push(given);
        starts.push(start);
        ends.push(end);
      }

      return { playerNums, pims, offences, givens, starts, ends };
    };

    const awayCols = buildPenaltyColumns(
      input.eventLog.filter((e) => e.type === "penalty_added" && e.team === "away").slice().sort(sortChronological),
    );
    const homeCols = buildPenaltyColumns(
      input.eventLog.filter((e) => e.type === "penalty_added" && e.team === "home").slice().sort(sortChronological),
    );

    const drawPenaltyTable = (
      label: "awayPenalties" | "homePenalties",
      cfg: GamesheetPdfLayout["awayPenalties"],
      cols: ReturnType<typeof buildPenaltyColumns>,
    ) => {
      const baseY = height - cfg.yFromTop;
      const lineHeight = s(layout, cfg.lineHeight);
      const size = s(layout, cfg.size);
      const y = t(layout, 0, baseY).y;

      const resolveColX = (x: number) => resolveLegacyRightX(x, width, layout);
      const xs = {
        player: t(layout, resolveColX(cfg.cols.playerNumX), 0).x,
        pim: t(layout, resolveColX(cfg.cols.pimX), 0).x,
        offence: t(layout, resolveColX(cfg.cols.offenceX), 0).x,
        given: t(layout, resolveColX(cfg.cols.givenX), 0).x,
        start: t(layout, resolveColX(cfg.cols.startX), 0).x,
        end: t(layout, resolveColX(cfg.cols.endX), 0).x,
      };

      if (opts?.debug) {
        drawDebugAnchor(page, xs.player, y, `${label}.player#`);
        drawDebugAnchor(page, xs.pim, y, `${label}.pim`);
        drawDebugAnchor(page, xs.offence, y, `${label}.offence`);
        drawDebugAnchor(page, xs.given, y, `${label}.given`);
        drawDebugAnchor(page, xs.start, y, `${label}.start`);
        drawDebugAnchor(page, xs.end, y, `${label}.end`);
      }

      const aligns = (cfg as any).aligns ?? {};
      drawLines({ page, font, x: xs.player, y, lineHeight, lines: cols.playerNums, size, maxLines: cfg.maxLines, align: aligns.playerNum ?? "left" });
      drawLines({ page, font, x: xs.pim, y, lineHeight, lines: cols.pims, size, maxLines: cfg.maxLines, align: aligns.pim ?? "left" });
      drawLines({ page, font, x: xs.offence, y, lineHeight, lines: cols.offences, size, maxLines: cfg.maxLines, align: aligns.offence ?? "left" });
      drawLines({ page, font, x: xs.given, y, lineHeight, lines: cols.givens, size, maxLines: cfg.maxLines, align: aligns.given ?? "left" });
      drawLines({ page, font, x: xs.start, y, lineHeight, lines: cols.starts, size, maxLines: cfg.maxLines, align: aligns.start ?? "left" });
      drawLines({ page, font, x: xs.end, y, lineHeight, lines: cols.ends, size, maxLines: cfg.maxLines, align: aligns.end ?? "left" });
    };

    drawPenaltyTable("awayPenalties", layout.awayPenalties, awayCols);
    drawPenaltyTable("homePenalties", layout.homePenalties, homeCols);
  }

  {
    // Legacy (v1) stored shots Y from bottom as `y`.
    const legacyHomeY =
      typeof (layout.homeShots as any).y === "number" ? (layout.homeShots as any).y : null;
    const legacyAwayY =
      typeof (layout.awayShots as any).y === "number" ? (layout.awayShots as any).y : null;

    const homeYFromTop = legacyHomeY === null ? layout.homeShots.yFromTop : height - legacyHomeY;
    const awayYFromTop = legacyAwayY === null ? layout.awayShots.yFromTop : height - legacyAwayY;

    const homePos = t(layout, resolveX(layout.homeShots.x, width), height - homeYFromTop);
    const awayPos = t(layout, resolveX(layout.awayShots.x, width), height - awayYFromTop);
    if (opts?.debug) {
      drawDebugAnchor(page, homePos.x, homePos.y, "homeShots");
      drawDebugAnchor(page, awayPos.x, awayPos.y, "awayShots");
    }
    drawTextAligned({ page, font, text: `${home.shots ?? 0}`, x: homePos.x, y: homePos.y, size: s(layout, layout.homeShots.size), align: layout.homeShots.align ?? "left" });
    drawTextAligned({ page, font, text: `${away.shots ?? 0}`, x: awayPos.x, y: awayPos.y, size: s(layout, layout.awayShots.size), align: layout.awayShots.align ?? "left" });
  }

  return await pdfDoc.save();
}
