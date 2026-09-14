import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Local mode has no Firebase Storage, so both uploaders must fall through to the
// local server instead of failing.
vi.mock("../../lib/localMode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/localMode")>()),
  isLocalMode: () => true,
}));
vi.mock("../../lib/firebase", () => ({ storage: null }));

const uploadBytes = vi.fn();
vi.mock("firebase/storage", () => ({
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
}));

import { uploadTeamLogo } from "../../lib/uploadTeamLogo";
import { uploadGamesheetTemplate } from "../../lib/uploadGamesheetTemplate";

function fakeFile(name: string, type: string, size = 1000): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("uploads in local mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: "/uploads/local-operator/file.bin" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a team logo locally instead of in Firebase Storage", async () => {
    const url = await uploadTeamLogo("local-operator", fakeFile("crest.png", "image/png"));
    expect(url).toBe("/uploads/local-operator/file.bin");
    expect(fetch).toHaveBeenCalledWith("/api/local-upload", expect.objectContaining({ method: "POST" }));
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it("stores a gamesheet template locally", async () => {
    const url = await uploadGamesheetTemplate("local-operator", fakeFile("blank.pdf", "application/pdf"));
    expect(url).toBe("/uploads/local-operator/file.bin");
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it("still applies the same validation before storing anything", async () => {
    // Type and size checks run ahead of the local branch, so offline uploads are
    // not a way around them.
    await expect(uploadTeamLogo("local-operator", fakeFile("notes.txt", "text/plain"))).rejects.toThrow();
    await expect(
      uploadGamesheetTemplate("local-operator", fakeFile("huge.pdf", "application/pdf", 11 * 1024 * 1024)),
    ).rejects.toThrow(/10MB/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection as the uploader's own error type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 415 }));
    await expect(uploadTeamLogo("local-operator", fakeFile("a.png", "image/png"))).rejects.toThrow(
      /type isn't supported/i,
    );
  });
});
