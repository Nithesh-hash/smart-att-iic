/**
 * Institutional Header Component
 * Matches Pic 3 from user screenshots:
 * - Top-right user menu with circular VIT icon and "Attendance ▾"
 * - Profile dropdown containing:
 *   - Circular VIT emblem
 *   - "Attendance" title
 *   - "VIT-IST Admin" subtitle
 *   - Full-width "Sign out" button (#190059)
 * - Centered institutional branding (VIT + IIC logos)
 * - Subtitles:
 *   - Office of Innovation, Startup and Technology Transfer (VIT-IST)
 *   - SMART ATTENDANCE SEGREGATOR
 */

import React, { useState, useRef, useEffect } from 'react';

export default function Header({
  currentUser,
  onLogout
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      {/* Top-Right User Profile & Logout Dropdown (Matching Pic 3) */}
      {currentUser && (
        <div className="top-right-user-menu" ref={dropdownRef}>
          <button
            type="button"
            className="user-profile-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="user-circle-logo">
              <img src="/vit-emblem.webp" alt="VIT Emblem" className="vit-circle-img" />
            </div>
            <span className="user-profile-name">Attendance</span>
            <span className="dropdown-caret">▾</span>
          </button>

          {dropdownOpen && (
            <div className="user-dropdown-menu-pic3">
              <div className="profile-center-emblem">
                <div className="user-circle-logo-large">
                  <img src="/vit-emblem.webp" alt="VIT Emblem" className="vit-circle-img" />
                </div>
                <h3 className="profile-dropdown-name">Attendance</h3>
                <p className="profile-dropdown-sub">VIT-IST Admin</p>
              </div>

              <div className="profile-dropdown-action">
                <button
                  type="button"
                  className="btn-signout-purple"
                  onClick={() => {
                    setDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                >
                  Sign out
                </button>
              </div>
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
