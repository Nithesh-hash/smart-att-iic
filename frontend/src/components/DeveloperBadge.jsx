/**
 * Floating Interactive Developer Badge Component
 * Reveals credits and GitHub / institutional contact links on click.
 */

import React, { useState } from 'react';
import { Code2, GitBranch, Globe, Heart, X, Award } from 'lucide-react';

export default function DeveloperBadge() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="developer-badge-container">
      {isOpen ? (
        <div className="dev-credit-popover">
          <div className="dev-credit-header">
            <div className="dev-badge-title">
              <Award size={18} className="award-icon" />
              <span>Architect & Engineering Credits</span>
            </div>
            <button className="dev-close-btn" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="dev-credit-body">
            <p className="dev-author-tag">
              Developed for <strong>VIT-IST</strong>
            </p>
            <p className="dev-office-desc">
              Office of Innovation, Startup & Technology Transfer
            </p>
            <div className="dev-links-row">
              <a
                href="https://github.com/Nithesh-hash/smart-att-iic"
                target="_blank"
                rel="noreferrer"
                className="dev-link-pill"
              >
                <GitBranch size={14} />
                <span>GitHub Repository</span>
              </a>
              <a
                href="https://smart-att-iic.web.app"
                target="_blank"
                rel="noreferrer"
                className="dev-link-pill"
              >
                <Globe size={14} />
                <span>Live Portal</span>
              </a>
            </div>
            <div className="dev-engine-tag">
              Built with React 19, Vite, ExcelJS, SheetJS & Firebase
            </div>
          </div>
        </div>
      ) : (
        <button
          className="dev-floating-btn"
          onClick={() => setIsOpen(true)}
          title="Developer Information & Credits"
        >
          <Code2 size={20} />
          <span className="dev-btn-label">&lt;/&gt;</span>
        </button>
      )}
    </div>
  );
}
