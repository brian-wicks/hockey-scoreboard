// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

describe("vite config", () => {
  it("exposes expected build chunks and defined app version", async () => {
    vi.doMock("vite", async () => {
      const actual: any = await vi.importActual("vite");
      return {
        ...actual,
        loadEnv: () => ({ GEMINI_API_KEY: "test-key" }),
      };
    });

    const mod = await import("../../vite.config");
    const cfgFactory = mod.default as unknown as (args: { mode: string }) => any;
    const cfg = cfgFactory({ mode: "test" });

    expect(cfg.define).toBeTruthy();
    expect(cfg.define.__APP_VERSION__).toMatch(/"\d+\.\d+\.\d+"/);
    expect(cfg.define["process.env.GEMINI_API_KEY"]).toBe("\"test-key\"");

    const manualChunks = cfg.build?.rollupOptions?.output?.manualChunks;
    expect(manualChunks["pdf-vendor"]).toContain("pdf-lib");
    expect(manualChunks["react-vendor"]).toContain("react");
  });
});

