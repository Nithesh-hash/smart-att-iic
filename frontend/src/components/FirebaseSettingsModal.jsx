/**
 * Firebase Cloud Settings & Database Seeder Modal Component
 */

import React, { useState } from 'react';
import {
  Database,
  Save,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  resetDbConnection
} from '../firebase/firebaseConfig';
import { seedInitialData, isUsingFirebase } from '../services/dataService';

export default function FirebaseSettingsModal({ onClose, onConfigSaved }) {
  const [config, setConfig] = useState(() => getSavedFirebaseConfig());
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isConnected = isUsingFirebase();

  const handleFieldChange = (key, val) => {
    setConfig(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSave = () => {
    saveFirebaseConfig(config);
    resetDbConnection();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    if (onConfigSaved) onConfigSaved();
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedInitialData();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
      if (onConfigSaved) onConfigSaved();
    } catch (err) {
      console.error('Seed database failed:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <Database size={24} className="modal-icon" />
            <div>
              <h3 className="modal-title">Firebase Cloud & Persistence Settings</h3>
              <p className="modal-desc">
                Configure Google Cloud Firestore credentials or initialize demo database collections.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="firebase-status-banner">
          <div className={`status-pill-large ${isConnected ? 'pill-cloud' : 'pill-offline'}`}>
            <span className="status-dot"></span>
            <strong>Status:</strong> {isConnected ? 'Connected to Firestore Cloud' : 'Operating in LocalStorage Fallback Mode'}
          </div>
          <p className="status-explainer">
            When Firebase keys are blank or offline, all events and segregation history safely persist in browser <code>localStorage</code>.
          </p>
        </div>

        {saveSuccess && (
          <div className="alert-box alert-success">
            <CheckCircle2 size={18} />
            <span>Firebase configuration saved! Storage connection refreshed.</span>
          </div>
        )}

        {seedSuccess && (
          <div className="alert-box alert-success">
            <Sparkles size={18} />
            <span>Database initialized with institutional sample events & segregation records!</span>
          </div>
        )}

        <div className="firebase-form-grid">
          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              type="text"
              className="form-input"
              placeholder="AIzaSy..."
              value={config.apiKey || ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="smart-att-iic"
              value={config.projectId || ''}
              onChange={(e) => handleFieldChange('projectId', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Auth Domain</label>
            <input
              type="text"
              className="form-input"
              placeholder="smart-att-iic.firebaseapp.com"
              value={config.authDomain || ''}
              onChange={(e) => handleFieldChange('authDomain', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Storage Bucket</label>
            <input
              type="text"
              className="form-input"
              placeholder="smart-att-iic.appspot.com"
              value={config.storageBucket || ''}
              onChange={(e) => handleFieldChange('storageBucket', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Messaging Sender ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="123456789"
              value={config.messagingSenderId || ''}
              onChange={(e) => handleFieldChange('messagingSenderId', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">App ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="1:123456789:web:abcdef"
              value={config.appId || ''}
              onChange={(e) => handleFieldChange('appId', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer-dual">
          <button
            type="button"
            className="btn-seed-database"
            onClick={handleSeed}
            disabled={isSeeding}
            title="Populate with realistic events and segregation history"
          >
            {isSeeding ? <RefreshCw size={16} className="spinning-icon" /> : <Sparkles size={16} />}
            <span>{isSeeding ? 'Seeding Database...' : 'Seed Sample Institutional Data'}</span>
          </button>

          <div className="footer-right-buttons">
            <button className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-modal-save" onClick={handleSave}>
              <Save size={16} />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
