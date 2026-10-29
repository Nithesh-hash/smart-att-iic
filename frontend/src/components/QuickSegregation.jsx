/**
 * Quick Segregation Component
 * Standalone direct-upload attendance segregation tool.
 * Extracts events, normalizes metadata, groups students by branch/school,
 * and compiles styled Excel workbooks per department.
 */

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
  FileCheck,
  Lock
} from 'lucide-react';

import defaultSchoolsConfig from '../config/schools.json';
import {
  processFilesForPreview,
  generateSegregatedZipClient,
  segregateAttendance
} from '../services/attendanceProcessor';
import { addSegregationHistory } from '../services/dataService';

const STORAGE_KEY = 'vit_attendance_custom_schools_mapping';

export default function QuickSegregation() {
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

  // Branch Configuration Security PIN State (Password 2525)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleOpenSettings = () => {
    if (isAuthorized) {
      setIsModalOpen(true);
    } else {
      setAuthPin('');
      setAuthError('');
      setIsAuthModalOpen(true);
    }
  };

  const handleVerifyPin = (e) => {
    if (e) e.preventDefault();
    const correctPin = import.meta.env.VITE_BRANCH_CONFIG_PASSWORD || '2525';
    if (authPin.trim() === correctPin.trim()) {
      setIsAuthorized(true);
      setIsAuthModalOpen(false);
      setAuthPin('');
      setAuthError('');
      setIsModalOpen(true);
    } else {
      setAuthError('Incorrect Security PIN. Access Denied.');
    }
  };

  const fileInputRef = useRef(null);

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

  const saveMappings = (updated) => {
    setMappings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_att_mappings_changed', { detail: updated }));
    }

    // Immediately re-segregate live if raw files/events exist!
    if (rawEvents && rawEvents.length > 0) {
      try {
        const segResult = segregateAttendance(rawEvents, updated);
        setPreviewData(prev => prev ? ({
          ...prev,
          schoolsCount: segResult.schoolSummaryList.length,
          totalStudentsProcessed: segResult.totalStudentsProcessed,
          schoolSummary: segResult.schoolSummaryList,
          warnings: segResult.warnings,
          suggestedZipName: segResult.zipFilename
        }) : null);
      } catch (err) {
        console.warn('Live re-segregation notice:', err);
      }
    }
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

  const handleRemoveBranch = (school, codeToRemove) => {
    const updated = {
      ...mappings,
      [school]: (mappings[school] || []).filter(c => c !== codeToRemove)
    };
    saveMappings(updated);
  };

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

  const handleFilesSelected = (newFiles) => {
    setErrorMessage(null);
    setDownloadSuccess(null);

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

  const analyzeFiles = async (filesToAnalyze) => {
    if (!filesToAnalyze || filesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
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

  const handleEditChange = (eventId, field, value) => {
    setEventEdits(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [field]: value
      }
    }));
  };

  const handleDownloadZip = async () => {
    if (!files || files.length === 0) return;

    setIsDownloading(true);
    setErrorMessage(null);

    try {
      if (rawEvents && rawEvents.length > 0) {
        const result = await generateSegregatedZipClient(rawEvents, eventEdits, mappings);
        triggerDownload(result.blob, result.filename);

        setDownloadSuccess({
          filename: result.filename,
          schoolsCount: result.schoolsCount,
          totalStudents: result.totalStudents
        });

        // Audit Trail: Record in History
        try {
          await addSegregationHistory({
            runTitle: previewData?.events?.map(e => e.eventName).slice(0, 2).join(', ') || 'Quick Segregation Run',
            dateRange: `${previewData?.dateRange?.firstDateStr || 'N/A'} - ${previewData?.dateRange?.lastDateStr || 'N/A'}`,
            eventsProcessed: previewData?.events?.length || 1,
            totalStudents: result.totalStudents,
            schoolsRepresented: result.schoolsCount,
            filesCount: files.length,
            zipName: result.filename
          });
        } catch (histErr) {
          console.warn('Could not record segregation run in history:', histErr);
        }

        return;
      }

      // Backend fallback if needed
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
        throw new Error('Cloud Functions require Blaze plan, but in-browser engine is ready. Re-upload files.');
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
    <div className="quick-segregation-module">
      <div className="section-title-bar">
        <div>
          <h2 className="section-heading">⚡ Quick Single / Multi-File Segregation</h2>
          <p className="section-subheading">
            Instant client-side segregation. Drop any raw attendance sheets to auto-detect event blocks, normalize dates/timings, group branches into schools, and download a ready-to-use ZIP.
          </p>
        </div>
        <button
          className="btn-glass"
          onClick={handleOpenSettings}
          title="Configure Branch Mappings (Protected by PIN)"
        >
          <Settings size={18} />
          <span>Branch Mappings</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div
        className={`dropzone-container ${isDragging ? 'dropzone-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          accept=".xlsx, .xls"
          style={{ display: 'none' }}
        />
        <div className="dropzone-content">
          <div className="dropzone-icon-circle">
            <UploadCloud size={40} className="dropzone-icon" />
          </div>
          <h3 className="dropzone-title">Drag & Drop Attendance Excel Files</h3>
          <p className="dropzone-subtitle">
            Supports multiple <code>.xlsx</code> / <code>.xls</code> files or stacked event blocks in a single sheet.
          </p>
          <button
            type="button"
            className="btn-select-files"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current && fileInputRef.current.click();
            }}
          >
            Browse Files from Device
          </button>
        </div>
      </div>

      {/* Selected Files Chips */}
      {files.length > 0 && (
        <div className="uploaded-files-bar">
          <div className="uploaded-files-header">
            <span className="files-count-badge">
              <FileSpreadsheet size={16} />
              {files.length} File{files.length > 1 ? 's' : ''} Selected
            </span>
            <button className="btn-clear-all" onClick={clearAllFiles}>
              <Trash2 size={14} /> Clear All
            </button>
          </div>
          <div className="file-chips-grid">
            {files.map((file, idx) => (
              <div key={idx} className="file-chip">
                <FileSpreadsheet size={18} className="file-chip-icon" />
                <div className="file-chip-info">
                  <span className="file-chip-name" title={file.name}>{file.name}</span>
                  <span className="file-chip-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                  className="file-chip-remove"
                  onClick={() => removeFile(idx)}
                  title="Remove this file"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="alert-box alert-error">
          <AlertTriangle size={20} className="alert-icon" />
          <div className="alert-text">{errorMessage}</div>
          <button className="alert-close" onClick={() => setErrorMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Download Success Alert */}
      {downloadSuccess && (
        <div className="alert-box alert-success">
          <CheckCircle2 size={20} className="alert-icon" />
          <div className="alert-text">
            <strong>Segregation Complete!</strong> Downloaded <code>{downloadSuccess.filename}</code> covering {downloadSuccess.schoolsCount} schools and {downloadSuccess.totalStudents} students.
          </div>
          <button className="alert-close" onClick={() => setDownloadSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isAnalyzing && (
        <div className="analyzing-card">
          <RefreshCw size={28} className="spinning-icon" />
          <p>Analyzing sheets, extracting event titles, and segregating branches...</p>
        </div>
      )}

      {/* Preview Section */}
      {previewData && !isAnalyzing && (
        <div className="preview-section-card">
          <div className="preview-header">
            <div className="preview-title-block">
              <h3>Parsed Event Segregation Preview</h3>
              <p>Review and edit normalized event titles, dates, and times inline before generating workbooks.</p>
            </div>
            <button
              className="btn-download-primary"
              onClick={handleDownloadZip}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={18} className="spinning-icon" />
                  <span>Packaging ZIP...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Generate & Download ZIP</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="quick-metrics-row">
            <div className="metric-badge">
              <span className="metric-val">{previewData.events.length}</span>
              <span className="metric-lbl">Event Block{previewData.events.length > 1 ? 's' : ''}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-val">{previewData.totalStudentsProcessed}</span>
              <span className="metric-lbl">Total Students</span>
            </div>
            <div className="metric-badge">
              <span className="metric-val">{previewData.schoolSummary.length}</span>
              <span className="metric-lbl">Schools Involved</span>
            </div>
            <div className="metric-badge">
              <span className="metric-val">{previewData.dateRange?.firstDateStr || 'N/A'}</span>
              <span className="metric-lbl">Date Range</span>
            </div>
          </div>

          {/* Warning notice if discrepancies or duplicates found */}
          {(previewData.warnings?.duplicateFiles?.length > 0 || previewData.warnings?.unknownBranches?.length > 0) && (
            <div className="warning-notice-banner">
              <AlertTriangle size={18} />
              <div>
                {previewData.warnings.duplicateFiles.length > 0 && (
                  <p>{previewData.warnings.duplicateFiles[0]}</p>
                )}
                {previewData.warnings.unknownBranches.length > 0 && (
                  <p>
                    Unknown branch codes found (will be placed in <code>UNKNOWN_SCHOOL.xlsx</code>):{' '}
                    <strong>{previewData.warnings.unknownBranches.join(', ')}</strong>. You can map them in Branch Mappings.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Interactive Events Preview Table */}
          <div className="table-responsive-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Source File / Sheet</th>
                  <th>Extracted Event Name</th>
                  <th>Normalized Date</th>
                  <th>Normalized Timing</th>
                  <th>Valid Students</th>
                  <th>Duplicates Removed</th>
                  <th>Rows Skipped</th>
                </tr>
              </thead>
              <tbody>
                {previewData.events.map((ev, index) => {
                  const edits = eventEdits[ev.id] || {};
                  return (
                    <tr key={ev.id || index}>
                      <td className="cell-index">{index + 1}</td>
                      <td>
                        <div className="file-sheet-tag">
                          <span className="file-name-text">{ev.filename}</span>
                          <span className="sheet-name-tag">{ev.sheetName}</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={edits.eventName !== undefined ? edits.eventName : ev.eventName}
                          onChange={(e) => handleEditChange(ev.id, 'eventName', e.target.value)}
                        />
                      </td>
                      <td>
                        <div className="input-with-icon">
                          <Calendar size={14} className="input-inner-icon" />
                          <input
                            type="text"
                            className="table-input"
                            value={edits.eventDate !== undefined ? edits.eventDate : ev.eventDate}
                            onChange={(e) => handleEditChange(ev.id, 'eventDate', e.target.value)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="input-with-icon">
                          <Clock size={14} className="input-inner-icon" />
                          <input
                            type="text"
                            className="table-input"
                            value={edits.eventTime !== undefined ? edits.eventTime : ev.eventTime}
                            onChange={(e) => handleEditChange(ev.id, 'eventTime', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="cell-num highlight-green">{ev.validRowsCount}</td>
                      <td className="cell-num">{ev.duplicatesRemoved > 0 ? <span className="tag-warning">{ev.duplicatesRemoved}</span> : '0'}</td>
                      <td className="cell-num">{ev.rowsSkipped}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* School Wise Count Chips */}
          <div className="school-breakdown-card">
            <h4>Estimated School-Wise Student Distribution:</h4>
            <div className="school-chips-flex">
              {previewData.schoolSummary.map((sch, i) => (
                <div key={i} className="school-count-pill">
                  <span className="school-pill-name">{sch.schoolName}</span>
                  <span className="school-pill-count">{sch.totalStudents}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branch Settings Security PIN Modal (Password 2525) */}
      {isAuthModalOpen && (
        <div className="modal-backdrop">
          <div className="security-pin-modal-card animate-dev-slide-up">
            <div className="security-pin-header">
              <div className="security-pin-icon-wrap">
                <Lock size={22} className="security-lock-icon" />
              </div>
              <div className="security-pin-title-block">
                <h3 className="security-pin-title">Security PIN Required</h3>
                <p className="security-pin-desc">
                  Enter authorization PIN to manage school and branch mappings.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAuthModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyPin} className="security-pin-form">
              <div className="security-input-group">
                <label className="security-pin-label">Authorization PIN</label>
                <input
                  type="password"
                  autoFocus
                  maxLength={10}
                  placeholder="Enter PIN"
                  className={`security-pin-input ${authError ? 'security-input-error' : ''}`}
                  value={authPin}
                  onChange={(e) => {
                    setAuthPin(e.target.value);
                    if (authError) setAuthError('');
                  }}
                />
              </div>

              {authError && (
                <div className="security-pin-error-text">
                  <AlertTriangle size={14} />
                  <span>{authError}</span>
                </div>
              )}

              <div className="security-modal-footer">
                <button
                  type="button"
                  className="btn-security-cancel"
                  onClick={() => setIsAuthModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-security-submit">
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom School Branch Mapping Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-group">
                <Settings size={22} className="modal-icon" />
                <div>
                  <h3 className="modal-title">Central Branch-to-School Mapping</h3>
                  <p className="modal-desc">
                    Map 3-character branch codes (characters 3–5 of registration numbers) to institutional schools.
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-toolbar">
              <input
                type="text"
                placeholder="Search branch code or school name..."
                className="modal-search-input"
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
              />
              <button
                className="btn-modal-reset"
                onClick={resetMappingsToDefault}
                title="Reset to default institutional configuration"
              >
                <RefreshCw size={14} /> Reset Defaults
              </button>
            </div>

            {/* Quick Add Bar */}
            <div className="modal-quick-add-bar">
              <input
                type="text"
                placeholder="Branch code (e.g. BCE, BVD)"
                maxLength={4}
                value={newBranchCode}
                onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                className="modal-add-input"
              />
              <select
                className="modal-add-select"
                value={targetSchool}
                onChange={(e) => setTargetSchool(e.target.value)}
              >
                <option value="">Select Target School...</option>
                {Object.keys(mappings).map(sch => (
                  <option key={sch} value={sch}>{sch}</option>
                ))}
              </select>
              <button
                className="btn-modal-add"
                disabled={!newBranchCode.trim() || !targetSchool}
                onClick={() => {
                  handleAddBranch(targetSchool);
                }}
              >
                <Plus size={16} /> Add Code
              </button>
            </div>

            {/* Mapping Grid */}
            <div className="modal-mappings-scroll">
              {Object.entries(mappings)
                .filter(([school, branches]) => {
                  if (!mappingSearch) return true;
                  const s = mappingSearch.toLowerCase();
                  if (school.toLowerCase().includes(s)) return true;
                  return branches.some(b => b.toLowerCase().includes(s));
                })
                .map(([school, branches]) => (
                  <div key={school} className="school-mapping-row">
                    <div className="school-mapping-meta">
                      <span className="school-name-badge">{school}</span>
                      <span className="school-branch-count">{branches.length} branch codes</span>
                    </div>
                    <div className="branch-tags-flex">
                      {branches.map(code => (
                        <span key={code} className="branch-tag">
                          {code}
                          <button
                            type="button"
                            className="branch-tag-delete"
                            onClick={() => handleRemoveBranch(school, code)}
                            title={`Remove ${code} from ${school}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            <div className="modal-footer">
              <button className="btn-modal-save" onClick={() => setIsModalOpen(false)}>
                Done & Save Mappings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

