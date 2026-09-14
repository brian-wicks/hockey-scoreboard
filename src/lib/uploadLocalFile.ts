/**
 * Uploads a file to the local server instead of Firebase Storage.
 *
 * Local mode has no internet, so the Storage SDK can't be used. The server
 * writes the file next to the local database and serves it back from /uploads
 * (see the local-upload route in serverApp.ts). The returned URL is
 * site-relative, which is all the app needs — it only ever renders these through
 * the same origin, and local-mode data never leaves the machine.
 */
export async function uploadLocalFile(file: File, contentType: string): Promise<string> {
  const response = await fetch("/api/local-upload", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!response.ok) {
    const message =
      response.status === 413
        ? "File is too large."
        : response.status === 415
          ? "That file type isn't supported."
          : "Could not save the file.";
    throw new Error(message);
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error("Could not save the file.");
  return data.url;
}
