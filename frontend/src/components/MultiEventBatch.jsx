/**
 * Exact Excel Segregation Component
 * Matches Screenshots (Images 5, 6, 7, 8) and Image 4 Results View:
 * - Step 1 — Select Date Range: [ dd-mm-yyyy ] to [ dd-mm-yyyy ] [ 🔍 Find Events ]
 * - Step 2 — Number of Events to Segregate: Dropdown (-- Select --, 1, 2, 3...)
 * - Green check banner: "☑ X event(s) found in range."
 * - Event 1, Event 2... cards:
 *   - "Select Event" dropdown: 🗓️ EventName (Date | Time | Venue)
 *   - "📄 Upload Attendance Excel" sub-card with clean single file input (no "+ Add File" button)
 * - Full-width "⚡ Segregate All Events" button (#190059)
 * - Output matching Screenshot Image 4 (media_1793275267159_924e18a2.jpg):
 *   - ✅ Segregation Completed Successfully
 *   - Segregation Summary Report with [ ⬇ Download Summary ] button
 *   - 📦 Download All Schools (ZIP): ⬇ all_schools_YYYY-MM-DD_HHMMSS.zip
 *   - 📁 Individual School Files (X): ⬇ SchoolName_YYYY-MM-DD.xlsx
 */

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
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
  const [numberOfEvents, setNumberOfEvents] = useState('');

  // Event slots data: { [slotIndex]: { eventId: string, files: [File] } }
  const [slotData, setSlotData] = useState({});

  // Processing state & Results (Image 4)
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [segregationResult, setSegregationResult] = useState(null);

  useEffect(() => {
    async function load() {
      const events = await getEvents();
      setAllRegisteredEvents(events);
    }
    load();
  }, []);

  const handleFindEvents = () => {
    setErrorMessage(null);
    setSegregationResult(null);
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
    setSegregationResult(null);
    const count = parseInt(val, 10) || 0;

    const initialSlots = {};
    for (let i = 1; i <= count; i++) {
      initialSlots[i] = {
        eventId: slotData[i]?.eventId || '',
        files: slotData[i]?.files || []
      };
    }
    setSlotData(initialSlots);
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

  // Clean single file input handler (no "+ Add File" button)
  const handleFileInputChange = (slotIdx, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);

    setSlotData(prev => ({
      ...prev,
      [slotIdx]: {
        ...(prev[slotIdx] || { eventId: '' }),
        files: filesArray
      }
    }));
  };

  const handleSegregateAll = async () => {
    setErrorMessage(null);
    setSegregationResult(null);

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
        setErrorMessage(`Please choose an attendance Excel file for Event ${i} (${ev.eventName}).`);
        return;
      }

      const dayUploads = {};
      if (ev.isMultiDay && ev.days && ev.days.length > 1) {
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
      setSegregationResult(result);

      // Record in Segregation History
      try {
        const eventsNamesList = compiledSlots.map(s => {
          const firstDay = s.event.days?.[0] || {};
          return `• ${s.event.eventName} | ${firstDay.venue || 'Campus'} | ${firstDay.date || result.dateTag} (${firstDay.startTime || '9:00 AM'} - ${firstDay.endTime || '5:00 PM'})`;
        }).join('\n');

        const firstCoord = compiledSlots[0]?.event;
        const coordFormatted = firstCoord
          ? `${firstCoord.coordinatorName} (${firstCoord.school}${firstCoord.phoneNumber ? ` | ${firstCoord.phoneNumber}` : ''})`
          : 'Faculty Admin';

        await addSegregationHistory({
          eventDates: compiledSlots.map(s => s.event.days?.[0]?.date).filter(Boolean).join(', ') || result.dateTag,
          eventsSegregated: eventsNamesList,
          coordinatorFormatted,
          count: compiledSlots.length,
          zipName: result.zipName,
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

  // Download ZIP
  const handleDownloadZip = () => {
    if (!segregationResult?.blob) return;
    const url = window.URL.createObjectURL(segregationResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = segregationResult.zipName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Download Individual School File
  const handleDownloadSchoolFile = (schoolFile) => {
    if (!schoolFile?.blob) return;
    const url = window.URL.createObjectURL(schoolFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = schoolFile.fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Download Summary PDF
  const handleDownloadSummary = () => {
    if (!segregationResult) return;

    try {
      const doc = new jsPDF();
      doc.setFont('helvetica');

      // Header Banner
      doc.setFillColor(25, 0, 89);
      doc.rect(0, 0, 210, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SMART ATTENDANCE & EVENT MANAGEMENT PORTAL', 105, 12, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Institutional Segregation Summary Report', 105, 20, { align: 'center' });

      // Meta info
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 38);
      doc.text(`Total Students Processed: ${segregationResult.totalStudents}`, 15, 45);
      doc.text(`Total Schools Segregated: ${segregationResult.schoolsCount}`, 15, 52);
      doc.text(`Total Spreadsheets Parsed: ${segregationResult.totalFiles}`, 15, 59);

      // School Breakdown Table
      doc.setDrawColor(216, 180, 254);
      doc.setFillColor(248, 246, 254);
      doc.rect(15, 68, 180, 8, 'FD');

      doc.setTextColor(25, 0, 89);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 20, 73);
      doc.text('School / Department', 35, 73);
      doc.text('Generated File Name', 105, 73);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      let currentY = 82;

      segregationResult.schoolFiles?.forEach((sf, idx) => {
        doc.text(`${idx + 1}`, 20, currentY);
        doc.text(sf.schoolName, 35, currentY);
        doc.text(sf.fileName, 105, currentY);
        doc.line(15, currentY + 3, 195, currentY + 3);
        currentY += 8;

        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
      });

      doc.save(`Segregation_Summary_${segregationResult.dateTag}.pdf`);
    } catch (e) {
      // Fallback to text file download
      console.warn('PDF export fallback:', e);
      const blob = new Blob([segregationResult.summaryText], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Segregation_Summary_${segregationResult.dateTag}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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

      {/* RESULTS VIEW (Matching Screenshot Image 4) */}
      {segregationResult && (
        <div className="exact-results-card">
          <div className="exact-results-header">
            <span className="green-box-check">✅</span>
            <h3 className="results-heading-green">Segregation Completed Successfully</h3>
          </div>

          {/* Segregation Summary Report Banner */}
          <div className="exact-summary-report-box">
            <div className="summary-box-left">
              <span className="summary-doc-icon">📄</span>
              <div className="summary-text-group">
                <h4 className="summary-box-title">Segregation Summary Report</h4>
                <p className="summary-box-sub">PDF summary of this segregation run</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-download-summary-purple"
              onClick={handleDownloadSummary}
            >
              ⬇ Download Summary
            </button>
          </div>

          {/* Download All Schools (ZIP) */}
          <div className="exact-results-section mt-4">
            <div className="results-section-label">
              <span className="pkg-emoji">📦</span>
              <strong>Download All Schools (ZIP):</strong>
            </div>
            <div className="results-link-row">
              <button
                type="button"
                className="exact-download-link-btn"
                onClick={handleDownloadZip}
              >
                ⬇ <span className="link-underlined">{segregationResult.zipName}</span>
              </button>
            </div>
          </div>

          {/* Individual School Files (8) */}
          <div className="exact-results-section mt-4">
            <div className="results-section-label">
              <span className="folder-emoji">📁</span>
              <strong>Individual School Files ({segregationResult.schoolFiles?.length || 0})</strong>
            </div>
            <div className="individual-files-tree-list">
              {segregationResult.schoolFiles?.map((file, fIdx) => (
                <div key={fIdx} className="tree-file-item">
                  <button
                    type="button"
                    className="exact-download-link-btn"
                    onClick={() => handleDownloadSchoolFile(file)}
                  >
                    ⬇ <span className="link-underlined">{file.fileName}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Reset / Segregate More Button */}
          <div className="results-footer-action mt-6">
            <button
              type="button"
              className="exact-btn-reset-segregate"
              onClick={() => {
                setSegregationResult(null);
                setNumberOfEvents('');
              }}
            >
              ⚡ Segregate Another Batch
            </button>
          </div>
        </div>
      )}

      {/* FORM VIEW (Matching Images 5, 6, 7 & 8) */}
      {!segregationResult && (
        <>
          {/* Step 1 — Select Date Range */}
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

          {/* Step 2 — Number of Events to Segregate */}
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

          {/* Dynamic Event Slots (Clean UI - No "+ Add File" button) */}
          {hasSearched && countNum > 0 && (
            <div className="exact-slots-container mt-4">
              {Array.from({ length: countNum }).map((_, idx) => {
                const slotIdx = idx + 1;
                const currentSlot = slotData[slotIdx] || { eventId: '', files: [] };
                const chosenFiles = currentSlot.files || [];

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

                    {/* Upload Attendance Excel (Clean single input - No "+ Add File" button) */}
                    {currentSlot.eventId && (
                      <div className="exact-upload-subcard">
                        <div className="exact-upload-subcard-header">
                          <div className="upload-header-left">
                            <span className="doc-icon">📄</span>
                            <span className="upload-header-title">Upload Attendance Excel</span>
                          </div>
                        </div>

                        <div className="exact-file-inputs-list">
                          <input
                            type="file"
                            multiple
                            accept=".xlsx, .xls, .csv"
                            className="exact-native-file-input"
                            onChange={(e) => handleFileInputChange(slotIdx, e.target.files)}
                          />
                          {chosenFiles.length > 0 && (
                            <div className="selected-files-indicator">
                              {chosenFiles.map((f, fIdx) => (
                                <span key={fIdx} className="file-chip-name">
                                  📄 {f.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bottom Segregate All Events Button */}
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
        </>
      )}
    </div>
  );
}
