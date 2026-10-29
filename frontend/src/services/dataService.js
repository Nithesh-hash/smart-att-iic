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
  const db = getDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (list.length > 0) return list;
    } catch (err) {
      console.warn('Firestore getEvents failed, falling back to LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('LocalStorage events error:', e);
  }

  // Default seed if completely empty
  const seeded = getInitialMockEvents();
  localStorage.setItem(EVENTS_KEY, JSON.stringify(seeded));
  return seeded;
}

export async function addEvent(eventData) {
  const newEvent = {
    ...eventData,
    createdAt: new Date().toISOString()
  };

  const db = getDb();
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'events'), newEvent);
      return { id: docRef.id, ...newEvent };
    } catch (err) {
      console.warn('Firestore addEvent failed, using LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  const current = await getEvents();
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const saved = { id, ...newEvent };
  const updated = [saved, ...current];
  localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
  return saved;
}

export async function deleteEvent(eventId) {
  const db = getDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'events', eventId));
    } catch (err) {
      console.warn('Firestore deleteEvent failed, checking LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  const current = await getEvents();
  const updated = current.filter(e => e.id !== eventId);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
  return true;
}

/**
 * --- SEGREGATION HISTORY CRUD ---
 */
export async function getSegregationHistory() {
  const db = getDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'segregation_history'));
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (list.length > 0) {
        return list.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
      }
    } catch (err) {
      console.warn('Firestore getSegregationHistory failed, using LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return list.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
    }
  } catch (e) {
    console.error('LocalStorage history error:', e);
  }

  const seeded = getInitialMockHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
  return seeded;
}

export async function addSegregationHistory(historyRecord) {
  const record = {
    ...historyRecord,
    timestamp: new Date().toISOString()
  };

  const db = getDb();
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'segregation_history'), record);
      return { id: docRef.id, ...record };
    } catch (err) {
      console.warn('Firestore addSegregationHistory failed, using LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  const current = await getSegregationHistory();
  const id = `hist_${Date.now()}`;
  const saved = { id, ...record };
  const updated = [saved, ...current];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return saved;
}

export async function deleteSegregationHistory(historyId) {
  const db = getDb();
  if (db) {
    try {
      await deleteDoc(doc(db, 'segregation_history', historyId));
    } catch (err) {
      console.warn('Firestore deleteSegregationHistory failed:', err);
    }
  }

  const current = await getSegregationHistory();
  const updated = current.filter(h => h.id !== historyId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
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
 * Initial Realistic Institutional Mock Data
 */
function getInitialMockEvents() {
  return [
    {
      id: 'ev_mock_1',
      eventName: 'AI & Deep Learning Hackathon 2026',
      coordinatorName: 'Dr. K. Senthil Kumar',
      coordinatorContact: '+91 98765 43210',
      school: 'SCOPE',
      eventType: 'Tech Fest / Hackathon / Ideathon',
      isMultiDay: true,
      days: [
        {
          dayIndex: 1,
          date: '2026-10-14',
          venue: 'Technology Tower Gallery',
          startTime: '09:00 AM',
          endTime: '05:00 PM'
        },
        {
          dayIndex: 2,
          date: '2026-10-15',
          venue: 'Anna Auditorium',
          startTime: '09:00 AM',
          endTime: '04:30 PM'
        }
      ],
      createdAt: '2026-10-01T10:00:00.000Z'
    },
    {
      id: 'ev_mock_2',
      eventName: 'Robotics & Automation Hands-on Workshop',
      coordinatorName: 'Prof. R. Anand',
      coordinatorContact: '+91 94432 10987',
      school: 'SMEC',
      eventType: 'Workshop',
      isMultiDay: false,
      days: [
        {
          dayIndex: 1,
          date: '2026-10-20',
          venue: 'SMEC CAD Lab 402',
          startTime: '10:00 AM',
          endTime: '01:00 PM'
        }
      ],
      createdAt: '2026-10-05T14:30:00.000Z'
    },
    {
      id: 'ev_mock_3',
      eventName: 'Startup Pitch & Mentoring Session with VCs',
      coordinatorName: 'Dr. Meenakshi Sundaram',
      coordinatorContact: '+91 91234 56789',
      school: 'VITBS',
      eventType: 'Mentoring Session',
      isMultiDay: false,
      days: [
        {
          dayIndex: 1,
          date: '2026-10-22',
          venue: 'TBI Incubation Center',
          startTime: '02:00 PM',
          endTime: '05:30 PM'
        }
      ],
      createdAt: '2026-10-10T09:15:00.000Z'
    },
    {
      id: 'ev_mock_4',
      eventName: 'VLSI Circuit Design Expert Seminar',
      coordinatorName: 'Dr. P. Rajeswari',
      coordinatorContact: '+91 98840 12345',
      school: 'SENSE',
      eventType: 'Expert Talk',
      isMultiDay: false,
      days: [
        {
          dayIndex: 1,
          date: '2026-10-25',
          venue: 'SENSE Seminar Hall 101',
          startTime: '03:00 PM',
          endTime: '05:00 PM'
        }
      ],
      createdAt: '2026-10-12T11:00:00.000Z'
    },
    {
      id: 'ev_mock_5',
      eventName: 'Bio-Innovation Expo & Research Demo Day',
      coordinatorName: 'Dr. S. Kavitha',
      coordinatorContact: '+91 97890 23456',
      school: 'SBST',
      eventType: 'Demo Day / Competition',
      isMultiDay: true,
      days: [
        {
          dayIndex: 1,
          date: '2026-10-27',
          venue: 'Silver Jubilee Tower Gallery',
          startTime: '10:00 AM',
          endTime: '04:00 PM'
        },
        {
          dayIndex: 2,
          date: '2026-10-28',
          venue: 'SBST Biotech Foyer',
          startTime: '10:00 AM',
          endTime: '03:00 PM'
        }
      ],
      createdAt: '2026-10-15T08:45:00.000Z'
    }
  ];
}

function getInitialMockHistory() {
  return [
    {
      id: 'hist_mock_1',
      runTitle: 'October Major Events Segregation',
      dateRange: '2026-10-14 to 2026-10-28',
      eventsProcessed: 4,
      totalStudents: 1248,
      schoolsRepresented: 11,
      filesCount: 6,
      zipName: 'all_schools_2026-10-14_to_2026-10-28.zip',
      timestamp: '2026-10-28T16:20:00.000Z'
    },
    {
      id: 'hist_mock_2',
      runTitle: 'Robotics Workshop Day 1 Batch',
      dateRange: '2026-10-20 to 2026-10-20',
      eventsProcessed: 1,
      totalStudents: 312,
      schoolsRepresented: 5,
      filesCount: 2,
      zipName: 'all_schools_2026-10-20.zip',
      timestamp: '2026-10-20T17:45:00.000Z'
    },
    {
      id: 'hist_mock_3',
      runTitle: 'Hackathon Grand Finale Attendance',
      dateRange: '2026-10-14 to 2026-10-15',
      eventsProcessed: 2,
      totalStudents: 840,
      schoolsRepresented: 9,
      filesCount: 4,
      zipName: 'all_schools_2026-10-14_to_2026-10-15.zip',
      timestamp: '2026-10-16T11:10:00.000Z'
    }
  ];
}

