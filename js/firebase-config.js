// ---------------------------------------------------------------------------
// FIREBASE CONFIG — you must fill this in yourself.
//
// This project uses Firebase for accounts, save/resume and the leaderboard.
// Firebase web config values (below) are NOT secret — they are meant to be
// public in client-side code; access is controlled by Firestore Security
// Rules (see firestore.rules in this repo), not by hiding these values.
//
// How to get your own values (free tier is enough):
//   1. Go to https://console.firebase.google.com/ and create a project.
//   2. In the project, go to Build > Authentication > Sign-in method and
//      enable "Email/Password" (and "Google" if you want that button to work).
//   3. Go to Build > Firestore Database > Create database (production mode
//      is fine — the rules in firestore.rules will lock it down). Pick any
//      region.
//   4. Go to Project settings (gear icon) > General > "Your apps" > click
//      the "</>" (web) icon to register a web app. Copy the firebaseConfig
//      object it gives you and paste the values below.
//   5. In Firestore > Rules, paste the contents of firestore.rules and
//      publish.
//
// Until you do this, the site will still load and the game is playable, but
// login/register/leaderboard/cloud-save will show a connection error.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Auto-detected — true once you've replaced the placeholder values above.
export const FIREBASE_CONFIGURED = !firebaseConfig.apiKey.startsWith("YOUR_");
