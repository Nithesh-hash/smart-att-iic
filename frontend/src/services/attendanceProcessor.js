/**
 * In-Browser Attendance Processing Engine
 * Powered by ExcelJS and JSZip
 * Fully functional offline and on Firebase Hosting (Spark Plan) without Cloud Functions.
 */

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import defaultSchoolsConfig from '../config/schools.json';

export { defaultSchoolsConfig };

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

function getBaseFilename(filename) {
  if (!filename) return '';
  const clean = filename.split(/[/\\]/).pop() || '';
  const dotIdx = clean.lastIndexOf('.');
  return dotIdx > 0 ? clean.substring(0, dotIdx) : clean;
}

/**
 * Normalizes any recognized date string to "DD Mon YYYY" (e.g., "07 Oct 2026")
 */
export function normalizeDate(rawStr) {
  if (!rawStr) return { formatted: '', iso: '' };
  const str = String(rawStr).trim();

  // 1. "DD Mon YYYY" / "DD Month YYYY" / "Month DD YYYY"
  const wordMatch = str.match(/(?:^|[_\s\-\/,|:\.])(\d{1,2})(?:st|nd|rd|th)?[\s\-_]+([A-Za-z]{3,9})[\s\-_]+(\d{2,4})(?:$|[_\s\-\/,|:\.])/i) ||
                    str.match(/(?:^|[_\s\-\/,|:\.])([A-Za-z]{3,9})[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?[\s\-_,]+(\d{2,4})(?:$|[_\s\-\/,|:\.])/i);

  if (wordMatch) {
    let day, monthStr, yearStr;
    if (isNaN(parseInt(wordMatch[1], 10))) {
      monthStr = wordMatch[1].toLowerCase();
      day = parseInt(wordMatch[2], 10);
      yearStr = wordMatch[3];
    } else {
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

  // 2. Numeric dates: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, or DD-MM-YY
  const numMatch = str.match(/(?:^|[_\s\-\/,|:\.])(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})(?:$|[_\s\-\/,|:\.])/);
  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);

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

  // 3. ISO format: YYYY-MM-DD
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

function parseTimePiece(timeStr) {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toUpperCase();

  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const modifier = ampmMatch[3];

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

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
export function normalizeTime(rawStr) {
  if (!rawStr) return { formatted: '', startMinutes: 0 };
  const str = String(rawStr).trim();

  const rangeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:to|-|–|until)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (rangeMatch) {
    let startPart = rangeMatch[1].trim();
    let endPart = rangeMatch[2].trim();

    const endHasAmPm = /(AM|PM)/i.test(endPart);
    const startHasAmPm = /(AM|PM)/i.test(startPart);
    if (endHasAmPm && !startHasAmPm) {
      const endModifier = endPart.match(/(AM|PM)/i)[1].toUpperCase();
      const sHour = parseInt(startPart.split(':')[0], 10);
      const eHour = parseInt(endPart.split(':')[0], 10);
      
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

  const single = parseTimePiece(str);
  if (single) {
    return {
      formatted: single.display,
      startMinutes: single.minutesTotal
    };
  }

  return { formatted: str, startMinutes: 0 };
}

export function extractEventMetadata(cellsOrText, filename = '') {
  const combined = Array.isArray(cellsOrText) ? cellsOrText.filter(Boolean).join(' | ') : String(cellsOrText || '');

  let eventName = '';
  let rawDate = '';
  let rawTime = '';

  const parts = combined.split('|').map(p => p.trim());
  const remainingParts = [];

  for (const part of parts) {
    if (/^Venue\s*:/i.test(part)) {
      continue;
    }

    let workingPart = part;

    const datePrefixMatch = workingPart.match(/^(?:Date|Dated)\s*[:\-]?\s*(.+)$/i);
    if (datePrefixMatch) {
      rawDate = datePrefixMatch[1].trim();
      continue;
    }

    const extractedDate = normalizeDate(workingPart);
    if (extractedDate.iso && !rawDate) {
      rawDate = extractedDate.formatted;
      workingPart = workingPart.replace(/(?:^|[_\s\-\/,|:])\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}(?:$|[_\s\-\/,|:])/g, ' ')
                               .replace(/(?:^|[_\s\-\/,|:])\d{1,2}(?:st|nd|rd|th)?[\s\-_]+[A-Za-z]{3,9}[\s\-_]+\d{2,4}(?:$|[_\s\-\/,|:])/ig, ' ')
                               .trim();
    }

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

    const cleanedText = workingPart.replace(/^[_\-\s|:]+|[_\-\s|:]+$/g, '');
    if (cleanedText && !eventName) {
      eventName = cleanedText;
    } else if (cleanedText) {
      remainingParts.push(cleanedText);
    }
  }

  if (!eventName && remainingParts.length > 0) {
    eventName = remainingParts[0];
  }

  const baseFilename = getBaseFilename(filename);

  if (!rawDate && baseFilename) {
    const fnDate = normalizeDate(baseFilename);
    if (fnDate.iso) {
      rawDate = fnDate.formatted;
    }
  }

  if (!rawTime && baseFilename) {
    const fnTimeMatch = baseFilename.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i);
    if (fnTimeMatch) {
      rawTime = fnTimeMatch[0];
    }
  }

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

export function isValidRegNo(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  return /^\d{2}[A-Z]{3}\d{4}$/.test(str);
}

export function buildBranchToSchoolMap(customMappings = null) {
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

export async function parseExcelBuffer(buffer, filename = '', customMappings = null) {
  const { branchMap, mergedConfig } = buildBranchToSchoolMap(customMappings);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const parsedEvents = [];
  const knownSchools = new Set(Object.keys(mergedConfig).map(s => s.toUpperCase()));

  workbook.eachSheet((worksheet) => {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber] = cell.text ? cell.text.trim() : (cell.value ? String(cell.value).trim() : '');
      });
      rows.push({ rowNumber, values });
    });

    if (rows.length === 0) return;

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
      let regNo = null;
      let regColIndex = -1;

      if (values[2] && isValidRegNo(values[2])) {
        regNo = values[2].trim().toUpperCase();
        regColIndex = 2;
      } else {
        for (let c = 1; c < values.length; c++) {
          if (values[c] && isValidRegNo(values[c])) {
            regNo = values[c].trim().toUpperCase();
            regColIndex = c;
            break;
          }
        }
      }

      if (regNo) {
        inStudentSection = true;
        consecutiveNonStudentRows = 0;

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
        const rowText = values.filter(Boolean).join(' ').trim();
        const isHeaderLike = /^(s\.?no|sl\.?no|serial|reg|registration|name|school|dept|programme|sign)/i.test(rowText);

        if (inStudentSection) {
          consecutiveNonStudentRows++;

          const isNewTitle = /^(venue|date|timings?|session|day\s*\d+|workshop|makerspace)/i.test(rowText) ||
                             normalizeDate(rowText).iso !== '' ||
                             normalizeTime(rowText).formatted !== '';

          if (isNewTitle && currentBlock.students.length > 0) {
            parsedEvents.push(finalizeBlock(currentBlock, filename, worksheet.name));
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
          if (!isHeaderLike && rowText.length > 0) {
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

function finalizeBlock(block, filename, sheetName) {
  const flatTitleCells = block.titleLines.flatMap(line => (Array.isArray(line) ? line : [line]));
  const metadata = extractEventMetadata(flatTitleCells, filename);

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

  const unknownBranches = [];
  for (const stu of uniqueStudents) {
    if (stu.mappedSchool === 'UNKNOWN_SCHOOL') {
      if (!unknownBranches.includes(stu.branchCode)) {
        unknownBranches.push(stu.branchCode);
      }
    }
  }

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

export function sortRegNumbers(regs) {
  return [...regs].sort((a, b) => {
    const yearA = parseInt(a.substring(0, 2), 10);
    const yearB = parseInt(b.substring(0, 2), 10);
    if (yearA !== yearB) return yearA - yearB;
    return a.localeCompare(b);
  });
}

export function segregateAttendance(events, customMappings = null) {
  const { branchMap } = buildBranchToSchoolMap(customMappings);

  const uniqueEvents = [];
  const duplicateFileWarnings = [];
  const seenSignatures = new Map();

  for (const ev of events) {
    if (seenSignatures.has(ev.signature)) {
      const originalFile = seenSignatures.get(ev.signature);
      duplicateFileWarnings.push(
        `Duplicate file detected: "${ev.filename}" has identical event and student list as "${originalFile}" and was skipped.`
      );
    } else {
      seenSignatures.set(ev.signature, ev.filename);
      uniqueEvents.push(ev);
    }
  }

  uniqueEvents.sort((a, b) => {
    const dateA = a.dateIso || '9999-99-99';
    const dateB = b.dateIso || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    if (a.startMinutes !== b.startMinutes) return (a.startMinutes || 0) - (b.startMinutes || 0);
    return a.eventName.localeCompare(b.eventName);
  });

  let firstDateStr = 'Unknown';
  let lastDateStr = 'Unknown';
  let firstDateIso = '';
  let lastDateIso = '';

  const eventsWithDates = uniqueEvents.filter(e => e.dateIso);
  if (eventsWithDates.length > 0) {
    firstDateStr = eventsWithDates[0].eventDate;
    firstDateIso = eventsWithDates[0].dateIso;
    lastDateStr = eventsWithDates[eventsWithDates.length - 1].eventDate;
    lastDateIso = eventsWithDates[eventsWithDates.length - 1].dateIso;
  } else if (uniqueEvents.length > 0) {
    firstDateStr = uniqueEvents[0].eventDate;
    lastDateStr = uniqueEvents[uniqueEvents.length - 1].eventDate;
  }

  const schoolsMap = new Map();
  const unknownBranchesFound = new Set();
  const allDiscrepancies = [];

  for (const ev of uniqueEvents) {
    if (ev.discrepancies && ev.discrepancies.length > 0) {
      allDiscrepancies.push(...ev.discrepancies.map(d => ({ ...d, eventName: ev.eventName })));
    }

    const eventSchools = new Map();

    for (const stu of ev.students) {
      const regNo = stu.regNo.trim().toUpperCase();
      const branchCode = regNo.substring(2, 5);
      const schoolName = branchMap.get(branchCode) || 'UNKNOWN_SCHOOL';

      if (schoolName === 'UNKNOWN_SCHOOL') {
        unknownBranchesFound.add(branchCode);
      }

      if (!eventSchools.has(schoolName)) {
        eventSchools.set(schoolName, new Map());
      }
      const branchBucket = eventSchools.get(schoolName);
      if (!branchBucket.has(branchCode)) {
        branchBucket.set(branchCode, []);
      }
      branchBucket.get(branchCode).push(regNo);
    }

    for (const [schoolName, branches] of eventSchools.entries()) {
      if (!schoolsMap.has(schoolName)) {
        schoolsMap.set(schoolName, {
          schoolName,
          events: [],
          totalStudents: 0
        });
      }

      const schoolEntry = schoolsMap.get(schoolName);
      const branchList = [];
      let eventStudentCountForSchool = 0;

      const sortedBranchCodes = Array.from(branches.keys()).sort();
      for (const bCode of sortedBranchCodes) {
        const sortedRegs = sortRegNumbers(branches.get(bCode));
        branchList.push({
          branchCode: bCode,
          students: sortedRegs
        });
        eventStudentCountForSchool += sortedRegs.length;
      }

      schoolEntry.events.push({
        eventName: ev.eventName,
        eventDate: ev.eventDate,
        eventTime: ev.eventTime,
        dateIso: ev.dateIso,
        startMinutes: ev.startMinutes,
        branches: branchList,
        studentCount: eventStudentCountForSchool
      });

      schoolEntry.totalStudents += eventStudentCountForSchool;
    }
  }

  const schoolSummaryList = Array.from(schoolsMap.values()).map(s => ({
    schoolName: s.schoolName,
    totalStudents: s.totalStudents
  }));

  schoolSummaryList.sort((a, b) => {
    if (b.totalStudents !== a.totalStudents) return b.totalStudents - a.totalStudents;
    return a.schoolName.localeCompare(b.schoolName);
  });

  const totalStudentsProcessed = schoolSummaryList.reduce((acc, curr) => acc + curr.totalStudents, 0);

  let zipFilename = 'all_schools.zip';
  if (firstDateIso && lastDateIso) {
    zipFilename = `all_schools_${firstDateIso}_to_${lastDateIso}.zip`;
  }

  return {
    uniqueEvents,
    schoolsMap,
    schoolSummaryList,
    totalStudentsProcessed,
    dateRange: {
      firstDateStr,
      lastDateStr,
      firstDateIso,
      lastDateIso
    },
    zipFilename,
    warnings: {
      duplicateFiles: duplicateFileWarnings,
      unknownBranches: Array.from(unknownBranchesFound),
      discrepancies: allDiscrepancies
    }
  };
}

export async function generateSchoolWorkbook(schoolName, events) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VIT SMART Attendance Segregator';
  workbook.lastModifiedBy = 'VIT SMART Attendance Segregator';
  workbook.created = new Date();
  workbook.modified = new Date();

  const safeSheetName = (schoolName || 'SHEET').substring(0, 31);
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }]
  });

  let maxColsUsed = 1;
  let currentRow = 1;

  for (const event of events) {
    if (!event.branches || event.branches.length === 0) continue;

    // Row 1: Event Name (bold, size 12, black, no fill)
    const row1 = worksheet.getRow(currentRow);
    const cell1 = row1.getCell(1);
    cell1.value = event.eventName;
    cell1.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: 'FF000000' }
    };
    currentRow++;

    // Row 2: Date and Time with light blue fill (D9E1F2) in column A only
    const row2 = worksheet.getRow(currentRow);
    const cell2 = row2.getCell(1);
    cell2.value = `Date ${event.eventDate} | Time : ${event.eventTime}`;
    cell2.font = {
      name: 'Calibri',
      size: 11,
      color: { argb: 'FF000000' }
    };
    cell2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };
    currentRow++;

    // Row 3: Branch codes with yellow fill (FFE699) on headers only
    const row3 = worksheet.getRow(currentRow);
    event.branches.forEach((branch, idx) => {
      const colNum = idx + 1;
      if (colNum > maxColsUsed) maxColsUsed = colNum;

      const cell = row3.getCell(colNum);
      cell.value = branch.branchCode;
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FF000000' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE699' }
      };
    });
    currentRow++;

    // Row 4+: Reg numbers under branch columns
    let maxBranchStudents = 0;
    event.branches.forEach(b => {
      if (b.students && b.students.length > maxBranchStudents) {
        maxBranchStudents = b.students.length;
      }
    });

    for (let i = 0; i < maxBranchStudents; i++) {
      const row = worksheet.getRow(currentRow + i);
      event.branches.forEach((branch, idx) => {
        const colNum = idx + 1;
        const regNo = branch.students[i];
        if (regNo) {
          const cell = row.getCell(colNum);
          cell.value = regNo;
          cell.font = {
            name: 'Calibri',
            size: 11,
            color: { argb: 'FF000000' }
          };
        }
      });
    }

    currentRow += maxBranchStudents;
    currentRow++; // Blank row separator
  }

  worksheet.getColumn(1).width = 46;
  for (let c = 2; c <= Math.max(maxColsUsed, 10); c++) {
    worksheet.getColumn(c).width = 18;
  }

  return await workbook.xlsx.writeBuffer();
}

