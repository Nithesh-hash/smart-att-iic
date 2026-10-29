/**
 * Smart Attendance & Event Management Portal
 * Root Application Orchestrator
 *
 * Modules Mounted:
 * 1. ⚡ Quick Segregation (Our standalone direct spreadsheet segregation engine)
 * 2. 📅 Event Registration (Single & Multi-day scheduling with validation)
 * 3. 📑 Multi-Event Batch Segregation (Slot allocation & SheetJS multi-day processing)
 * 4. 🛡️ Admin & Analytics Panel (Events Management, Audit Trail, Chart.js & jsPDF)
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation, { TABS } from './components/Navigation';
import LoginModal from './components/LoginModal';
import DeveloperBadge from './components/DeveloperBadge';
import RulesModal from './components/RulesModal';
import FirebaseSettingsModal from './components/FirebaseSettingsModal';

import QuickSegregation from './components/QuickSegregation';
import EventRegistration from './components/EventRegistration';
import MultiEventBatch from './components/MultiEventBatch';
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

  // Active Tab
  const [activeTab, setActiveTab] = useState(TABS.QUICK);

  // Modals
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isCloudSettingsOpen, setIsCloudSettingsOpen] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('smart_att_user');
    setCurrentUser(null);
  };

  return (
    <div className="portal-root-wrapper">
      {/* Institutional Authentication Gate */}
      {!currentUser && (
        <LoginModal onLoginSuccess={(user) => setCurrentUser(user)} />
      )}

      {/* Main Portal View */}
      {currentUser && (
        <div className="portal-main-layout">
          {/* Top Institutional Header */}
          <Header
            currentUser={currentUser}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenCloudSettings={() => setIsCloudSettingsOpen(true)}
            onLogout={handleLogout}
          />

          {/* Module Navigation Tabs */}
          <Navigation
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />

          {/* Main Tab View Area */}
          <main className="portal-content-container">
            {activeTab === TABS.QUICK && (
              <QuickSegregation />
            )}

            {activeTab === TABS.REGISTRATION && (
              <EventRegistration
                onEventCreated={() => {
                  // Optionally switch or notify
                }}
              />
            )}

            {activeTab === TABS.BATCH && (
              <MultiEventBatch />
            )}

            {activeTab === TABS.ADMIN && (
              <AdminPanel />
            )}
          </main>

          {/* Institutional Footer */}
          <footer className="portal-institutional-footer">
            <div className="footer-content">
              <p className="footer-copyright">
                © {new Date().getFullYear()} VIT-IST • Office of Innovation, Startup & Technology Transfer
              </p>
              <p className="footer-tagline">
                Institutional Smart Attendance & Multi-Event Departmental Segregator
              </p>
            </div>
          </footer>

          {/* Floating Developer Credits Badge */}
          <DeveloperBadge />

          {/* Rules & Guide Modal */}
          {isRulesOpen && (
            <RulesModal onClose={() => setIsRulesOpen(false)} />
          )}

          {/* Firebase Settings Modal */}
          {isCloudSettingsOpen && (
            <FirebaseSettingsModal
              onClose={() => setIsCloudSettingsOpen(false)}
              onConfigSaved={() => {
                // Rerender / refresh connection status
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
