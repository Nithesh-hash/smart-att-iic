/**
 * Module 1: Event Registration Engine
 * Single-Day and Multi-Day Event registration with dynamic day rows,
 * strict chronological and time validation, confetti celebration, and persistence.
 */

import React, { useState } from 'react';
import {
  CalendarPlus,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Clock,
  MapPin,
  Calendar,
  User,
  Phone,
  Building,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  addEvent,
  SCHOOL_OPTIONS,
  EVENT_TYPES
} from '../services/dataService';

export default function EventRegistration({ onEventCreated }) {
  // Form State
  const [eventName, setEventName] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorContact, setCoordinatorContact] = useState('');
  const [school, setSchool] = useState('SCOPE');
  const [eventType, setEventType] = useState('Workshop');
  const [isMultiDay, setIsMultiDay] = useState(false);

  // Single-Day State
  const [singleDate, setSingleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [singleVenue, setSingleVenue] = useState('');
  const [singleStartHour, setSingleStartHour] = useState('09:00');
  const [singleStartMod, setSingleStartMod] = useState('AM');
  const [singleEndHour, setSingleEndHour] = useState('01:00');
  const [singleEndMod, setSingleEndMod] = useState('PM');

  // Multi-Day State
  const [days, setDays] = useState([
    {
      id: 1,
      dayIndex: 1,
      date: new Date().toISOString().split('T')[0],
      venue: '',
      startHour: '09:00',
      startMod: 'AM',
      endHour: '05:00',
      endMod: 'PM'
    },
    {
      id: 2,
      dayIndex: 2,
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      venue: '',
      startHour: '09:00',
      startMod: 'AM',
      endHour: '05:00',
      endMod: 'PM'
    }
  ]);

  const [formError, setFormError] = useState(null);
  const [createdEventModal, setCreatedEventModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Converts hour (HH:MM) and modifier (AM/PM) to total minutes from midnight
   */
  const toMinutes = (timeStr, modifier) => {
    if (!timeStr) return 0;
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  /**
   * Validate Start Time < End Time
   */
  const isTimeValid = (startHour, startMod, endHour, endMod) => {
    const sMin = toMinutes(startHour, startMod);
    const eMin = toMinutes(endHour, endMod);
    return sMin < eMin;
  };

  const handleAddDay = () => {
    const nextIdx = days.length + 1;
    const lastDayDate = days[days.length - 1]?.date;
    let nextDate = new Date().toISOString().split('T')[0];
    if (lastDayDate) {
      const d = new Date(lastDayDate);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }

    setDays([
      ...days,
      {
        id: Date.now(),
        dayIndex: nextIdx,
        date: nextDate,
        venue: days[0]?.venue || '',
        startHour: '09:00',
        startMod: 'AM',
        endHour: '05:00',
        endMod: 'PM'
      }
    ]);
  };

  const handleRemoveDay = (id) => {
    if (days.length <= 2) {
      setFormError('Multi-day events must contain at least 2 days.');
      return;
    }
    const filtered = days.filter(d => d.id !== id);
    const reindexed = filtered.map((d, i) => ({ ...d, dayIndex: i + 1 }));
    setDays(reindexed);
  };

  const handleDayChange = (id, field, value) => {
    setDays(days.map(d => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Basic Validation
    if (!eventName.trim()) {
      setFormError('Please enter an Event Name.');
      return;
    }
    if (!coordinatorName.trim()) {
      setFormError('Please enter the Faculty Coordinator Name.');
      return;
    }

    let compiledDays = [];

    if (!isMultiDay) {
      if (!singleVenue.trim()) {
        setFormError('Please enter the venue for this event.');
        return;
      }
      if (!isTimeValid(singleStartHour, singleStartMod, singleEndHour, singleEndMod)) {
        setFormError('Single-day event Start Time must be strictly before End Time.');
        return;
      }

      compiledDays = [
        {
          dayIndex: 1,
          date: singleDate,
          venue: singleVenue.trim(),
          startTime: `${singleStartHour} ${singleStartMod}`,
          endTime: `${singleEndHour} ${singleEndMod}`
        }
      ];
    } else {
      // Validate Multi-Day Rows
      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        if (!d.venue.trim()) {
          setFormError(`Please specify the venue for Day ${d.dayIndex}.`);
          return;
        }
        if (!isTimeValid(d.startHour, d.startMod, d.endHour, d.endMod)) {
          setFormError(`Day ${d.dayIndex} Start Time must be strictly before End Time.`);
          return;
        }
        if (i > 0) {
          const prevDate = new Date(days[i - 1].date);
          const currDate = new Date(d.date);
          if (currDate < prevDate) {
            setFormError(`Chronological violation: Day ${d.dayIndex} date cannot precede Day ${i}.`);
            return;
          }
        }
      }

      compiledDays = days.map(d => ({
        dayIndex: d.dayIndex,
        date: d.date,
        venue: d.venue.trim(),
        startTime: `${d.startHour} ${d.startMod}`,
        endTime: `${d.endHour} ${d.endMod}`
      }));
    }

    setIsSubmitting(true);

    try {
      const eventPayload = {
        eventName: eventName.trim(),
        coordinatorName: coordinatorName.trim(),
        coordinatorContact: coordinatorContact.trim(),
        school,
        eventType,
        isMultiDay,
        days: compiledDays
      };

      const saved = await addEvent(eventPayload);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      setCreatedEventModal(saved);

      // Reset Form
      setEventName('');
      setCoordinatorName('');
      setCoordinatorContact('');
      setSingleVenue('');
      setIsMultiDay(false);

      if (onEventCreated) onEventCreated(saved);
    } catch (err) {
      console.error('Event registration error:', err);
      setFormError('Failed to save event. Please check storage connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="event-registration-container">
      <div className="section-title-bar">
        <div>
          <h2 className="section-heading">📅 Institutional Event Registration</h2>
          <p className="section-subheading">
            Register single-day and multi-day workshops, hackathons, and seminars. Registered events are linked to attendance spreadsheets during batch segregation.
          </p>
        </div>
      </div>

      {formError && (
        <div className="alert-box alert-error">
          <AlertCircle size={20} className="alert-icon" />
          <div className="alert-text">{formError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="registration-card-form">
        {/* Core Metadata Grid */}
        <div className="form-section-title">
          <Building size={18} />
          <span>Event & Coordinator Details</span>
        </div>

        <div className="form-grid-2cols">
          <div className="form-group">
            <label className="form-label">Event Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. National Cyber Security Summit 2026"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Event Type *</label>
            <select
              className="form-select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Organizing School / Department *</label>
            <select
              className="form-select"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            >
              {SCHOOL_OPTIONS.map(sch => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Faculty Coordinator Name *</label>
            <div className="input-icon-wrapper">
              <User size={16} className="field-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Dr. / Prof. Full Name"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Coordinator Contact Number (Tel)</label>
            <div className="input-icon-wrapper">
              <Phone size={16} className="field-icon" />
              <input
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={coordinatorContact}
                onChange={(e) => setCoordinatorContact(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Event Duration Mode</label>
            <div className="toggle-duration-card">
              <button
                type="button"
                className={`btn-toggle-mode ${!isMultiDay ? 'toggle-active' : ''}`}
                onClick={() => setIsMultiDay(false)}
              >
                Single-Day Event
              </button>
              <button
                type="button"
                className={`btn-toggle-mode ${isMultiDay ? 'toggle-active' : ''}`}
                onClick={() => setIsMultiDay(true)}
              >
                Multi-Day Event
              </button>
            </div>
          </div>
        </div>

        {/* Scheduling Section */}
        <div className="form-section-title mt-6">
          <Calendar size={18} />
          <span>{isMultiDay ? 'Multi-Day Schedule Breakdown' : 'Single-Day Schedule & Venue'}</span>
        </div>

        {!isMultiDay ? (
          /* Single-Day Card */
          <div className="single-day-card">
            <div className="form-grid-3cols">
              <div className="form-group">
                <label className="form-label">Event Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Campus Venue</label>
                <div className="input-icon-wrapper">
                  <MapPin size={16} className="field-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. TT Gallery / Anna Auditorium"
                    value={singleVenue}
                    onChange={(e) => setSingleVenue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Time Window (From – To)</label>
                <div className="time-pickers-row">
                  <input
                    type="time"
                    className="form-time-input"
                    value={singleStartHour}
                    onChange={(e) => setSingleStartHour(e.target.value)}
                  />
                  <select
                    className="form-time-mod"
                    value={singleStartMod}
                    onChange={(e) => setSingleStartMod(e.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <span className="time-to-separator">to</span>
                  <input
                    type="time"
                    className="form-time-input"
                    value={singleEndHour}
                    onChange={(e) => setSingleEndHour(e.target.value)}
                  />
                  <select
                    className="form-time-mod"
                    value={singleEndMod}
                    onChange={(e) => setSingleEndMod(e.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                {!isTimeValid(singleStartHour, singleStartMod, singleEndHour, singleEndMod) && (
                  <span className="inline-time-warning">
                    ⚠️ Start time must precede end time.
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Day Rows */
          <div className="multi-day-list">
            {days.map((dayItem, idx) => {
              const validTime = isTimeValid(dayItem.startHour, dayItem.startMod, dayItem.endHour, dayItem.endMod);
              return (
                <div key={dayItem.id} className="multi-day-row">
                  <div className="day-badge-col">
                    <span className="day-pill">Day {dayItem.dayIndex}</span>
                  </div>

                  <div className="day-inputs-grid">
                    <div className="form-group">
                      <label className="form-sublabel">Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dayItem.date}
                        onChange={(e) => handleDayChange(dayItem.id, 'date', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-sublabel">Venue</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Technology Tower Lab 201"
                        value={dayItem.venue}
                        onChange={(e) => handleDayChange(dayItem.id, 'venue', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-sublabel">Time Window</label>
                      <div className="time-pickers-row">
                        <input
                          type="time"
                          className="form-time-input"
                          value={dayItem.startHour}
                          onChange={(e) => handleDayChange(dayItem.id, 'startHour', e.target.value)}
                        />
                        <select
                          className="form-time-mod"
                          value={dayItem.startMod}
                          onChange={(e) => handleDayChange(dayItem.id, 'startMod', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                        <span className="time-to-separator">to</span>
                        <input
                          type="time"
                          className="form-time-input"
                          value={dayItem.endHour}
                          onChange={(e) => handleDayChange(dayItem.id, 'endHour', e.target.value)}
                        />
                        <select
                          className="form-time-mod"
                          value={dayItem.endMod}
                          onChange={(e) => handleDayChange(dayItem.id, 'endMod', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      {!validTime && (
                        <span className="inline-time-warning">
                          ⚠️ Start must precede End.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="day-delete-col">
                    <button
                      type="button"
                      className="btn-delete-day"
                      onClick={() => handleRemoveDay(dayItem.id)}
                      title="Remove this day"
                      disabled={days.length <= 2}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className="btn-add-day-row"
              onClick={handleAddDay}
            >
              <Plus size={16} />
              <span>Add Another Day</span>
            </button>
          </div>
        )}

        <div className="form-submit-row">
          <button
            type="submit"
            className="btn-primary-register"
            disabled={isSubmitting}
          >
            <Sparkles size={18} />
            <span>{isSubmitting ? 'Registering Event...' : 'Register Institutional Event'}</span>
          </button>
        </div>
      </form>

      {/* Confirmation Celebration Modal */}
      {createdEventModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-group">
                <CheckCircle2 size={28} className="modal-icon-success" />
                <div>
                  <h3 className="modal-title">Event Successfully Registered!</h3>
                  <p className="modal-desc">
                    Ready to be linked with student attendance spreadsheets.
                  </p>
                </div>
              </div>
            </div>

            <div className="registered-summary-box">
              <div className="summary-field">
                <span className="lbl">Event Name:</span>
                <span className="val highlight">{createdEventModal.eventName}</span>
              </div>
              <div className="summary-field">
                <span className="lbl">Type & School:</span>
                <span className="val">{createdEventModal.eventType} — {createdEventModal.school}</span>
              </div>
              <div className="summary-field">
                <span className="lbl">Coordinator:</span>
                <span className="val">{createdEventModal.coordinatorName} ({createdEventModal.coordinatorContact || 'N/A'})</span>
              </div>
              <div className="summary-field">
                <span className="lbl">Duration:</span>
                <span className="val">
                  {createdEventModal.isMultiDay ? `${createdEventModal.days.length} Days` : 'Single Day'}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-modal-save"
                onClick={() => setCreatedEventModal(null)}
              >
                Close & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
