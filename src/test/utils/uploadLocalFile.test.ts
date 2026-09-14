import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadLocalFile } from "../../lib/uploadLocalFile";

function fakeFile(name: string, type: string): File {
  return new File(["data"], name, { type });
}

describe("uploadLocalFile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: "/uploads/local-operator/abc.png" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the file to the local endpoint with its content type", async () => {
    const file = fakeFile("crest.png", "image/png");
    const url = await uploadLocalFile(file, "image/png");

    expect(url).toBe("/uploads/local-operator/abc.png");
    const [endpoint, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/local-upload");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("image/png");
    expect(init.body).toBe(file);
  });

  it("returns a site-relative URL, which works offline", async () => {
    const url = await uploadLocalFile(fakeFile("a.png", "image/png"), "image/png");
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toMatch(/^https?:/);
  });

  it("reports a too-large file distinctly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 413 }));
    await expect(uploadLocalFile(fakeFile("big.pdf", "application/pdf"), "application/pdf")).rejects.toThrow(
      /too large/i,
    );
  });

  it("reports an unsupported type distinctly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 415 }));
    await expect(uploadLocalFile(fakeFile("x.svg", "image/svg+xml"), "image/svg+xml")).rejects.toThrow(
      /type isn't supported/i,
    );
  });

  it("throws when the server returns no URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));
    await expect(uploadLocalFile(fakeFile("a.png", "image/png"), "image/png")).rejects.toThrow();
  });
});
