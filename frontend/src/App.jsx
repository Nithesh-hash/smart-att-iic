import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Settings,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Clock,
  Users,
  X,
  Plus,
  FileCheck
} from 'lucide-react';

import defaultSchoolsConfig from './config/schools.json';
import {
  processFilesForPreview,
  generateSegregatedZipClient
} from './services/attendanceProcessor';

const STORAGE_KEY = 'vit_attendance_custom_schools_mapping';

export default function App() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [eventEdits, setEventEdits] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  // Custom School Branch Mapping Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mappings, setMappings] = useState(defaultSchoolsConfig);
  const [mappingSearch, setMappingSearch] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [targetSchool, setTargetSchool] = useState('');

  const fileInputRef = useRef(null);

  // Load custom mappings from localStorage or fetch from backend
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setMappings(JSON.parse(saved));
        return;
      } catch (e) {
        console.warn('Corrupt localStorage mapping:', e);
      }
    }

    // Try fetching from backend API if available, fallback to defaultSchoolsConfig
    fetch('/api/config/schools')
      .then(res => {
        if (!res.ok) throw new Error('API config not available');
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error('Not JSON');
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object') {
          setMappings(data);
        }
      })
      .catch(() => {
        setMappings(defaultSchoolsConfig);
      });
  }, []);

  // Save custom mappings
  const saveMappings = (updated) => {
    setMappings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const resetMappingsToDefault = async () => {
    try {
      const res = await fetch('/api/config/schools');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setMappings(data);
      } else {
        setMappings(defaultSchoolsConfig);
      }
    } catch {
      setMappings(defaultSchoolsConfig);
    }
    localStorage.removeItem(STORAGE_KEY);
  };

  // Add a branch code to a school
  const handleAddBranch = (school) => {
    if (!newBranchCode.trim()) return;
    const code = newBranchCode.trim().toUpperCase();
    const existingBranches = mappings[school] || [];
    if (existingBranches.includes(code)) return;

    const updated = {
      ...mappings,
      [school]: [...existingBranches, code]
    };
    saveMappings(updated);
    setNewBranchCode('');
  };

  // Remove a branch code from a school
  const handleRemoveBranch = (school, codeToRemove) => {
    const updated = {
      ...mappings,
      [school]: (mappings[school] || []).filter(c => c !== codeToRemove)
    };
    saveMappings(updated);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
  };

  // When files are selected, update state and trigger preview analysis
  const handleFilesSelected = (newFiles) => {
    setErrorMessage(null);
    setDownloadSuccess(null);

    // Filter valid excel files
    const validFiles = newFiles.filter(f => f.name.match(/\.(xlsx|xls)$/i));
    if (validFiles.length === 0) {
      setErrorMessage('Please upload valid Excel files (.xlsx or .xls).');
      return;
    }

    const merged = [...files];
    validFiles.forEach(vf => {
      if (!merged.some(f => f.name === vf.name && f.size === vf.size)) {
        merged.push(vf);
      }
    });

    setFiles(merged);
    analyzeFiles(merged);
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    if (updated.length > 0) {
      analyzeFiles(updated);
    } else {
      setPreviewData(null);
      setRawEvents([]);
      setEventEdits({});
    }
  };

  const clearAllFiles = () => {
    setFiles([]);
    setPreviewData(null);
    setRawEvents([]);
    setEventEdits({});
    setErrorMessage(null);
    setDownloadSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Analyze files: In-Browser processing engine with backend fallback
  const analyzeFiles = async (filesToAnalyze) => {
    if (!filesToAnalyze || filesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      // 1. Primary: Run directly in browser memory (instant, Spark-compatible, 100% private)
      const { rawEvents: parsedRaw, previewData: clientData } = await processFilesForPreview(filesToAnalyze, mappings);
      setRawEvents(parsedRaw);
      setPreviewData(clientData);

      const initialEdits = {};
      clientData.events.forEach(ev => {
        initialEdits[ev.id] = {
          eventName: ev.eventName || '',
          eventDate: ev.eventDate || '',
          eventTime: ev.eventTime || ''
        };
      });
      setEventEdits(initialEdits);
    } catch (clientErr) {
      console.warn('In-browser analysis error, attempting API fallback:', clientErr);
      try {
        const formData = new FormData();
        filesToAnalyze.forEach(f => formData.append('files', f));

        if (Object.keys(mappings).length > 0) {
          formData.append('customMappings', JSON.stringify(mappings));
        }

        const res = await fetch('/api/preview', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(clientErr.message || 'Failed to parse attendance files.');
        }

        if (!res.ok) {
          let errText = 'Failed to analyze files.';
          try {
            const errJson = await res.json();
            if (errJson.error) errText = errJson.error;
          } catch {
            errText = `Server responded with status ${res.status}: ${res.statusText}`;
          }
          throw new Error(errText);
        }

        const data = await res.json();
        if (!data || !data.events) {
          throw new Error('Invalid preview response received from server.');
        }

        setPreviewData(data);

        const initialEdits = {};
        data.events.forEach(ev => {
          initialEdits[ev.id] = {
            eventName: ev.eventName || '',
            eventDate: ev.eventDate || '',
            eventTime: ev.eventTime || ''
          };
        });
        setEventEdits(initialEdits);
      } catch (err) {
        console.error('Preview analysis failed:', err);
        setErrorMessage(err.message || 'Failed to analyze attendance files.');
        setPreviewData(null);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle inline edits in preview table
  const handleEditChange = (eventId, field, value) => {
    setEventEdits(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [field]: value
      }
    }));
  };

  // Trigger Download: Generates ZIP in-browser (or falls back to backend)
  const handleDownloadZip = async () => {
    if (!files || files.length === 0) return;

    setIsDownloading(true);
    setErrorMessage(null);

    try {
      // 1. Primary: In-browser ZIP generation
      if (rawEvents && rawEvents.length > 0) {
        const result = await generateSegregatedZipClient(rawEvents, eventEdits, mappings);
        triggerDownload(result.blob, result.filename);

        setDownloadSuccess({
          filename: result.filename,
          schoolsCount: result.schoolsCount,
          totalStudents: result.totalStudents
        });
        return;
      }

      // 2. Fallback to API if rawEvents not cached
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('eventOverrides', JSON.stringify(eventEdits));

      if (Object.keys(mappings).length > 0) {
        formData.append('customMappings', JSON.stringify(mappings));
      }

      const response = await fetch('/api/segregate', {
        method: 'POST',
        body: formData
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Cloud Functions are not enabled. Re-upload your files to use instant in-browser generation.');
      }

      if (!response.ok) {
        let errText = 'Failed to generate ZIP archive.';
        try {
          const errJson = await response.json();
          if (errJson.error) errText = errJson.error;
        } catch {
          errText = `Server error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errText);
      }

      let filename = previewData?.suggestedZipName || 'all_schools.zip';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"']+)["']?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      triggerDownload(blob, filename);

      setDownloadSuccess({
        filename,
        schoolsCount: previewData?.schoolSummary?.length || 0,
        totalStudents: previewData?.totalStudentsProcessed || 0
      });
    } catch (err) {
      console.error('Download error:', err);
      setErrorMessage(err.message || 'Could not download ZIP archive.');
    } finally {
      setIsDownloading(false);
    }
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="app-container">
      {/* Institutional Header with Official VIT/IIC Banner & Top-Right Settings */}
      <header className="institutional-header">
        <button
          className="header-settings-btn"
          onClick={() => setIsModalOpen(true)}
          id="btn-branch-mappings"
          title="Branch Mappings Settings"
          aria-label="Branch Mappings Settings"
        >
          <Settings size={18} />
        </button>

        <div className="banner-wrapper">
          <img
            src="/header-banner.png"
            alt="Office of Innovation, Startup and Technology Transfer (VIT-IST) - SMART ATTENDANCE SEGREGATOR"
            className="official-banner-image"
          />
        </div>
      </header>

      {/* Error alert */}
      {errorMessage && (
        <div className="warnings-box" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)', marginBottom: '1.5rem' }}>
          <div className="warnings-header" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={18} />
            <strong>Error</strong>
          </div>
          <p style={{ color: '#991b1b', fontSize: '0.88rem' }}>{errorMessage}</p>
        </div>
      )}

      {/* Success alert */}
      {downloadSuccess && (
        <div className="warnings-box" style={{ borderColor: 'var(--success-border)', background: 'var(--success-bg)', marginBottom: '1.5rem' }}>
          <div className="warnings-header" style={{ color: 'var(--success)' }}>
            <CheckCircle2 size={18} />
            <strong>ZIP Downloaded Successfully!</strong>
          </div>
          <p style={{ color: '#065f46', fontSize: '0.88rem' }}>
            Generated <strong>{downloadSuccess.filename}</strong> containing {downloadSuccess.schoolsCount} school Excel files and SEGREGATION_SUMMARY.txt ({downloadSuccess.totalStudents} total students processed).
          </p>
        </div>
      )}

      {/* Upload Dropzone */}
      <section className="glass-card">
        <div
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          id="dropzone-area"
        >
          <div className="dropzone-icon-wrap">
            <UploadCloud size={32} />
          </div>
          <h2 className="dropzone-title">Upload Excel Attendance Sheets</h2>
          <p className="dropzone-subtitle">
            Drag and drop multiple <strong>.xlsx</strong> files here, or click to browse. Files are processed entirely in memory.
          </p>
          <span className="badge badge-info">20 MB limit per file • In-memory processing</span>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx, .xls"
            onChange={handleFileInputChange}
            className="file-input-hidden"
            id="file-input"
          />
        </div>

        {/* Selected files list */}
        {files.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {files.length} FILE{files.length === 1 ? '' : 'S'} SELECTED
              </span>
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={clearAllFiles}
                id="btn-clear-files"
              >
                <Trash2 size={14} /> Clear All
              </button>
            </div>

            <div className="file-list">
              {files.map((file, idx) => (
                <div key={`${file.name}_${idx}`} className="file-item">
                  <div className="file-info">
                    <FileSpreadsheet size={20} className="file-icon" />
                    <div>
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.3rem 0.5rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Loading state */}
      {isAnalyzing && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <RefreshCw size={36} className="spin" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Analyzing Attendance Sheets...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Detecting title blocks, normalizing dates & timings, deduplicating students, and mapping schools.
          </p>
        </div>
      )}

      {/* Preview Section */}
      {!isAnalyzing && previewData && previewData.events && (
        <>
          <section className="glass-card" id="preview-section">
            <div className="section-header">
              <div className="section-title">
                <FileCheck size={24} style={{ color: 'var(--primary)' }} />
                <span>Detected Events ({previewData.events.length})</span>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                Edit event titles, dates, or timings if needed before generating.
              </span>
            </div>

            <div className="events-container">
              {previewData.events.map((ev, index) => {
                const currentEdit = eventEdits[ev.id] || {
                  eventName: ev.eventName || '',
                  eventDate: ev.eventDate || '',
                  eventTime: ev.eventTime || ''
                };

                return (
                  <div key={ev.id || index} className="event-card">
                    <div className="event-header-row">
                      <div className="event-editable-title">
                        <label className="input-label">Event Name</label>
                        <input
                          type="text"
                          className="editable-input"
                          value={currentEdit.eventName}
                          onChange={(e) => handleEditChange(ev.id, 'eventName', e.target.value)}
                          placeholder="Event Name"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-info">
                          Source: {ev.filename} {ev.sheetName ? `(${ev.sheetName})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="event-datetime-grid">
                      <div>
                        <label className="input-label">
                          <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          Date (Normalized: DD Mon YYYY)
                        </label>
                        <input
                          type="text"
                          className="editable-input"
                          value={currentEdit.eventDate}
                          onChange={(e) => handleEditChange(ev.id, 'eventDate', e.target.value)}
                          placeholder="e.g. 08 Oct 2026"
                        />
                      </div>

                      <div>
                        <label className="input-label">
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          Time (Normalized: H:MM AM/PM – H:MM AM/PM)
                        </label>
                        <input
                          type="text"
                          className="editable-input"
                          value={currentEdit.eventTime}
                          onChange={(e) => handleEditChange(ev.id, 'eventTime', e.target.value)}
                          placeholder="e.g. 3:00 PM – 5:00 PM"
                        />
                      </div>
                    </div>

                    <div className="event-metrics">
                      <div className="metric-pill">
                        Valid Students: <strong>{ev.validRowsCount}</strong>
                      </div>
                      <div className="metric-pill">
                        Total Rows Found: <strong>{ev.totalRowsFound}</strong>
                      </div>
                      {ev.duplicatesRemoved > 0 && (
                        <span className="badge badge-warning">
                          {ev.duplicatesRemoved} duplicate{ev.duplicatesRemoved === 1 ? '' : 's'} removed
                        </span>
                      )}
                      {ev.rowsSkipped > 0 && (
                        <div className="metric-pill">
                          Non-student Rows: <strong>{ev.rowsSkipped}</strong>
                        </div>
                      )}
                      {ev.unknownBranches && ev.unknownBranches.length > 0 && (
                        <span className="badge badge-danger">
                          Unknown Branch: {ev.unknownBranches.join(', ')} (routed to UNKNOWN_SCHOOL.xlsx)
                        </span>
                      )}
                    </div>

                    {/* Discrepancy warnings */}
                    {ev.discrepancies && ev.discrepancies.length > 0 && (
                      <div className="warnings-box" style={{ marginTop: '0.75rem', padding: '0.65rem 1rem' }}>
                        <div className="warnings-header" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                          <AlertTriangle size={14} /> Sheet Column Discrepancies ({ev.discrepancies.length}):
                        </div>
                        <ul className="warnings-list" style={{ fontSize: '0.78rem' }}>
                          {ev.discrepancies.slice(0, 4).map((d, dIdx) => (
                            <li key={dIdx} className="warning-item">
                              • Student <strong>{d.regNo}</strong> (Branch {d.branchCode} maps to {d.mappedSchool}), but sheet column listed {d.sheetSchool}.
                            </li>
                          ))}
                          {ev.discrepancies.length > 4 && (
                            <li className="warning-item">• ...and {ev.discrepancies.length - 4} more.</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Global warnings if any */}
            {previewData.warnings && (
              <>
                {previewData.warnings.duplicateFiles?.length > 0 && (
                  <div className="warnings-box">
                    <div className="warnings-header">
                      <AlertTriangle size={16} /> Identical Files Detected
                    </div>
                    <ul className="warnings-list">
                      {previewData.warnings.duplicateFiles.map((w, idx) => (
                        <li key={idx} className="warning-item">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* School breakdown */}
            {previewData.schoolSummary && (
              <div style={{ marginTop: '2rem' }}>
                <div className="section-title" style={{ fontSize: '1.15rem' }}>
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  <span>School-wise Student Counts ({previewData.schoolSummary.length} schools)</span>
                </div>

                <div className="schools-grid">
                  {previewData.schoolSummary.map((sch) => {
                    const isUnknown = sch.schoolName === 'UNKNOWN_SCHOOL';
                    return (
                      <div
                        key={sch.schoolName}
                        className={`school-card ${isUnknown ? 'unknown-school' : ''}`}
                      >
                        <span className="school-name">{sch.schoolName}</span>
                        <span className="school-count">{sch.totalStudents}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="action-bar" id="action-bar">
              <div className="action-meta">
                <span className="zip-title">
                  <Download size={18} style={{ color: 'var(--primary)' }} />
                  {previewData.suggestedZipName || 'all_schools.zip'}
                </span>
                <span className="zip-subtext">
                  Total Students: <strong>{previewData.totalStudentsProcessed || 0}</strong> across {previewData.events.length} event(s)
                  {previewData.dateRange?.firstDateStr && ` • Date Range: ${previewData.dateRange.firstDateStr} – ${previewData.dateRange.lastDateStr}`}
                </span>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleDownloadZip}
                disabled={isDownloading}
                id="btn-download-zip"
                style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}
              >
                {isDownloading ? (
                  <>
                    <RefreshCw size={18} className="spin" /> Generating ZIP...
                  </>
                ) : (
                  <>
                    <Download size={18} /> Download Segregated ZIP
                  </>
                )}
              </button>
            </div>
          </section>
        </>
      )}

      {/* Branch Mappings Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Settings size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>School Branch Mappings</h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Registration number characters 3-5 determine the student's branch (e.g. <code>25BCE0014</code> gives <code>BCE</code>). Any code not listed here routes to <code>UNKNOWN_SCHOOL.xlsx</code>.
              </p>

              {/* Add code control */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Add Branch Code
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="editable-input"
                    style={{ flex: 1, minWidth: '140px' }}
                    value={targetSchool}
                    onChange={(e) => setTargetSchool(e.target.value)}
                  >
                    <option value="">Select School...</option>
                    {Object.keys(mappings).sort().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    maxLength={5}
                    placeholder="e.g. BCE"
                    className="editable-input"
                    style={{ width: '100px', textTransform: 'uppercase' }}
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value)}
                  />

                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!targetSchool || !newBranchCode.trim()}
                    onClick={() => handleAddBranch(targetSchool)}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Search filter */}
              <input
                type="text"
                placeholder="Search school or branch code (e.g. BCE, SCOPE)..."
                className="editable-input"
                style={{ marginBottom: '1.25rem' }}
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
              />

              {/* Mapping list */}
              <div>
                {Object.entries(mappings)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .filter(([school, branches]) => {
                    const q = mappingSearch.toLowerCase();
                    return school.toLowerCase().includes(q) ||
                           branches.some(b => b.toLowerCase().includes(q));
                  })
                  .map(([school, branches]) => (
                    <div key={school} className="mapping-school-row">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          {school}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {branches.length} code{branches.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="mapping-tags">
                        {branches.map(code => (
                          <span key={code} className="mapping-tag">
                            {code}
                            <span
                              className="mapping-tag-remove"
                              onClick={() => handleRemoveBranch(school, code)}
                              title={`Remove ${code}`}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={resetMappingsToDefault}
              >
                Reset to Defaults
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setIsModalOpen(false);
                  if (files.length > 0) analyzeFiles(files);
                }}
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Footer with Developer Credit */}
      <footer className="app-footer">
        <div className="footer-left">
          <span className="footer-tagline">
            VIT-IST • Office of Innovation, Startup & Technology Transfer
          </span>
        </div>
        <div className="footer-right">
          <span className="developer-credit">
            Developed by <strong>Nithesh Kumar T</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
