import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { isLocalModeEnv } from "./localMode";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const localMode = isLocalModeEnv(import.meta.env as Record<string, string | undefined>);

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

// Local mode never signs in, so it must not demand Firebase config to boot.
if (missingKeys.length > 0 && !localMode && !import.meta.env.VITEST) {
  throw new Error(
    `Missing Firebase client config: ${missingKeys.join(", ")}. ` +
      "Copy .env.example to .env, fill in the VITE_FIREBASE_* values from your " +
      "Firebase project settings, then restart `npm run dev`.",
  );
}

// In local mode there is nothing to initialize and no network to reach, so these
// stay null. Everything that touches them is gated on isLocalMode() — the auth
// listener in App.tsx, login/logout in the store, and the two upload helpers.
const app = localMode ? null : initializeApp(firebaseConfig);
export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
export const storage = app ? getStorage(app) : null;