export function formatGeneratedDate(dateObj = new Date()) {
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
}

export function generateSummaryText(segResult) {
  const {
    uniqueEvents,
    schoolSummaryList,
    totalStudentsProcessed,
    dateRange
  } = segResult;

  const generatedTimestamp = formatGeneratedDate(new Date());
  const dateRangeStr = `${dateRange.firstDateStr} - ${dateRange.lastDateStr}`;

  const lines = [];

  lines.push('=======================================================');
  lines.push('  VIT SMART ATTENDANCE SEGREGATOR - Segregation Summary');
  lines.push(`  Generated : ${generatedTimestamp}`);
  lines.push(`  Date Range: ${dateRangeStr}`);
  lines.push('=======================================================');
  lines.push('');
  lines.push(`--- EVENTS SEGREGATED (${uniqueEvents.length}) ---`);

  for (const ev of uniqueEvents) {
    lines.push(`  * ${ev.eventName} [Single-day]`);
    lines.push(`    Date ${ev.eventDate} | Time : ${ev.eventTime}`);
    lines.push('');
  }

  lines.push('-------------------------------------------------------');
  lines.push(`--- SCHOOL-WISE STUDENT COUNT (${schoolSummaryList.length} schools) ---`);

  schoolSummaryList.forEach((sch, idx) => {
    const rank = String(idx + 1).padStart(3, ' ');
    const schoolNameFormatted = sch.schoolName.padEnd(10, ' ');
    const countFormatted = `${sch.totalStudents} student${sch.totalStudents === 1 ? '' : 's'}`;
    lines.push(` ${rank}.  ${schoolNameFormatted}: ${countFormatted}`);
  });

  lines.push('-------------------------------------------------------');
  lines.push(`  TOTAL STUDENTS PROCESSED : ${totalStudentsProcessed}`);
  lines.push('=======================================================');
  lines.push('  VIT-IST | Office of Innovation, Startup & Technology Transfer');
  lines.push('=======================================================');

  return lines.join('\n');
}

