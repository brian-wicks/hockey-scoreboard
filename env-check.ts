const REQUIRED_FIREBASE_ENV_VARS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function findMissingFirebaseEnvVars(env: Record<string, string | undefined>): string[] {
  return REQUIRED_FIREBASE_ENV_VARS.filter((key) => !env[key]);
}

export function formatMissingEnvError(missing: string[]): string {
  return (
    `Missing Firebase client config: ${missing.join(", ")}.\n` +
    "Copy .env.example to .env and fill in the VITE_FIREBASE_* values from your " +
    "Firebase project settings, then restart."
  );
}
