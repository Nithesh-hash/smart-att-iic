/**
 * Institutional Header Component
 * Displays VIT-IST official branding, active authenticated user indicator,
 * Cloud settings trigger, Rules & instructions modal trigger, and Logout.
 */

import React from 'react';
import {
  FileSpreadsheet,
  BookOpen,
  Database,
  LogOut,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { isUsingFirebase } from '../services/dataService';

export default function Header({
  currentUser,
  onOpenRules,
  onOpenCloudSettings,
  onLogout
}) {
  const isCloudConnected = isUsingFirebase();

  return (
    <header className="institutional-header">
      {/* Official Branding Banner Image */}
      <div className="header-banner-wrapper">
        <img
          src="/header-banner.png"
          alt="VIT - Office of Innovation, Startup & Technology Transfer (VIT-IST)"
          className="header-banner-image"
          onError={(e) => {
            // Graceful fallback if banner image fails
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div className="header-meta-bar">
        <div className="header-title-container">
          <div className="header-logo-badge">
            <FileSpreadsheet size={24} className="portal-logo-icon" />
          </div>
          <div>
            <h1 className="header-portal-title">
              Smart Attendance & Event Management Portal
            </h1>
            <p className="header-portal-subtitle">
              Office of Innovation, Startup & Technology Transfer (VIT-IST)
            </p>
          </div>
        </div>

        <div className="header-actions-group">
          {/* Cloud Storage Status Pill */}
          <div
            className={`cloud-status-indicator ${isCloudConnected ? 'status-cloud' : 'status-local'}`}
            onClick={onOpenCloudSettings}
            title={isCloudConnected ? 'Connected to Firebase Firestore' : 'Operating in LocalStorage Mode (Click to configure Firebase)'}
          >
            <span className="status-dot"></span>
            <Database size={14} />
            <span className="status-label">
              {isCloudConnected ? 'Firestore Active' : 'Offline / LocalStorage'}
            </span>
          </div>

          {/* Rules & Instructions */}
          <button
            className="btn-header-action"
            onClick={onOpenRules}
            title="Read Rules & Instructions"
          >
            <BookOpen size={16} />
            <span className="hide-on-mobile">Rules & Guide</span>
          </button>

          {/* Firebase Settings */}
          <button
            className="btn-header-action"
            onClick={onOpenCloudSettings}
            title="Cloud & Database Settings"
          >
            <Database size={16} />
            <span className="hide-on-mobile">Cloud Settings</span>
          </button>

          {/* Authenticated User Badge & Logout */}
          {currentUser && (
            <div className="user-session-badge">
              <div className="user-avatar-tag">
                <UserCheck size={14} />
                <span>{currentUser.name || currentUser.username || 'Administrator'}</span>
              </div>
              <button
                className="btn-header-logout"
                onClick={onLogout}
                title="Sign Out of Session"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
