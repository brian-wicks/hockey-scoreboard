// Offline build stub. Local mode never initializes Firebase (serverApp.ts only
// calls these with a FIREBASE_SERVICE_ACCOUNT, which the desktop app never sets),
// so the real SDK is replaced at bundle time rather than shipped. Throwing rather
// than silently no-op'ing means a build that somehow reaches this fails loudly.
const unavailable = () => {
  throw new Error("firebase-admin is not available in the offline desktop build.");
};

export const initializeApp = unavailable;
export const cert = unavailable;
