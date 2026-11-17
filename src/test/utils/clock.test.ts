import { describe, expect, it } from "vitest";
import {
  addServerTimeSample,
  formatClockDisplay,
  formatPenaltyTimeMs,
  liveClockMs,
  livePenaltyMs,
  parseTimeInputMs,
} from "../../utils/clock";

describe("clock utils", () => {
  it("formats clock display with tenths under one minute", () => {
    expect(formatClockDisplay(9950)).toBe("9.9");
    expect(formatClockDisplay(0)).toBe("0.0");
  });

  it("formats clock display with minutes and seconds at or above one minute", () => {
    expect(formatClockDisplay(60000)).toBe("1:00");
    expect(formatClockDisplay(90500)).toBe("1:30");
  });

  it("parses mm:ss inputs", () => {
    expect(parseTimeInputMs("1:30")).toBe(90000);
    expect(parseTimeInputMs("00:05")).toBe(5000);
    expect(parseTimeInputMs("1:")).toBeNull();
  });

  it("parses digit inputs into seconds and minutes", () => {
    expect(parseTimeInputMs("45")).toBe(45000);
    expect(parseTimeInputMs("245")).toBe(2 * 60 * 1000 + 45 * 1000);
    expect(parseTimeInputMs("1234")).toBe(12 * 60 * 1000 + 34 * 1000);
  });

  it("returns null for invalid inputs", () => {
    expect(parseTimeInputMs("")).toBeNull();
    expect(parseTimeInputMs("abc")).toBeNull();
    expect(parseTimeInputMs(":45")).toBeNull();
  });

  it("formats penalty time with ceiling seconds", () => {
    expect(formatPenaltyTimeMs(1000)).toBe("0:01");
    expect(formatPenaltyTimeMs(119999)).toBe("2:00");
  });

  it("counts a running clock down from its last update, and stops at zero", () => {
    expect(liveClockMs({ timeRemaining: 60_000, isRunning: true, lastUpdate: 1_000 }, 3_500)).toBe(57_500);
    expect(liveClockMs({ timeRemaining: 60_000, isRunning: false, lastUpdate: 1_000 }, 3_500)).toBe(60_000);
    expect(liveClockMs({ timeRemaining: 1_000, isRunning: true, lastUpdate: 0 }, 5_000)).toBe(0);
  });

  it("takes the same time off a penalty as the clock has run since it arrived", () => {
    expect(livePenaltyMs(90_000, { timeRemaining: 60_000 }, 57_500)).toBe(87_500);
    expect(livePenaltyMs(1_000, { timeRemaining: 60_000 }, 50_000)).toBe(0);
  });

  it("estimates the server's clock from the quickest delivery in the last 30 seconds", () => {
    let result = addServerTimeSample([], 1_500, 1_000);
    expect(result.offsetMs).toBe(500);
    result = addServerTimeSample(result.samples, 2_100, 2_000);
    expect(result.offsetMs).toBe(500);
    result = addServerTimeSample(result.samples, 40_100, 40_000);
    expect(result.offsetMs).toBe(100);
    expect(result.samples).toHaveLength(1);
  });
});
