/**
 * Student Portal Container Component
 * Coordinates Student Login, Registration, Pending Verification, and Student OD Dashboard.
 * Maintains independent Firebase Auth state from the Admin Portal.
 */

import React, { useState, useEffect } from 'react';
import {
  getStudentAuth,
  fetchCurrentStudentProfile,
  logoutStudent
} from '../../services/studentAuthService';
import StudentLogin from './StudentLogin';
import StudentRegister from './StudentRegister';
import StudentPendingApproval from './StudentPendingApproval';
import StudentDashboard from './StudentDashboard';
import { RefreshCw } from 'lucide-react';

export const STUDENT_VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  PENDING: 'pending',
  DASHBOARD: 'dashboard'
};

export default function StudentPortal({ onSwitchToAdmin }) {
  const [currentView, setCurrentView] = useState(STUDENT_VIEWS.LOGIN);
  const [studentProfile, setStudentProfile] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize and check Firebase Auth state
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const auth = getStudentAuth();
      unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            await user.reload();
            const profile = await fetchCurrentStudentProfile(user.uid);
            if (profile) {
              profile.emailVerified = Boolean(user.emailVerified || profile.emailVerified);
              setStudentProfile(profile);

              if (profile.approvalStatus === 'approved' && profile.emailVerified) {
                setCurrentView(STUDENT_VIEWS.DASHBOARD);
              } else {
                setCurrentView(STUDENT_VIEWS.PENDING);
              }
            } else {
              // User has auth record but no profile in Firestore
              setStudentProfile({
                uid: user.uid,
                email: user.email,
                name: 'VIT Student',
                registrationNumber: 'Pending',
                approvalStatus: 'pending',
                emailVerified: Boolean(user.emailVerified)
              });
              setCurrentView(STUDENT_VIEWS.PENDING);
            }
          } catch (profileErr) {
            console.warn('Profile fetch warning:', profileErr);
            setCurrentView(STUDENT_VIEWS.LOGIN);
          }
        } else {
          setStudentProfile(null);
          setCurrentView(STUDENT_VIEWS.LOGIN);
        }
        setIsInitializing(false);
      });
    } catch (e) {
      console.warn('Auth state check error:', e);
      setIsInitializing(false);
    }

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (user, profile) => {
    setStudentProfile(profile);
    if (profile?.approvalStatus === 'approved' && (profile?.emailVerified || user?.emailVerified)) {
      setCurrentView(STUDENT_VIEWS.DASHBOARD);
    } else {
      setCurrentView(STUDENT_VIEWS.PENDING);
    }
  };

  const handleRegisterSuccess = (user, profile) => {
    setStudentProfile(profile);
    setCurrentView(STUDENT_VIEWS.PENDING);
  };

  const handleStatusResolved = (updatedProfile) => {
    setStudentProfile(updatedProfile);
    if (updatedProfile?.approvalStatus === 'approved' && updatedProfile?.emailVerified) {
      setCurrentView(STUDENT_VIEWS.DASHBOARD);
    }
  };

  const handleLogout = async () => {
    await logoutStudent();
    setStudentProfile(null);
    setCurrentView(STUDENT_VIEWS.LOGIN);
  };

  if (isInitializing) {
    return (
      <div className="login-page-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#190059' }}>
          <RefreshCw size={32} className="spinning-icon" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>Loading Student Portal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="exact-portal-wrapper student-portal-root">
      {/* View 1: Student Login */}
      {currentView === STUDENT_VIEWS.LOGIN && (
        <StudentLogin
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setCurrentView(STUDENT_VIEWS.REGISTER)}
          onSwitchToAdmin={onSwitchToAdmin}
        />
      )}

      {/* View 2: Student Registration */}
      {currentView === STUDENT_VIEWS.REGISTER && (
        <StudentRegister
          onRegisterSuccess={handleRegisterSuccess}
          onSwitchToLogin={() => setCurrentView(STUDENT_VIEWS.LOGIN)}
          onSwitchToAdmin={onSwitchToAdmin}
        />
      )}

      {/* View 3: Pending Approval / Email Verification Screen */}
      {currentView === STUDENT_VIEWS.PENDING && (
        <StudentPendingApproval
          studentProfile={studentProfile}
          onStatusResolved={handleStatusResolved}
          onLogout={handleLogout}
          onSwitchToAdmin={onSwitchToAdmin}
        />
      )}

      {/* View 4: Student OD Dashboard */}
      {currentView === STUDENT_VIEWS.DASHBOARD && (
        <StudentDashboard
          studentProfile={studentProfile}
          onLogout={handleLogout}
          onSwitchToAdmin={onSwitchToAdmin}
        />
      )}
    </div>
  );
}

