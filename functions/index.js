/**
 * Attendance Segregator Backend
 * Express App exported as a Firebase Cloud Function (2nd Gen)
 * In-memory processing using Multer (20MB limit), ExcelJS, and Archiver.
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const { onRequest } = require('firebase-functions/v2/https');

const { parseExcelBuffer, defaultSchoolsConfig } = require('./parser');
const { segregateAttendance } = require('./segregate');
const { generateSchoolWorkbook } = require('./excelWriter');
const { generateSummaryText } = require('./summary');

const app = express();

// Enable CORS
app.use(cors({ origin: true }));
app.use(express.json());

// In-memory Multer configuration (20 MB limit)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check extension
    if (file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: "${file.originalname}". Only Excel (.xlsx, .xls) files are allowed.`));
    }
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Attendance Segregator API is operational' });
});

/**
 * Default school-branch mappings endpoint
 */
app.get('/api/config/schools', (req, res) => {
  res.json(defaultSchoolsConfig);
});

/**
 * POST /api/preview (or /api/parse)
 * Parses uploaded Excel files into event blocks and student lists.
 * Returns metadata, duplicate counts, skipped rows, unknown branches, and discrepancies.
 */
app.post('/api/preview', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    let customMappings = null;
    if (req.body.customMappings) {
      try {
        customMappings = typeof req.body.customMappings === 'string'
          ? JSON.parse(req.body.customMappings)
          : req.body.customMappings;
      } catch (e) {
        console.warn('Failed to parse customMappings:', e.message);
      }
    }

    const allEvents = [];
    for (const file of req.files) {
      const parsed = await parseExcelBuffer(file.buffer, file.originalname, customMappings);
      allEvents.push(...parsed);
    }

    // Run preview segregation to generate summary metrics and detect identical files
    const segResult = segregateAttendance(allEvents, customMappings);

    res.json({
      success: true,
      events: allEvents.map(e => ({
        id: e.id,
        filename: e.filename,
        sheetName: e.sheetName,
        eventName: e.eventName,
        eventDate: e.eventDate,
        dateIso: e.dateIso,
        eventTime: e.eventTime,
        startMinutes: e.startMinutes,
        totalRowsFound: e.totalRowsFound,
        validRowsCount: e.validRowsCount,
        duplicatesRemoved: e.duplicatesRemoved,
        rowsSkipped: e.rowsSkipped,
        unknownBranches: e.unknownBranches,
        discrepancies: e.discrepancies,
        signature: e.signature,
        studentCount: e.students.length
      })),
      schoolSummary: segResult.schoolSummaryList,
      totalStudentsProcessed: segResult.totalStudentsProcessed,
      dateRange: segResult.dateRange,
      suggestedZipName: segResult.zipFilename,
      warnings: segResult.warnings,
      defaultSchools: defaultSchoolsConfig
    });
  } catch (error) {
    console.error('Error during preview:', error);
    res.status(500).json({ error: error.message || 'Failed to parse attendance files.' });
  }
});

/**
 * POST /api/segregate
 * Accepts files and generates ZIP containing segregated Excel files per school + SEGREGATION_SUMMARY.txt
 */
app.post('/api/segregate', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded for segregation.' });
    }

    // Parse custom mappings if provided
    let customMappings = null;
    if (req.body.customMappings) {
      try {
        customMappings = typeof req.body.customMappings === 'string'
          ? JSON.parse(req.body.customMappings)
          : req.body.customMappings;
      } catch (e) {
        console.warn('Failed to parse customMappings:', e.message);
      }
    }

    // Parse event overrides (user edits from preview table: { [eventId or index]: { eventName, eventDate, eventTime } })
    let eventOverrides = {};
    if (req.body.eventOverrides) {
      try {
        eventOverrides = typeof req.body.eventOverrides === 'string'
          ? JSON.parse(req.body.eventOverrides)
          : req.body.eventOverrides;
      } catch (e) {
        console.warn('Failed to parse eventOverrides:', e.message);
      }
    }

    // 1. Parse all files in memory
    const parsedEvents = [];
    for (let fIdx = 0; fIdx < req.files.length; fIdx++) {
      const file = req.files[fIdx];
      const eventsFromFile = await parseExcelBuffer(file.buffer, file.originalname, customMappings);

      for (let eIdx = 0; eIdx < eventsFromFile.length; eIdx++) {
        const ev = eventsFromFile[eIdx];

        // Apply override if user edited event details in preview
        const override = eventOverrides[ev.id] ||
                         eventOverrides[`${ev.filename}_${eIdx}`] ||
                         eventOverrides[ev.filename];

        if (override) {
          if (override.eventName) ev.eventName = override.eventName.trim();
          if (override.eventDate) {
            ev.eventDate = override.eventDate.trim();
            const normD = require('./parser').normalizeDate(ev.eventDate);
            if (normD.iso) {
              ev.dateIso = normD.iso;
              ev.eventDate = normD.formatted;
            }
          }
          if (override.eventTime) {
            ev.eventTime = override.eventTime.trim();
            const normT = require('./parser').normalizeTime(ev.eventTime);
            if (normT.startMinutes !== undefined) {
              ev.startMinutes = normT.startMinutes;
              ev.eventTime = normT.formatted;
            }
          }
          // Refresh signature
          const sortedRegs = ev.students.map(s => s.regNo).sort();
          ev.signature = `${ev.eventName.toLowerCase()}__${ev.eventDate}__${ev.eventTime}__${sortedRegs.join(',')}`;
        }

        parsedEvents.push(ev);
      }
    }

    if (parsedEvents.length === 0) {
      return res.status(400).json({ error: 'No valid attendance events or student registration numbers found.' });
    }

    // 2. Perform Segregation
    const segResult = segregateAttendance(parsedEvents, customMappings);

    // 3. Setup Archiver to stream ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error generating ZIP archive.' });
      }
    });

    const zipFilename = segResult.zipFilename || 'all_schools.zip';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('X-Zip-Filename', zipFilename);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Zip-Filename');

    archive.pipe(res);

    // 4. Generate and append Excel files for each school (in CAPITALS)
    for (const [schoolName, schoolData] of segResult.schoolsMap.entries()) {
      if (schoolData.events.length === 0 || schoolData.totalStudents === 0) continue;

      const excelBuffer = await generateSchoolWorkbook(schoolName, schoolData.events);
      const filenameInCapitals = `${schoolName.toUpperCase()}.xlsx`;
      archive.append(excelBuffer, { name: filenameInCapitals });
    }

    // 5. Append SEGREGATION_SUMMARY.txt
    const summaryText = generateSummaryText(segResult);
    archive.append(summaryText, { name: 'SEGREGATION_SUMMARY.txt' });

    // Finalize archive
    await archive.finalize();
  } catch (error) {
    console.error('Error during segregation:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Segregation process failed.' });
    }
  }
});

// Error handling middleware for multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds limit of 20 MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Cloud Function 2nd Generation export (Blaze plan required in production)
exports.api = onRequest(
  {
    cors: true,
    maxInstances: 10,
    memory: '512MiB',
    timeoutSeconds: 120
  },
  app
);

// Local standalone server support (for development without emulator)
if (process.env.NODE_ENV !== 'production' && !process.env.FIREBASE_CONFIG) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Backend server running locally on http://localhost:${PORT}`);
  });
}
