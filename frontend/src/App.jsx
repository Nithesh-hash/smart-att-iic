/**
 * Smart Attendance & Event Management Portal
 * Matches the official VIT-IST institutional design from screenshots:
 * - Exact Login Screen (Image 1)
 * - Exact Welcome Modal "Please read this page!" (Image 2)
 * - Exact Centered Navigation & "Register New Event" form (Images 3 & 4)
 * - Exact "Excel Segregation" Step 1 & multi-event batch workflow (Image 5)
 * - Plus Quick Segregation & Admin Analytics Panel
 */

import React, { useState } from 'react';
import Header from './components/Header';
import Navigation, { TABS } from './components/Navigation';
import LoginModal from './components/LoginModal';
import WelcomeModal from './components/WelcomeModal';
import RulesModal from './components/RulesModal';
import FirebaseSettingsModal from './components/FirebaseSettingsModal';

import EventRegistration from './components/EventRegistration';
import MultiEventBatch from './components/MultiEventBatch';
import QuickSegregation from './components/QuickSegregation';
import AdminPanel from './components/admin/AdminPanel';

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
    </div>
  );
}
