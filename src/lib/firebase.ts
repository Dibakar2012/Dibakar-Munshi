import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, PhoneAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the specific database ID if it exists and isn't a placeholder, otherwise fallback to default
const dbId = firebaseConfig.firestoreDatabaseId && 
             firebaseConfig.firestoreDatabaseId !== "(default)" && 
             !firebaseConfig.firestoreDatabaseId.includes("TODO") 
             ? firebaseConfig.firestoreDatabaseId 
             : undefined;

// Initialize Firestore with long-polling for better compatibility in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);

// Enable persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { createUserWithEmailAndPassword, signInWithEmailAndPassword };
