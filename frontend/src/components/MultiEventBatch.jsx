/**
 * Exact Excel Segregation Component
 * Matches Image 5 from screenshots:
 * - Excel Segregation (Heading)
 * - Step 1 — Select Date Range
 * - [ dd-mm-yyyy ] to [ dd-mm-yyyy ] [ 🔍 Find Events ] button
 * - Followed by Event Slot selection, Daily Spreadsheets Upload, and ZIP generation
 */

import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, X, Layers } from 'lucide-react';
import { getEvents, addSegregationHistory } from '../services/dataService';
import { processMultiEventBatch } from '../services/batchProcessor';

export default function MultiEventBatch() {
  // Step 1: Date Range Filter (Exact UI from Screenshot 5)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [allRegisteredEvents, setAllRegisteredEvents] = useState([]);
  const [matchingEvents, setMatchingEvents] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Step 2: Slots
  const [slotsCount, setSlotsCount] = useState(2);
  const [selectedSlots, setSelectedSlots] = useState([
    { slotId: 1, eventId: '' },
    { slotId: 2, eventId: '' }
  ]);

  // Step 3: Daily Uploads { [slotId]: { [dayIndex]: [File, File...] } }
  const [dayUploads, setDayUploads] = useState({});

  // Processing & Feedback
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => {
    async function load() {
      const list = await getEvents();
      setAllRegisteredEvents(list);
    }
    load();
  }, []);

  const handleFindEvents = () => {
    setErrorMsg(null);
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

  const handleSlotCountChange = (count) => {
    setSlotsCount(count);
    const updated = [];
    for (let i = 1; i <= count; i++) {
      const existing = selectedSlots.find(s => s.slotId === i);
      updated.push(existing || { slotId: i, eventId: '' });
    }
    setSelectedSlots(updated);
  };

  const handleSelectEventForSlot = (slotId, eventId) => {
    setSelectedSlots(prev => prev.map(s => (s.slotId === slotId ? { ...s, eventId } : s)));
  };

  const handleFilesAddedToDay = (slotId, dayIndex, filesList) => {
    const valid = Array.from(filesList).filter(f => f.name.match(/\.(xlsx|xls|csv)$/i));
    if (valid.length === 0) return;

    setDayUploads(prev => {
      const slotData = prev[slotId] || {};
      const dayData = slotData[dayIndex] || [];
      return {
        ...prev,
        [slotId]: {
          ...slotData,
          [dayIndex]: [...dayData, ...valid]
        }
      };
    });
  };

  const handleRemoveFile = (slotId, dayIndex, fileIdx) => {
    setDayUploads(prev => {
      const slotData = prev[slotId] || {};
      const dayData = slotData[dayIndex] || [];
      return {
        ...prev,
        [slotId]: {
          ...slotData,
          [dayIndex]: dayData.filter((_, i) => i !== fileIdx)
        }
      };
    });
  };

  const handleExecuteSegregation = async () => {
    setErrorMsg(null);
    setBatchResult(null);

    const compiledSlots = [];
    for (const slot of selectedSlots) {
      if (!slot.eventId) continue;
      const ev = allRegisteredEvents.find(e => e.id === slot.eventId);
      if (!ev) continue;

      const uploads = dayUploads[slot.slotId] || {};
      const hasFiles = Object.values(uploads).some(arr => arr && arr.length > 0);
      if (hasFiles) {
        compiledSlots.push({
          event: ev,
          dayUploads: uploads
        });
      }
    }

    if (compiledSlots.length === 0) {
      setErrorMsg('Please select at least one event and upload attendance sheets for its scheduled days.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await processMultiEventBatch(compiledSlots);

      const filename = `all_schools_${fromDate}_to_${toDate}.zip`;
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBatchResult({
        filename,
        eventsCount: compiledSlots.length,
        totalStudents: result.totalStudents,
        schoolsCount: result.schoolsCount,
        filesCount: result.totalFiles
      });

      // Log into Segregation History
      try {
        await addSegregationHistory({
          runTitle: `Batch Segregation (${compiledSlots.map(s => s.event.eventName).slice(0, 2).join(', ')})`,
          dateRange: `${fromDate} to ${toDate}`,
          eventsProcessed: compiledSlots.length,
          totalStudents: result.totalStudents,
          schoolsRepresented: result.schoolsCount,
          filesCount: result.totalFiles,
          zipName: filename
        });
      } catch (hErr) {
        console.warn('History recording error:', hErr);
      }
    } catch (err) {
      console.error('Batch error:', err);
      setErrorMsg(err.message || 'Segregation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="exact-form-outer-card">
      <h2 className="exact-card-heading">Excel Segregation</h2>

      {errorMsg && (
        <div className="exact-alert-box exact-alert-error">
          {errorMsg}
        </div>
      )}

      {batchResult && (
        <div className="exact-alert-box exact-alert-success">
          <strong>Batch Segregation Completed!</strong> Downloaded <code>{batchResult.filename}</code> covering {batchResult.eventsCount} events, {batchResult.schoolsCount} schools, and {batchResult.totalStudents} total student registrations.
        </div>
      )}

      {/* Step 1 - Select Date Range (Exact from Screenshot 5) */}
      <div className="step1-exact-section">
        <h4 className="step1-exact-subtitle">Step 1 — Select Date Range</h4>

        <div className="step1-exact-inputs-row">
          <input
            type="date"
            className="exact-date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <span className="step1-to-text">to</span>

          <input
            type="date"
            className="exact-date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <button
            type="button"
            className="exact-btn-find-events"
            onClick={handleFindEvents}
          >
            <span className="search-icon-symbol">🔍</span>
            <span>Find Events</span>
          </button>
        </div>
      </div>

      {/* Step 2 & 3: Slot Allocation & File Dropzones (revealed after clicking Find Events) */}
      {hasSearched && (
        <div className="batch-workflow-section mt-6">
          <div className="step2-exact-section">
            <h4 className="step1-exact-subtitle">
              Step 2 — Allocate Event Slots ({matchingEvents.length} event{matchingEvents.length === 1 ? '' : 's'} available in range)
            </h4>

            <div className="slot-selection-chips">
              <span className="slot-label-text">Select number of events:</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`btn-slot-pill ${slotsCount === n ? 'slot-pill-active' : ''}`}
                  onClick={() => handleSlotCountChange(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Slots Mapping */}
          <div className="step3-exact-section mt-4">
            <h4 className="step1-exact-subtitle">
              Step 3 — Link Registered Events & Drop Attendance Spreadsheets
            </h4>

            <div className="slots-grid-list">
              {selectedSlots.map(slot => {
                const currentEv = allRegisteredEvents.find(e => e.id === slot.eventId);
                const slotDays = dayUploads[slot.slotId] || {};

                return (
                  <div key={slot.slotId} className="slot-container-card">
                    <div className="slot-top-row">
                      <span className="slot-badge-number">Slot {slot.slotId}</span>

                      <select
                        className="exact-form-input slot-dropdown-select"
                        value={slot.eventId}
                        onChange={(e) => handleSelectEventForSlot(slot.slotId, e.target.value)}
                      >
                        <option value="">-- Choose an Event to Link --</option>
                        {matchingEvents.map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {ev.eventName} ({ev.school} • {ev.eventType} • {ev.isMultiDay ? `${ev.days.length} Days` : 'Single Day'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentEv ? (
                      <div className="slot-days-layout">
                        <div className="slot-event-summary">
                          <span><strong>Coordinator:</strong> {currentEv.coordinatorName}</span>
                          <span><strong>School:</strong> {currentEv.school}</span>
                          <span><strong>Type:</strong> {currentEv.eventType}</span>
                        </div>

                        <div className="slot-days-dropzones-row">
                          {currentEv.days.map(day => {
                            const filesForDay = slotDays[day.dayIndex] || [];
                            const inputId = `batch_file_${slot.slotId}_${day.dayIndex}`;

                            return (
                              <div key={day.dayIndex} className="exact-day-card">
                                <div className="exact-day-badge-header">
                                  <span className="day-index-badge">Day {day.dayIndex}</span>
                                  <span className="day-date-span">{day.date}</span>
                                </div>

                                <div className="day-sub-info">
                                  <span>📍 {day.venue}</span>
                                  <span>⏰ {day.startTime} – {day.endTime}</span>
                                </div>

                                <label
                                  htmlFor={inputId}
                                  className="exact-day-dropzone"
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files) {
                                      handleFilesAddedToDay(slot.slotId, day.dayIndex, e.dataTransfer.files);
                                    }
                                  }}
                                >
                                  <UploadCloud size={20} className="dropzone-mini-icon" />
                                  <span className="dropzone-mini-text">Drop <code>.xlsx</code> / <code>.csv</code> or click</span>
                                  <input
                                    id={inputId}
                                    type="file"
                                    multiple
                                    accept=".xlsx, .xls, .csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        handleFilesAddedToDay(slot.slotId, day.dayIndex, e.target.files);
                                      }
                                    }}
                                  />
                                </label>

                                {filesForDay.length > 0 && (
                                  <div className="exact-files-sublist">
                                    {filesForDay.map((f, fIdx) => (
                                      <div key={fIdx} className="exact-file-tag">
                                        <FileSpreadsheet size={13} />
                                        <span className="file-name-truncated" title={f.name}>{f.name}</span>
                                        <button
                                          type="button"
                                          className="btn-remove-mini-file"
                                          onClick={() => handleRemoveFile(slot.slotId, day.dayIndex, fIdx)}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="slot-empty-guide">
                        Select an event from the dropdown to display its scheduled sessions.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Execute Segregation Button */}
            <div className="exact-submit-wrapper mt-6">
              <button
                type="button"
                className="exact-btn-submit"
                onClick={handleExecuteSegregation}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing Segregation & Packaging ZIP...' : 'Execute Segregation & Download ZIP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
