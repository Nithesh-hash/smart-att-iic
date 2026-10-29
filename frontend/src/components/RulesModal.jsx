/**
 * Institutional Rules & Operating Guide Modal Component
 */

import React from 'react';
import { BookOpen, CheckCircle, ShieldCheck, X, FileSpreadsheet, Clock } from 'lucide-react';

export default function RulesModal({ onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-large">
        <div className="modal-header">
          <div className="modal-title-group">
            <BookOpen size={24} className="modal-icon" />
            <div>
              <h3 className="modal-title">Institutional Rules & Segregation Guidelines</h3>
              <p className="modal-desc">
                Standard operating guidelines for attendance segregation and event data processing.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="rules-content-body">
          <div className="rule-card">
            <div className="rule-card-header">
              <CheckCircle size={18} className="rule-icon" />
              <h4>1. Student Registration Number Specification</h4>
            </div>
            <p>
              Students must possess a valid 9-character registration number matching the regex:
              <code>/^\d&#123;2&#125;[A-Za-z]&#123;3&#125;\d&#123;4&#125;$/</code> (e.g. <code>23BCE1001</code>, <code>25BDS0201</code>, <code>24BVD0011</code>).
            </p>
            <ul>
              <li>Characters 1–2 represent the admission year prefix (e.g., <code>23</code>, <code>25</code>).</li>
              <li>Characters 3–5 represent the academic branch code (e.g., <code>BCE</code>, <code>BDS</code>, <code>BVD</code>).</li>
              <li>Characters 6–9 represent the individual 4-digit roll number.</li>
            </ul>
          </div>

          <div className="rule-card">
            <div className="rule-card-header">
              <FileSpreadsheet size={18} className="rule-icon" />
              <h4>2. Automated School Mapping & Output Workbooks</h4>
            </div>
            <p>
              Each student is sorted into their corresponding School/Department workbook (e.g., <code>SCOPE.xlsx</code>, <code>SENSE.xlsx</code>, <code>SMEC.xlsx</code>).
            </p>
            <ul>
              <li>Inside each workbook, branches are laid out side-by-side with yellow header styling (<code>#FFE699</code>).</li>
              <li>Student records are sorted primarily by admission year prefix, then ascending by registration number.</li>
              <li>Any unrecognized branch code is automatically routed to <code>UNKNOWN_SCHOOL.xlsx</code> for manual verification.</li>
            </ul>
          </div>

          <div className="rule-card">
            <div className="rule-card-header">
              <Clock size={18} className="rule-icon" />
              <h4>3. Time Normalization & Rounding Logic</h4>
            </div>
            <p>
              When processing multi-event batch sessions, times with minute values greater than or equal to 30 are automatically rounded up to the nearest top-of-hour:
            </p>
            <ul>
              <li><code>09:30 AM</code> is normalized to <code>10:00 AM</code>.</li>
              <li><code>02:45 PM</code> is normalized to <code>03:00 PM</code>.</li>
              <li><code>11:15 AM</code> remains in its exact slot without rounding.</li>
            </ul>
          </div>

          <div className="rule-card">
            <div className="rule-card-header">
              <ShieldCheck size={18} className="rule-icon" />
              <h4>4. 100% In-Browser Privacy & Zero Server Upload</h4>
            </div>
            <p>
              All spreadsheet parsing, metadata extraction, and ZIP compression execute completely inside your browser's local memory. No student attendance spreadsheets or sensitive records are ever transmitted over the network or saved to public servers.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-modal-save" onClick={onClose}>
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

