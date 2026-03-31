import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, PhoneAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the specific database ID if it exists and isn't a placeholder, otherwise fallback to default
const dbId = firebaseConfig.firestoreDatabaseId && 
             firebaseConfig.firestoreDatabaseId !== "(default)" && 
             !firebaseConfig.firestoreDatabaseId.includes("TODO") 
             ? firebaseConfig.firestoreDatabaseId 
             : undefined;

export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { createUserWithEmailAndPassword, signInWithEmailAndPassword };
