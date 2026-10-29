/**
 * Admin Sub-Module 1: Events Management Table
 * Matches exact UI from Screenshot (media_1793273808909_e4365f8f.png):
 * - Search bar: [ Search event name / venue ]
 * - Date Range: [ dd-mm-yyyy ] to [ dd-mm-yyyy ]
 * - Dropdown: [ All Event Types ▾ ]
 * - Dropdown: [ Newest First ▾ ]
 * - Button: [ Clear ] (gray button)
 * - Subtitle: Showing 1–X of X events
 * - Table Columns:
 *   # | Event Name | Faculty Coordinator | School | Phone Number | Event Type (pill) | Day Type | Date, Venue & Time (with 📍 pin) | Action ([ 🗑️ Delete ])
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { getEvents, deleteEvent, EVENT_TYPES } from '../../services/dataService';

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

export default function EventsManagement() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters matching screenshot
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name

  // Delete modal candidate
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const list = await getEvents();
      setEvents(list);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const handleEventsChanged = () => loadEvents();
    window.addEventListener('smart_att_events_changed', handleEventsChanged);
    return () => window.removeEventListener('smart_att_events_changed', handleEventsChanged);
  }, []);

  const handleClear = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setSelectedType('ALL');
    setSortBy('newest');
  };

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search query: event name or venue
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(ev => {
        const nameMatch = ev.eventName?.toLowerCase().includes(q);
        const coordMatch = ev.coordinatorName?.toLowerCase().includes(q);
        const venueMatch = ev.days?.some(d => d.venue?.toLowerCase().includes(q));
        const schoolMatch = ev.school?.toLowerCase().includes(q);
        return nameMatch || coordMatch || venueMatch || schoolMatch;
      });
    }

    // Date range filter
    if (fromDate) {
      result = result.filter(ev => {
        return ev.days?.some(d => d.date && d.date >= fromDate);
      });
    }
    if (toDate) {
      result = result.filter(ev => {
        return ev.days?.some(d => d.date && d.date <= toDate);
      });
    }

    // Event type filter
    if (selectedType !== 'ALL') {
      result = result.filter(ev => ev.eventType === selectedType);
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = a.days?.[0]?.date || a.createdAt || '';
      const dateB = b.days?.[0]?.date || b.createdAt || '';

      if (sortBy === 'newest') return dateB.localeCompare(dateA);
      if (sortBy === 'oldest') return dateA.localeCompare(dateB);
      if (sortBy === 'name') return (a.eventName || '').localeCompare(b.eventName || '');
      return 0;
    });

    return result;
  }, [events, searchQuery, fromDate, toDate, selectedType, sortBy]);

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteEvent(deleteCandidate.id);
      setEvents(prev => prev.filter(e => e.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      console.error('Delete event failed:', err);
    }
  };

  return (
    <div className="exact-admin-events-tab">
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

        {/* Event Types dropdown */}
        <select
          className="exact-admin-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="ALL">All Event Types</option>
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Sort dropdown */}
        <select
          className="exact-admin-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Event Name (A-Z)</option>
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

      {/* Subtitle counter matching Screenshot: Showing 1–4 of 4 events */}
      <div className="exact-showing-count">
        Showing {filteredEvents.length > 0 ? `1–${filteredEvents.length}` : '0'} of {filteredEvents.length} events
      </div>

      {/* Events Table */}
      <div className="exact-table-responsive">
        <table className="exact-admin-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>#</th>
              <th>Event Name</th>
              <th>Faculty Coordinator</th>
              <th>School</th>
              <th>Phone Number</th>
              <th>Event Type</th>
              <th>Day Type</th>
              <th>Date, Venue & Time</th>
              <th style={{ width: '90px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((ev, idx) => {
                const firstDay = ev.days?.[0] || {};
                const isMulti = Boolean(ev.isMultiDay || (ev.days && ev.days.length > 1));

                return (
                  <tr key={ev.id || idx}>
                    <td className="cell-row-num">{idx + 1}</td>
                    <td className="cell-event-name">{ev.eventName}</td>
                    <td className="cell-coord-name">{ev.coordinatorName}</td>
                    <td className="cell-school">{ev.school}</td>
                    <td className="cell-phone">{ev.coordinatorContact || '–'}</td>
                    <td>
                      <span className="exact-event-type-badge">{ev.eventType}</span>
                    </td>
                    <td className="cell-day-type">
                      {isMulti ? (
                        <div className="exact-day-type-multi">
                          <span>Multi-</span>
                          <span>day</span>
                        </div>
                      ) : (
                        <span className="exact-day-type-single">Single Day</span>
                      )}
                    </td>
                    <td>
                      {isMulti && ev.days && ev.days.length > 0 ? (
                        <div className="exact-dvt-multiday">
                          {ev.days.map((d, dIdx) => (
                            <div key={dIdx} className="dvt-day-entry">
                              <div className="dvt-day-title">Day {d.dayIndex || dIdx + 1} {formatDateDDMMYYYY(d.date)}</div>
                              <div className="dvt-venue-line">
                                <span className="red-pin">📍</span> {d.venue || 'Campus'}
                              </div>
                              {d.startTime && (
                                <div className="dvt-time-line">
                                  {d.startTime} - {d.endTime || ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="exact-dvt-singleday">
                          <div className="dvt-date-title">{formatDateDDMMYYYY(firstDay.date)}</div>
                          <div className="dvt-venue-line">
                            <span className="red-pin">📍</span> {firstDay.venue || 'Campus'}
                          </div>
                          {firstDay.startTime && (
                            <div className="dvt-time-line">
                              {firstDay.startTime} - {firstDay.endTime || ''}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="exact-btn-delete-red"
                        onClick={() => setDeleteCandidate(ev)}
                        title="Delete Event"
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
                <td colSpan="9" className="exact-table-empty">
                  {isLoading ? 'Loading events...' : 'No registered events match the filters.'}
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
              <h3 className="modal-title" style={{ color: '#b91c1c' }}>Confirm Event Deletion</h3>
              <p className="modal-desc" style={{ marginTop: '8px' }}>
                Are you sure you want to permanently delete <strong>{deleteCandidate.eventName}</strong>?
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
