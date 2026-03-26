import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDhtAnofq-ciRN_jocuRzZ_eGQ_7jWLs60',
  authDomain: 'habittracker-4feb2.firebaseapp.com',
  projectId: 'habittracker-4feb2',
  storageBucket: 'habittracker-4feb2.firebasestorage.app',
  messagingSenderId: '164879829524',
  appId: '1:164879829524:web:59d46e71e03b0ab7b2f501',
};

// Guard against re-initialisation in dev hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db   = getFirestore(app);
export const auth = getAuth(app);
