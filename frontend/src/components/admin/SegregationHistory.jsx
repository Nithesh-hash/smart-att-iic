/**
 * Admin Sub-Module 2: Segregation History & Audit Trail
 * Matches exact UI from Screenshot (media_1793273697872_e5c99bac.png):
 * - Search bar: [ Search event name / venue ]
 * - Date Range: [ dd-mm-yyyy ] to [ dd-mm-yyyy ]
 * - Dropdown: [ Newest First ▾ ]
 * - Button: [ Clear ] (gray button)
 * - Subtitle: Showing 1–X of X records
 * - Table Columns:
 *   # | Event Date(s) | Events Segregated | Faculty Coordinator (School | Phone) | Count | Segregated On | Download | Action
 * - Bottom Pagination: Square purple button [ 1 ]
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { getSegregationHistory, deleteSegregationHistory } from '../../services/dataService';

// Format YYYY-MM-DD to DD-MM-YYYY
function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Format ISO string to DD-MM-YYYY hh:mm A
function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  if (/^\d{2}-\d{2}-\d{4}/.test(isoStr)) return isoStr;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
}

export default function SegregationHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Deletion candidate
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await getSegregationHistory();
      setHistoryList(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClear = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setSortBy('newest');
  };

  const filteredHistory = useMemo(() => {
    let result = [...historyList];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const eventsMatch = item.eventsSegregated?.toLowerCase().includes(q);
        const coordMatch = item.coordinatorFormatted?.toLowerCase().includes(q);
        const zipMatch = item.zipName?.toLowerCase().includes(q);
        const titleMatch = item.runTitle?.toLowerCase().includes(q);
        return eventsMatch || coordMatch || zipMatch || titleMatch;
      });
    }

    // Date range filter
    if (fromDate) {
      result = result.filter(item => {
        const d = item.eventDates || item.timestamp;
        return d && d >= fromDate;
      });
    }
    if (toDate) {
      result = result.filter(item => {
        const d = item.eventDates || item.timestamp;
        return d && d <= toDate;
      });
    }

    // Sorting
    result.sort((a, b) => {
      const timeA = a.timestamp || a.segregatedOn || '';
      const timeB = b.timestamp || b.segregatedOn || '';
      if (sortBy === 'newest') return timeB.localeCompare(timeA);
      if (sortBy === 'oldest') return timeA.localeCompare(timeB);
      return 0;
    });

    return result;
  }, [historyList, searchQuery, fromDate, toDate, sortBy]);

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteSegregationHistory(deleteCandidate.id);
      setHistoryList(prev => prev.filter(h => h.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      console.error('Failed to delete history record:', err);
    }
  };

  const handleDownloadZip = (item) => {
    // If there is cached blob or url
    if (item.downloadUrl) {
      const a = document.createElement('a');
      a.href = item.downloadUrl;
      a.download = item.zipName || 'all_schools.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Fallback: create mock or notify
    alert(`Downloading archive: ${item.zipName || 'all_schools.zip'}`);
  };

  return (
    <div className="exact-admin-history-tab">
      {/* Exact Filter Row from Screenshot */}
      <div className="exact-admin-filter-bar">
        {/* Search input */}
        <input
          type="text"
          className="exact-admin-input search-input"
          placeholder="Search event name / venue"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Date range pickers */}
        <div className="exact-admin-date-range">
          <input
            type="date"
            className="exact-admin-input date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span className="exact-to-sep">to</span>
          <input
            type="date"
            className="exact-admin-input date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* Sort dropdown */}
        <select
          className="exact-admin-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        {/* Clear button */}
        <button
          type="button"
          className="exact-btn-clear"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>

      {/* Subtitle counter matching Screenshot: Showing 1–1 of 1 records */}
      <div className="exact-showing-count">
        Showing {filteredHistory.length > 0 ? `1–${filteredHistory.length}` : '0'} of {filteredHistory.length} records
      </div>

      {/* History Table */}
      <div className="exact-table-responsive">
        <table className="exact-admin-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>#</th>
              <th>Event Date(s)</th>
              <th>Events Segregated</th>
              <th>Faculty Coordinator (School | Phone)</th>
              <th style={{ width: '60px' }}>Count</th>
              <th>Segregated On</th>
              <th>Download</th>
              <th style={{ width: '90px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, idx) => {
                const eventDatesDisplay = formatDateDDMMYYYY(item.eventDates || item.dateRange);
                const segregatedOnDisplay = item.segregatedOn || formatTimestamp(item.timestamp);
                const zipFileName = item.zipName || 'all_schools.zip';

                // Format events segregated with bullet points if multiline
                const eventsText = item.eventsSegregated || item.runTitle || '• Attendance Segregation';
                const eventLines = eventsText.split('\n');

                return (
                  <tr key={item.id || idx}>
                    <td className="cell-row-num">{idx + 1}</td>
                    <td className="cell-event-date">{eventDatesDisplay}</td>
                    <td className="cell-events-segregated">
                      {eventLines.map((line, lIdx) => (
                        <div key={lIdx} className="events-segregated-bullet-line">
                          {line.startsWith('•') ? line : `• ${line}`}
                        </div>
                      ))}
                    </td>
                    <td className="cell-coord-school">
                      {item.coordinatorFormatted || 'Faculty Admin (VIT)'}
                    </td>
                    <td className="cell-count text-center">
                      {item.count || 1}
                    </td>
                    <td className="cell-segregated-on">
                      {segregatedOnDisplay}
                    </td>
                    <td className="cell-download-zip">
                      <button
                        type="button"
                        className="exact-zip-link-btn"
                        onClick={() => handleDownloadZip(item)}
                        title="Download ZIP Archive"
                      >
                        <span className="pkg-emoji">📦</span>
                        <span className="zip-text-underline">{zipFileName}</span>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="exact-btn-delete-red"
                        onClick={() => setDeleteCandidate(item)}
                        title="Delete Record"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="exact-table-empty">
                  {isLoading ? 'Loading records...' : 'No segregation records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination at bottom: square button [ 1 ] matching Screenshot */}
      <div className="exact-admin-pagination-row">
        <button
          type="button"
          className="exact-page-square-btn"
          onClick={() => setCurrentPage(1)}
        >
          1
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-small">
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#b91c1c' }}>Confirm Record Deletion</h3>
              <p className="modal-desc" style={{ marginTop: '8px' }}>
                Are you sure you want to delete the audit record for <strong>{deleteCandidate.zipName || 'this run'}</strong>?
              </p>
            </div>
            <div className="modal-footer-dual" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="exact-btn-clear"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="exact-btn-delete-red"
                style={{ padding: '8px 18px', fontSize: '13px' }}
                onClick={handleDeleteConfirm}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
