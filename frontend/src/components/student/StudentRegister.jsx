/**
 * Student Registration Component
 * Matches the official VIT-IST Institutional Design:
 * - Exact header banner with official VIT & IIC logos
 * - Exact centered white login card (.exact-login-card inside .login-card-body-wrapper)
 * - Exact form inputs (.exact-form-input)
 * - Exact deep-purple button (.exact-btn-signin)
 * - Enforces VIT email (@vitstudent.ac.in) and 9-character Reg No format
 */

import React, { useState } from 'react';
import {
  registerStudent,
  isValidVitRegNo,
  isValidVitStudentEmail,
  normalizeRegNo
} from '../../services/studentAuthService';

export default function StudentRegister({ onRegisterSuccess, onSwitchToLogin, onSwitchToAdmin }) {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  // Live registration number formatter
  const handleRegNoChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/\s+/g, '');
    if (val.length <= 9) {
      setRegNo(val);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    const cleanRegNo = normalizeRegNo(regNo);
    const cleanEmail = email.trim().toLowerCase();

    // Validations
    if (!cleanName) {
      setErrorMessage('Please enter your full name as per VIT records.');
      return;
    }

    if (!isValidVitRegNo(cleanRegNo)) {
      setErrorMessage('Invalid Registration Number. Must be a 9-character VIT registration code (e.g. 24MIS0319, 21BCE1234).');
      return;
    }

    if (!isValidVitStudentEmail(cleanEmail)) {
      setErrorMessage('Registration is strictly restricted to official VIT student email addresses (@vitstudent.ac.in). External emails are rejected.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const { user, profile } = await registerStudent({
        name: cleanName,
        registrationNumber: cleanRegNo,
        email: cleanEmail,
        password
      });

      if (onRegisterSuccess) {
        onRegisterSuccess(user, profile);
      }
    } catch (err) {
      console.error('Registration error:', err);
      let msg = err.message || 'Registration failed.';
      if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
        msg = 'Firebase Authentication is not activated yet for this project. Please go to Firebase Console -> Build -> Authentication -> click "Get Started" and enable "Email/Password" under the Sign-in method tab.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is disabled in Firebase Console. Please go to Authentication -> Sign-in method and enable Email/Password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this VIT student email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use a stronger password with at least 6 characters.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
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
        <div className="exact-login-card" style={{ width: '420px', maxWidth: '92vw' }}>
          <h2 className="login-card-title">Student Registration</h2>

          {errorMessage && (
            <div className="login-error-text">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleRegister} className="login-form-inner">
            {/* Full Name */}
            <div className="login-input-group">
              <input
                type="text"
                className="exact-form-input"
                placeholder="Full Name (as per VIT records)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Registration Number */}
            <div className="login-input-group">
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="exact-form-input"
                  placeholder="VIT Registration Number (e.g. 24MIS0319)"
                  value={regNo}
                  onChange={handleRegNoChange}
                  maxLength={9}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}
                  required
                />
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: regNo.length === 9 ? '#16a34a' : '#9ca3af',
                  fontWeight: regNo.length === 9 ? '700' : '500'
                }}>
                  {regNo.length}/9
                </span>
              </div>
            </div>

            {/* VIT Email */}
            <div className="login-input-group">
              <input
                type="email"
                className="exact-form-input"
                placeholder="VIT Student Email (@vitstudent.ac.in)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="login-input-group">
              <input
                type="password"
                className="exact-form-input"
                placeholder="Password (minimum 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="login-input-group">
              <input
                type="password"
                className="exact-form-input"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit Button */}
            <button type="submit" className="exact-btn-signin" disabled={isLoading}>
              {isLoading ? 'Creating Student Account...' : 'Create Student Account'}
            </button>
          </form>

          {/* Switch to Login */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
              Already registered?
            </p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                color: '#1d4ed8',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Sign In with VIT Student Email
            </button>
          </div>

          {/* Switch back to Admin */}
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
