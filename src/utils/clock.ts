export function formatClockDisplay(currentRemainingMs: number): string {
  if (currentRemainingMs < 60000 && currentRemainingMs >= 0) {
    const seconds = Math.floor(currentRemainingMs / 1000) % 60;
    const tenths = Math.floor((currentRemainingMs % 1000) / 100);
    return `${seconds}.${tenths}`;
  }

  const totalSeconds = Math.floor(currentRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function parseTimeInputMs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        return (mins * 60 + secs) * 1000;
      }
    }
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const num = parseInt(digits, 10);
  if (isNaN(num)) return null;

  if (digits.length <= 2) {
    return num * 1000;
  }

  if (digits.length === 3) {
    const mins = parseInt(digits[0], 10);
    const secs = parseInt(digits.slice(1), 10);
    return (mins * 60 + secs) * 1000;
  }

  const secs = parseInt(digits.slice(-2), 10);
  const mins = parseInt(digits.slice(0, -2), 10);
  return (mins * 60 + secs) * 1000;
}

export function formatPenaltyTimeMs(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Where a clock is at `serverNowMs`. A running clock is counted down from the last time the server sent. */
export function liveClockMs(clock: { timeRemaining: number; isRunning: boolean; lastUpdate: number }, serverNowMs: number): number {
  if (!clock.isRunning) return clock.timeRemaining;
  return Math.max(0, clock.timeRemaining - Math.max(0, serverNowMs - clock.lastUpdate));
}

/**
 * A penalty's time while the clock shows `clockMs`. Penalties run only while the clock does, so a
 * penalty loses the same time as the clock it arrived with.
 */
export function livePenaltyMs(penaltyMs: number, clock: { timeRemaining: number }, clockMs: number): number {
  return Math.max(0, penaltyMs - Math.max(0, clock.timeRemaining - clockMs));
}

export interface ServerTimeSample {
  offsetMs: number;
  receivedAt: number;
}

// Long enough to hold several quick deliveries, short enough to follow a change to this device's clock.
const SERVER_TIME_SAMPLE_WINDOW_MS = 30_000;

/**
 * Adds the server time from a message that just arrived, and works out how far the server's clock
 * is from this device's. A message can arrive late but never early, so the largest offset in the
 * window is the one that took the least time to arrive, and the closest to the truth. Using each
 * message's own offset would move the clock on screen whenever the network slowed down.
 */
export function addServerTimeSample(
  samples: ServerTimeSample[],
  serverTime: number,
  receivedAt: number,
): { samples: ServerTimeSample[]; offsetMs: number } {
  const sample = { offsetMs: serverTime - receivedAt, receivedAt };
  const next = [...samples.filter((s) => receivedAt - s.receivedAt <= SERVER_TIME_SAMPLE_WINDOW_MS && s.receivedAt <= receivedAt), sample];
  return { samples: next, offsetMs: Math.max(...next.map((s) => s.offsetMs)) };
}
