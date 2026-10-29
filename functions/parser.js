/**
 * Parser Module for Attendance Segregator
 * Extracts event metadata (Title, Date, Time) and student registration numbers
 * Handles stacked blocks, date/time normalization, and discrepancy detection.
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Load default school branch mapping
const defaultSchoolsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'schools.json'), 'utf8')
);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

/**
 * Normalizes any recognized date string to "DD Mon YYYY" (e.g., "07 Oct 2026")
 * Also returns an ISO string for sorting (e.g., "2026-10-07")
 */
function normalizeDate(rawStr) {
  if (!rawStr) return { formatted: '', iso: '' };

  const str = String(rawStr).trim();

  // 1. Check for "DD Mon YYYY" or "DD Month YYYY" or "Month DD YYYY" (e.g., "08 Oct 2026", "8 Oct 2026")
  const wordMatch = str.match(/(?:^|[_\s\-\/,|:\.])(\d{1,2})(?:st|nd|rd|th)?[\s\-_]+([A-Za-z]{3,9})[\s\-_]+(\d{2,4})(?:$|[_\s\-\/,|:\.])/i) ||
                    str.match(/(?:^|[_\s\-\/,|:\.])([A-Za-z]{3,9})[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?[\s\-_,]+(\d{2,4})(?:$|[_\s\-\/,|:\.])/i);

  if (wordMatch) {
    let day, monthStr, yearStr;
    if (isNaN(parseInt(wordMatch[1], 10))) {
      // Form: Month Day Year
      monthStr = wordMatch[1].toLowerCase();
      day = parseInt(wordMatch[2], 10);
      yearStr = wordMatch[3];
    } else {
      // Form: Day Month Year
      day = parseInt(wordMatch[1], 10);
      monthStr = wordMatch[2].toLowerCase();
      yearStr = wordMatch[3];
    }

    if (MONTH_MAP[monthStr] !== undefined) {
      let year = parseInt(yearStr, 10);
      if (year < 100) year += 2000;
      const mIdx = MONTH_MAP[monthStr];
      const dd = String(day).padStart(2, '0');
      const mm = String(mIdx + 1).padStart(2, '0');
      return {
        formatted: `${dd} ${MONTH_NAMES[mIdx]} ${year}`,
        iso: `${year}-${mm}-${dd}`
      };
    }
  }

  // 2. Check for numeric dates: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, or DD-MM-YY (e.g. 7-10-26, _24-10-2026)
  const numMatch = str.match(/(?:^|[_\s\-\/,|:\.])(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})(?:$|[_\s\-\/,|:\.])/);
  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);

    // If month > 12 and day <= 12, swap (handles MM/DD/YYYY if inverted)
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mIdx = month - 1;
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return {
        formatted: `${dd} ${MONTH_NAMES[mIdx]} ${year}`,
        iso: `${year}-${mm}-${dd}`
      };
    }
  }

  // 3. Check for ISO format: YYYY-MM-DD
  const isoMatch = str.match(/(?:^|[_\s\-\/,|:\.])(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})(?:$|[_\s\-\/,|:\.])/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mIdx = month - 1;
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return {
        formatted: `${dd} ${MONTH_NAMES[mIdx]} ${year}`,
        iso: `${year}-${mm}-${dd}`
      };
    }
  }

  return { formatted: str, iso: '' };
}

/**
 * Normalizes single time piece (e.g., "3pm", "3:00 PM", "8 AM", "14:00", "7:20 PM")
 */
function parseTimePiece(timeStr) {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toUpperCase();

  // Pattern: HH:MM AM/PM or HH AM/PM
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const modifier = ampmMatch[3];

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    // Default to PM for typical afternoon numbers without modifier (e.g. 1..6) if ambiguous
    const minutesTotal = hours * 60 + minutes;

    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    const displayMod = hours >= 12 ? 'PM' : 'AM';
    const displayMin = String(minutes).padStart(2, '0');

    return {
      minutesTotal,
      display: `${displayHours}:${displayMin} ${displayMod}`
    };
  }

  return null;
}

/**
 * Normalizes time ranges into "H:MM AM/PM – H:MM AM/PM" (e.g. "2:00 PM – 7:20 PM")
 */
