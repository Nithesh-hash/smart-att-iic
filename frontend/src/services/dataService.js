/**
 * Unified Data Persistence Layer
 * Hybrid Serverless Architecture:
 * - Direct Firestore integration with resilient non-blocking background sync
 * - Instant, synchronous LocalStorage operations so UI reflects immediately without latency
 * - Pre-seeded institutional mock data matching portal design
 */

import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  writeBatch
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
 * Helper: Run promise with a timeout so Firestore never hangs the UI
 */
function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
  ]);
}

/**
 * --- EVENTS CRUD (Instant Local + Background Remote Sync) ---
 */
export function getEventsSync() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage events read error:', e);
  }

  // Fallback initial seed
  const seeded = getInitialMockEvents();
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(seeded));
  } catch (e) {}
  return seeded;
}

export async function getEvents() {
  const localList = getEventsSync();

  // Background non-blocking sync with Firestore
  const db = getDb();
  if (db) {
    withTimeout(getDocs(collection(db, 'events')), 2500)
      .then(snap => {
        if (!snap.empty) {
          const remoteList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const current = getEventsSync();
          const existingIds = new Set(current.map(e => e.id));
          const newFromRemote = remoteList.filter(e => !existingIds.has(e.id));
          if (newFromRemote.length > 0) {
            const merged = [...current, ...newFromRemote];
            localStorage.setItem(EVENTS_KEY, JSON.stringify(merged));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('smart_att_events_changed', { detail: { merged: true } }));
            }
          }
        }
      })
      .catch(err => {
        // Silently skip if Firestore is unreachable or offline
      });
  }

  return localList;
}

export async function addEvent(eventData) {
  const current = getEventsSync();
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const saved = {
    id,
    ...eventData,
    createdAt: new Date().toISOString()
  };

  const updated = [saved, ...current.filter(e => e.id !== id)];
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

  // Background Firestore persistence (non-blocking)
  const db = getDb();
  if (db) {
    setDoc(doc(db, 'events', id), saved).catch(err => {
      console.warn('Firestore event write error:', err);
    });
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
    deleteDoc(doc(db, 'events', eventId)).catch(err => {
      console.warn('Firestore event delete error:', err);
    });
  }

  return true;
}

/**
 * --- SEGREGATION HISTORY CRUD (Instant Local + Background Remote Sync) ---
 */
export function getSegregationHistorySync() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw !== null) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
      }
    }
  } catch (e) {
    console.error('LocalStorage history read error:', e);
  }

  // Fallback initial seed matching screenshot
  const seeded = getInitialMockHistory();
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
  } catch (e) {}
  return seeded;
}

export async function getSegregationHistory() {
  const localList = getSegregationHistorySync();

  // Background non-blocking sync with Firestore
  const db = getDb();
  if (db) {
    withTimeout(getDocs(collection(db, 'segregation_history')), 2500)
      .then(snap => {
        if (!snap.empty) {
          const remoteList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const current = getSegregationHistorySync();
          const existingIds = new Set(current.map(h => h.id));
          const newFromRemote = remoteList.filter(h => !existingIds.has(h.id));
          if (newFromRemote.length > 0) {
            const merged = [...current, ...newFromRemote];
            merged.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('smart_att_history_changed', { detail: { merged: true } }));
            }
          }
        }
      })
      .catch(err => {
        // Silently skip if Firestore is unreachable or offline
      });
  }

  return localList;
}

