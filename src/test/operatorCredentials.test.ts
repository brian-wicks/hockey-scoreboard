// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isValidOperatorPin, maskOperatorLinks } from "../lib/operatorAccess";
import {
  DEVICE_TOKEN_TTL_MS,
  MAX_DEVICE_TOKENS,
  generatePin,
  hasValidDeviceToken,
  hashPin,
  isValidOperatorId,
  issueDeviceToken,
  verifyPin,
} from "../server/operatorCredentials";

describe("operator credentials", () => {
  it("accepts only six-digit PINs", () => {
    expect(isValidOperatorPin("012345")).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", " 12345", 123456, null, undefined]) {
      expect(isValidOperatorPin(bad)).toBe(false);
    }
  });

  it("generates six-digit PINs, keeping leading zeros", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it("accepts only UUIDs as operator IDs", () => {
    expect(isValidOperatorId("3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b")).toBe(true);
    for (const bad of ["x/y", "", "not-a-uuid", 7, null]) {
      expect(isValidOperatorId(bad)).toBe(false);
    }
  });

  it("verifies the right PIN and rejects a wrong one", async () => {
    const credentials = await hashPin("123456");
    expect(credentials.pinHash).not.toContain("123456");
    expect(await verifyPin("123456", credentials)).toBe(true);
    expect(await verifyPin("654321", credentials)).toBe(false);
  });

  it("salts each PIN hash separately", async () => {
    const first = await hashPin("123456");
    const second = await hashPin("123456");
    expect(first.pinHash).not.toBe(second.pinHash);
  });

  it("stores only a hash of each device token, with an expiry", () => {
    const { token, tokens } = issueDeviceToken([], 1000);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(token);
    expect(tokens[0].expiresAt).toBe(1000 + DEVICE_TOKEN_TTL_MS);
    expect(hasValidDeviceToken(tokens, token, 1000)).toBe(true);
    expect(hasValidDeviceToken(tokens, "other", 1000)).toBe(false);
    expect(hasValidDeviceToken(tokens, token, 1000 + DEVICE_TOKEN_TTL_MS + 1)).toBe(false);
  });

  it("drops the oldest token past the cap, and expired tokens on issue", () => {
    let tokens = issueDeviceToken([], 0).tokens;
    const first = issueDeviceToken(tokens, 1);
    tokens = first.tokens;
    for (let i = 0; i < MAX_DEVICE_TOKENS; i += 1) {
      tokens = issueDeviceToken(tokens, 2 + i).tokens;
    }
    expect(tokens).toHaveLength(MAX_DEVICE_TOKENS);
    expect(hasValidDeviceToken(tokens, first.token, 10)).toBe(false);

    const afterExpiry = issueDeviceToken(tokens, DEVICE_TOKEN_TTL_MS + 100);
    expect(afterExpiry.tokens).toHaveLength(1);
  });

  it("masks the link in operator paths and URLs and leaves other text alone", () => {
    const id = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";
    expect(maskOperatorLinks(`/operate/${id}`)).toBe("/operate/[hidden]");
    expect(maskOperatorLinks(`/api/operator/${id}/session`)).toBe("/api/operator/[hidden]/session");
    expect(maskOperatorLinks(`https://x.example/operate/${id}?a=1#b`)).toBe("https://x.example/operate/[hidden]?a=1#b");
    expect(maskOperatorLinks(`POST /api/operator/${id}/session 200`)).toBe("POST /api/operator/[hidden]/session 200");
    for (const same of ["/api/operator-access", "/api/games/abc", "plain text", ""]) {
      expect(maskOperatorLinks(same)).toBe(same);
    }
  });
});
