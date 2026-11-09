/**
 * Automatic OD Extraction Engine
 * Automatically extracts student registration numbers from generated segregation ZIP files
 * and school-wise Excel spreadsheets, maps them to event dates and timings, and creates
 * individual student OD records in Firebase Firestore.
 * 
 * Executes 100% automatically in the background upon segregation completion.
 * Zero manual clicks required from the admin.
 */

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  getFirestore,
  doc,
  setDoc,
  writeBatch,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { getDb } from '../firebase/firebaseConfig';
import { isValidRegNo } from './batchProcessor';
import { sanitizeForFirestore } from './dataService';

const OD_RECORDS_CACHE_KEY = 'smart_att_od_records_store';

/**
 * Normalizes registration number
 */
function normalizeRegNo(regNo) {
  return String(regNo || '').trim().toUpperCase();
}

/**
 * Creates a deterministic, sanitised document ID for idempotency:
 * e.g. "22MIS0001_ev_1793_2026-11-02"
 */
export function buildDeterministicRecordId(normalizedRegNo, eventId, eventDate) {
  const cleanReg = normalizeRegNo(normalizedRegNo);
  const cleanEvId = String(eventId || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDate = String(eventDate || 'date').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanReg}_${cleanEvId}_${cleanDate}`;
}

/**
 * Extract all unique registration numbers from an Excel file buffer or Uint8Array using SheetJS
 */
export function extractRegNumbersFromWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const foundRegs = new Set();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (cell !== undefined && cell !== null) {
          const str = String(cell).trim().toUpperCase();
          const matches = str.match(/\b\d{2}[A-Z]{3}\d{4}\b/g);
          if (matches) {
            matches.forEach(m => foundRegs.add(m));
          }
        }
      }
    }
  }

  return Array.from(foundRegs);
}

/**
 * Extract student registration numbers and metadata from a generated ZIP file (Blob or ArrayBuffer)
 * Iterates through all school workbooks (e.g. SCOPE.xlsx, SELECT.xlsx, SITE.xlsx, etc.)
 */
export async function extractFromZipArchive(zipBlobOrBuffer) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipBlobOrBuffer);
  const extractedFiles = [];

  const fileEntries = Object.keys(loadedZip.files).filter(
    name => !name.startsWith('__MACOSX') && !name.startsWith('.') && (name.endsWith('.xlsx') || name.endsWith('.xls'))
  );

  for (const fileName of fileEntries) {
    const file = loadedZip.file(fileName);
    if (!file) continue;

    try {
      const buffer = await file.async('uint8array');
      const regNumbers = extractRegNumbersFromWorkbookBuffer(buffer);
      const schoolName = fileName.replace(/\.(xlsx|xls)$/i, '').trim();

      extractedFiles.push({
        fileName,
        schoolName,
        regNumbers
      });
    } catch (err) {
      console.warn(`Could not extract from ${fileName} inside ZIP:`, err);
    }
  }

  return extractedFiles;
}

/**
 * Core Automation Engine:
 * Processes segregation output, extracts all students across all school workbooks,
 * maps them to event dates and timings, and commits them to Firestore student_od_records.
 * 
 * @param {Object} params
 * @param {Blob} params.zipBlob - The generated all_schools.zip archive
 * @param {Array} params.compiledSlots - Event slot definitions with events metadata
 * @param {string} params.segregationId - Unique segregation run ID
 * @param {string} params.zipName - Name of the generated zip
 */
export async function autoExtractAndStoreODRecords({
  zipBlob,
  compiledSlots = [],
  segregationId = `seg_${Date.now()}`,
  zipName = 'all_schools.zip'
}) {
  console.log('⚡ Starting Automatic OD Extraction for segregation:', segregationId);

  const startTime = Date.now();
  let totalFilesProcessed = 0;
  let totalRegistrationNumbersFound = 0;
  let totalODRecordsCreated = 0;
  let totalDuplicatesSkipped = 0;
  let totalErrors = 0;

  // Map to collect all individual student OD records
  const generatedRecordsMap = new Map();

  try {
    // 1. Extract all school Excel files from the generated ZIP
    let zipExtractedSchools = [];
    if (zipBlob) {
      try {
        zipExtractedSchools = await extractFromZipArchive(zipBlob);
        totalFilesProcessed = zipExtractedSchools.length;
        console.log(`📂 Extracted ${zipExtractedSchools.length} school workbooks from ZIP archive`);
      } catch (zipErr) {
        console.warn('ZIP extraction failed, falling back to slot attendance inspection:', zipErr);
      }
    }

    // 2. Map every school and its student registration numbers to the corresponding events
    // Case A: Using the compiledSlots with event metadata (most accurate for multi-event & multi-day)
    for (const slot of compiledSlots) {
      const event = slot.event;
      if (!event) continue;

      const eventId = event.id || `ev_${Date.now()}`;
      const eventName = event.eventName || 'Institutional Event';
      const days = event.days && event.days.length > 0 ? event.days : [
        {
          dayIndex: 1,
          date: event.date || new Date().toISOString().split('T')[0],
          venue: event.venue || 'Campus',
          startTime: event.startTime || '9:00 AM',
          endTime: event.endTime || '5:00 PM'
        }
      ];

      for (const day of days) {
        const dayDate = day.date || event.date || new Date().toISOString().split('T')[0];
        const dayStartTime = day.startTime || event.startTime || 'Timing not available';
        const dayEndTime = day.endTime || event.endTime || 'Timing not available';
        const venue = day.venue || event.venue || 'Campus';

        // Find all student registration numbers for this day
        // Priority 1: From the extracted ZIP files
        if (zipExtractedSchools.length > 0) {
          for (const schoolEntry of zipExtractedSchools) {
            for (const rawReg of schoolEntry.regNumbers) {
              const cleanReg = normalizeRegNo(rawReg);
              if (!isValidRegNo(cleanReg)) continue;

              totalRegistrationNumbersFound++;
              const recordId = buildDeterministicRecordId(cleanReg, eventId, dayDate);

              if (generatedRecordsMap.has(recordId)) {
                totalDuplicatesSkipped++;
                continue;
              }

              generatedRecordsMap.set(recordId, {
                recordId,
                registrationNumber: cleanReg,
                normalizedRegistrationNumber: cleanReg,
                eventId,
                eventName: event.isMultiDay && event.days?.length > 1
                  ? `${eventName} (Day ${day.dayIndex || 1})`
                  : eventName,
                eventDate: dayDate,
                odStartTime: dayStartTime,
                odEndTime: dayEndTime,
                venue,
                school: schoolEntry.schoolName || 'VIT School',
                sourceFile: schoolEntry.fileName || `${schoolEntry.schoolName}.xlsx`,
                segregationId,
                coordinatorName: event.coordinatorName || '',
                coordinatorSchool: event.school || '',
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (slot.dayUploads) {
          // Priority 2: Fallback to reading the slot day uploads directly
          const dayFiles = slot.dayUploads[day.dayIndex] || slot.dayUploads[1] || [];
          for (const file of dayFiles) {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const foundRegs = extractRegNumbersFromWorkbookBuffer(arrayBuffer);
              for (const rawReg of foundRegs) {
                const cleanReg = normalizeRegNo(rawReg);
                if (!isValidRegNo(cleanReg)) continue;

                totalRegistrationNumbersFound++;
                const recordId = buildDeterministicRecordId(cleanReg, eventId, dayDate);

                if (generatedRecordsMap.has(recordId)) {
                  totalDuplicatesSkipped++;
                  continue;
                }

                generatedRecordsMap.set(recordId, {
                  recordId,
                  registrationNumber: cleanReg,
                  normalizedRegistrationNumber: cleanReg,
                  eventId,
                  eventName: event.isMultiDay && event.days?.length > 1
                    ? `${eventName} (Day ${day.dayIndex || 1})`
                    : eventName,
                  eventDate: dayDate,
                  odStartTime: dayStartTime,
                  odEndTime: dayEndTime,
                  venue,
                  school: 'VIT School',
                  sourceFile: file.name,
                  segregationId,
                  coordinatorName: event.coordinatorName || '',
                  coordinatorSchool: event.school || '',
                  createdAt: new Date().toISOString()
                });
              }
            } catch (err) {
              console.warn('Error reading day upload fallback file:', err);
              totalErrors++;
            }
          }
        }
      }
    }

    const recordsToSave = Array.from(generatedRecordsMap.values());
    totalODRecordsCreated = recordsToSave.length;
    console.log(`📊 Generated ${totalODRecordsCreated} unique student OD records to persist.`);

    // 3. Persist to Cloud Firestore in chunks of up to 450 (Firestore limit is 500 per batch)
    const db = getDb();
    if (db && recordsToSave.length > 0) {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < recordsToSave.length; i += CHUNK_SIZE) {
        const chunk = recordsToSave.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const record of chunk) {
          const docRef = doc(db, 'student_od_records', record.recordId);
          const sanitized = sanitizeForFirestore(record);
          batch.set(docRef, sanitized, { merge: true });
        }

        await batch.commit();
        console.log(`💾 Committed batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} OD records) to Firestore`);
      }
    }

    // 4. Update LocalStorage cache for instant local access
    try {
      const existingRaw = localStorage.getItem(OD_RECORDS_CACHE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingMap = new Map(existing.map(r => [r.recordId, r]));

      for (const rec of recordsToSave) {
        existingMap.set(rec.recordId, rec);
      }

      localStorage.setItem(OD_RECORDS_CACHE_KEY, JSON.stringify(Array.from(existingMap.values())));
    } catch (e) {
      console.warn('LocalStorage OD cache write warning:', e);
    }

    // 5. Store Extraction Log in Firestore
    const logData = {
      segregationId,
      eventId: compiledSlots[0]?.event?.id || 'batch_events',
      extractionStatus: 'completed',
      totalFilesProcessed,
      totalRegistrationNumbersFound,
      totalODRecordsCreated,
      totalDuplicatesSkipped,
      totalErrors,
      durationMs: Date.now() - startTime,
      processedAt: new Date().toISOString()
    };

    if (db) {
      try {
        await setDoc(doc(db, 'od_extraction_logs', `log_${segregationId}`), logData);
        console.log('✅ OD extraction log saved to Firestore');
      } catch (logErr) {
        console.warn('Could not save extraction log to Firestore:', logErr);
      }
    }

    // Dispatch custom event for real-time UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_att_od_records_updated', {
        detail: { count: totalODRecordsCreated, segregationId }
      }));
    }

    return {
      success: true,
      totalODRecordsCreated,
      totalFilesProcessed,
      records: recordsToSave
    };
  } catch (globalErr) {
    console.error('❌ Automatic OD Extraction failed:', globalErr);
    // Log failure in Firestore if possible
    const db = getDb();
    if (db) {
      try {
        await setDoc(doc(db, 'od_extraction_logs', `log_${segregationId}`), {
          segregationId,
          extractionStatus: 'failed',
          errorMessage: globalErr.message || 'Unknown extraction error',
          totalErrors: totalErrors + 1,
          processedAt: new Date().toISOString()
        });
      } catch (e) {}
    }

    // Return without crashing the main segregation flow
    return {
      success: false,
      error: globalErr.message
    };
  }
}
