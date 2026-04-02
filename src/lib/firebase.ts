import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Set persistence to local to ensure session is kept
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error('Firebase persistence error:', err);
});

export const googleProvider = new GoogleAuthProvider();
// Add custom parameters to provider to force account selection if needed
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { signInWithPopup, signOut, onAuthStateChanged };
