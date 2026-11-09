/**
 * Student Authentication & Profile Service
 * Handles VIT student registration, email validation, registration number uniqueness,
 * Firebase Authentication, and Firestore student profiles.
 */

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { getApps, initializeApp, getApp } from 'firebase/app';
import { getSavedFirebaseConfig, getDb } from '../firebase/firebaseConfig';

const STUDENT_PROFILE_STORAGE_KEY = 'smart_att_student_profile';

/**
 * Initialize or return active Firebase Auth instance
 */
export function getStudentAuth() {
  const cfg = getSavedFirebaseConfig();
  const app = getApps().length === 0 ? initializeApp(cfg) : getApp();
  return getAuth(app);
}

/**
 * Validates 9-character VIT Registration Number format (e.g. 21BCE1234, 22MIS0001)
 */
export function isValidVitRegNo(regNo) {
  if (!regNo) return false;
  const str = String(regNo).trim().toUpperCase();
  return /^\d{2}[A-Z]{3}\d{4}$/.test(str);
}

/**
 * Normalizes VIT Registration Number (trimmed, uppercase)
 */
export function normalizeRegNo(regNo) {
  return String(regNo || '').trim().toUpperCase();
}

/**
 * Validates official VIT Student email format (@vitstudent.ac.in)
 */
export function isValidVitStudentEmail(email) {
  if (!email) return false;
  const str = String(email).trim().toLowerCase();
  return /^[a-zA-Z0-9._%+-]+@vitstudent\.ac\.in$/.test(str);
}

/**
 * Register a new student with VIT email, password, and registration number
 */
