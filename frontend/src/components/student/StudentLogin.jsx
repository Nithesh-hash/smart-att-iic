/**
 * Exact Institutional Student Login Screen
 * Matches Image 3 & LoginModal.jsx:
 * - Institutional branding (VIT + IIC logos)
 * - Office of Innovation, Startup and Technology Transfer (VIT-IST)
 * - SMART ATTENDANCE SEGREGATOR
 * - Centered White Card with "Student Login", Inputs, and Deep Purple "Sign In" button
 */

import React, { useState } from 'react';
import {
  loginStudent,
  isValidVitStudentEmail,
  sendStudentPasswordReset
} from '../../services/studentAuthService';

export default function StudentLogin({ onLoginSuccess, onSwitchToRegister, onSwitchToAdmin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setResetMessage('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      setErrorMessage('Please enter both VIT student email and password.');
      return;
    }

    if (!isValidVitStudentEmail(cleanEmail)) {
      setErrorMessage('Access is restricted to official VIT student email addresses (@vitstudent.ac.in).');
      return;
    }

    setIsLoading(true);
    try {
      const { user, profile } = await loginStudent({ email: cleanEmail, password });
      onLoginSuccess(user, profile);
    } catch (err) {
      console.error('Student login error:', err);
      let userFriendlyMsg = err.message || 'Login failed. Please check your credentials.';
      if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
        userFriendlyMsg = 'Firebase Authentication is not activated yet for this project. Please go to Firebase Console -> Build -> Authentication -> click "Get Started" and enable "Email/Password" under the Sign-in method tab.';
      } else if (err.code === 'auth/operation-not-allowed') {
        userFriendlyMsg = 'Email/Password sign-in is disabled in Firebase Console. Please go to Authentication -> Sign-in method and enable Email/Password.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userFriendlyMsg = 'Invalid VIT student email or password. Please verify and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMsg = 'Too many failed login attempts. Please reset your password or try again later.';
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setResetMessage('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your VIT student email address above first to reset your password.');
      return;
    }

    if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
      setErrorMessage('Password reset is only available for @vitstudent.ac.in email addresses.');
      return;
    }

    setIsResetting(true);
    try {
      await sendStudentPasswordReset(cleanEmail);
      setResetMessage(`Password reset link sent to ${cleanEmail}. Please check your VIT student inbox.`);
    } catch (err) {
      setErrorMessage(err.message || 'Could not send password reset email.');
    } finally {
      setIsResetting(false);
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
          <h2 className="login-card-title">Student Login</h2>

          {errorMessage && (
            <div className="login-error-text">
              {errorMessage}
            </div>
          )}

          {resetMessage && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form-inner">
            <div className="login-input-group">
              <input
                type="email"
                className="exact-form-input"
                placeholder="VIT Student Email (@vitstudent.ac.in)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="login-input-group">
              <input
                type="password"
                className="exact-form-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {isResetting ? 'Sending link...' : 'Forgot password?'}
              </button>
            </div>

            <button type="submit" className="exact-btn-signin" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* New student register pill */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
              Are you a new student user?
            </p>
            <button
              type="button"
              onClick={onSwitchToRegister}
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
              <span>Register New Student Account →</span>
            </button>
          </div>

          {/* Switch back to Admin Portal */}
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onSwitchToAdmin}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ← Switch to Staff & Admin Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
