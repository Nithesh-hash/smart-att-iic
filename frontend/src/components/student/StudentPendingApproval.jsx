/**
 * Student Pending Approval & Email Verification Status Screen
 * Displays pending approval notice and email verification alerts.
 * Blocks access to the OD Dashboard until both email is verified and admin has approved.
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  ArrowLeft,
  ShieldAlert,
  Send
} from 'lucide-react';
import {
  resendStudentVerificationEmail,
  fetchCurrentStudentProfile,
  logoutStudent,
  getStudentAuth
} from '../../services/studentAuthService';

export default function StudentPendingApproval({ studentProfile, onStatusResolved, onLogout, onSwitchToAdmin }) {
  const [profile, setProfile] = useState(studentProfile);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);
  const [isResending, setIsResending] = useState(false);

  // Poll or check status
  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      const auth = getStudentAuth();
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }

      const updated = await fetchCurrentStudentProfile(profile?.uid);
      if (updated) {
        if (auth.currentUser) {
          updated.emailVerified = Boolean(auth.currentUser.emailVerified || updated.emailVerified);
        }
        setProfile(updated);

        // If approved and verified, resolve to dashboard!
        if (updated.approvalStatus === 'approved' && updated.emailVerified) {
          if (onStatusResolved) {
            onStatusResolved(updated);
          }
        }
      }
    } catch (err) {
      console.warn('Status check warning:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Check status on mount and every 10 seconds
    checkStatus();
    const timer = setInterval(checkStatus, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleResendEmail = async () => {
    setIsResending(true);
    setResendStatus(null);
    try {
      await resendStudentVerificationEmail();
      setResendStatus({ type: 'success', text: `Verification link resent to ${profile?.email}. Please check your inbox and spam folder.` });
      setTimeout(() => setResendStatus(null), 5000);
    } catch (err) {
      setResendStatus({ type: 'error', text: err.message || 'Could not resend email.' });
    } finally {
      setIsResending(false);
    }
  };

  const isEmailVerified = Boolean(profile?.emailVerified);
  const isApproved = profile?.approvalStatus === 'approved';
  const isRejected = profile?.approvalStatus === 'rejected';

  return (
    <div className="login-page-screen">
      {/* Top Header Banner */}
      <div className="login-header-banner">
        <div className="logos-row-center">
          <img src="/vit-logo.png" alt="VIT Logo" className="official-vit-logo" />
          <img src="/iic-logo.png" alt="IIC Logo" className="official-iic-logo" />
        </div>
        <p className="inst-office-text">Office of Innovation, Startup and Technology Transfer (VIT-IST)</p>
        <h1 className="inst-app-title">STUDENT ON DUTY (OD) TRACKING PORTAL</h1>
      </div>

      <div className="exact-login-card" style={{ maxWidth: '520px' }}>
        {/* Student Credential Header */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{profile?.name}</span>
            <span style={{
              padding: '3px 8px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              fontSize: '12px'
            }}>
              {profile?.registrationNumber}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            VIT Student Email: <strong>{profile?.email}</strong>
          </div>
        </div>

        {/* Step 1: Email Verification Status */}
        <div style={{
          backgroundColor: isEmailVerified ? '#f0fdf4' : '#fffbeb',
          border: isEmailVerified ? '1px solid #bbf7d0' : '1px solid #fde68a',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <div style={{ color: isEmailVerified ? '#16a34a' : '#d97706', marginTop: '2px' }}>
            {isEmailVerified ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: isEmailVerified ? '#166534' : '#92400e', marginBottom: '4px' }}>
              Step 1: VIT Email Verification {isEmailVerified ? '— Completed ✅' : '— Pending'}
            </div>
            {isEmailVerified ? (
              <p style={{ fontSize: '12px', color: '#15803d', margin: 0 }}>
                Your official VIT student email address has been verified successfully.
              </p>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: '#b45309', marginBottom: '8px' }}>
                  A verification link was sent to <strong>{profile?.email}</strong>. You must verify your email before entering the OD portal.
                </p>
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#fff',
                    border: '1px solid #f59e0b',
                    color: '#b45309',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Send size={12} />
                  <span>{isResending ? 'Sending...' : 'Resend Verification Email'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {resendStatus && (
          <div className={`exact-alert-box exact-alert-${resendStatus.type}`} style={{ marginBottom: '14px', fontSize: '12px' }}>
            {resendStatus.text}
          </div>
        )}

        {/* Step 2: Administrative Approval Status */}
        <div style={{
          backgroundColor: isApproved ? '#f0fdf4' : (isRejected ? '#fef2f2' : '#f8fafc'),
          border: isApproved ? '1px solid #bbf7d0' : (isRejected ? '1px solid #fecaca' : '1px solid #e2e8f0'),
          borderRadius: '8px',
          padding: '14px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <div style={{ color: isApproved ? '#16a34a' : (isRejected ? '#dc2626' : '#64748b'), marginTop: '2px' }}>
            {isApproved ? <CheckCircle2 size={20} /> : (isRejected ? <XCircle size={20} /> : <Clock size={20} />)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: isApproved ? '#166534' : (isRejected ? '#991b1b' : '#1e293b'), marginBottom: '4px' }}>
              Step 2: Admin Approval {isApproved ? '— Approved ✅' : (isRejected ? '— Rejected ❌' : '— In Review ⏳')}
            </div>
            {isApproved ? (
              <p style={{ fontSize: '12px', color: '#15803d', margin: 0 }}>
                Your student account has been approved by the administration.
              </p>
            ) : isRejected ? (
              <div>
                <p style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '4px' }}>
                  Your student registration was rejected by the administrator.
                </p>
                {profile?.rejectionReason && (
                  <p style={{ fontSize: '12px', color: '#7f1d1d', fontStyle: 'italic', margin: 0 }}>
                    Reason: "{profile.rejectionReason}"
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                Your registration has been submitted successfully. Your account is awaiting admin approval by VIT-IST coordinators.
              </p>
            )}
          </div>
        </div>

        {/* Check Status Button */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={checkStatus}
            disabled={isRefreshing}
            style={{
              flex: 1,
              padding: '10px 16px',
              backgroundColor: '#190059',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinning-icon' : ''} />
            <span>Check Approval Status Again</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: '10px 16px',
              backgroundColor: '#fff',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Switch to Admin */}
        <div style={{ textAlign: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
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

