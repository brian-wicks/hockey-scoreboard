// Offline build stub — see firebase-admin-app.mjs. Token verification only runs
// on the authenticated (non-local-mode) path, which the desktop app never takes.
export const getAuth = () => ({
  verifyIdToken: async () => {
    throw new Error("Token verification is not available in the offline desktop build.");
  },
});
