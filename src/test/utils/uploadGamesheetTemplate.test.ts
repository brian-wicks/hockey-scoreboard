import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadBytes = vi.fn().mockResolvedValue(undefined);
const getDownloadURL = vi.fn().mockResolvedValue("https://storage.example.com/template.pdf");
const ref = vi.fn((_storage: unknown, path: string) => ({ path }));

vi.mock("firebase/storage", () => ({
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURL(...args),
  ref: (...args: [unknown, string]) => ref(...args),
}));

vi.mock("../../lib/firebase", () => ({ storage: {} }));

import { MAX_TEMPLATE_BYTES, TemplateUploadError, uploadGamesheetTemplate } from "../../lib/uploadGamesheetTemplate";

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("uploadGamesheetTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads to a folder scoped to the uploading user", async () => {
    await uploadGamesheetTemplate("user-123", fakeFile("blank.pdf", "application/pdf", 1000));
    const path = ref.mock.calls[0][1];
    expect(path).toMatch(/^gamesheet-templates\/user-123\/.+\.pdf$/);
  });

  it("returns the download URL for the uploaded template", async () => {
    const url = await uploadGamesheetTemplate("user-123", fakeFile("blank.pdf", "application/pdf", 1000));
    expect(url).toBe("https://storage.example.com/template.pdf");
  });

  it("rejects non-PDF files", async () => {
    await expect(
      uploadGamesheetTemplate("user-123", fakeFile("crest.png", "image/png", 1000)),
    ).rejects.toBeInstanceOf(TemplateUploadError);
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it("accepts a .pdf file whose type the browser did not report", async () => {
    await expect(
      uploadGamesheetTemplate("user-123", fakeFile("blank.pdf", "", 1000)),
    ).resolves.toBeTruthy();
  });

  it("rejects files over the size cap", async () => {
    await expect(
      uploadGamesheetTemplate("user-123", fakeFile("huge.pdf", "application/pdf", MAX_TEMPLATE_BYTES + 1)),
    ).rejects.toThrow(/10MB/);
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});
