// Offline build stub — see firebase-admin-app.mjs. The desktop app pins
// DB_BACKEND=sqlite, so the Firestore adapter is never the selected backend;
// it's only reachable because esbuild sees both sides of database.ts's import.
export const getFirestore = () => {
  throw new Error("Firestore is not available in the offline desktop build.");
};
