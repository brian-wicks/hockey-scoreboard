import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { OperatorDeviceToken } from "../db/types.ts";

export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;
export const DEVICE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DEVICE_TOKENS = 5;

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const PIN_HASH_BYTES = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checked before any database read: a route param can decode to a value with a slash,
// which Firestore would treat as a path into a different document.
export const isValidOperatorId = (id: unknown): id is string =>
  typeof id === "string" && UUID_PATTERN.test(id);

export const generatePin = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(pin, pinSalt, PIN_HASH_BYTES);
  return { pinHash: hash.toString("hex"), pinSalt };
}

export async function verifyPin(pin: string, credentials: { pinHash: string; pinSalt: string }): Promise<boolean> {
  const expected = Buffer.from(credentials.pinHash, "hex");
  const actual = await scryptAsync(pin, credentials.pinSalt, PIN_HASH_BYTES);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export function issueDeviceToken(
  tokens: OperatorDeviceToken[],
  nowMs: number,
): { token: string; tokens: OperatorDeviceToken[] } {
  const token = randomBytes(32).toString("base64url");
  const live = tokens.filter((entry) => entry.expiresAt > nowMs);
  const next = [...live, { tokenHash: hashToken(token), expiresAt: nowMs + DEVICE_TOKEN_TTL_MS }];
  return { token, tokens: next.slice(-MAX_DEVICE_TOKENS) };
}

export function hasValidDeviceToken(tokens: OperatorDeviceToken[], token: string, nowMs: number): boolean {
  const hash = Buffer.from(hashToken(token), "hex");
  return tokens.some((entry) => {
    const stored = Buffer.from(entry.tokenHash, "hex");
    return entry.expiresAt > nowMs && stored.length === hash.length && timingSafeEqual(stored, hash);
  });
}
