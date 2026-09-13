import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;

export class TemplateUploadError extends Error {}

/**
 * Uploads a blank gamesheet template PDF to Firebase Storage under this user's
 * own folder (matches storage.rules, which scopes writes to
 * request.auth.uid == userId) and returns its download URL. The URL is stored on
 * the layout as `templateUrl`, so a template travels with the layout it was
 * positioned against — see src/utils/gamesheetPdf.ts's resolveTemplateBytes.
 */
export async function uploadGamesheetTemplate(userId: string, file: File): Promise<string> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new TemplateUploadError("Please choose a PDF file.");
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    throw new TemplateUploadError("Template must be under 10MB.");
  }

  const path = `gamesheet-templates/${userId}/${crypto.randomUUID()}.pdf`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: "application/pdf" });
  return getDownloadURL(storageRef);
}