function normalizeTime(rawStr) {
  if (!rawStr) return { formatted: '', startMinutes: 0 };
  const str = String(rawStr).trim();

  // Look for time range separated by "to", "-", "–", or "until"
  const rangeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:to|-|–|until)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (rangeMatch) {
    let startPart = rangeMatch[1].trim();
    let endPart = rangeMatch[2].trim();

    // If startPart has no AM/PM but endPart does, infer AM/PM
    const endHasAmPm = /(AM|PM)/i.test(endPart);
    const startHasAmPm = /(AM|PM)/i.test(startPart);
    if (endHasAmPm && !startHasAmPm) {
      const endModifier = endPart.match(/(AM|PM)/i)[1].toUpperCase();
      const sHour = parseInt(startPart.split(':')[0], 10);
      const eHour = parseInt(endPart.split(':')[0], 10);
      
      // If start hour > end hour and end is PM, start is likely AM (e.g. 8 to 1:20 PM)
      if (endModifier === 'PM' && sHour > eHour) {
        startPart += ' AM';
      } else {
        startPart += ' ' + endModifier;
      }
    }

    const t1 = parseTimePiece(startPart);
    const t2 = parseTimePiece(endPart);

    if (t1 && t2) {
      return {
        formatted: `${t1.display} – ${t2.display}`,
        startMinutes: t1.minutesTotal
      };
    }
  }

  // Single time fallback
  const single = parseTimePiece(str);
  if (single) {
    return {
      formatted: single.display,
      startMinutes: single.minutesTotal
    };
  }

  return { formatted: str, startMinutes: 0 };
}

/**
 * Extracts event name, date, and time from title strings or cell arrays.
 */
function extractEventMetadata(cellsOrText, filename = '') {
  const combined = Array.isArray(cellsOrText) ? cellsOrText.filter(Boolean).join(' | ') : String(cellsOrText || '');

  let eventName = '';
  let rawDate = '';
  let rawTime = '';

  // 1. Split by delimiters like '|'
  const parts = combined.split('|').map(p => p.trim());

  const remainingParts = [];

  for (const part of parts) {
    // Check if it's Venue (we drop venue from output)
    if (/^Venue\s*:/i.test(part)) {
      continue;
    }

    let workingPart = part;

    // Check if part contains a date pattern directly or prefixed
    const datePrefixMatch = workingPart.match(/^(?:Date|Dated)\s*[:\-]?\s*(.+)$/i);
    if (datePrefixMatch) {
      rawDate = datePrefixMatch[1].trim();
      continue;
    }

    const extractedDate = normalizeDate(workingPart);
    if (extractedDate.iso && !rawDate) {
      rawDate = extractedDate.formatted;
      // Remove the matched date from workingPart so title doesn't retain it
      workingPart = workingPart.replace(/(?:^|[_\s\-\/,|:])\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}(?:$|[_\s\-\/,|:])/g, ' ')
                               .replace(/(?:^|[_\s\-\/,|:])\d{1,2}(?:st|nd|rd|th)?[\s\-_]+[A-Za-z]{3,9}[\s\-_]+\d{2,4}(?:$|[_\s\-\/,|:])/ig, ' ')
                               .trim();
    }

    // Check for Time / Timings
    const timePrefixMatch = workingPart.match(/^(?:Time|Timings)\s*[:\-]?\s*(.+)$/i);
    if (timePrefixMatch) {
      rawTime = timePrefixMatch[1].trim();
      continue;
    }

    const timeMatch = workingPart.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i);
    if (timeMatch && !rawTime) {
      rawTime = timeMatch[0];
      workingPart = workingPart.replace(timeMatch[0], ' ').trim();
    }

    // Clean up remaining text for event name
    const cleanedText = workingPart.replace(/^[_\-\s|:]+|[_\-\s|:]+$/g, '');
    if (cleanedText && !eventName) {
      eventName = cleanedText;
    } else if (cleanedText) {
      remainingParts.push(cleanedText);
    }
  }

  // If event name not found yet, use first substantial remaining part
  if (!eventName && remainingParts.length > 0) {
    eventName = remainingParts[0];
  }

  const baseFilename = filename ? path.basename(filename, path.extname(filename)) : '';

  // Fallback Date from filename if missing
  if (!rawDate && baseFilename) {
    const fnDate = normalizeDate(baseFilename);
    if (fnDate.iso) {
      rawDate = fnDate.formatted;
    }
  }

  // Fallback Time from filename if missing
  if (!rawTime && baseFilename) {
    const fnTimeMatch = baseFilename.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i);
    if (fnTimeMatch) {
      rawTime = fnTimeMatch[0];
    }
  }

  // Fallback Event Name from filename if missing
  if (!eventName && baseFilename) {
    const cleanFn = baseFilename
      .replace(/[_\-]+/g, ' ')
      .replace(/\b\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}\b/g, '')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/ig, '')
      .trim();
    eventName = cleanFn || 'Untitled Event';
  }

  const normalizedDateObj = normalizeDate(rawDate);
  const normalizedTimeObj = normalizeTime(rawTime);

  return {
    eventName: eventName.replace(/\s+/g, ' ').trim() || 'Untitled Event',
    eventDate: normalizedDateObj.formatted || rawDate || 'Unknown Date',
    dateIso: normalizedDateObj.iso,
    eventTime: normalizedTimeObj.formatted || rawTime || 'Not Specified',
    startMinutes: normalizedTimeObj.startMinutes
  };
}

