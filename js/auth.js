// ---------------------------------------------------------------------------
// Auth + cloud save + leaderboard, backed by Firebase (Auth + Firestore).
// See firebase-config.js for setup instructions. This module degrades
// gracefully (throws readable errors) if Firebase hasn't been configured yet.
// ---------------------------------------------------------------------------

import { firebaseConfig, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInAnonymously, signOut, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let app = null, auth = null, db = null;

function ensureInit() {
  if (!FIREBASE_CONFIGURED) {
    throw new Error(
      "Firebase henüz yapılandırılmadı. js/firebase-config.js dosyasına " +
      "kendi Firebase proje bilgilerinizi girin. / Firebase is not " +
      "configured yet — fill in js/firebase-config.js with your project's values."
    );
  }
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export function isConfigured() {
  return FIREBASE_CONFIGURED;
}

export function watchAuth(cb) {
  if (!FIREBASE_CONFIGURED) { cb(null); return () => {}; }
  ensureInit();
  return onAuthStateChanged(auth, cb);
}

export async function registerWithEmail(name, email, password) {
  ensureInit();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    displayName: name,
    createdAt: serverTimestamp(),
  }, { merge: true });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  ensureInit();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle() {
  ensureInit();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await setDoc(doc(db, "users", cred.user.uid), {
    displayName: cred.user.displayName || "Denetçi",
    createdAt: serverTimestamp(),
  }, { merge: true });
  return cred.user;
}

export async function playAsGuest() {
  ensureInit();
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function logout() {
  ensureInit();
  await signOut(auth);
}

export function displayNameFor(user) {
  return (user && (user.displayName || (user.isAnonymous ? "Misafir" : user.email))) || "Denetçi";
}

// ---- save / resume ----

export async function loadSave(uid) {
  ensureInit();
  const snap = await getDoc(doc(db, "users", uid, "saves", "current"));
  return snap.exists() ? snap.data() : null;
}

export async function writeSave(uid, state) {
  ensureInit();
  const { updatedAt, ...clean } = state;
  await setDoc(doc(db, "users", uid, "saves", "current"), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

// ---- leaderboard ----
// One public-readable doc per user, overwritten whenever XP/findings change.

export async function updateLeaderboardEntry(uid, displayName, entry) {
  ensureInit();
  await setDoc(doc(db, "leaderboard", uid), {
    displayName,
    xp: entry.xp,
    rank: entry.rank,
    findings: entry.findings,
    clearance: entry.clearance,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchLeaderboard(topN = 50) {
  ensureInit();
  const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(topN));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(d => rows.push(d.data()));
  return rows;
}
