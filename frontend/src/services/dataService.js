/**
 * Unified Data Persistence Layer
 * Powered directly by Google Cloud Firestore:
 * - Primary cloud storage in Firestore collections ('events', 'segregation_history', 'config')
 * - Instant synchronous local cache for zero-latency UI updates
 * - Clean production state: No mock/demo records. All records come directly from user registrations and segregations.
 */

import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { getDb } from '../firebase/firebaseConfig';
import defaultSchoolsConfig from '../config/schools.json';

const EVENTS_KEY = 'smart_att_events_store';
const HISTORY_KEY = 'smart_att_history_store';
const SCHOOLS_KEY = 'vit_attendance_custom_schools_mapping';

// Default Institutional Schools
export const SCHOOL_OPTIONS = [
  'SCOPE',
  'SENSE',
  'SCORE',
  'SMEC',
  'SELECT',
  'SAS',
  'SBST',
  'SCE',
  'SHINE',
  'SCHEME',
  'SSL',
  'VITBS',
  'VAIAL',
  'HOT',
  'VSMART',
  'V-SIGN',
  'V-SPARC'
];

export const EVENT_TYPES = [
  'Expert Talk',
  'Mentoring Session',
  'Workshop',
  'Seminar',
  'Boot Camp',
  'Expo',
  'Demo Day / Competition',
  'Tech Fest / Hackathon / Ideathon'
];

/**
 * Check if the active connection is Firestore
 */
export function isUsingFirebase() {
  return Boolean(getDb());
}

/**
 * Identify legacy demo events to permanently filter and purge them
 */
export function isDemoEvent(ev) {
  if (!ev) return false;
  const id = String(ev.id || '');
  const name = String(ev.eventName || '').trim().toLowerCase();
  const coord = String(ev.coordinatorName || '').trim().toLowerCase();
  const school = String(ev.school || '').trim().toLowerCase();

  if (id.startsWith('ev_1_') || id.startsWith('ev_2_') || id.startsWith('ev_3_') || id.startsWith('ev_4_')) return true;
  if (name === 'demo' || name === 'gyhby' || name === 'iic student council meeting' || name === 'summer startup launch pad') return true;
  if (coord === 'ybyg' || school === 'ybyv') return true;
  return false;
}

/**
 * Identify legacy demo segregation history to permanently filter and purge them
 */
export function isDemoHistory(h) {
  if (!h) return false;
  const id = String(h.id || '');
  const eventsText = String(h.eventsSegregated || '').toLowerCase();
  const coord = String(h.coordinatorFormatted || '').toLowerCase();
  const zip = String(h.zipName || '').toLowerCase();

  if (id === 'hist_1' || id.startsWith('hist_1_')) return true;
  if (eventsText.includes('gyhby') || coord.includes('ybyg') || coord.includes('ybyv') || zip.includes('all_schools_2026-07-01_120228.zip')) return true;
  return false;
}

/**
 * Helper: Run promise with a timeout so Firestore never hangs the UI
 */
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
  ]);
}

/**
 * --- EVENTS CRUD (Direct Firestore + Instant Local Cache) ---
 */
export function getEventsSync() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(e => !isDemoEvent(e));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(EVENTS_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('LocalStorage events read error:', e);
  }

  return [];
}

export async function getEvents() {
  const localList = getEventsSync();

  const db = getDb();
  if (db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'events')), 4000);
      if (!snap.empty) {
        const remoteList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Purge any old demo records found in Firestore
        remoteList.forEach(item => {
          if (isDemoEvent(item)) {
            deleteDoc(doc(db, 'events', item.id)).catch(() => {});
          }
        });

        const cleanRemote = remoteList.filter(e => !isDemoEvent(e));
        cleanRemote.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        localStorage.setItem(EVENTS_KEY, JSON.stringify(cleanRemote));
        return cleanRemote;
      } else {
        return localList;
      }
    } catch (err) {
      console.warn('Firestore getEvents failed, fallback to LocalStorage:', err);
      return localList;
    }
  }

  return localList;
}

