/**
 * Admin Panel Container
 * Matches Screenshots (Image 9 & 10):
 * - Heading: "Admin Panel"
 * - Subtabs: [ 📄 Events ]  [ 🕒 Segregation History ]  [ 📊 Analytics ]
 * - Underline divider
 * - Dynamic view for Events, Segregation History, and Analytics
 */

import React, { useState, useEffect } from 'react';
import EventsManagement from './EventsManagement';
import SegregationHistory from './SegregationHistory';
import AnalyticsDashboard from './AnalyticsDashboard';
import StudentManagement from './StudentManagement';

const ADMIN_SUBTABS = {
  EVENTS: 'events',
  HISTORY: 'history',
  ANALYTICS: 'analytics',
  STUDENTS: 'students'
};

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    try {
      const pending = sessionStorage.getItem('smart_att_admin_subtab');
      if (pending && Object.values(ADMIN_SUBTABS).includes(pending)) {
        sessionStorage.removeItem('smart_att_admin_subtab');
        return pending;
      }
    } catch (e) {}
    return ADMIN_SUBTABS.EVENTS;
  });

  useEffect(() => {
    const handleSubTab = (e) => {
      if (e.detail && Object.values(ADMIN_SUBTABS).includes(e.detail)) {
        setActiveSubTab(e.detail);
      }
    };
    window.addEventListener('smart_att_admin_subtab', handleSubTab);
    return () => window.removeEventListener('smart_att_admin_subtab', handleSubTab);
  }, []);

  return (
    <div className="exact-form-outer-card exact-admin-outer-card">
      <h2 className="exact-card-heading">Admin Panel</h2>

      {/* Admin Subtabs Bar (Images 9 & 10) */}
      <div className="exact-admin-subtabs-container">
        <div className="exact-admin-subtabs-row">
          <button
            type="button"
            className={`exact-admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.EVENTS ? 'subtab-active' : ''}`}
            onClick={() => setActiveSubTab(ADMIN_SUBTABS.EVENTS)}
          >
            <span className="subtab-icon-emoji">📄</span>
            <span>Events</span>
          </button>

          <button
            type="button"
            className={`exact-admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.HISTORY ? 'subtab-active' : ''}`}
            onClick={() => setActiveSubTab(ADMIN_SUBTABS.HISTORY)}
          >
            <span className="subtab-icon-emoji">🕒</span>
            <span>Segregation History</span>
          </button>

          <button
            type="button"
            className={`exact-admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.ANALYTICS ? 'subtab-active' : ''}`}
            onClick={() => setActiveSubTab(ADMIN_SUBTABS.ANALYTICS)}
          >
            <span className="subtab-icon-emoji">📊</span>
            <span>Analytics</span>
          </button>

          <button
            type="button"
            className={`exact-admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.STUDENTS ? 'subtab-active' : ''}`}
            onClick={() => setActiveSubTab(ADMIN_SUBTABS.STUDENTS)}
          >
            <span className="subtab-icon-emoji">🎓</span>
            <span>Student Management</span>
          </button>
        </div>
        <div className="exact-admin-tabs-line" />
      </div>

      {/* Tab Content */}
      <div className="exact-admin-body-content mt-4">
        {activeSubTab === ADMIN_SUBTABS.EVENTS && <EventsManagement />}
        {activeSubTab === ADMIN_SUBTABS.HISTORY && <SegregationHistory />}
        {activeSubTab === ADMIN_SUBTABS.ANALYTICS && <AnalyticsDashboard />}
        {activeSubTab === ADMIN_SUBTABS.STUDENTS && <StudentManagement />}
      </div>
    </div>
  );
}
