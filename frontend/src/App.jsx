/**
 * Smart Attendance & Event Management Portal
 * Matches the official VIT-IST institutional design from screenshots:
 * - Exact Login Screen (Image 1)
 * - Exact Welcome Modal "Please read this page!" (Image 2)
 * - Exact Centered Navigation & "Register New Event" form (Images 3 & 4)
 * - Exact "Excel Segregation" Step 1 & multi-event batch workflow (Image 5)
 * - Plus Quick Segregation & Admin Analytics Panel
 * - Security: 5-minute inactivity auto-logout, DevTools / ContextMenu inspect protection
 * - Developer Badge: Bottom-left with rotation and official LinkedIn credentials
 */

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Navigation, { TABS } from './components/Navigation';
import LoginModal from './components/LoginModal';
import WelcomeModal from './components/WelcomeModal';
import RulesModal from './components/RulesModal';
import FirebaseSettingsModal from './components/FirebaseSettingsModal';
import DeveloperBadge from './components/DeveloperBadge';

import EventRegistration from './components/EventRegistration';
import MultiEventBatch from './components/MultiEventBatch';
import QuickSegregation from './components/QuickSegregation';
import AdminPanel from './components/admin/AdminPanel';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('smart_att_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Welcome Modal (Shows on initial session if not previously acknowledged)
  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('smart_att_seen_welcome');
  });

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState(TABS.REGISTRATION);

  // Aux Modals
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isCloudSettingsOpen, setIsCloudSettingsOpen] = useState(false);

  // Inactivity Timer Ref
  const inactivityTimerRef = useRef(null);

  // 1. Institutional Security: Turn off Inspect & DevTools Shortcuts
  useEffect(() => {
    const disableContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const disableDevShortcuts = (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (or Cmd on Mac)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')
      ) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        return false;
      }
      // Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('contextmenu', disableContextMenu);
    window.addEventListener('keydown', disableDevShortcuts);

    return () => {
      window.removeEventListener('contextmenu', disableContextMenu);
      window.removeEventListener('keydown', disableDevShortcuts);
    };
  }, []);

  // 2. Institutional Security: 5-minute Inactivity Auto-Logout
  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        handleInactivityLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleInactivityLogout = () => {
      sessionStorage.clear();
      // Clear cookies
      try {
        document.cookie.split(';').forEach((c) => {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });
      } catch (err) {
        console.warn('Cookie cleanup:', err);
      }
      setCurrentUser(null);
      alert('Institutional Security: You have been logged out due to 5 minutes of inactivity.');
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    // Start initial timer
    resetTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab(TABS.REGISTRATION);
    setShowWelcome(true);
  };

  const handleAcknowledgeWelcome = () => {
    sessionStorage.setItem('smart_att_seen_welcome', 'true');
    setShowWelcome(false);
    setActiveTab(TABS.REGISTRATION);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('smart_att_user');
    sessionStorage.removeItem('smart_att_seen_welcome');
    try {
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    } catch {
      // ignore
    }
    setCurrentUser(null);
  };

  return (
    <div className="exact-portal-wrapper">
      {/* 1. Login Screen (Image 1) */}
      {!currentUser && (
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* 2. Authenticated Portal View */}
      {currentUser && (
        <div className="portal-page-container">
          {/* Official Institutional Header */}
          <Header
            currentUser={currentUser}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenCloudSettings={() => setIsCloudSettingsOpen(true)}
            onSelectTab={(tab) => setActiveTab(tab)}
            onLogout={handleLogout}
          />

          {/* Centered Deep Purple Navigation Bar */}
          <Navigation
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />

          {/* Main Card View matching active tab */}
          <main className="portal-content-body">
            {activeTab === TABS.REGISTRATION && (
              <EventRegistration />
            )}

            {activeTab === TABS.BATCH && (
              <MultiEventBatch />
            )}

            {activeTab === TABS.QUICK && (
              <QuickSegregation />
            )}

            {activeTab === TABS.ADMIN && (
              <AdminPanel />
            )}
          </main>

          {/* Welcome Modal (Image 2) */}
          {showWelcome && (
            <WelcomeModal onConfirm={handleAcknowledgeWelcome} />
          )}

          {/* Rules & Guide Modal */}
          {isRulesOpen && (
            <RulesModal onClose={() => setIsRulesOpen(false)} />
          )}

          {/* Firebase Settings Modal */}
          {isCloudSettingsOpen && (
            <FirebaseSettingsModal
              onClose={() => setIsCloudSettingsOpen(false)}
            />
          )}
        </div>
      )}

      {/* Floating Developer Badge at Bottom-Left */}
      <DeveloperBadge />
    </div>
  );
}
