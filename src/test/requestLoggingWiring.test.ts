// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { createScoreboardServer } from "../../serverApp";
import { requestLogSerializers } from "../server/requestLogging";

const pinoHttpOptions = vi.hoisted(() => [] as { serializers?: unknown }[]);

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock("pino-http", () => ({
  default: (options: { serializers?: unknown }) => {
    pinoHttpOptions.push(options);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  },
}));

describe("request logging setup", () => {
  it("gives the server's pino-http the masking serializers", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-logging-"));
    createScoreboardServer({ dataDir });
    expect(pinoHttpOptions.at(-1)?.serializers).toBe(requestLogSerializers);
    await rm(dataDir, { recursive: true, force: true });
  });
});
