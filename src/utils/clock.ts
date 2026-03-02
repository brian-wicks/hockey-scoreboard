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
