/**
 * Student Login Component
 * Strictly authenticates VIT students via @vitstudent.ac.in credentials.
 */

import React, { useState } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, AlertCircle, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { loginStudent, sendStudentPasswordReset } from '../../services/studentAuthService';

export default function StudentLogin({ onLoginSuccess, onSwitchToRegister, onSwitchToAdmin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setResetMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password.trim()) {
      setErrorMessage('Please enter both your VIT student email and password.');
      return;
    }

    if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
      setErrorMessage('Access restricted to official VIT student email addresses (@vitstudent.ac.in). External emails are rejected.');
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
      {/* Top Header Banner */}
      <div className="login-header-banner">
        <div className="logos-row-center">
          <img src="/vit-logo.png" alt="VIT Logo" className="official-vit-logo" />
          <img src="/iic-logo.png" alt="IIC Logo" className="official-iic-logo" />
        </div>
        <p className="inst-office-text">
          Office of Innovation, Startup and Technology Transfer (VIT-IST)
        </p>
        <h1 className="inst-app-title">
          STUDENT ON DUTY (OD) TRACKING PORTAL
        </h1>
      </div>

      {/* Login Card */}
      <div className="exact-login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#1d4ed8', marginBottom: '8px' }}>
            <LogIn size={26} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#190059' }}>Student Sign In</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Access verified On Duty (OD) attendance records with your VIT student account.
          </p>
        </div>

        {errorMessage && (
          <div className="exact-alert-box exact-alert-error" style={{ marginBottom: '14px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {resetMessage && (
          <div className="exact-alert-box exact-alert-success" style={{ marginBottom: '14px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{resetMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="exact-login-form">
          <div className="exact-form-group">
            <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} color="#64748b" />
              <span>VIT Student Email (@vitstudent.ac.in)</span>
            </label>
            <input
              type="email"
              className="exact-field-input"
              placeholder="e.g. firstname.lastname2022@vitstudent.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="exact-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Lock size={14} color="#64748b" />
                <span>Password</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '500', cursor: 'pointer', padding: 0 }}
              >
                {isResetting ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
            <input
              type="password"
              className="exact-field-input"
              placeholder="Enter your student portal password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="exact-login-submit-btn"
            disabled={isLoading}
            style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="spinning-icon" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Student Portal</span>
                <LogIn size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
            New student user?
          </p>
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#1e293b',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Create New Student Account
          </button>
        </div>

        {/* Switch back to Admin Portal */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onSwitchToAdmin}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={13} />
            <span>Switch to Staff & Admin Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
}

