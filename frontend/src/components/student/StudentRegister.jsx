/**
 * Student Registration Component
 * Enforces:
 * 1. Full Name
 * 2. VIT Registration Number (9-character format, strictly unique)
 * 3. VIT Student Email (@vitstudent.ac.in)
 * 4. Password & Confirm Password
 * 5. Sends Firebase Email Verification
 * 6. Sets initial status to "pending"
 */

import React, { useState } from 'react';
import {
  User,
  Hash,
  Mail,
  Lock,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
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

    // 1. Validations
    if (!cleanName) {
      setErrorMessage('Please enter your full name as registered with VIT.');
      return;
    }

    if (!isValidVitRegNo(cleanRegNo)) {
      setErrorMessage('Invalid Registration Number. Must be a 9-character VIT registration code (e.g. 22MIS0001, 21BCE1234).');
      return;
    }

    if (!isValidVitStudentEmail(cleanEmail)) {
      setErrorMessage('Registration is strictly restricted to official VIT student email addresses ending with @vitstudent.ac.in.');
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

      setSuccessInfo(profile);
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

  if (successInfo) {
    return (
      <div className="login-page-screen">
        <div className="login-header-banner">
          <div className="logos-row-center">
            <img src="/vit-logo.png" alt="VIT Logo" className="official-vit-logo" />
            <img src="/iic-logo.png" alt="IIC Logo" className="official-iic-logo" />
          </div>
          <p className="inst-office-text">Office of Innovation, Startup and Technology Transfer (VIT-IST)</p>
          <h1 className="inst-app-title">STUDENT ON DUTY (OD) TRACKING PORTAL</h1>
        </div>

        <div className="exact-login-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={34} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
            Registration Submitted Successfully!
          </h2>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', textAlign: 'left', marginBottom: '18px' }}>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
              <strong>Student Name:</strong> {successInfo.name}
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
              <strong>Registration No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1d4ed8' }}>{successInfo.registrationNumber}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#475569' }}>
              <strong>VIT Email:</strong> {successInfo.email}
            </div>
          </div>

          <div className="exact-alert-box exact-alert-warning" style={{ textAlign: 'left', marginBottom: '20px', fontSize: '13px' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Two Important Next Steps:</div>
            <ol style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={{ marginBottom: '4px' }}>
                <strong>Verify your Email:</strong> A verification link has been sent to <code>{successInfo.email}</code>. Please check your inbox.
              </li>
              <li>
                <strong>Admin Approval:</strong> Your account is currently awaiting administrative approval by VIT-IST coordinators.
              </li>
            </ol>
          </div>

          <button
            type="button"
            className="exact-login-submit-btn"
            onClick={onSwitchToLogin}
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
          >
            Proceed to Student Login
          </button>
        </div>
      </div>
    );
  }

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

      {/* Registration Card */}
      <div className="exact-login-card" style={{ maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', backgroundColor: '#f5f3ff', color: '#7c3aed', marginBottom: '8px' }}>
            <UserPlus size={26} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#190059' }}>Student Registration</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Register your official VIT student credentials to track your event OD records.
          </p>
        </div>

        {errorMessage && (
          <div className="exact-alert-box exact-alert-error" style={{ marginBottom: '14px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="exact-login-form">
          {/* Full Name */}
          <div className="exact-form-group">
            <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="#64748b" />
              <span>Full Name (as per VIT records)</span>
            </label>
            <input
              type="text"
              className="exact-field-input"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* VIT Registration Number */}
          <div className="exact-form-group">
            <label className="exact-field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hash size={14} color="#64748b" />
                <span>VIT Registration Number (Primary ID)</span>
              </span>
              <span style={{ fontSize: '11px', color: regNo.length === 9 ? '#16a34a' : '#94a3b8' }}>
                {regNo.length}/9 characters
              </span>
            </label>
            <input
              type="text"
              className="exact-field-input"
              placeholder="e.g. 22MIS0001 or 21BCE1234"
              value={regNo}
              onChange={handleRegNoChange}
              style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: '600' }}
              required
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              Used to identify and query your On Duty (OD) records across all events.
            </span>
          </div>

          {/* VIT Student Email */}
          <div className="exact-form-group">
            <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} color="#64748b" />
              <span>VIT Student Email (@vitstudent.ac.in)</span>
            </label>
            <input
              type="email"
              className="exact-field-input"
              placeholder="e.g. jane.doe2022@vitstudent.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              External domains (Gmail, Yahoo, Outlook) are strictly rejected.
            </span>
          </div>

          {/* Password & Confirm Password in two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="exact-form-group">
              <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={13} color="#64748b" />
                <span>Password</span>
              </label>
              <input
                type="password"
                className="exact-field-input"
                placeholder="Min 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="exact-form-group">
              <label className="exact-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={13} color="#64748b" />
                <span>Confirm</span>
              </label>
              <input
                type="password"
                className="exact-field-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="exact-login-submit-btn"
            disabled={isLoading}
            style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="spinning-icon" />
                <span>Submitting Registration...</span>
              </>
            ) : (
              <>
                <span>Create Student Account</span>
                <UserPlus size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
            Already have an approved student account?
          </p>
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Sign in with VIT Student Email
          </button>
        </div>

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