export async function addSegregationHistory(historyRecord) {
  const current = getSegregationHistorySync();
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

  const saved = {
    id,
    ...historyRecord,
    segregatedOn: historyRecord.segregatedOn || formattedSegregatedOn,
    timestamp: historyRecord.timestamp || now.toISOString()
  };

  const updated = [saved, ...current.filter(h => h.id !== id)];
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

  // Background Firestore persistence (non-blocking)
  const db = getDb();
  if (db) {
    setDoc(doc(db, 'segregation_history', id), saved).catch(err => {
      console.warn('Firestore history write error:', err);
    });
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
    deleteDoc(doc(db, 'segregation_history', historyId)).catch(err => {
      console.warn('Firestore history delete error:', err);
    });
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
}

/**
 * --- SEED DATABASE ---
 * Populates Firestore or LocalStorage with rich sample data
 */
export async function seedInitialData() {
  const mockEvents = getInitialMockEvents();
  const mockHistory = getInitialMockHistory();

  const db = getDb();
  if (db) {
    try {
      const batch = writeBatch(db);
      mockEvents.forEach(ev => {
        const ref = doc(collection(db, 'events'));
        batch.set(ref, ev);
      });
      mockHistory.forEach(h => {
        const ref = doc(collection(db, 'segregation_history'));
        batch.set(ref, h);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Firestore batch seed failed, writing to LocalStorage instead:', err);
    }
  }

  localStorage.setItem(EVENTS_KEY, JSON.stringify(mockEvents));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(mockHistory));
  localStorage.setItem(SCHOOLS_KEY, JSON.stringify(defaultSchoolsConfig));

  return true;
}

/**
 * Initial Institutional Mock Data matching exact screenshots (Image 9 & 10)
 */
function getInitialMockEvents() {
  return [
    {
      id: 'ev_1_iic_council',
      eventName: 'IIC Student Council Meeting',
      coordinatorName: 'Dr.Jothish Kumar',
      coordinatorContact: '9787074353',
      school: 'VITISR',
      eventType: 'Mentoring Session',
      isMultiDay: false,
      days: [
        {
          dayIndex: 1,
          date: '2026-07-16',
          venue: 'PRP- A BLOCK 156',
          startTime: '5:00 PM',
          endTime: '7:00 PM'
        }
      ],
      createdAt: '2026-07-16T17:00:00.000Z'
    },
    {
      id: 'ev_2_summer_startup_1',
      eventName: 'Summer Startup Launch Pad',
      coordinatorName: 'Jothish Kumar M',
      coordinatorContact: '',
      school: 'SCORE',
      eventType: 'Mentoring Session',
      isMultiDay: true,
      days: [
        {
          dayIndex: 1,
          date: '2026-07-09',
          venue: 'PRP A block Room no. 156',
          startTime: '9:30 AM',
          endTime: '1:00 PM'
        },
        {
          dayIndex: 2,
          date: '2026-07-10',
          venue: 'PRP A block Room no. 156',
          startTime: '9:30 AM',
          endTime: '1:00 PM'
        }
      ],
      createdAt: '2026-07-09T09:30:00.000Z'
    },
    {
      id: 'ev_3_summer_startup_2',
      eventName: 'Summer Startup Launch Pad',
      coordinatorName: 'Jothish Kumar M',
      coordinatorContact: '',
      school: 'SCORE',
      eventType: 'Mentoring Session',
      isMultiDay: true,
      days: [
        {
          dayIndex: 1,
          date: '2026-07-09',
          venue: 'PRP A block Room no. 156',
          startTime: '2:00 PM',
          endTime: '5:30 PM'
        },
        {
          dayIndex: 2,
          date: '2026-07-10',
          venue: 'PRP A block Room no. 156',
          startTime: '2:00 PM',
          endTime: '5:30 PM'
        }
      ],
      createdAt: '2026-07-09T14:00:00.000Z'
    },
    {
      id: 'ev_4_gyhby',
      eventName: 'Gyhby',
      coordinatorName: 'Ybyg',
      coordinatorContact: '',
      school: 'Ybyv',
      eventType: 'Workshop',
      isMultiDay: false,
      days: [
        {
          dayIndex: 1,
          date: '2026-07-01',
          venue: 'Thtyg',
          startTime: '1:00 AM',
          endTime: '1:00 PM'
        }
      ],
      createdAt: '2026-07-01T01:00:00.000Z'
    }
  ];
}

function getInitialMockHistory() {
  return [
    {
      id: 'hist_1',
      eventDates: '01-07-2026',
      eventsSegregated: '• Gyhby | Thtyg | 2026-07-01 (1:00 AM - 1:00 PM)',
      coordinatorFormatted: 'Ybyg (Ybyv)',
      count: 1,
      segregatedOn: '12-10-2026 12:02 PM',
      zipName: 'all_schools_2026-07-01_120228.zip',
      timestamp: '2026-10-12T12:02:28.000Z',
      totalStudents: 1,
      schoolsRepresented: 1,
      filesCount: 1
    }
  ];
}
