/**
 * Exact Event Registration Component
 * Matches Images 3 & 4 with enhanced validation & success confirmation popup:
 * - Register New Event (Heading)
 * - Event Name
 * - Faculty Coordinator
 * - School
 * - Phone Number: Must start with 6 to 9 and have exactly 10 digits
 * - Event Type with dropdown "-- Select Event Type --"
 * - Multi-day Event? with Checkbox
 * - Event Date: Empty by default so user selects date manually
 * - Event Timing with From/To (Hour, Minute, AM/PM dropdowns)
 * - Event Venue with placeholder "Enter venue"
 * - Full-width "Add Event" button (#190059)
 * - Success Modal Popup displaying full registered event details
 */

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Calendar, MapPin, Clock, User, Phone, Building, Layers, X } from 'lucide-react';
import { addEvent, EVENT_TYPES, SCHOOL_OPTIONS } from '../services/dataService';

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

export default function EventRegistration({ onEventCreated }) {
  // Form State
  const [eventName, setEventName] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [school, setSchool] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [eventType, setEventType] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);

  // Single-Day Schedule (empty date by default)
  const [eventDate, setEventDate] = useState('');
  const [fromHour, setFromHour] = useState('1');
  const [fromMinute, setFromMinute] = useState('00');
  const [fromModifier, setFromModifier] = useState('AM');

  const [toHour, setToHour] = useState('1');
  const [toMinute, setToMinute] = useState('00');
  const [toModifier, setToModifier] = useState('AM');

  const [eventVenue, setEventVenue] = useState('');

  // Multi-Day Schedule Slots (empty dates by default)
  const [multiDays, setMultiDays] = useState([
    {
      id: 1,
      dayIndex: 1,
      date: '',
      venue: '',
      fromHour: '9',
      fromMinute: '00',
      fromModifier: 'AM',
      toHour: '5',
      toMinute: '00',
      toModifier: 'PM'
    },
    {
      id: 2,
      dayIndex: 2,
      date: '',
      venue: '',
      fromHour: '9',
      fromMinute: '00',
      fromModifier: 'AM',
      toHour: '5',
      toMinute: '00',
      toModifier: 'PM'
    }
  ]);

  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Modal State
  const [successModalEvent, setSuccessModalEvent] = useState(null);

  const hoursList = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  // Phone input handler: only numbers, max 10 digits, validation for 6-9
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(raw);

    if (raw.length === 0) {
      setPhoneError('');
    } else if (!/^[6-9]/.test(raw)) {
      setPhoneError('Phone number must start with 6, 7, 8, or 9.');
    } else if (raw.length < 10) {
      setPhoneError(`10 digits required (${raw.length}/10 entered).`);
    } else {
      setPhoneError('');
    }
  };

  const handleAddMultiDay = () => {
    const nextIdx = multiDays.length + 1;
    setMultiDays([
      ...multiDays,
      {
        id: Date.now(),
        dayIndex: nextIdx,
        date: '',
        venue: multiDays[0]?.venue || '',
        fromHour: '9',
        fromMinute: '00',
        fromModifier: 'AM',
        toHour: '5',
        toMinute: '00',
        toModifier: 'PM'
      }
    ]);
  };

  const handleRemoveMultiDay = (id) => {
    if (multiDays.length <= 2) {
      alert('Multi-day events require at least 2 days.');
      return;
    }
    const filtered = multiDays.filter(d => d.id !== id);
    setMultiDays(filtered.map((d, i) => ({ ...d, dayIndex: i + 1 })));
  };

  const handleMultiDayChange = (id, field, value) => {
    setMultiDays(multiDays.map(d => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!eventName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please enter the Event Name.' });
      return;
    }
    if (!coordinatorName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please enter the Faculty Coordinator.' });
      return;
    }
    if (!eventType) {
      setFeedbackMsg({ type: 'error', text: 'Please select an Event Type.' });
      return;
    }

    // Phone validation (if entered, must start with 6-9 and have exactly 10 digits)
    if (phoneNumber.trim()) {
      if (!/^[6-9]\d{9}$/.test(phoneNumber.trim())) {
        setFeedbackMsg({
          type: 'error',
          text: 'Contact number must be exactly 10 digits starting with 6, 7, 8, or 9.'
        });
        return;
      }
    }

    let compiledDays = [];

    if (!isMultiDay) {
      if (!eventDate) {
        setFeedbackMsg({ type: 'error', text: 'Please select the Event Date.' });
        return;
      }
      if (!eventVenue.trim()) {
        setFeedbackMsg({ type: 'error', text: 'Please enter the Event Venue.' });
        return;
      }

      compiledDays = [
        {
          dayIndex: 1,
          date: eventDate,
          venue: eventVenue.trim(),
          startTime: `${fromHour}:${fromMinute} ${fromModifier}`,
          endTime: `${toHour}:${toMinute} ${toModifier}`
        }
      ];
    } else {
      for (let i = 0; i < multiDays.length; i++) {
        const d = multiDays[i];
        if (!d.date) {
          setFeedbackMsg({ type: 'error', text: `Please select the date for Day ${d.dayIndex}.` });
          return;
        }
        if (!d.venue.trim()) {
          setFeedbackMsg({ type: 'error', text: `Please specify the venue for Day ${d.dayIndex}.` });
          return;
        }
      }

      compiledDays = multiDays.map(d => ({
        dayIndex: d.dayIndex,
        date: d.date,
        venue: d.venue.trim(),
        startTime: `${d.fromHour}:${d.fromMinute} ${d.fromModifier}`,
        endTime: `${d.toHour}:${d.toMinute} ${d.toModifier}`
      }));
    }

    setIsSubmitting(true);

    try {
      const newEvent = {
        eventName: eventName.trim(),
        coordinatorName: coordinatorName.trim(),
        school: school.trim() || 'SCOPE',
        phoneNumber: phoneNumber.trim(),
        eventType,
        isMultiDay,
        days: compiledDays
      };

      const saved = await addEvent(newEvent);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Display Full Success Modal
      setSuccessModalEvent(saved);

      // Reset form fields
      setEventName('');
      setCoordinatorName('');
      setSchool('');
      setPhoneNumber('');
      setPhoneError('');
      setEventType('');
      setIsMultiDay(false);
      setEventDate('');
      setEventVenue('');
      setMultiDays([
        {
          id: 1,
          dayIndex: 1,
          date: '',
          venue: '',
          fromHour: '9',
          fromMinute: '00',
          fromModifier: 'AM',
          toHour: '5',
          toMinute: '00',
          toModifier: 'PM'
        },
        {
          id: 2,
          dayIndex: 2,
          date: '',
          venue: '',
          fromHour: '9',
          fromMinute: '00',
          fromModifier: 'AM',
          toHour: '5',
          toMinute: '00',
          toModifier: 'PM'
        }
      ]);

      if (onEventCreated) onEventCreated(saved);
    } catch (err) {
      console.error('Add event error:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to add event. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="exact-form-outer-card">
      <h2 className="exact-card-heading">Register New Event</h2>

      {feedbackMsg && (
        <div className={`exact-alert-box ${feedbackMsg.type === 'error' ? 'exact-alert-error' : 'exact-alert-success'}`}>
          {feedbackMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="exact-event-form">
        {/* Event Name */}
        <div className="exact-form-group">
          <label className="exact-form-label">Event Name</label>
          <input
            type="text"
            className="exact-form-input"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            required
          />
        </div>

        {/* Faculty Coordinator */}
        <div className="exact-form-group">
          <label className="exact-form-label">Faculty Coordinator</label>
          <input
            type="text"
            className="exact-form-input"
            value={coordinatorName}
            onChange={(e) => setCoordinatorName(e.target.value)}
            required
          />
        </div>

        {/* School */}
        <div className="exact-form-group">
          <label className="exact-form-label">School</label>
          <input
            type="text"
            className="exact-form-input"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. SCOPE, SENSE, SCORE"
          />
        </div>

        {/* Phone Number (optional, 10 digits, starts 6-9) */}
        <div className="exact-form-group">
          <label className="exact-form-label">
            Phone Number <span className="field-optional">(optional)</span>
          </label>
          <input
            type="tel"
            className={`exact-form-input ${phoneError ? 'input-error-border' : ''}`}
            placeholder="10-digit mobile number (starts with 6, 7, 8, or 9)"
            value={phoneNumber}
            onChange={handlePhoneChange}
            maxLength={10}
          />
          {phoneError && (
            <p className="field-validation-error">{phoneError}</p>
          )}
        </div>

        {/* Event Type */}
        <div className="exact-form-group">
          <label className="exact-form-label">Event Type</label>
          <div className="exact-select-wrapper">
            <select
              className="exact-form-select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
            >
              <option value="">-- Select Event Type --</option>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-day Event Toggle Switch (Professional Switch) */}
        <div className="exact-form-group">
          <div className="exact-toggle-row">
            <span className="exact-toggle-label">Multi-day Event?</span>
            <label className="switch-toggle-container">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => setIsMultiDay(e.target.checked)}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>

        {/* SINGLE DAY SCHEDULE (Empty date by default - Matching Pic 2) */}
        {!isMultiDay && (
          <div className="single-day-section">
            <div className="exact-form-group">
              <label className="exact-form-label">Event Date</label>
              <input
                type="date"
                className="exact-form-input exact-date-picker"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

            {/* Event Timing (Matching Pic 2) */}
            <div className="exact-form-group">
              <label className="exact-form-label">Event Timing</label>
              <div className="exact-timing-container">
                {/* From Group */}
                <div className="exact-timing-col">
                  <span className="timing-label-sub">From</span>
                  <div className="timing-dropdowns-row">
                    <select
                      className="exact-select-mini"
                      value={fromHour}
                      onChange={(e) => setFromHour(e.target.value)}
                    >
                      {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={fromMinute}
                      onChange={(e) => setFromMinute(e.target.value)}
                    >
                      {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={fromModifier}
                      onChange={(e) => setFromModifier(e.target.value)}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* To Group */}
                <div className="exact-timing-col">
                  <span className="timing-label-sub">To</span>
                  <div className="timing-dropdowns-row">
                    <select
                      className="exact-select-mini"
                      value={toHour}
                      onChange={(e) => setToHour(e.target.value)}
                    >
                      {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={toMinute}
                      onChange={(e) => setToMinute(e.target.value)}
                    >
                      {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={toModifier}
                      onChange={(e) => setToModifier(e.target.value)}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Venue */}
            <div className="exact-form-group">
              <label className="exact-form-label">Event Venue</label>
              <input
                type="text"
                className="exact-form-input"
                placeholder="Enter venue"
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* MULTI DAY SCHEDULE */}
        {isMultiDay && (
          <div className="multi-days-container">
            {multiDays.map((d) => (
              <div key={d.id} className="multi-day-slot-card">
                <div className="multi-day-header">
                  <span className="day-slot-title">Day {d.dayIndex} Schedule</span>
                  {multiDays.length > 2 && (
                    <button
                      type="button"
                      className="btn-remove-day-link"
                      onClick={() => handleRemoveMultiDay(d.id)}
                    >
                      Remove Day
                    </button>
                  )}
                </div>

                <div className="exact-form-group">
                  <label className="exact-form-label">Date</label>
                  <input
                    type="date"
                    className="exact-form-input exact-date-picker"
                    value={d.date}
                    onChange={(e) => handleMultiDayChange(d.id, 'date', e.target.value)}
                    required
                  />
                </div>

                <div className="exact-form-group">
                  <label className="exact-form-label">Timing</label>
                  <div className="timing-dropdowns-row">
                    <div className="timing-group">
                      <span className="timing-sublabel">From</span>
                      <div className="timing-selects-triple">
                        <select
                          className="exact-timing-select"
                          value={d.fromHour}
                          onChange={(e) => handleMultiDayChange(d.id, 'fromHour', e.target.value)}
                        >
                          {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          className="exact-timing-select"
                          value={d.fromMinute}
                          onChange={(e) => handleMultiDayChange(d.id, 'fromMinute', e.target.value)}
                        >
                          {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          className="exact-timing-select"
                          value={d.fromModifier}
                          onChange={(e) => handleMultiDayChange(d.id, 'fromModifier', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>

                    <div className="timing-group">
                      <span className="timing-sublabel">To</span>
                      <div className="timing-selects-triple">
                        <select
                          className="exact-timing-select"
                          value={d.toHour}
                          onChange={(e) => handleMultiDayChange(d.id, 'toHour', e.target.value)}
                        >
                          {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          className="exact-timing-select"
                          value={d.toMinute}
                          onChange={(e) => handleMultiDayChange(d.id, 'toMinute', e.target.value)}
                        >
                          {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          className="exact-timing-select"
                          value={d.toModifier}
                          onChange={(e) => handleMultiDayChange(d.id, 'toModifier', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="exact-form-group">
                  <label className="exact-form-label">Venue</label>
                  <input
                    type="text"
                    className="exact-form-input"
                    placeholder="Enter venue for this day"
                    value={d.venue}
                    onChange={(e) => handleMultiDayChange(d.id, 'venue', e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn-add-day-outline"
              onClick={handleAddMultiDay}
            >
              + Add Another Day
            </button>
          </div>
        )}

        {/* Submit Button */}
        <div className="exact-submit-wrapper">
          <button
            type="submit"
            className="exact-btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registering Event...' : 'Add Event'}
          </button>
        </div>
      </form>

      {/* SUCCESS CONFIRMATION MODAL */}
      {successModalEvent && (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-registered-success">
            <div className="success-modal-header">
              <div className="success-icon-badge">
                <CheckCircle2 size={36} color="#16a34a" />
              </div>
              <h3 className="success-modal-title">Event Successfully Registered!</h3>
              <p className="success-modal-sub">
                <strong>"{successModalEvent.eventName}"</strong> has been successfully registered in the portal database.
              </p>
            </div>

            {/* Event Summary Details Card */}
            <div className="registered-event-details-card">
              <div className="detail-row">
                <span className="detail-label">Faculty Coordinator:</span>
                <span className="detail-value">{successModalEvent.coordinatorName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Organizing School:</span>
                <span className="detail-value">{successModalEvent.school || 'SCOPE'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Contact Number:</span>
                <span className="detail-value">{successModalEvent.phoneNumber || '–'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Event Type:</span>
                <span className="detail-value event-type-pill">{successModalEvent.eventType}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Schedule Mode:</span>
                <span className="detail-value">
                  {successModalEvent.isMultiDay
                    ? `Multi-day Event (${successModalEvent.days?.length} Days)`
                    : 'Single-Day Event'}
                </span>
              </div>

              {/* Sessions breakdown */}
              <div className="detail-sessions-list">
                <div className="sessions-list-title">Scheduled Sessions:</div>
                {successModalEvent.days?.map((d, dIdx) => (
                  <div key={dIdx} className="session-item-row">
                    <span className="session-day-tag">Day {d.dayIndex}</span>
                    <span className="session-date-tag">📅 {formatDateDDMMYYYY(d.date)}</span>
                    <span className="session-venue-tag">📍 {d.venue}</span>
                    <span className="session-time-tag">🕒 {d.startTime} – {d.endTime}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="success-modal-actions">
              <button
                type="button"
                className="exact-btn-submit"
                style={{ padding: '10px 24px', fontSize: '14px' }}
                onClick={() => setSuccessModalEvent(null)}
              >
                Done / Register Another Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