export async function registerStudent({ name, registrationNumber, email, password }) {
  const auth = getStudentAuth();
  const db = getDb();

  const cleanName = String(name || '').trim();
  const cleanRegNo = normalizeRegNo(registrationNumber);
  const cleanEmail = String(email || '').trim().toLowerCase();

  // 1. Validation checks
  if (!cleanName) {
    throw new Error('Please enter your full name.');
  }

  if (!isValidVitRegNo(cleanRegNo)) {
    throw new Error('Please enter a valid 9-character VIT Registration Number (e.g. 22MIS0001).');
  }

  if (!isValidVitStudentEmail(cleanEmail)) {
    throw new Error('Registration requires an official VIT student email address ending with @vitstudent.ac.in.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // 2. Check registration number uniqueness in Firestore
  if (db) {
    try {
      const regLockRef = doc(db, 'unique_reg_numbers', cleanRegNo);
      const regLockSnap = await getDoc(regLockRef);
      if (regLockSnap.exists()) {
        throw new Error(`Registration Number ${cleanRegNo} is already registered. Each student account must have a unique registration number.`);
      }
    } catch (err) {
      if (err.message && err.message.includes('already registered')) {
        throw err;
      }
      console.warn('Could not verify reg number uniqueness via Firestore, proceeding:', err);
    }
  }

  // 3. Create Firebase Authentication account
  const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  // 4. Send official Firebase Email Verification link
  try {
    await sendEmailVerification(user);
    console.log('✅ Verification email sent to:', cleanEmail);
  } catch (emailErr) {
    console.warn('Could not send verification email immediately:', emailErr);
  }

  // 5. Store Student Profile in Firestore
  const studentProfile = {
    uid: user.uid,
    name: cleanName,
    registrationNumber: cleanRegNo,
    normalizedRegistrationNumber: cleanRegNo,
    email: cleanEmail,
    approvalStatus: 'pending', // 'pending' | 'approved' | 'rejected'
    emailVerified: Boolean(user.emailVerified),
    rejectionReason: '',
    createdAt: new Date().toISOString(),
    approvedAt: null
  };

  if (db) {
    try {
      // Save profile
      await setDoc(doc(db, 'students', user.uid), studentProfile);
      // Lock unique registration number mapping
      await setDoc(doc(db, 'unique_reg_numbers', cleanRegNo), {
        uid: user.uid,
        email: cleanEmail,
        name: cleanName,
        createdAt: new Date().toISOString()
      });
      console.log('✅ Student profile & unique reg lock saved in Firestore');
    } catch (dbErr) {
      console.error('Error saving student profile to Firestore:', dbErr);
    }
  }

  // Save in local storage cache
  try {
    localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(studentProfile));
  } catch (e) {}

  return { user, profile: studentProfile };
}

/**
 * Log in an existing student with VIT email and password
 */
export async function loginStudent({ email, password }) {
  const auth = getStudentAuth();
  const db = getDb();

  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!isValidVitStudentEmail(cleanEmail)) {
    throw new Error('Only official VIT student email addresses (@vitstudent.ac.in) are permitted to access the Student Portal.');
  }

  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  // Reload user to refresh emailVerified status
  try {
    await user.reload();
  } catch (e) {}

  // Retrieve student profile
  let profile = null;
  if (db) {
    try {
      const profileSnap = await getDoc(doc(db, 'students', user.uid));
      if (profileSnap.exists()) {
        profile = profileSnap.data();

        // Update emailVerified in Firestore if it was verified in Firebase Auth
        if (user.emailVerified && !profile.emailVerified) {
          profile.emailVerified = true;
          await updateDoc(doc(db, 'students', user.uid), { emailVerified: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error fetching student profile from Firestore:', err);
    }
  }

  // Fallback to local storage if Firestore failed
  if (!profile) {
    try {
      const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.uid === user.uid) {
          profile = parsed;
        }
      }
    } catch (e) {}
  }

  if (profile) {
    profile.emailVerified = Boolean(user.emailVerified || profile.emailVerified);
    try {
      localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }

  return { user, profile };
}

/**
 * Resend email verification link to student
 */
export async function resendStudentVerificationEmail() {
  const auth = getStudentAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    return true;
  }
  throw new Error('No logged-in student found to resend verification email.');
}

/**
 * Send password reset email for student
 */
export async function sendStudentPasswordReset(email) {
  const auth = getStudentAuth();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!isValidVitStudentEmail(cleanEmail)) {
    throw new Error('Please enter a valid VIT student email address (@vitstudent.ac.in).');
  }

  await sendPasswordResetEmail(auth, cleanEmail);
  return true;
}

/**
 * Log out student
 */
export async function logoutStudent() {
  const auth = getStudentAuth();
  try {
    await signOut(auth);
  } catch (e) {}
  try {
    localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
    sessionStorage.removeItem('smart_att_student_session');
  } catch (e) {}
}

/**
 * Fetch current student profile from Firestore or local cache
 */
export async function fetchCurrentStudentProfile(uid) {
  const db = getDb();
  if (db && uid) {
    try {
      const snap = await getDoc(doc(db, 'students', uid));
      if (snap.exists()) {
        const data = snap.data();
        try {
          localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    } catch (err) {
      console.warn('Error fetching student profile:', err);
    }
  }

  // Cache fallback
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!uid || parsed.uid === uid) return parsed;
    }
  } catch (e) {}

  return null;
}

/**
 * Admin: Fetch all registered students for approval management
 */
export async function getAllStudentsForAdmin() {
  const db = getDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'students'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return list;
      }
    } catch (err) {
      console.warn('Error fetching all students from Firestore:', err);
    }
  }

  // Fallback to local cache if offline
  try {
    const raw = localStorage.getItem('smart_att_all_students_cache');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [];
}

/**
 * Admin: Update student approval status (approve / reject)
 */
export async function updateStudentApprovalStatus(uid, status, rejectionReason = '') {
  const db = getDb();
  const updates = {
    approvalStatus: status, // 'approved' | 'rejected' | 'pending'
    approvedAt: status === 'approved' ? new Date().toISOString() : null,
    rejectionReason: status === 'rejected' ? rejectionReason : ''
  };

  if (db) {
    try {
      await updateDoc(doc(db, 'students', uid), updates);
      console.log(`✅ Student ${uid} approval status updated to ${status}`);
    } catch (err) {
      console.error('Error updating student approval status in Firestore:', err);
      throw err;
    }
  }

  // Update in local profile if matches active student
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (raw) {
      const profile = JSON.parse(raw);
      if (profile.uid === uid) {
        Object.assign(profile, updates);
        localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      }
    }
  } catch (e) {}

  return updates;
}

