import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import type { SavedGame } from "./types.ts";

// Reuses the firebase-admin app serverApp.ts already initializes from
// FIREBASE_SERVICE_ACCOUNT for auth — no separate credential wiring needed here.
const firestore = () => getFirestore();

// Layout (see the implementation plan for the composite-index reasoning):
//   users/{userId}/configs/{key}     { value }
//   users/{userId}/gameState/current { state }
//   users/{userId}/savedGames/{id}   { name, state, createdAt }
//   shares/{shareId}                 { userId }
//   users/{userId}.shareId           (field on the user doc, avoids a where() query)
const usersCollection = () => firestore().collection("users");
const sharesCollection = () => firestore().collection("shares");

export const getUserConfig = async (userId: string, key: string): Promise<string | null> => {
  const snap = await usersCollection().doc(userId).collection("configs").doc(key).get();
  const data = snap.data();
  return typeof data?.value === "string" ? data.value : null;
};

export const setUserConfig = async (userId: string, key: string, value: string): Promise<void> => {
  await usersCollection().doc(userId).collection("configs").doc(key).set({ value });
};

export const getGameState = async (userId: string): Promise<string | null> => {
  const snap = await usersCollection().doc(userId).collection("gameState").doc("current").get();
  const data = snap.data();
  return typeof data?.state === "string" ? data.state : null;
};

export const saveGameState = async (userId: string, state: string): Promise<void> => {
  await usersCollection().doc(userId).collection("gameState").doc("current").set({ state });
};

export const getSavedGames = async (userId: string): Promise<SavedGame[]> => {
  const snap = await usersCollection().doc(userId).collection("savedGames").orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId,
      name: data.name as string,
      state: data.state as string,
      createdAt: data.createdAt as number,
    };
  });
};

export const getSavedGame = async (id: string, userId: string): Promise<SavedGame | null> => {
  const snap = await usersCollection().doc(userId).collection("savedGames").doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    userId,
    name: data.name as string,
    state: data.state as string,
    createdAt: data.createdAt as number,
  };
};

export const createSavedGame = async (userId: string, name: string, state: string): Promise<string> => {
  const id = randomUUID();
  await usersCollection().doc(userId).collection("savedGames").doc(id).set({
    name,
    state,
    createdAt: Date.now(),
  });
  return id;
};

export const deleteSavedGame = async (id: string, userId: string): Promise<void> => {
  await usersCollection().doc(userId).collection("savedGames").doc(id).delete();
};

export const getShareUserId = async (shareId: string): Promise<string | null> => {
  const snap = await sharesCollection().doc(shareId).get();
  const data = snap.data();
  return typeof data?.userId === "string" ? data.userId : null;
};

export const getUserIdShare = async (userId: string): Promise<string | null> => {
  const snap = await usersCollection().doc(userId).get();
  const data = snap.data();
  return typeof data?.shareId === "string" ? data.shareId : null;
};

export const setUserIdShare = async (userId: string, shareId: string): Promise<void> => {
  await Promise.all([
    sharesCollection().doc(shareId).set({ userId }),
    usersCollection().doc(userId).set({ shareId }, { merge: true }),
  ]);
};

// Costs exactly one read (hit or miss, same billing) and doesn't require any
// seeded data — a successful round-trip is treated as "reachable", mirroring the
// sqlite adapter's "SELECT 1" liveness check.
export const pingDatabase = async (): Promise<boolean> => {
  try {
    await firestore().collection("_health").doc("ping").get();
    return true;
  } catch {
    return false;
  }
};
