export function formatClockDisplay(currentRemainingMs: number): string {
  const totalSeconds = Math.ceil(currentRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (currentRemainingMs <= 59000 && currentRemainingMs > 0) {
    const tenths = Math.floor((currentRemainingMs % 1000) / 100);
    return `${seconds}.${tenths}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
