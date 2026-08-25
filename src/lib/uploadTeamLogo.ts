import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_LOGO_BYTES = 3 * 1024 * 1024;

export class LogoUploadError extends Error {}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-z0-9]{2,4}$/i.test(fromName)) return fromName.toLowerCase();
  const fromType = file.type.split("/").pop();
  return fromType || "png";
}

/**
 * Uploads a team logo to Firebase Storage under this user's own folder (matches
 * storage.rules, which scopes writes to request.auth.uid == userId) and returns
 * its public download URL — the same shape of value the "Logo URL" field already
 * stores, so no schema change is needed anywhere the logo field is read.
 */
export async function uploadTeamLogo(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new LogoUploadError("Please choose an image file.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new LogoUploadError("Image must be under 3MB.");
  }

  const path = `team-logos/${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
