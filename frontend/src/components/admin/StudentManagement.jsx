/**
 * Admin Sub-Module: Student Management
 * Allows admins to view, search, approve, and reject student registrations.
 * Features tabs for: All, Pending Approvals, Approved, and Rejected.
 * Displays student name, registration number, VIT email, date, verification status, and approval controls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserX,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  Database
} from 'lucide-react';
import {
  getAllStudentsForAdmin,
  updateStudentApprovalStatus
} from '../../services/studentAuthService';
import { formatDateDDMMYYYY } from '../../services/studentOdService';
import { getDb } from '../../firebase/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [totalODRecordsCount, setTotalODRecordsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Load students and OD count
  const loadData = async () => {
    setIsLoading(true);
    try {
      const studentList = await getAllStudentsForAdmin();
      setStudents(studentList);

      // Query total OD records count
      const db = getDb();
      if (db) {
        try {
          const odSnap = await getDocs(collection(db, 'student_od_records'));
          setTotalODRecordsCount(odSnap.size);
        } catch (e) {
          // Fallback from cache
          try {
            const raw = localStorage.getItem('smart_att_od_records_store');
            if (raw) setTotalODRecordsCount(JSON.parse(raw).length);
          } catch (err) {}
        }
      }
    } catch (err) {
      console.error('Failed to load student management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('smart_att_od_records_updated', handleUpdate);
    return () => window.removeEventListener('smart_att_od_records_updated', handleUpdate);
  }, []);

  // Handle Approve
  const handleApprove = async (student) => {
    setActionInProgress(student.id || student.uid);
    try {
      await updateStudentApprovalStatus(student.id || student.uid, 'approved');
      setStudents(prev => prev.map(s => (s.id === student.id || s.uid === student.uid) ? { ...s, approvalStatus: 'approved', approvedAt: new Date().toISOString() } : s));
      setStatusMessage({ type: 'success', text: `Approved student ${student.name} (${student.registrationNumber}) successfully.` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Approval error:', err);
      setStatusMessage({ type: 'error', text: `Failed to approve student: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Reject
  const handleReject = async (student) => {
    const reason = window.prompt(`Enter rejection reason for ${student.name} (optional):`, 'Invalid student credentials or unregistered registration number.') || 'Registration rejected by administrator.';
    setActionInProgress(student.id || student.uid);
    try {
      await updateStudentApprovalStatus(student.id || student.uid, 'rejected', reason);
      setStudents(prev => prev.map(s => (s.id === student.id || s.uid === student.uid) ? { ...s, approvalStatus: 'rejected', rejectionReason: reason } : s));
      setStatusMessage({ type: 'warning', text: `Rejected student ${student.name} (${student.registrationNumber}).` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Rejection error:', err);
      setStatusMessage({ type: 'error', text: `Failed to reject student: ${err.message}` });
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtered and searched list
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Status Filter
      if (activeFilter === 'pending' && student.approvalStatus !== 'pending') return false;
      if (activeFilter === 'approved' && student.approvalStatus !== 'approved') return false;
      if (activeFilter === 'rejected' && student.approvalStatus !== 'rejected') return false;

      // 2. Search Query (Reg No, Name, VIT Email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const regMatch = student.registrationNumber?.toLowerCase().includes(q);
        const nameMatch = student.name?.toLowerCase().includes(q);
        const emailMatch = student.email?.toLowerCase().includes(q);
        return regMatch || nameMatch || emailMatch;
      }

      return true;
    });
  }, [students, activeFilter, searchQuery]);

  // Statistics
  const pendingCount = students.filter(s => s.approvalStatus === 'pending').length;
  const approvedCount = students.filter(s => s.approvalStatus === 'approved').length;
  const rejectedCount = students.filter(s => s.approvalStatus === 'rejected').length;

  return (
    <div className="exact-admin-student-management">
      {/* Top Notification */}
      {statusMessage && (
        <div className={`exact-alert-box exact-alert-${statusMessage.type}`} style={{ marginBottom: '16px' }}>
          {statusMessage.text}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="exact-admin-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Total Students</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{students.length}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: pendingCount > 0 ? '1px solid #fde68a' : '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#d97706', textTransform: 'uppercase' }}>Pending Approvals</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: pendingCount > 0 ? '#b45309' : '#0f172a' }}>
              {pendingCount}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a', textTransform: 'uppercase' }}>Approved Accounts</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{approvedCount}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
            <Database size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7c3aed', textTransform: 'uppercase' }}>Total OD Records</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{totalODRecordsCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="exact-admin-filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        {/* Status Pill Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: activeFilter === 'all' ? '1px solid #190059' : '1px solid #e2e8f0',
              backgroundColor: activeFilter === 'all' ? '#190059' : '#fff',
              color: activeFilter === 'all' ? '#fff' : '#475569'
            }}
          >
            All Students ({students.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: activeFilter === 'pending' ? '1px solid #d97706' : '1px solid #e2e8f0',
              backgroundColor: activeFilter === 'pending' ? '#d97706' : '#fff',
              color: activeFilter === 'pending' ? '#fff' : '#b45309'
            }}
          >
            Pending Approvals ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('approved')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: activeFilter === 'approved' ? '1px solid #16a34a' : '1px solid #e2e8f0',
              backgroundColor: activeFilter === 'approved' ? '#16a34a' : '#fff',
              color: activeFilter === 'approved' ? '#fff' : '#15803d'
            }}
          >
            Approved ({approvedCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('rejected')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              border: activeFilter === 'rejected' ? '1px solid #dc2626' : '1px solid #e2e8f0',
              backgroundColor: activeFilter === 'rejected' ? '#dc2626' : '#fff',
              color: activeFilter === 'rejected' ? '#fff' : '#b91c1c'
            }}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search Reg No, Name, or VIT Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="exact-admin-input"
              style={{ width: '280px', paddingRight: '32px' }}
            />
            <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          <button
            type="button"
            onClick={loadData}
            title="Refresh student list"
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spinning-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Showing counter */}
      <div className="exact-showing-count" style={{ marginBottom: '10px' }}>
        Showing {filteredStudents.length > 0 ? `1–${filteredStudents.length}` : '0'} of {filteredStudents.length} student registrations
      </div>

      {/* Students Table */}
      <div className="exact-table-responsive">
        <table className="exact-admin-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Student Name</th>
              <th>Registration No.</th>
              <th>VIT Email Address</th>
              <th>Registered On</th>
              <th>Email Verification</th>
              <th>Approval Status</th>
              <th style={{ width: '160px', textAlign: 'center' }}>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  <RefreshCw size={20} className="spinning-icon" style={{ margin: '0 auto 8px' }} />
                  <div>Loading student registrations...</div>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  No student registrations found matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => {
                const isPending = student.approvalStatus === 'pending';
                const isApproved = student.approvalStatus === 'approved';
                const isRejected = student.approvalStatus === 'rejected';
                const isEmailVerified = Boolean(student.emailVerified);

                return (
                  <tr key={student.id || student.uid || idx}>
                    <td style={{ color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{student.name}</span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {student.registrationNumber}
                      </span>
                    </td>
                    <td style={{ color: '#475569', fontSize: '13px' }}>{student.email}</td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>
                      {formatDateDDMMYYYY(student.createdAt ? student.createdAt.split('T')[0] : '')}
                    </td>
                    <td>
                      {isEmailVerified ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '12px', fontWeight: '500' }}>
                          <CheckCircle size={14} /> Verified
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '12px', fontWeight: '500' }}>
                          <Clock size={14} /> Unverified
                        </span>
                      )}
                    </td>
                    <td>
                      {isApproved && (
                        <span style={{ padding: '3px 8px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                          Approved
                        </span>
                      )}
                      {isPending && (
                        <span style={{ padding: '3px 8px', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                          Pending Approval
                        </span>
                      )}
                      {isRejected && (
                        <span style={{ padding: '3px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }} title={student.rejectionReason || 'Rejected'}>
                          Rejected
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApprove(student)}
                            disabled={actionInProgress === (student.id || student.uid)}
                            title="Approve student for OD access"
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '5px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <UserCheck size={13} />
                            <span>Approve</span>
                          </button>
                        )}

                        {!isRejected && (
                          <button
                            type="button"
                            onClick={() => handleReject(student)}
                            disabled={actionInProgress === (student.id || student.uid)}
                            title="Reject student account"
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '5px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <UserX size={13} />
                            <span>Reject</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
