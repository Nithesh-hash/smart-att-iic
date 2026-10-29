/**
 * Admin Sub-Module 1: Events Management Table
 * Features:
 * - Paginated table of all registered events
 * - Search bar across event name, coordinator, venue, school
 * - Filters by date range & event type
 * - Sort options (by date, name, school)
 * - Delete event with immediate UI synchronization & confirmation
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building,
  User,
  AlertCircle,
  Clock,
  Layers,
  MapPin
} from 'lucide-react';
import { getEvents, deleteEvent, EVENT_TYPES, SCHOOL_OPTIONS } from '../../services/dataService';

export default function EventsManagement() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedSchool, setSelectedSchool] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, name-asc

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Deletion modal
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
  }, []);

  // Filtered & Sorted Events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search Query (Event name, coordinator, venue, school)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(ev => {
        const nameMatch = ev.eventName?.toLowerCase().includes(q);
        const coordMatch = ev.coordinatorName?.toLowerCase().includes(q);
        const schoolMatch = ev.school?.toLowerCase().includes(q);
        const venueMatch = ev.days?.some(d => d.venue?.toLowerCase().includes(q));
        return nameMatch || coordMatch || schoolMatch || venueMatch;
      });
    }

    // Type filter
    if (selectedType !== 'ALL') {
      result = result.filter(ev => ev.eventType === selectedType);
    }

    // School filter
    if (selectedSchool !== 'ALL') {
      result = result.filter(ev => ev.school === selectedSchool);
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = a.days?.[0]?.date || a.createdAt || '';
      const dateB = b.days?.[0]?.date || b.createdAt || '';

      if (sortBy === 'date-desc') return dateB.localeCompare(dateA);
      if (sortBy === 'date-asc') return dateA.localeCompare(dateB);
      if (sortBy === 'name-asc') return (a.eventName || '').localeCompare(b.eventName || '');
      return 0;
    });

    return result;
  }, [events, searchQuery, selectedType, selectedSchool, sortBy]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

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
    <div className="admin-events-management">
      <div className="admin-filter-bar">
        {/* Search Input */}
        <div className="admin-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by event, coordinator, school, or venue..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Filters Group */}
        <div className="admin-filters-group">
          <select
            className="admin-filter-select"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Event Types</option>
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="admin-filter-select"
            value={selectedSchool}
            onChange={(e) => {
              setSelectedSchool(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Schools</option>
            {SCHOOL_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="admin-filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="table-responsive-wrapper mt-4">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Event Title</th>
              <th>Type</th>
              <th>School</th>
              <th>Coordinator</th>
              <th>Schedule / Venue</th>
              <th>Duration</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.length > 0 ? (
              paginatedEvents.map((ev, idx) => {
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                const firstDay = ev.days?.[0] || {};
                return (
                  <tr key={ev.id || idx}>
                    <td className="cell-num">{rowNum}</td>
                    <td>
                      <div className="event-title-cell">
                        <span className="event-name-bold">{ev.eventName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">{ev.eventType}</span>
                    </td>
                    <td>
                      <span className="school-badge-cell">{ev.school}</span>
                    </td>
                    <td>
                      <div className="coord-info-cell">
                        <span>{ev.coordinatorName}</span>
                        {ev.coordinatorContact && (
                          <span className="coord-phone-sub">{ev.coordinatorContact}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="schedule-info-cell">
                        <span>📅 {firstDay.date || 'TBD'}</span>
                        <span className="schedule-venue-sub">📍 {firstDay.venue || 'Campus'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`duration-badge ${ev.isMultiDay ? 'duration-multi' : 'duration-single'}`}>
                        {ev.isMultiDay ? `${ev.days?.length || 2} Days` : 'Single Day'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        className="btn-action-delete"
                        onClick={() => setDeleteCandidate(ev)}
                        title="Delete Event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="table-empty-row">
                  {isLoading ? 'Loading events...' : 'No registered events match the selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="admin-pagination-footer">
        <div className="pagination-info">
          Showing <strong>{filteredEvents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
          <strong>{Math.min(currentPage * pageSize, filteredEvents.length)}</strong> of{' '}
          <strong>{filteredEvents.length}</strong> events
        </div>

        <div className="pagination-buttons">
          <button
            className="btn-pagination-nav"
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="pagination-page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-pagination-nav"
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage >= totalPages}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Deletion Confirmation Modal */}
      {deleteCandidate && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-small">
            <div className="modal-header">
              <div className="modal-title-group">
                <AlertCircle size={24} className="modal-icon-danger" />
                <div>
                  <h3 className="modal-title">Confirm Event Deletion</h3>
                  <p className="modal-desc">
                    Are you sure you want to delete this event from the portal registry?
                  </p>
                </div>
              </div>
            </div>

            <div className="delete-target-preview">
              <strong>{deleteCandidate.eventName}</strong>
              <span>{deleteCandidate.school} • {deleteCandidate.eventType}</span>
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
                onClick={handleDeleteConfirm}
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
