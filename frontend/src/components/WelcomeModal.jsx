/**
 * Exact Welcome Modal Component
 * Matches Image 2 from screenshots:
 * - WELCOME TO SMART ATTENDANCE SEGREGATOR
 * - Please read this page!
 * - 3 Bullet points
 * - "I Understand" button
 */

import React from 'react';

export default function WelcomeModal({ onConfirm }) {
  return (
    <div className="welcome-modal-backdrop">
      <div className="welcome-modal-card">
        <h2 className="welcome-modal-heading">
          WELCOME TO SMART ATTENDANCE SEGREGATOR
        </h2>
        <h3 className="welcome-modal-subheading">
          Please read this page!
        </h3>

        <ul className="welcome-bullets-list">
          <li>Enter accurate event details.</li>
          <li>For events spanning multiple days, add a slot for each day with its respective date &amp; time.</li>
          <li>Each day of a multiple-day event will require a separate Excel upload during segregation.</li>
        </ul>

        <div className="welcome-btn-center">
          <button
            type="button"
            className="exact-btn-understand"
            onClick={onConfirm}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