/**
 * Validates registration number against: /^\d\d[A-Za-z]{3}\d{4}$/
 */
function isValidRegNo(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  return /^\d{2}[A-Z]{3}\d{4}$/.test(str);
}

/**
 * Builds reverse lookup mapping: branchCode -> schoolName
 */
function buildBranchToSchoolMap(customMappings = null) {
  const mergedConfig = { ...defaultSchoolsConfig, ...(customMappings || {}) };
  const branchMap = new Map();

  for (const [school, branches] of Object.entries(mergedConfig)) {
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        branchMap.set(branch.trim().toUpperCase(), school.trim().toUpperCase());
      }
    }
  }

  return { branchMap, mergedConfig };
}

/**
 * Parses an Excel file buffer into raw event blocks.
 * Supports stacked blocks in sheets, extracts reg numbers, checks school discrepancies.
 */
async function parseExcelBuffer(buffer, filename = '', customMappings = null) {
  const { branchMap, mergedConfig } = buildBranchToSchoolMap(customMappings);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const parsedEvents = [];
  const knownSchools = new Set(Object.keys(mergedConfig).map(s => s.toUpperCase()));

  workbook.eachSheet((worksheet, sheetId) => {
    // Collect rows
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // row.values is 1-indexed array
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber] = cell.text ? cell.text.trim() : (cell.value ? String(cell.value).trim() : '');
      });
      rows.push({ rowNumber, values });
    });

    if (rows.length === 0) return;

    // Detect stacked blocks
    // A block starts with title rows (optional), table header (optional), followed by student rows.
    // If student rows have started, and then we encounter a new title or header, we split into a new block.
    let currentBlock = {
      titleLines: [],
      students: [],
      skippedRows: 0,
      sheetSchoolDiscrepancies: []
    };

    let inStudentSection = false;
    let consecutiveNonStudentRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const { rowNumber, values } = rows[i];
      // Check column B first (index 2 in 1-based indexing)
      let regNo = null;
      let regColIndex = -1;

      if (values[2] && isValidRegNo(values[2])) {
        regNo = values[2].trim().toUpperCase();
        regColIndex = 2;
      } else {
        // Check any column
        for (let c = 1; c < values.length; c++) {
          if (values[c] && isValidRegNo(values[c])) {
            regNo = values[c].trim().toUpperCase();
            regColIndex = c;
            break;
          }
        }
      }

      if (regNo) {
        // This is a student row!
        inStudentSection = true;
        consecutiveNonStudentRows = 0;

        // Check for school column discrepancy
        let sheetSchool = null;
        for (let c = 1; c < values.length; c++) {
          if (c !== regColIndex && values[c]) {
            const valUpper = values[c].toUpperCase();
            if (knownSchools.has(valUpper)) {
              sheetSchool = valUpper;
              break;
            }
          }
        }

        const branchCode = regNo.substring(2, 5);
        const mappedSchool = branchMap.get(branchCode) || 'UNKNOWN_SCHOOL';

        if (sheetSchool && sheetSchool !== mappedSchool) {
          currentBlock.sheetSchoolDiscrepancies.push({
            regNo,
            branchCode,
            sheetSchool,
            mappedSchool
          });
        }

        currentBlock.students.push({
          regNo,
          branchCode,
          mappedSchool,
          rowNumber
        });
      } else {
        // Non-student row (could be title, header, label, or skipped row)
        const rowText = values.filter(Boolean).join(' ').trim();
        const isHeaderLike = /^(s\.?no|sl\.?no|serial|reg|registration|name|school|dept|programme|sign)/i.test(rowText);

        if (inStudentSection) {
          consecutiveNonStudentRows++;

          // Check if this row looks like the start of a NEW stacked block (e.g., "Day 2", "Venue:", "Date:", or distinct title)
          const isNewTitle = /^(venue|date|timings?|session|day\s*\d+|workshop|makerspace)/i.test(rowText) ||
                             normalizeDate(rowText).iso !== '' ||
                             normalizeTime(rowText).formatted !== '';

          // If it's a new title or we hit a new block boundary
          if (isNewTitle && currentBlock.students.length > 0) {
            // Push previous block
            parsedEvents.push(finalizeBlock(currentBlock, filename, worksheet.name));
            // Start fresh block
            currentBlock = {
              titleLines: [rowText],
              students: [],
              skippedRows: 0,
              sheetSchoolDiscrepancies: []
            };
            inStudentSection = false;
            consecutiveNonStudentRows = 0;
            continue;
          }

          if (!isHeaderLike && rowText.length > 0) {
            currentBlock.skippedRows++;
          }
        } else {
          // In title / preamble section before students
          if (!isHeaderLike && rowText.length > 0) {
            // Preserve individual cell values if split across A/B/C
            currentBlock.titleLines.push(values.filter(Boolean));
          }
        }
      }
    }

    if (currentBlock.students.length > 0 || currentBlock.titleLines.length > 0) {
      parsedEvents.push(finalizeBlock(currentBlock, filename, worksheet.name));
    }
  });

  return parsedEvents;
}

