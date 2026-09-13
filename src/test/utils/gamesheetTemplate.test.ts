import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The template cache lives at module scope, so each test imports a fresh copy
// rather than inheriting whatever the previous test cached.
async function freshModule() {
  vi.resetModules();
  return import("../../utils/gamesheetPdf");
}

describe("gamesheet template loading", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the bundled template when no URL is set", async () => {
    const { loadTemplateBytes, DEFAULT_TEMPLATE_URL } = await freshModule();
    await loadTemplateBytes(undefined);
    expect(fetch).toHaveBeenCalledWith(DEFAULT_TEMPLATE_URL);
  });

  it("fetches a custom template URL when one is set", async () => {
    const { loadTemplateBytes } = await freshModule();
    await loadTemplateBytes("https://example.com/blank.pdf");
    expect(fetch).toHaveBeenCalledWith("https://example.com/blank.pdf");
  });

  it("caches by URL so repeated previews do not refetch", async () => {
    const { loadTemplateBytes } = await freshModule();
    await loadTemplateBytes("https://example.com/blank.pdf");
    await loadTemplateBytes("https://example.com/blank.pdf");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps separate cache entries per template", async () => {
    const { loadTemplateBytes } = await freshModule();
    await loadTemplateBytes("https://example.com/a.pdf");
    await loadTemplateBytes("https://example.com/b.pdf");
    await loadTemplateBytes("https://example.com/a.pdf");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws a descriptive error when the template is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { loadTemplateBytes } = await freshModule();
    await expect(loadTemplateBytes("https://example.com/missing.pdf")).rejects.toThrow(/404/);
  });

  it("does not cache a failed fetch, so a retry can succeed", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    vi.stubGlobal("fetch", fetchMock);

    const { loadTemplateBytes } = await freshModule();
    await expect(loadTemplateBytes("https://example.com/flaky.pdf")).rejects.toThrow("network down");
    await expect(loadTemplateBytes("https://example.com/flaky.pdf")).resolves.toBeInstanceOf(ArrayBuffer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
