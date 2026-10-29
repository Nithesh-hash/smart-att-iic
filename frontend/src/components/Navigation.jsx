/**
 * Top Navigation Bar (Tabs) Component
 * Enables seamless switching between Portal modules:
 * 1. ⚡ Quick Segregation
 * 2. 📅 Event Registration
 * 3. 📑 Multi-Event Batch Segregation
 * 4. 🛡️ Admin & Analytics Panel
 */

import React from 'react';
import {
  Zap,
  CalendarPlus,
  Layers,
  ShieldCheck
} from 'lucide-react';

export const TABS = {
  QUICK: 'quick',
  REGISTRATION: 'registration',
  BATCH: 'batch',
  ADMIN: 'admin'
};

export default function Navigation({ activeTab, onTabChange }) {
  const navItems = [
    {
      id: TABS.QUICK,
      label: 'Quick Segregation',
      badge: 'Fast',
      icon: Zap
    },
    {
      id: TABS.REGISTRATION,
      label: 'Event Registration',
      badge: null,
      icon: CalendarPlus
    },
    {
      id: TABS.BATCH,
      label: 'Multi-Event Batch',
      badge: 'Advanced',
      icon: Layers
    },
    {
      id: TABS.ADMIN,
      label: 'Admin & Analytics',
      badge: null,
      icon: ShieldCheck
    }
  ];

  return (
    <nav className="top-navigation-bar">
      <div className="nav-tabs-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-tab-btn ${isActive ? 'nav-tab-active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={18} className="nav-tab-icon" />
              <span className="nav-tab-label">{item.label}</span>
              {item.badge && <span className="nav-tab-badge">{item.badge}</span>}
              {isActive && <div className="nav-tab-indicator" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
