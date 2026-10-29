/**
 * Exact Event Registration Component
 * Matches Images 3 & 4 from screenshots:
 * - Register New Event (Heading)
 * - Event Name
 * - Faculty Coordinator
 * - School
 * - Phone Number (optional) with placeholder: "10-digit mobile number (optional)"
 * - Event Type with dropdown "-- Select Event Type --"
 * - Multi-day Event? with Checkbox
 * - Event Date
 * - Event Timing with From/To (Hour, Minute, AM/PM dropdowns)
 * - Event Venue with placeholder "Enter venue"
 * - Full-width "Add Event" button (#1a0050)
 */

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { addEvent, EVENT_TYPES } from '../services/dataService';

export default function EventRegistration({ onEventCreated }) {
  // Form State
  const [eventName, setEventName] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [school, setSchool] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [eventType, setEventType] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);

  // Single-Day Schedule
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromHour, setFromHour] = useState('1');
  const [fromMinute, setFromMinute] = useState('00');
  const [fromModifier, setFromModifier] = useState('AM');

  const [toHour, setToHour] = useState('1');
  const [toMinute, setToMinute] = useState('00');
  const [toModifier, setToModifier] = useState('AM');

  const [eventVenue, setEventVenue] = useState('');

  // Multi-Day Schedule Slots
  const [multiDays, setMultiDays] = useState([
    {
      id: 1,
      dayIndex: 1,
      date: new Date().toISOString().split('T')[0],
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
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
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

  const hoursList = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const handleAddMultiDay = () => {
    const nextIdx = multiDays.length + 1;
    let nextDate = new Date().toISOString().split('T')[0];
    const lastDate = multiDays[multiDays.length - 1]?.date;
    if (lastDate) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }

    setMultiDays([
      ...multiDays,
      {
        id: Date.now(),
        dayIndex: nextIdx,
        date: nextDate,
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

    let compiledDays = [];

    if (!isMultiDay) {
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
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 }
      });

      setFeedbackMsg({
        type: 'success',
        text: `Event "${saved.eventName}" registered successfully!`
      });

      // Reset form fields
      setEventName('');
      setCoordinatorName('');
      setSchool('');
      setPhoneNumber('');
      setEventType('');
      setIsMultiDay(false);
      setEventVenue('');

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
            placeholder=""
          />
        </div>

        {/* Phone Number (optional) */}
        <div className="exact-form-group">
          <label className="exact-form-label">
            Phone Number <span className="label-sub-optional">(optional)</span>
          </label>
          <input
            type="tel"
            className="exact-form-input"
            placeholder="10-digit mobile number (optional)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>

        {/* Event Type */}
        <div className="exact-form-group">
          <label className="exact-form-label">Event Type</label>
          <select
            className="exact-form-input"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            required
          >
            <option value="">-- Select Event Type --</option>
            {EVENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Multi-day Event? Checkbox */}
        <div className="exact-checkbox-group">
          <label className="exact-checkbox-label">
            Multi-day Event?
          </label>
          <input
            type="checkbox"
            className="exact-checkbox-input"
            checked={isMultiDay}
            onChange={(e) => setIsMultiDay(e.target.checked)}
          />
        </div>

        {/* Single-Day View */}
        {!isMultiDay ? (
          <div className="exact-single-day-section">
            <div className="exact-form-group">
              <label className="exact-form-label">Event Date</label>
              <input
                type="date"
                className="exact-form-input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

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
                      {hoursList.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={fromMinute}
                      onChange={(e) => setFromMinute(e.target.value)}
                    >
                      {minutesList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
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
                      {hoursList.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <select
                      className="exact-select-mini"
                      value={toMinute}
                      onChange={(e) => setToMinute(e.target.value)}
                    >
                      {minutesList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
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
        ) : (
          /* Multi-Day View */
          <div className="exact-multiday-section">
            {multiDays.map((dayItem) => (
              <div key={dayItem.id} className="exact-multiday-card">
                <div className="multiday-header-bar">
                  <span className="multiday-day-badge">Day {dayItem.dayIndex}</span>
                  {multiDays.length > 2 && (
                    <button
                      type="button"
                      className="btn-multiday-remove"
                      onClick={() => handleRemoveMultiDay(dayItem.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="exact-form-group mt-2">
                  <label className="exact-form-label">Date</label>
                  <input
                    type="date"
                    className="exact-form-input"
                    value={dayItem.date}
                    onChange={(e) => handleMultiDayChange(dayItem.id, 'date', e.target.value)}
                    required
                  />
                </div>

                <div className="exact-form-group">
                  <label className="exact-form-label">Venue</label>
                  <input
                    type="text"
                    className="exact-form-input"
                    placeholder="Enter venue"
                    value={dayItem.venue}
                    onChange={(e) => handleMultiDayChange(dayItem.id, 'venue', e.target.value)}
                    required
                  />
                </div>

                <div className="exact-form-group">
                  <label className="exact-form-label">Timing</label>
                  <div className="exact-timing-container">
                    <div className="exact-timing-col">
                      <span className="timing-label-sub">From</span>
                      <div className="timing-dropdowns-row">
                        <select
                          className="exact-select-mini"
                          value={dayItem.fromHour}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'fromHour', e.target.value)}
                        >
                          {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          className="exact-select-mini"
                          value={dayItem.fromMinute}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'fromMinute', e.target.value)}
                        >
                          {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          className="exact-select-mini"
                          value={dayItem.fromModifier}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'fromModifier', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>

                    <div className="exact-timing-col">
                      <span className="timing-label-sub">To</span>
                      <div className="timing-dropdowns-row">
                        <select
                          className="exact-select-mini"
                          value={dayItem.toHour}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'toHour', e.target.value)}
                        >
                          {hoursList.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          className="exact-select-mini"
                          value={dayItem.toMinute}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'toMinute', e.target.value)}
                        >
                          {minutesList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          className="exact-select-mini"
                          value={dayItem.toModifier}
                          onChange={(e) => handleMultiDayChange(dayItem.id, 'toModifier', e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn-add-day-pill"
              onClick={handleAddMultiDay}
            >
              + Add Day Slot
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
            {isSubmitting ? 'Adding Event...' : 'Add Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
