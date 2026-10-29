/**
 * Exact Institutional Login Screen Component
 * Matches Image 1 from screenshots:
 * - Centered institutional branding (VIT + IIC logos)
 * - Office of Innovation, Startup and Technology Transfer (VIT-IST)
 * - SMART ATTENDANCE SEGREGATOR
 * - White Card with "Login", Username, Password, and "Sign In" button
 */

import React, { useState } from 'react';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    if (
      (username.toLowerCase() === 'admin' && password === 'admin123') ||
      (username.toLowerCase() === 'vit' && password === 'vit2026') ||
      password.length >= 4
    ) {
      const user = {
        username,
        name: username.toUpperCase() === 'ADMIN' ? 'Attendance' : username,
        role: 'Faculty / Administrator',
        loggedInAt: new Date().toISOString()
      };
      sessionStorage.setItem('smart_att_user', JSON.stringify(user));
      onLoginSuccess(user);
    } else {
      setError('Invalid username or password.');
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
                placeholder="Username"
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
        </div>
      </div>
    </div>
  );
}
