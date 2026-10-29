/**
 * Module 2: Advanced Multi-Event Batch Segregation Engine
 * 4-Step Guided Workflow:
 * 1. Date Range Filter
 * 2. Dynamic Event Slot Creator
 * 3. Daily Drag-and-Drop Spreadsheet Zones
 * 4. In-Memory SheetJS Extraction, Time Normalization, and ZIP Packaging
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Filter,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { getEvents, addSegregationHistory } from '../services/dataService';
import { processMultiEventBatch } from '../services/batchProcessor';

export default function MultiEventBatch() {
  // Step 1: Date Range Filter
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

  // Step 2: Dynamic Event Slots
  const [slotsCount, setSlotsCount] = useState(2);
  const [selectedSlots, setSelectedSlots] = useState([]); // [{ slotId: 1, eventId: '' }, ...]

  // Step 3: Daily Uploads { [slotId]: { [dayIndex]: [File, File...] } }
  const [dayUploads, setDayUploads] = useState({});

  // Processing & State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [batchResult, setBatchResult] = useState(null);

  // Load events from Data Service
  useEffect(() => {
    async function load() {
      const events = await getEvents();
      setAllRegisteredEvents(events);
    }
    load();
  }, []);

  // Filter events within Date Range
  useEffect(() => {
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
  }, [fromDate, toDate, allRegisteredEvents]);

  // Adjust slots count
  useEffect(() => {
    const currentLength = selectedSlots.length;
    if (slotsCount > currentLength) {
      const added = [];
      for (let i = currentLength; i < slotsCount; i++) {
        added.push({ slotId: i + 1, eventId: '' });
      }
      setSelectedSlots([...selectedSlots, ...added]);
    } else if (slotsCount < currentLength) {
      setSelectedSlots(selectedSlots.slice(0, slotsCount));
    }
  }, [slotsCount]);

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
      const updated = dayData.filter((_, i) => i !== fileIdx);
      return {
        ...prev,
        [slotId]: {
          ...slotData,
          [dayIndex]: updated
        }
      };
    });
  };

  const handleRunBatchSegregation = async () => {
    setErrorMsg(null);
    setBatchResult(null);

    // Validate that at least one slot has an event selected and files uploaded
    const compiledEventSlots = [];
    for (const slot of selectedSlots) {
      if (!slot.eventId) continue;
      const ev = allRegisteredEvents.find(e => e.id === slot.eventId);
      if (!ev) continue;

      const uploadsForThisSlot = dayUploads[slot.slotId] || {};
      // Check if at least one day has files
      const hasFiles = Object.values(uploadsForThisSlot).some(arr => arr && arr.length > 0);
      if (hasFiles) {
        compiledEventSlots.push({
          event: ev,
          dayUploads: uploadsForThisSlot
        });
      }
    }

    if (compiledEventSlots.length === 0) {
      setErrorMsg('Please select at least one event and upload attendance sheets for its scheduled days.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await processMultiEventBatch(compiledEventSlots);

      // Trigger direct browser download
      const filename = `multi_event_batch_${fromDate}_to_${toDate}.zip`;
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
        eventsCount: compiledEventSlots.length,
        totalStudents: result.totalStudents,
        schoolsCount: result.schoolsCount,
        filesCount: result.totalFiles
      });

      // Audit Trail: Record in History
      try {
        await addSegregationHistory({
          runTitle: `Multi-Event Batch (${compiledEventSlots.map(s => s.event.eventName).slice(0, 2).join(', ')})`,
          dateRange: `${fromDate} to ${toDate}`,
          eventsProcessed: compiledEventSlots.length,
          totalStudents: result.totalStudents,
          schoolsRepresented: result.schoolsCount,
          filesCount: result.totalFiles,
          zipName: filename
        });
      } catch (hErr) {
        console.warn('Could not record batch history:', hErr);
      }
    } catch (err) {
      console.error('Batch segregation processing failed:', err);
      setErrorMsg(err.message || 'Batch segregation process failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="multi-event-batch-container">
      <div className="section-title-bar">
        <div>
          <h2 className="section-heading">📑 Multi-Event Batch Segregation Engine</h2>
          <p className="section-subheading">
            Query registered events, assign dynamic slots, link daily attendance sheets per session, and compile multi-school departmental workbooks into a unified archive.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="alert-box alert-error">
          <AlertTriangle size={20} className="alert-icon" />
          <div className="alert-text">{errorMsg}</div>
          <button className="alert-close" onClick={() => setErrorMsg(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {batchResult && (
        <div className="alert-box alert-success">
          <CheckCircle2 size={20} className="alert-icon" />
          <div className="alert-text">
            <strong>Batch Segregation Successful!</strong> Downloaded <code>{batchResult.filename}</code> covering {batchResult.eventsCount} events, {batchResult.schoolsCount} schools, and {batchResult.totalStudents} total student records.
          </div>
          <button className="alert-close" onClick={() => setBatchResult(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Step 1: Date Filter */}
      <div className="step-card">
        <div className="step-badge-row">
          <span className="step-indicator">Step 1</span>
          <h3 className="step-title">Query Registered Events by Date Window</h3>
        </div>
        <p className="step-desc">
          Specify a date range to filter institutional events scheduled in this period.
        </p>

        <div className="date-filter-row">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <div className="input-icon-wrapper">
              <Calendar size={16} className="field-icon" />
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">To Date</label>
            <div className="input-icon-wrapper">
              <Calendar size={16} className="field-icon" />
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-summary-pill">
            <Filter size={16} />
            <span>{matchingEvents.length} Event{matchingEvents.length === 1 ? '' : 's'} Match Window</span>
          </div>
        </div>
      </div>

      {/* Step 2: Slot Creator */}
      <div className="step-card mt-6">
        <div className="step-badge-row">
          <span className="step-indicator">Step 2</span>
          <h3 className="step-title">Event Slot Allocation</h3>
        </div>
        <p className="step-desc">
          Select how many events you want to batch-process simultaneously.
        </p>

        <div className="slot-counter-row">
          <label className="form-label">Number of Events to Process:</label>
          <div className="slot-buttons-flex">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                type="button"
                className={`btn-slot-num ${slotsCount === num ? 'slot-num-active' : ''}`}
                onClick={() => setSlotsCount(num)}
              >
                {num} Event{num > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Event Slots & Daily Dropzones */}
      <div className="step-card mt-6">
        <div className="step-badge-row">
          <span className="step-indicator">Step 3</span>
          <h3 className="step-title">Event Session Matching & Daily Spreadsheet Uploads</h3>
        </div>
        <p className="step-desc">
          For each slot, pick an event and drop the attendance sheets for each scheduled day.
        </p>

        <div className="slots-list-wrapper">
          {selectedSlots.map((slot) => {
            const selectedEvent = allRegisteredEvents.find(e => e.id === slot.eventId);
            const slotUploads = dayUploads[slot.slotId] || {};

            return (
              <div key={slot.slotId} className="event-slot-card">
                <div className="slot-header-bar">
                  <span className="slot-header-title">
                    <Layers size={18} /> Slot {slot.slotId}
                  </span>

                  <select
                    className="slot-event-select"
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

                {selectedEvent ? (
                  <div className="slot-days-container">
                    <div className="slot-event-meta-strip">
                      <span><strong>Coordinator:</strong> {selectedEvent.coordinatorName}</span>
                      <span><strong>School:</strong> {selectedEvent.school}</span>
                      <span><strong>Type:</strong> {selectedEvent.eventType}</span>
                    </div>

                    <div className="days-dropzones-grid">
                      {selectedEvent.days.map((day) => {
                        const uploadedForThisDay = slotUploads[day.dayIndex] || [];
                        const inputId = `file_input_${slot.slotId}_${day.dayIndex}`;

                        return (
                          <div key={day.dayIndex} className="day-dropzone-box">
                            <div className="day-dropzone-header">
                              <span className="day-label-tag">Day {day.dayIndex}</span>
                              <span className="day-date-tag">{day.date}</span>
                            </div>

                            <div className="day-venue-time-sub">
                              <span>📍 {day.venue}</span>
                              <span>⏰ {day.startTime} – {day.endTime}</span>
                            </div>

                            {/* Drop Zone Area */}
                            <label
                              htmlFor={inputId}
                              className="day-drop-area"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer.files) {
                                  handleFilesAddedToDay(slot.slotId, day.dayIndex, e.dataTransfer.files);
                                }
                              }}
                            >
                              <UploadCloud size={24} className="day-upload-icon" />
                              <span className="day-drop-prompt">Drop <code>.xlsx</code> / <code>.csv</code> or click</span>
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

                            {/* Uploaded Files for Day */}
                            {uploadedForThisDay.length > 0 && (
                              <div className="day-files-list">
                                {uploadedForThisDay.map((f, fIdx) => (
                                  <div key={fIdx} className="day-file-item">
                                    <FileSpreadsheet size={14} />
                                    <span className="day-file-name" title={f.name}>{f.name}</span>
                                    <button
                                      type="button"
                                      className="day-file-remove"
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
                  <div className="slot-empty-notice">
                    Please select a registered event from the dropdown above to view its scheduled session days.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Process Batch Button */}
        <div className="batch-action-bar">
          <button
            type="button"
            className="btn-run-batch"
            onClick={handleRunBatchSegregation}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={20} className="spinning-icon" />
                <span>Extracting SheetJS Rows & Generating ZIP...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Execute Batch Segregation & Download ZIP</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
