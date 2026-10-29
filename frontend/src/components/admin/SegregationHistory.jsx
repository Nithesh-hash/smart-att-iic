/**
 * Admin Sub-Module 2: Segregation History & Audit Trail
 * Tracks all quick and batch segregation executions, total student volumes,
 * involved schools, and downloadable ZIP archives.
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Trash2,
  Calendar,
  Users,
  FileSpreadsheet,
  Archive,
  AlertCircle
} from 'lucide-react';
import { getSegregationHistory, deleteSegregationHistory } from '../../services/dataService';

export default function SegregationHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await getSegregationHistory();
      setHistoryList(list);
    } catch (err) {
      console.error('Failed to load segregation history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = historyList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = item.runTitle?.toLowerCase().includes(q);
    const rangeMatch = item.dateRange?.toLowerCase().includes(q);
    const zipMatch = item.zipName?.toLowerCase().includes(q);
    return titleMatch || rangeMatch || zipMatch;
  });

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteSegregationHistory(deleteCandidate.id);
      setHistoryList(prev => prev.filter(h => h.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      console.error('Failed to delete history record:', err);
    }
  };

  return (
    <div className="admin-history-container">
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search audit trail by run title, date range, or zip archive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="history-summary-count">
          <span>{filteredHistory.length} Recorded Runs</span>
        </div>
      </div>

      <div className="table-responsive-wrapper mt-4">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Run Title / Description</th>
              <th>Date Range Covered</th>
              <th>Events</th>
              <th>Total Students</th>
              <th>Schools</th>
              <th>Files Parsed</th>
              <th>Generated ZIP Archive</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <tr key={item.id}>
                  <td className="cell-timestamp">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent'}
                  </td>
                  <td>
                    <div className="history-title-cell">
                      <History size={16} className="history-icon-sub" />
                      <strong>{item.runTitle || 'Attendance Segregation Run'}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="history-daterange">{item.dateRange || 'N/A'}</span>
                  </td>
                  <td className="cell-num">{item.eventsProcessed || 1}</td>
                  <td className="cell-num highlight-green font-bold">
                    {item.totalStudents || 0}
                  </td>
                  <td className="cell-num">{item.schoolsRepresented || 'Multiple'}</td>
                  <td className="cell-num">{item.filesCount || 1}</td>
                  <td>
                    <span className="zip-file-tag">
                      <Archive size={12} /> {item.zipName || 'all_schools.zip'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-action-delete"
                      onClick={() => setDeleteCandidate(item)}
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="table-empty-row">
                  {isLoading ? 'Loading audit trail...' : 'No segregation history records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-small">
            <div className="modal-header">
              <div className="modal-title-group">
                <AlertCircle size={24} className="modal-icon-danger" />
                <div>
                  <h3 className="modal-title">Delete Audit Record</h3>
                  <p className="modal-desc">
                    Are you sure you want to remove this segregation audit record?
                  </p>
                </div>
              </div>
            </div>

            <div className="delete-target-preview">
              <strong>{deleteCandidate.runTitle}</strong>
              <span>{deleteCandidate.dateRange} • {deleteCandidate.totalStudents} students</span>
            </div>

            <div className="modal-footer-dual">
              <button
                className="btn-modal-cancel"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </button>
              <button
                className="btn-modal-delete-danger"
                onClick={handleDelete}
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

