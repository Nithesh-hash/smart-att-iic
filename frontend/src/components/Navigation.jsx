/**
 * Exact Navigation Component
 * Matches the centered deep purple buttons from screenshots:
 * [ Event Registration ]  [ Excel Segregation ]  [ Quick Segregation ]  [ Admin Panel ]
 */

import React from 'react';

export const TABS = {
  REGISTRATION: 'registration',
  BATCH: 'batch',
  QUICK: 'quick',
  ADMIN: 'admin'
};

export default function Navigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: TABS.REGISTRATION, label: 'Event Registration' },
    { id: TABS.BATCH, label: 'Excel Segregation' },
    { id: TABS.QUICK, label: 'Quick Segregation' },
    { id: TABS.ADMIN, label: 'Admin Panel' }
  ];

  return (
    <div className="exact-nav-center-container">
      <div className="nav-buttons-row">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`exact-nav-btn ${isActive ? 'nav-btn-active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