export async function addEvent(eventData) {
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const saved = {
    id,
    ...eventData,
    createdAt: new Date().toISOString()
  };

  const current = getEventsSync();
  const updated = [saved, ...current.filter(e => e.id !== id && !isDemoEvent(e))];
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }

  // Dispatch global event for instant UI reflection across tabs & components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_events_changed', { detail: saved }));
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  // Direct Firestore persistence
  const db = getDb();
  if (db) {
    try {
      await setDoc(doc(db, 'events', id), saved);
    } catch (err) {
      console.warn('Firestore event write error:', err);
    }
  }

  return saved;
}

export async function deleteEvent(eventId) {
  const current = getEventsSync();
  const updated = current.filter(e => e.id !== eventId);
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_events_changed', { detail: { deletedId: eventId } }));
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  const db = getDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'events', eventId));
    } catch (err) {
      console.warn('Firestore event delete error:', err);
    }
  }

  return true;
}

/**
 * --- SEGREGATION HISTORY CRUD (Direct Firestore + Instant Local Cache) ---
 */
export function getSegregationHistorySync() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw !== null) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const cleaned = list.filter(h => !isDemoHistory(h));
        if (cleaned.length !== list.length) {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned));
        }
        return cleaned.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
      }
    }
  } catch (e) {
    console.error('LocalStorage history read error:', e);
  }

  return [];
}

export async function getSegregationHistory() {
  const localList = getSegregationHistorySync();

  const db = getDb();
  if (db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'segregation_history')), 4000);
      if (!snap.empty) {
        const remoteList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Purge any old demo records found in Firestore
        remoteList.forEach(item => {
          if (isDemoHistory(item)) {
            deleteDoc(doc(db, 'segregation_history', item.id)).catch(() => {});
          }
        });

        const cleanRemote = remoteList
          .filter(h => !isDemoHistory(h))
          .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(cleanRemote));
        return cleanRemote;
      } else {
        return localList;
      }
    } catch (err) {
      console.warn('Firestore getSegregationHistory failed, fallback to LocalStorage:', err);
      return localList;
    }
  }

  return localList;
}

export async function addSegregationHistory(historyRecord) {
  const id = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, '0');
  const formattedSegregatedOn = `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;

  // Strip non-serializable properties (blob) before writing to Firestore
  const { blob, downloadUrl, ...firestoreData } = historyRecord;

  const saved = {
    id,
    ...firestoreData,
    segregatedOn: historyRecord.segregatedOn || formattedSegregatedOn,
    timestamp: historyRecord.timestamp || now.toISOString()
  };

  const current = getSegregationHistorySync();
  const updated = [
    { ...saved, downloadUrl },
    ...current.filter(h => h.id !== id && !isDemoHistory(h))
  ];
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }

  // Dispatch global events for instant UI reflection across tabs & components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_history_changed', { detail: saved }));
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  // Direct Firestore persistence
  const db = getDb();
  if (db) {
    try {
      await setDoc(doc(db, 'segregation_history', id), saved);
    } catch (err) {
      console.warn('Firestore history write error:', err);
    }
  }

  return saved;
}

export async function deleteSegregationHistory(historyId) {
  const current = getSegregationHistorySync();
  const updated = current.filter(h => h.id !== historyId);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_history_changed', { detail: { deletedId: historyId } }));
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  const db = getDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'segregation_history', historyId));
    } catch (err) {
      console.warn('Firestore history delete error:', err);
    }
  }

  return true;
}

/**
 * --- SCHOOLS MAPPING CRUD ---
 */
export function getSchoolMappings() {
  try {
    const raw = localStorage.getItem(SCHOOLS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('School mapping read error:', e);
  }
  return defaultSchoolsConfig;
}

export function saveSchoolMappings(mappings) {
  localStorage.setItem(SCHOOLS_KEY, JSON.stringify(mappings));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_mappings_changed', { detail: mappings }));
  }

  const db = getDb();
  if (db) {
    try {
      setDoc(doc(db, 'config', 'schools_mapping'), { mappings, updatedAt: new Date().toISOString() }).catch(() => {});
    } catch (e) {}
  }
}

/**
 * Clean seeder (no mock data)
 */
export async function seedInitialData() {
  return true;
}

// Self-executing cleanup of legacy demo items on initialization
if (typeof window !== 'undefined') {
  try {
    getEventsSync();
    getSegregationHistorySync();
  } catch (e) {}
}
