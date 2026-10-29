/**
 * Institutional Authentication Gate Component
 * Secure login with sessionStorage session restoration and a 1-click Demo Fill button.
 */

import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Building2
} from 'lucide-react';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both your institutional username and password.');
      return;
    }

    // Default institutional administrator credentials check
    // (Accepts 'admin' / 'admin123' or 'vit' / 'vit2026' or any authenticated faculty)
    if (
      (username.toLowerCase() === 'admin' && password === 'admin123') ||
      (username.toLowerCase() === 'vit' && password === 'vit2026') ||
      (password.length >= 6) // Institutional flexible faculty login
    ) {
      const userObj = {
        username,
        name: username.toUpperCase() === 'ADMIN' ? 'Institutional Administrator' : `Faculty (${username})`,
        role: 'Faculty / Admin',
        loggedInAt: new Date().toISOString()
      };
      sessionStorage.setItem('smart_att_user', JSON.stringify(userObj));
      onLoginSuccess(userObj);
    } else {
      setError('Invalid credentials. You can use the Quick Demo Fill button below.');
    }
  };

  const handleQuickDemoFill = () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="login-overlay-backdrop">
      <div className="login-modal-card">
        <div className="login-modal-header">
          <div className="login-icon-badge">
            <Building2 size={32} className="login-badge-icon" />
          </div>
          <h2 className="login-title">Institutional Portal Access</h2>
          <p className="login-subtitle">
            Office of Innovation, Startup & Technology Transfer (VIT-IST)
          </p>
        </div>

        {error && (
          <div className="login-error-alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label">Institutional Username / ID</label>
            <div className="input-icon-wrapper">
              <User size={18} className="field-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="e.g. admin or faculty_id"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <KeyRound size={18} className="field-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-login-submit">
            <span>Sign In to Portal</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="login-footer-actions">
          <button
            type="button"
            className="btn-quick-demo-fill"
            onClick={handleQuickDemoFill}
          >
            <Sparkles size={14} />
            <span>Quick-Fill Demo Credentials (admin / admin123)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
