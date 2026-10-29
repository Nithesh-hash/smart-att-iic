/**
 * Floating Interactive Developer Badge Component
 * Located at bottom-left per institutional specification.
 * - Clicking rotates the button clockwise and reveals the developer speech-bubble card.
 * - Clicking again rotates anticlockwise back to 0deg and hides the card.
 * - Links to official LinkedIn profile.
 */

import React, { useState, useEffect, useRef } from 'react';

export default function DeveloperBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <div className="dev-badge-floating-root" ref={containerRef}>
      {/* Popover Card (Image 4) */}
      {isOpen && (
        <div className="dev-speech-bubble-card animate-dev-slide-up">
          {/* Top Row: SYSTEM DEVELOPER Pill & Smart Attendance Segregator */}
          <div className="dev-card-top-row">
            <span className="dev-role-pill">SYSTEM DEVELOPER</span>
            <span className="dev-org-title">Smart Attendance Segregator</span>
          </div>

          <div className="dev-card-divider" />

          {/* Bottom Section: Nithesh Kumar T + LinkedIn Link */}
          <div className="dev-card-bottom-section">
            <div className="dev-author-name-row">
              <span className="dev-author-fullname">Nithesh Kumar T</span>
              <a
                href="https://www.linkedin.com/in/nithesh-kumar-t-b4028130a/"
                target="_blank"
                rel="noopener noreferrer"
                className="dev-linkedin-icon-btn"
                title="Connect on LinkedIn"
              >
                <svg
                  className="linkedin-svg-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="24" height="24" rx="4" fill="#0A66C2" />
                  <path
                    d="M7.4 9.1H4.8V17.5H7.4V9.1ZM6.1 5.4C5.3 5.4 4.6 6.1 4.6 6.9C4.6 7.7 5.3 8.4 6.1 8.4C6.9 8.4 7.6 7.7 7.6 6.9C7.6 6.1 6.9 5.4 6.1 5.4Z"
                    fill="white"
                  />
                  <path
                    d="M11.6 9.1H9.1V17.5H11.6V13.1C11.6 10.7 14.7 10.5 14.7 13.1V17.5H17.3V12.1C17.3 8 12.7 8.2 11.6 10.2V9.1Z"
                    fill="white"
                  />
                </svg>
              </a>
            </div>
            <p className="dev-author-role-sub">Lead Developer & Architect</p>
          </div>

          {/* Speech Bubble Arrow pointing towards the button */}
          <div className="dev-bubble-pointer" />
        </div>
      )}

      {/* Floating Button with </> symbol that rotates clockwise on open, anticlockwise on close */}
      <button
        type="button"
        className={`dev-trigger-button ${isOpen ? 'dev-btn-active' : ''}`}
        onClick={toggleOpen}
        title={isOpen ? 'Close Developer Information' : 'Developer Information & Architecture'}
        aria-label="Developer Information"
      >
        <div className={`dev-code-icon-wrapper ${isOpen ? 'dev-rotate-clockwise' : 'dev-rotate-anticlockwise'}`}>
          <svg
            className="dev-bracket-svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
      </button>
    </div>
  );
}
