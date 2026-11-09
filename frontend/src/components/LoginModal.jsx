/**
 * Exact Institutional Login Screen Component
 * Matches Image 1 from screenshots:
 * - Centered institutional branding (VIT + IIC logos)
 * - Office of Innovation, Startup and Technology Transfer (VIT-IST)
 * - SMART ATTENDANCE SEGREGATOR
 * - White Card with "Login", Username, Password, and "Sign In" button
 */

import React, { useState } from 'react';

export default function LoginModal({ onLoginSuccess, onSwitchToStudent }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedInput = username.trim();
    if (!trimmedInput || !password.trim()) {
      setError('Please enter both username/email and password.');
      return;
    }

    const validUsername = (import.meta.env.VITE_AUTH_USERNAME || 'Attendance').trim();
    const validPassword = import.meta.env.VITE_AUTH_PASSWORD || 'SPM@123';

    const validEmail2 = (import.meta.env.VITE_AUTH_EMAIL_2 || 'prasanth.b@vit.ac.in').trim();
    let validPassword2 = import.meta.env.VITE_AUTH_PASSWORD_2 || 'Nov@#7898';
    if (validPassword2 === 'Nov@' || !validPassword2) {
      validPassword2 = 'Nov@#7898';
    }

    if (trimmedInput.toLowerCase() === validUsername.toLowerCase() && password === validPassword) {
      const user = {
        username: validUsername,
        name: 'Attendance',
        email: 'attendance@vit.ac.in',
        role: 'VIT-IST Admin',
        loggedInAt: new Date().toISOString()
      };
      sessionStorage.setItem('smart_att_user', JSON.stringify(user));
      onLoginSuccess(user);
    } else if (trimmedInput.toLowerCase() === validEmail2.toLowerCase() && password === validPassword2) {
      const user = {
        username: validEmail2,
        name: 'prasanth.b@vit.ac.in',
        email: validEmail2,
        role: 'VIT-IST Admin',
        loggedInAt: new Date().toISOString()
      };
      sessionStorage.setItem('smart_att_user', JSON.stringify(user));
      onLoginSuccess(user);
    } else {
      setError('Invalid username/email or password.');
    }
  };

  return (
    <div className="login-page-screen">
      {/* Top Institutional Header Banner (Image 3) */}
      <div className="login-header-banner">
        <div className="logos-row-center">
          <img src="/vit-logo.png" alt="VIT Logo" className="official-vit-logo" />
          <img src="/iic-logo.png" alt="IIC Logo" className="official-iic-logo" />
        </div>
        <p className="inst-office-text">
          Office of Innovation, Startup and Technology Transfer (VIT-IST)
        </p>
        <h1 className="inst-main-title">
          SMART ATTENDANCE SEGREGATOR
        </h1>
      </div>

      {/* Centered Login Card Body (Image 3) */}
      <div className="login-card-body-wrapper">
        <div className="exact-login-card">
          <h2 className="login-card-title">Login</h2>

          {error && (
            <div className="login-error-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form-inner">
            <div className="login-input-group">
              <input
                type="text"
                className="exact-form-input"
                placeholder="Username / Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="login-input-group">
              <input
                type="password"
                className="exact-form-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="exact-btn-signin">
              Sign In
            </button>
          </form>

          {/* Student OD Portal Quick Access Pill */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
              Are you a VIT student looking for your On Duty (OD) status?
            </p>
            <button
              type="button"
              onClick={onSwitchToStudent}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                color: '#1d4ed8',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🎓</span>
              <span>Go to Student OD Tracking Portal →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
