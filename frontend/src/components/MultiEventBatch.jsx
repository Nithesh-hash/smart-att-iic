/**
 * Exact Excel Segregation Component
 * Perfectly matches Images 1, 2, and 3 from user screenshots:
 * - Step 1 — Select Date Range with [ dd-mm-yyyy ] to [ dd-mm-yyyy ] [ 🔍 Find Events ]
 * - Step 2 — Number of Events to Segregate with dropdown (-- Select --, 1, 2, 3, 4, 5)
 * - "✅ X event(s) found in range."
 * - Event 1, Event 2... cards with "Select Event" dropdown formatted as:
 *   "🗓️ EventName (YYYY-MM-DD | Time | Venue)" or "(Multi-day: Start – End)"
 * - "📄 Upload Attendance Excel" inner card with "[ + Add File ]" button
 * - Multiple file input rows per slot
 * - Full-width "[ ⚡ Segregate All Events ]" button (#190059)
 */

import React, { useState, useEffect } from 'react';
import { getEvents, addSegregationHistory } from '../services/dataService';
import { processMultiEventBatch } from '../services/batchProcessor';

export default function MultiEventBatch() {
  // Step 1: Date Range Filter
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });

  const [allRegisteredEvents, setAllRegisteredEvents] = useState([]);
  const [matchingEvents, setMatchingEvents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Step 2: Number of Events to Segregate
  const [numberOfEvents, setNumberOfEvents] = useState(''); // '', '1', '2', '3', '4', '5'

  // Event slots data: { [slotIndex]: { eventId: string, files: [File, File...] } }
  const [slotData, setSlotData] = useState({});

  // Dynamic file input rows count per slot: { [slotIndex]: number }
  const [slotFileRowCount, setSlotFileRowCount] = useState({});

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    async function load() {
      const events = await getEvents();
      setAllRegisteredEvents(events);
    }
    load();
  }, []);

  const handleFindEvents = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setHasSearched(true);

    if (!allRegisteredEvents || allRegisteredEvents.length === 0) {
      setMatchingEvents([]);
      return;
    }

    const filtered = allRegisteredEvents.filter(ev => {
      if (!ev.days || ev.days.length === 0) return true;
      return ev.days.some(d => {
        if (!d.date) return true;
        return d.date >= fromDate && d.date <= toDate;
      });
    });

    setMatchingEvents(filtered);
  };

  const handleSelectNumberOfEvents = (val) => {
    setNumberOfEvents(val);
    const count = parseInt(val, 10) || 0;

    const initialSlots = {};
    const initialFileCounts = {};
    for (let i = 1; i <= count; i++) {
      initialSlots[i] = {
        eventId: slotData[i]?.eventId || '',
        files: slotData[i]?.files || []
      };
      initialFileCounts[i] = slotFileRowCount[i] || 1;
    }
    setSlotData(initialSlots);
    setSlotFileRowCount(initialFileCounts);
  };

  const handleSelectEventForSlot = (slotIdx, eventId) => {
    setSlotData(prev => ({
      ...prev,
      [slotIdx]: {
        ...prev[slotIdx],
        eventId
      }
    }));
  };

  const handleAddFileInputRow = (slotIdx) => {
    setSlotFileRowCount(prev => ({
      ...prev,
      [slotIdx]: (prev[slotIdx] || 1) + 1
    }));
  };

  const handleFileInputChange = (slotIdx, fileRowIdx, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const newFiles = Array.from(fileList);

    setSlotData(prev => {
      const current = prev[slotIdx] || { eventId: '', files: [] };
      const existingFiles = [...(current.files || [])];

      // Update or append file at fileRowIdx
      existingFiles[fileRowIdx] = newFiles[0];

      return {
        ...prev,
        [slotIdx]: {
          ...current,
          files: existingFiles.filter(Boolean)
        }
      };
    });
  };

  const handleSegregateAll = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const count = parseInt(numberOfEvents, 10) || 0;
    if (count === 0) {
      setErrorMessage('Please select the number of events to segregate.');
      return;
    }

    const compiledSlots = [];
    for (let i = 1; i <= count; i++) {
      const slot = slotData[i];
      if (!slot || !slot.eventId) {
        setErrorMessage(`Please select an event for Event ${i}.`);
        return;
      }

      const ev = allRegisteredEvents.find(e => e.id === slot.eventId);
      if (!ev) continue;

      const files = slot.files || [];
      if (files.length === 0) {
        setErrorMessage(`Please upload at least one attendance Excel file for Event ${i} (${ev.eventName}).`);
        return;
      }

      // Map files to days
      const dayUploads = {};
      if (ev.isMultiDay && ev.days && ev.days.length > 1) {
        // If multiple files, allocate per day, or associate files with Day 1, Day 2 etc.
        ev.days.forEach((d, dIdx) => {
          dayUploads[d.dayIndex] = files[dIdx] ? [files[dIdx]] : [files[0]];
        });
      } else {
        dayUploads[1] = files;
      }

      compiledSlots.push({
        event: ev,
        dayUploads
      });
    }

    setIsProcessing(true);

    try {
      const result = await processMultiEventBatch(compiledSlots);

      // Formatted timestamp zip filename matching Image 5: all_schools_YYYY-MM-DD_HHMMSS.zip
      const now = new Date();
      const datePart = now.toISOString().split('T')[0];
      const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
      const zipName = `all_schools_${datePart}_${timePart}.zip`;

      // Trigger instant browser download
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage(`Segregation completed! Downloaded "${zipName}" covering ${result.schoolsCount} schools and ${result.totalStudents} student records.`);

      // Record in Segregation History Audit Trail
      try {
        const eventsNamesList = compiledSlots.map(s => {
          const firstDay = s.event.days?.[0] || {};
          return `• ${s.event.eventName} | ${firstDay.venue || 'Campus'} | ${firstDay.date || datePart} (${firstDay.startTime || '9:00 AM'} - ${firstDay.endTime || '5:00 PM'})`;
        }).join('\n');

        const firstCoord = compiledSlots[0]?.event;
        const coordFormatted = firstCoord
          ? `${firstCoord.coordinatorName} (${firstCoord.school}${firstCoord.phoneNumber ? ` | ${firstCoord.phoneNumber}` : ''})`
          : 'Faculty Admin';

        await addSegregationHistory({
          eventDates: compiledSlots.map(s => s.event.days?.[0]?.date).filter(Boolean).join(', ') || datePart,
          eventsSegregated: eventsNamesList,
          coordinatorFormatted,
          count: compiledSlots.length,
          zipName,
          totalStudents: result.totalStudents,
          schoolsRepresented: result.schoolsCount,
          filesCount: result.totalFiles,
          timestamp: new Date().toISOString()
        });
      } catch (histErr) {
        console.warn('Could not record history:', histErr);
      }
    } catch (err) {
      console.error('Segregation error:', err);
      setErrorMessage(err.message || 'Segregation failed. Please verify spreadsheet columns.');
    } finally {
      setIsProcessing(false);
    }
  };

  const countNum = parseInt(numberOfEvents, 10) || 0;

  return (
    <div className="exact-form-outer-card">
      <h2 className="exact-card-heading">Excel Segregation</h2>

      {errorMessage && (
        <div className="exact-alert-box exact-alert-error">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="exact-alert-box exact-alert-success">
          {successMessage}
        </div>
      )}

      {/* Step 1 — Select Date Range (Image 1) */}
      <div className="exact-step-section">
        <h3 className="exact-step-title">Step 1 — Select Date Range</h3>
        <div className="exact-date-range-row">
          <input
            type="date"
            className="exact-date-picker"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <span className="exact-to-sep">to</span>
          <input
            type="date"
            className="exact-date-picker"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button
            type="button"
            className="exact-btn-find-events"
            onClick={handleFindEvents}
          >
            <span className="search-mag-glass">🔍</span>
            <span>Find Events</span>
          </button>
        </div>
      </div>

      {/* Step 2 — Number of Events to Segregate (Image 1) */}
      {hasSearched && (
        <div className="exact-step-section mt-4">
          <h3 className="exact-step-title">Step 2 — Number of Events to Segregate</h3>
          <div className="exact-select-wrapper">
            <select
              className="exact-select-dropdown"
              value={numberOfEvents}
              onChange={(e) => handleSelectNumberOfEvents(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          <div className="exact-events-found-banner">
            <span className="green-check-icon">☑</span>
            <span className="green-found-text">{matchingEvents.length} event(s) found in range.</span>
          </div>
        </div>
      )}

      {/* Dynamic Event Slots (Images 2 & 3) */}
      {hasSearched && countNum > 0 && (
        <div className="exact-slots-container mt-4">
          {Array.from({ length: countNum }).map((_, idx) => {
            const slotIdx = idx + 1;
            const currentSlot = slotData[slotIdx] || { eventId: '', files: [] };
            const rowCount = slotFileRowCount[slotIdx] || 1;

            return (
              <div key={slotIdx} className="exact-event-slot-card">
                <h4 className="exact-event-slot-title">Event {slotIdx}</h4>

                <div className="exact-slot-field-group">
                  <label className="exact-slot-field-label">Select Event</label>
                  <select
                    className="exact-slot-event-select"
                    value={currentSlot.eventId}
                    onChange={(e) => handleSelectEventForSlot(slotIdx, e.target.value)}
                  >
                    <option value="">-- Select Event --</option>
                    {matchingEvents.map(ev => {
                      const firstDay = ev.days?.[0] || {};
                      const optionLabel = ev.isMultiDay && ev.days?.length > 1
                        ? `🗓️ ${ev.eventName} (Multi-day: ${ev.days[0]?.date} – ${ev.days[ev.days.length - 1]?.date})`
                        : `🗓️ ${ev.eventName} (${firstDay.date || 'TBD'} | ${firstDay.startTime || '9:00 AM'} - ${firstDay.endTime || '1:00 PM'} | ${firstDay.venue || 'Campus'})`;

                      return (
                        <option key={ev.id} value={ev.id}>
                          {optionLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Upload Attendance Excel Sub-box (Image 3) */}
                {currentSlot.eventId && (
                  <div className="exact-upload-subcard">
                    <div className="exact-upload-subcard-header">
                      <div className="upload-header-left">
                        <span className="doc-icon">📄</span>
                        <span className="upload-header-title">Upload Attendance Excel</span>
                      </div>
                      <button
                        type="button"
                        className="btn-add-file-purple"
                        onClick={() => handleAddFileInputRow(slotIdx)}
                      >
                        + Add File
                      </button>
                    </div>

                    <div className="exact-file-inputs-list">
                      {Array.from({ length: rowCount }).map((_, fIdx) => (
                        <div key={fIdx} className="file-input-row">
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            className="exact-native-file-input"
                            onChange={(e) => handleFileInputChange(slotIdx, fIdx, e.target.files)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Segregate All Events Button (Images 2 & 3) */}
          <div className="exact-segregate-btn-wrapper">
            <button
              type="button"
              className="exact-btn-segregate-all"
              onClick={handleSegregateAll}
              disabled={isProcessing}
            >
              <span className="lightning-icon">⚡</span>
              <span>{isProcessing ? 'Segregating Attendance Sheets...' : 'Segregate All Events'}</span>
            </button>
          </div>

          <div className="exact-events-found-banner mt-2">
            <span className="green-check-icon">☑</span>
            <span className="green-found-text">{matchingEvents.length} event(s) found in range.</span>
          </div>
        </div>
      )}
    </div>
  );
}
