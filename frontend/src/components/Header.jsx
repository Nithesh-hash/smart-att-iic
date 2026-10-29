/**
 * Exact Institutional Header Component
 * Matches the official VIT-IST layout from screenshots:
 * - Top-right user menu with VIT avatar and "Attendance ▾" dropdown
 * - Centered VIT and IIC logos side by side
 * - Office of Innovation, Startup and Technology Transfer (VIT-IST)
 * - SMART ATTENDANCE SEGREGATOR
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  Settings,
  BookOpen,
  Database,
  User,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { isUsingFirebase } from '../services/dataService';

export default function Header({
  currentUser,
  onOpenRules,
  onOpenCloudSettings,
  onSelectTab,
  onLogout
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isCloudConnected = isUsingFirebase();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="exact-portal-header">
      {/* Top-Right User Profile & Tools Menu */}
      {currentUser && (
        <div className="top-right-user-menu" ref={dropdownRef}>
          <button
            type="button"
            className="user-profile-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="user-circle-logo">
              <img src="/vit-logo.png" alt="VIT Logo" className="vit-circle-img" />
            </div>
            <span className="user-profile-name">Attendance</span>
            <span className="dropdown-caret">▾</span>
          </button>

          {dropdownOpen && (
            <div className="user-dropdown-menu">
              <div className="dropdown-user-header">
                <strong>{currentUser.name || 'Institutional Admin'}</strong>
                <span className="dropdown-user-sub">
                  {isCloudConnected ? '🟢 Firestore Active' : '⚪ Offline / LocalStorage'}
                </span>
              </div>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onSelectTab) onSelectTab('quick');
                }}
              >
                <Zap size={15} />
                <span>Quick Segregation Engine</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onOpenRules) onOpenRules();
                }}
              >
                <BookOpen size={15} />
                <span>Rules & Instructions</span>
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onOpenCloudSettings) onOpenCloudSettings();
                }}
              >
                <Database size={15} />
                <span>Cloud & Database Settings</span>
              </button>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="dropdown-item dropdown-item-logout"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onLogout) onLogout();
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Centered Institutional Logos and Titles */}
      <div className="center-institutional-branding">
        <div className="logos-row-center">
          <img src="/vit-logo.png" alt="Vellore Institute of Technology" className="official-vit-logo" />
          <img src="/iic-logo.png" alt="Institution's Innovation Council" className="official-iic-logo" />
        </div>
        <p className="inst-office-text">
          Office of Innovation, Startup and Technology Transfer (VIT-IST)
        </p>
        <h1 className="inst-main-title">
          SMART ATTENDANCE SEGREGATOR
        </h1>
      </div>
    </header>
  );
}