/**
 * High-level orchestration for client-side processing:
 * Parses uploaded files into preview data
 */
export async function processFilesForPreview(fileList, customMappings = null) {
  const allEvents = [];
  for (const file of fileList) {
    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseExcelBuffer(arrayBuffer, file.name, customMappings);
    allEvents.push(...parsed);
  }

  const segResult = segregateAttendance(allEvents, customMappings);

  return {
    rawEvents: allEvents,
    previewData: {
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
    }
  };
}

/**
 * High-level orchestration for generating final ZIP entirely in client memory
 */
export async function generateSegregatedZipClient(rawEvents, eventOverrides = {}, customMappings = null) {
  // Apply overrides
  const updatedEvents = rawEvents.map(orig => {
    const ev = { ...orig, students: [...orig.students] };
    const override = eventOverrides[ev.id] || eventOverrides[ev.filename];
    if (override) {
      if (override.eventName) ev.eventName = override.eventName.trim();
      if (override.eventDate) {
        ev.eventDate = override.eventDate.trim();
        const normD = normalizeDate(ev.eventDate);
        if (normD.iso) {
          ev.dateIso = normD.iso;
          ev.eventDate = normD.formatted;
        }
      }
      if (override.eventTime) {
        ev.eventTime = override.eventTime.trim();
        const normT = normalizeTime(ev.eventTime);
        if (normT.startMinutes !== undefined) {
          ev.startMinutes = normT.startMinutes;
          ev.eventTime = normT.formatted;
        }
      }
      const sortedRegs = ev.students.map(s => s.regNo).sort();
      ev.signature = `${ev.eventName.toLowerCase()}__${ev.eventDate}__${ev.eventTime}__${sortedRegs.join(',')}`;
    }
    return ev;
  });

  const segResult = segregateAttendance(updatedEvents, customMappings);
  const zip = new JSZip();

  for (const [schoolName, schoolData] of segResult.schoolsMap.entries()) {
    const buffer = await generateSchoolWorkbook(schoolName, schoolData.events);
    zip.file(`${schoolName}.xlsx`, buffer);
  }

  const summaryText = generateSummaryText(segResult);
  zip.file('SEGREGATION_SUMMARY.txt', summaryText);

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob: zipBlob,
    filename: segResult.zipFilename,
    schoolsCount: segResult.schoolSummaryList.length,
    totalStudents: segResult.totalStudentsProcessed
  };
}