/**
 * Finalizes an event block with deduplication, metadata parsing, and warning compilation.
 */
function finalizeBlock(block, filename, sheetName) {
  // Flatten title lines
  const flatTitleCells = block.titleLines.flatMap(line => (Array.isArray(line) ? line : [line]));
  const metadata = extractEventMetadata(flatTitleCells, filename);

  // Remove duplicate reg numbers within the event
  const seenRegs = new Set();
  const uniqueStudents = [];
  let duplicatesRemoved = 0;

  for (const stu of block.students) {
    if (seenRegs.has(stu.regNo)) {
      duplicatesRemoved++;
    } else {
      seenRegs.add(stu.regNo);
      uniqueStudents.push(stu);
    }
  }

  // Count unknown branches
  const unknownBranches = [];
  for (const stu of uniqueStudents) {
    if (stu.mappedSchool === 'UNKNOWN_SCHOOL') {
      if (!unknownBranches.includes(stu.branchCode)) {
        unknownBranches.push(stu.branchCode);
      }
    }
  }

  // Build unique signature for identical file/event detection
  const sortedRegs = uniqueStudents.map(s => s.regNo).sort();
  const signature = `${metadata.eventName.toLowerCase()}__${metadata.eventDate}__${metadata.eventTime}__${sortedRegs.join(',')}`;

  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    filename,
    sheetName,
    eventName: metadata.eventName,
    eventDate: metadata.eventDate,
    dateIso: metadata.dateIso,
    eventTime: metadata.eventTime,
    startMinutes: metadata.startMinutes,
    students: uniqueStudents,
    totalRowsFound: block.students.length,
    validRowsCount: uniqueStudents.length,
    duplicatesRemoved,
    rowsSkipped: block.skippedRows,
    unknownBranches,
    discrepancies: block.sheetSchoolDiscrepancies,
    signature
  };
}

module.exports = {
  normalizeDate,
  normalizeTime,
  extractEventMetadata,
  isValidRegNo,
  buildBranchToSchoolMap,
  parseExcelBuffer,
  defaultSchoolsConfig
};
