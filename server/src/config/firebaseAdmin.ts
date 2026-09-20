import "dotenv/config";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
    return applicationDefault();
  }

  throw new Error(
    "Firebase credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
  );
}

const firebaseApp = getApps()[0] ?? initializeApp({ credential: createCredential() });

export const adminAuth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);