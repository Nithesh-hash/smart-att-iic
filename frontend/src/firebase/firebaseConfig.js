/**
 * Firebase Client Configuration & Initialization
 * Provides dynamic Firestore connection with localStorage configuration overrides.
 * Falls back gracefully when keys are omitted or when operating offline.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const STORAGE_KEY = 'smart_att_firebase_custom_config';

/**
 * Retrieve saved Firebase config from localStorage or environment variables
 */
export function getSavedFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse saved Firebase config:', err);
  }

  // Fallback to default project environment settings if provided
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'smart-att-iic.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'smart-att-iic',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'smart-att-iic.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  };
}

/**
 * Save user-entered Firebase config to localStorage
 */
export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Check if valid Firebase credentials are configured
 */
export function isFirebaseConfigured() {
  const cfg = getSavedFirebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

let cachedDb = null;

/**
 * Initialize or return active Firestore instance
 */
export function getDb() {
  if (cachedDb) return cachedDb;

  const cfg = getSavedFirebaseConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    return null; // Signals dataService to use localStorage fallback
  }

  try {
    const app = getApps().length === 0 ? initializeApp(cfg) : getApp();
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch (err) {
    console.warn('Firebase initialization error, fallback to offline storage:', err);
    return null;
  }
}

/**
 * Reset cached Firestore connection (used after modifying config in settings modal)
 */
export function resetDbConnection() {
  cachedDb = null;
}

