import type { GameState, PreshowRotation, PreshowSettings, TeamPlayer } from "../store";

export const ROSTER_PAGE_SIZE = 16;

export const MIN_SLIDE_SECONDS = 5;
export const MAX_SLIDE_SECONDS = 120;
const DEFAULT_SLIDE_SECONDS = 30;

export type ResolvedPreshow = Required<PreshowSettings>;
export type PreshowSlide = Pick<PreshowSettings, "view" | "rosterPage">;

export const DEFAULT_PRESHOW: ResolvedPreshow = {
  view: "teams",
  rosterPage: 0,
  faceoffAt: null,
  rotation: { enabled: false, intervalSeconds: DEFAULT_SLIDE_SECONDS, startedAt: 0 },
};

const PRESHOW_VIEWS: readonly unknown[] = ["teams", "home", "away"];

function getRotation(raw: unknown): PreshowRotation {
  const { enabled, intervalSeconds, startedAt } = (raw ?? {}) as Partial<Record<keyof PreshowRotation, unknown>>;
  const hasStart = typeof startedAt === "number" && Number.isFinite(startedAt);
  const hasInterval =
    typeof intervalSeconds === "number" && intervalSeconds >= MIN_SLIDE_SECONDS && intervalSeconds <= MAX_SLIDE_SECONDS;
  return {
    enabled: enabled === true && hasStart,
    intervalSeconds: hasInterval ? intervalSeconds : DEFAULT_SLIDE_SECONDS,
    startedAt: hasStart ? startedAt : 0,
  };
}

/** The game's settings, with defaults for a game saved before these settings existed. */
export function getPreshow(gameState: Pick<GameState, "preshow">): ResolvedPreshow {
  const raw: Partial<Record<keyof PreshowSettings, unknown>> = gameState.preshow ?? {};
  const { rosterPage, faceoffAt } = raw;
  return {
    view: PRESHOW_VIEWS.includes(raw.view) ? (raw.view as PreshowSettings["view"]) : DEFAULT_PRESHOW.view,
    rosterPage: Number.isSafeInteger(rosterPage) && (rosterPage as number) >= 0 ? (rosterPage as number) : 0,
    faceoffAt: typeof faceoffAt === "number" && Number.isFinite(faceoffAt) ? faceoffAt : null,
    rotation: getRotation(raw.rotation),
  };
}

function jerseySortValue(player: TeamPlayer): number {
  const number = player.jerseyNumber.trim();
  return number === "" || Number.isNaN(Number(number)) ? Infinity : Number(number);
}

/** Players in jersey number order, with anyone lacking a usable number last, by name. */
export function sortRoster(players: TeamPlayer[]): TeamPlayer[] {
  return [...players].sort((a, b) => {
    const numberA = jerseySortValue(a);
    const numberB = jerseySortValue(b);
    if (numberA !== numberB) return numberA < numberB ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getRosterPageCount(players: TeamPlayer[]): number {
  return Math.max(1, Math.ceil(players.length / ROSTER_PAGE_SIZE));
}

/** The page that will show for a saved page number, which can outlast a shrunken roster. */
export function clampRosterPage(players: TeamPlayer[], page: number): number {
  return Math.min(page, getRosterPageCount(players) - 1);
}

export function getRosterPage(players: TeamPlayer[], page: number): TeamPlayer[] {
  const start = clampRosterPage(players, page) * ROSTER_PAGE_SIZE;
  return sortRoster(players).slice(start, start + ROSTER_PAGE_SIZE);
}

/** The rotation order: teams, then each page of each roster. A team with no players is skipped. */
export function getRotationSlides(homePlayers: TeamPlayer[], awayPlayers: TeamPlayer[]): PreshowSlide[] {
  const rosterSlides = (view: "home" | "away", players: TeamPlayer[]): PreshowSlide[] =>
    players.length === 0
      ? []
      : Array.from({ length: getRosterPageCount(players) }, (_, rosterPage) => ({ view, rosterPage }));
  return [{ view: "teams", rosterPage: 0 }, ...rosterSlides("home", homePlayers), ...rosterSlides("away", awayPlayers)];
}

/** What the screen shows at this server time. Worked out from the clock, so every screen agrees. */
export function getCurrentSlide(
  preshow: ResolvedPreshow,
  homePlayers: TeamPlayer[],
  awayPlayers: TeamPlayer[],
  nowMs: number,
): PreshowSlide {
  const { rotation, view, rosterPage } = preshow;
  if (!rotation.enabled) return { view, rosterPage };
  const slides = getRotationSlides(homePlayers, awayPlayers);
  const slidesElapsed = Math.floor(Math.max(0, nowMs - rotation.startedAt) / (rotation.intervalSeconds * 1000));
  return slides[slidesElapsed % slides.length];
}

/**
 * The start time that puts this slide on screen now with its full time ahead of it.
 * A view outside the rotation, such as an empty roster, starts from the first slide.
 */
export function rotationStartFor(
  slide: PreshowSlide,
  homePlayers: TeamPlayer[],
  awayPlayers: TeamPlayer[],
  intervalSeconds: number,
  nowMs: number,
): number {
  const roster = slide.view === "home" ? homePlayers : awayPlayers;
  const rosterPage = slide.view === "teams" ? 0 : clampRosterPage(roster, slide.rosterPage);
  const index = getRotationSlides(homePlayers, awayPlayers).findIndex(
    (candidate) => candidate.view === slide.view && candidate.rosterPage === rosterPage,
  );
  return nowMs - Math.max(0, index) * intervalSeconds * 1000;
}

export function msUntilNextSlide(rotation: PreshowRotation, nowMs: number): number {
  const intervalMs = rotation.intervalSeconds * 1000;
  const elapsed = nowMs - rotation.startedAt;
  return elapsed < 0 ? intervalMs - elapsed : intervalMs - (elapsed % intervalMs);
}

/** The next time this local clock time comes round: today, or tomorrow if it has passed. */
export function nextFaceoffTime(time: string, nowMs: number): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const faceoff = new Date(nowMs);
  faceoff.setHours(hours, minutes, 0, 0);
  if (faceoff.getTime() <= nowMs) faceoff.setDate(faceoff.getDate() + 1);
  return faceoff.getTime();
}

export function faceoffTimeInputValue(faceoffAt: number | null): string {
  if (faceoffAt === null) return "";
  const date = new Date(faceoffAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}
