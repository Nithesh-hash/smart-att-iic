/**
 * Module 3: Admin & Analytics Panel Container
 * Sub-Tab navigation between:
 * 1. Events Management
 * 2. Segregation History (Audit Trail)
 * 3. Analytics Dashboard
 */

import React, { useState } from 'react';
import { Calendar, History, BarChart3, ShieldCheck } from 'lucide-react';
import EventsManagement from './EventsManagement';
import SegregationHistory from './SegregationHistory';
import AnalyticsDashboard from './AnalyticsDashboard';

const ADMIN_SUBTABS = {
  EVENTS: 'events',
  HISTORY: 'history',
  ANALYTICS: 'analytics'
};

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState(ADMIN_SUBTABS.ANALYTICS);

  return (
    <div className="admin-panel-container">
      <div className="section-title-bar">
        <div>
          <h2 className="section-heading">🛡️ Administrative Control & Analytics Panel</h2>
          <p className="section-subheading">
            Audit institutional event registries, inspect historical segregation archives, and analyze event metrics with interactive visual charts.
          </p>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="admin-subtabs-row">
        <button
          type="button"
          className={`admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.ANALYTICS ? 'subtab-active' : ''}`}
          onClick={() => setActiveSubTab(ADMIN_SUBTABS.ANALYTICS)}
        >
          <BarChart3 size={18} />
          <span>Executive Analytics Dashboard</span>
        </button>

        <button
          type="button"
          className={`admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.EVENTS ? 'subtab-active' : ''}`}
          onClick={() => setActiveSubTab(ADMIN_SUBTABS.EVENTS)}
        >
          <Calendar size={18} />
          <span>Events Management Registry</span>
        </button>

        <button
          type="button"
          className={`admin-subtab-btn ${activeSubTab === ADMIN_SUBTABS.HISTORY ? 'subtab-active' : ''}`}
          onClick={() => setActiveSubTab(ADMIN_SUBTABS.HISTORY)}
        >
          <History size={18} />
          <span>Segregation History & Audit Trail</span>
        </button>
      </div>

      {/* Active SubTab Component */}
      <div className="admin-subtab-content mt-6">
        {activeSubTab === ADMIN_SUBTABS.ANALYTICS && <AnalyticsDashboard />}
        {activeSubTab === ADMIN_SUBTABS.EVENTS && <EventsManagement />}
        {activeSubTab === ADMIN_SUBTABS.HISTORY && <SegregationHistory />}
      </div>
    </div>
  );
}
