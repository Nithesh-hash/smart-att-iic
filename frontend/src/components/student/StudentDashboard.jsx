/**
 * Student OD Dashboard Component
 * Displays student profile, OD statistics cards, searchable/filterable OD history,
 * and enables one-click official PDF export.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  Award,
  Search,
  Filter,
  Download,
  LogOut,
  RefreshCw,
  Building,
  CheckCircle,
  FileText,
  User,
  ArrowUpDown,
  X
} from 'lucide-react';
import {
  getStudentODRecords,
  calculateStudentODStats,
  generateStudentODPdf,
  formatDateDDMMYYYY
} from '../../services/studentOdService';

export default function StudentDashboard({ studentProfile, onLogout, onSwitchToAdmin }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'

  // Load student records
  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await getStudentODRecords(studentProfile?.registrationNumber);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load student OD records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
    const handleUpdate = () => loadRecords();
    window.addEventListener('smart_att_od_records_updated', handleUpdate);
    return () => window.removeEventListener('smart_att_od_records_updated', handleUpdate);
  }, [studentProfile?.registrationNumber]);

  // Overall Statistics calculated from all records
  const overallStats = useMemo(() => {
    return calculateStudentODStats(records);
  }, [records]);

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        r.eventName?.toLowerCase().includes(q) ||
        r.school?.toLowerCase().includes(q) ||
        r.venue?.toLowerCase().includes(q)
      );
    }

    // 2. Month Filter
    if (selectedMonth !== 'all') {
      const monthIdx = parseInt(selectedMonth, 10);
      result = result.filter(r => {
        if (!r.eventDate) return false;
        const d = new Date(r.eventDate);
        return !isNaN(d.getTime()) && (d.getMonth() + 1) === monthIdx;
      });
    }

    // 3. Academic Year Filter (e.g. 2026 for 2026-2027)
    if (selectedYear !== 'all') {
      const yr = parseInt(selectedYear, 10);
      result = result.filter(r => {
        if (!r.eventDate) return false;
        const d = new Date(r.eventDate);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      });
    }

    // 4. Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.eventDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.eventDate || b.createdAt || 0).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [records, searchQuery, selectedMonth, selectedYear, sortBy]);

  const handleDownloadPdf = () => {
    generateStudentODPdf(studentProfile, filteredRecords, overallStats);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMonth('all');
    setSelectedYear('all');
    setSortBy('newest');
  };

  // Distinct Years for dropdown
  const availableYears = useMemo(() => {
    const years = new Set();
    records.forEach(r => {
      if (r.eventDate) {
        const d = new Date(r.eventDate);
        if (!isNaN(d.getTime())) years.add(d.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  return (
    <div className="portal-page-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      {/* Top Navigation & Profile Bar */}
      <header style={{
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 22px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            backgroundColor: '#190059',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <GraduationCap size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#190059', margin: 0 }}>
                {studentProfile?.name || 'VIT Student'}
              </h1>
              <span style={{
                padding: '3px 10px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fontSize: '13px',
                border: '1px solid #bfdbfe'
              }}>
                {studentProfile?.registrationNumber}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
              {studentProfile?.email} • Verified VIT Student Account
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={records.length === 0}
            style={{
              padding: '9px 16px',
              backgroundColor: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: records.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: records.length === 0 ? 0.6 : 1
            }}
            title="Download official PDF OD attendance statement"
          >
            <Download size={15} />
            <span>Download OD Statement (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: '9px 14px',
              backgroundColor: '#fff',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* 4 Statistics KPI Cards (Section 10) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Card 1: Total OD Records */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
              Total OD Records
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>
              {overallStats.totalRecords}
            </div>
          </div>
        </div>

        {/* Card 2: Total Unique OD Dates */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
              Unique OD Dates
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>
              {overallStats.uniqueDatesCount}
            </div>
          </div>
        </div>

        {/* Card 3: Total Events */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            backgroundColor: '#f5f3ff',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
              Total Events
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>
              {overallStats.totalEventsCount}
            </div>
          </div>
        </div>

        {/* Card 4: Upcoming OD Dates */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            backgroundColor: '#fffbeb',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
              Upcoming / Recent
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>
              {overallStats.upcomingDatesCount}
            </div>
          </div>
        </div>
      </div>

      {/* Main OD Records Card */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Card Header & Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#190059', margin: 0 }}>
              On Duty (OD) Attendance Records
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
              Events where your registration number ({studentProfile?.registrationNumber}) was segregated for OD.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRecords}
            style={{
              padding: '7px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#334155'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spinning-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <input
              type="text"
              placeholder="Search by event name, venue, or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="exact-admin-input"
              style={{ width: '100%', paddingRight: '32px' }}
            />
            <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {/* Month Filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="exact-admin-select"
            style={{ flex: '0 0 auto', minWidth: '130px' }}
          >
            <option value="all">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>

          {/* Year Filter */}
          {availableYears.length > 0 && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="exact-admin-select"
              style={{ flex: '0 0 auto', minWidth: '110px' }}
            >
              <option value="all">All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="exact-admin-select"
            style={{ flex: '0 0 auto', minWidth: '130px' }}
          >
            <option value="newest">Newest Date First</option>
            <option value="oldest">Oldest Date First</option>
          </select>

          {/* Clear Filters */}
          {(searchQuery || selectedMonth !== 'all' || selectedYear !== 'all' || sortBy !== 'newest') && (
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                padding: '7px 12px',
                backgroundColor: '#e2e8f0',
                color: '#334155',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Counter */}
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> recorded OD events
        </div>

        {/* OD Records Table */}
        <div className="exact-table-responsive">
          <table className="exact-admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Event Name</th>
                <th style={{ width: '130px' }}>OD Date</th>
                <th style={{ width: '190px' }}>Scheduled OD Timing</th>
                <th style={{ width: '110px' }}>School / Dept</th>
                <th style={{ width: '120px' }}>Venue</th>
                <th style={{ width: '110px', textAlign: 'center' }}>OD Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    <RefreshCw size={22} className="spinning-icon" style={{ margin: '0 auto 8px' }} />
                    <div>Loading your OD records...</div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <Calendar size={24} />
                    </div>
                    <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                      {records.length === 0 ? 'No OD Records Found' : 'No matching records for current filters'}
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
                      {records.length === 0
                        ? `When your registration number (${studentProfile?.registrationNumber}) is processed in event attendance segregation by VIT-IST, your OD records will appear here automatically.`
                        : 'Try clearing your search query or adjusting month/year filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const timingDisplay = rec.odStartTime && rec.odEndTime
                    ? `${rec.odStartTime} – ${rec.odEndTime}`
                    : (rec.odStartTime || 'Timing not available');

                  return (
                    <tr key={rec.id || rec.recordId || idx}>
                      <td style={{ color: '#64748b' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{rec.eventName}</div>
                        {rec.sourceFile && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Source: {rec.sourceFile}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: '#1e293b' }}>
                          {formatDateDDMMYYYY(rec.eventDate)}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '13px' }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>{timingDisplay}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {rec.school || 'SCOPE'}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>
                        {rec.venue || 'Campus'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <CheckCircle size={12} />
                          <span>Processed</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Informative Disclaimer Note */}
        <div style={{ marginTop: '18px', padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
          <strong>Notice:</strong> The presence of your registration number in an event OD record indicates that your attendance was processed and included in official school-wise segregation for the scheduled OD period. For attendance questions, please consult your event faculty coordinator.
        </div>
      </div>
    </div>
  );
}

