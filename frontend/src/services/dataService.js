/**
 * Unified Data Persistence Layer
 * Hybrid Serverless Architecture:
 * - Direct Firestore integration when credentials exist
 * - Seamless LocalStorage fallback for offline / demo mode
 * - Pre-seeded institutional mock data for zero-config onboarding
 */

import {
  collection,
  getDocs,
  addDoc,
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
 * --- EVENTS CRUD ---
 */
export async function getEvents() {
  // Always load from local persistence first
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage events read error:', e);
  }

  // Default seed matching screenshots
  const seeded = getInitialMockEvents();
  localStorage.setItem(EVENTS_KEY, JSON.stringify(seeded));
  return seeded;
}

export async function addEvent(eventData) {
  const current = await getEvents();
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const saved = {
    id,
    ...eventData,
    createdAt: new Date().toISOString()
  };

  const updated = [saved, ...current];
  localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));

  // Dispatch global event for instant UI reflection across tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_events_changed', { detail: saved }));
  }

  // Background sync to Firestore if connected
  const db = getDb();
  if (db) {
    addDoc(collection(db, 'events'), saved).catch(err => {
      console.warn('Firestore background event sync error:', err);
    });
  }

  return saved;
}

export async function deleteEvent(eventId) {
  const current = await getEvents();
  const updated = current.filter(e => e.id !== eventId);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_events_changed', { detail: { deletedId: eventId } }));
  }

  const db = getDb();
  if (db) {
    deleteDoc(doc(db, 'events', eventId)).catch(err => {
      console.warn('Firestore background delete error:', err);
    });
  }

  return true;
}

/**
 * --- SEGREGATION HISTORY CRUD ---
 */
export async function getSegregationHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
      }
    }
  } catch (e) {
    console.error('LocalStorage history read error:', e);
  }

  const seeded = getInitialMockHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
  return seeded;
}

export async function addSegregationHistory(historyRecord) {
  const current = await getSegregationHistory();
  const id = `hist_${Date.now()}`;
  const saved = {
    id,
    ...historyRecord,
    timestamp: historyRecord.timestamp || new Date().toISOString()
  };

  const updated = [saved, ...current];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

  // Dispatch global event for instant UI reflection across tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_history_changed', { detail: saved }));
  }

  const db = getDb();
  if (db) {
    addDoc(collection(db, 'segregation_history'), saved).catch(err => {
      console.warn('Firestore background history sync error:', err);
    });
  }

  return saved;
}

export async function deleteSegregationHistory(historyId) {
  const current = await getSegregationHistory();
  const updated = current.filter(h => h.id !== historyId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smart_att_history_changed', { detail: { deletedId: historyId } }));
  }

  const db = getDb();
  if (db) {
    deleteDoc(doc(db, 'segregation_history', historyId)).catch(err => {
      console.warn('Firestore background history delete error:', err);
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
      eventName: 'Summer StartUp Launch Pad',
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

