/**
 * Multi-Event Batch Segregation Engine
 * Powered by SheetJS (xlsx), ExcelJS, and JSZip.
 * Links registered events (single & multi-day) to multiple uploaded daily attendance spreadsheets.
 * 100% Client-side in-memory processing.
 */

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { getSchoolMappings } from './dataService';

/**
 * Validates 9-character registration number (e.g. 21BCE1234)
 */
export function isValidRegNo(val) {
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return /^\d{2}[A-Z]{3}\d{4}$/.test(str);
}

/**
 * Normalizes time string:
 * Rounds time where minutes >= 30 up to the next hour
 * (e.g. 09:30 AM -> 10:00 AM, 02:45 PM -> 03:00 PM)
 */
export function normalizeEventTime(timeStr) {
  if (!timeStr) return 'Not Specified';
  const str = String(timeStr).trim();

  // Handle ranges like "09:30 AM to 01:15 PM" or "9:30 AM - 1:15 PM"
  const rangeMatch = str.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:to|-|–)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (rangeMatch) {
    const t1 = roundTimeToNextHour(rangeMatch[1]);
    const t2 = roundTimeToNextHour(rangeMatch[2]);
    return `${t1} – ${t2}`;
  }

  return roundTimeToNextHour(str);
}

function roundTimeToNextHour(piece) {
  if (!piece) return '';
  const match = piece.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return piece.trim();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  let modifier = match[3] ? match[3].toUpperCase() : 'AM';

  // Rule: Round times where minutes >= 30 up to next hour
  if (minutes >= 30) {
    hours += 1;
    if (hours === 12 && modifier === 'AM') {
      modifier = 'PM';
    } else if (hours === 12 && modifier === 'PM') {
      modifier = 'AM';
    } else if (hours > 12) {
      hours = 1;
    }
  }

  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:00 ${modifier}`;
}

/**
 * Parse an Excel or CSV file using SheetJS
 * Extracts all unique 9-character registration numbers found across all sheets
 */
export async function parseAttendanceFileSheetJS(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const foundRegs = new Set();
  let totalRowsRead = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON array of row arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      totalRowsRead++;
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          const trimmed = cell.trim().toUpperCase();
          if (isValidRegNo(trimmed)) {
            foundRegs.add(trimmed);
          }
        }
      }
    }
  }

  return {
    filename: file.name,
    totalRowsRead,
    uniqueStudents: Array.from(foundRegs)
  };
}

/**
 * Execute Multi-Event Batch Segregation
 * @param {Array} eventSlots - Array of { event, dayUploads: { [dayIndex]: [File, File...] } }
 * @param {Object} customMappings - Custom branch to school dictionary
 */
export async function processMultiEventBatch(eventSlots, customMappings = null) {
  const mappings = customMappings || getSchoolMappings();

  // Invert branch mapping: BCE -> SCOPE
  const branchToSchool = new Map();
  for (const [school, branches] of Object.entries(mappings)) {
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        branchToSchool.set(branch.toUpperCase(), school.toUpperCase());
      }
    }
  }

  // Structure: schoolsMap[schoolName] -> Array of Event Day Blocks
  const schoolsMap = new Map();
  const summaryReportData = [];
  let grandTotalStudents = 0;
  let totalFilesProcessed = 0;

  for (let sIdx = 0; sIdx < eventSlots.length; sIdx++) {
    const slot = eventSlots[sIdx];
    const event = slot.event;
    if (!event) continue;

    const days = event.days || [
      {
        dayIndex: 1,
        date: event.date || 'Unknown Date',
        venue: event.venue || 'Campus',
        startTime: event.startTime || '',
        endTime: event.endTime || ''
      }
    ];

    for (const day of days) {
      const filesForDay = slot.dayUploads[day.dayIndex] || [];
      totalFilesProcessed += filesForDay.length;

      // Extract all student registration numbers for this day
      const dayRegsSet = new Set();
      for (const file of filesForDay) {
        const parsed = await parseAttendanceFileSheetJS(file);
        parsed.uniqueStudents.forEach(r => dayRegsSet.add(r));
      }

      const uniqueRegs = Array.from(dayRegsSet);
      grandTotalStudents += uniqueRegs.length;

      // Format event day title and timing
      const normalizedTime = day.startTime && day.endTime
        ? normalizeEventTime(`${day.startTime} to ${day.endTime}`)
        : (day.startTime ? normalizeEventTime(day.startTime) : 'Not Specified');

      // Group day students by school and branch
      const eventSchoolGroups = new Map();

      for (const reg of uniqueRegs) {
        const branchCode = reg.substring(2, 5);
        const schoolName = branchToSchool.get(branchCode) || 'UNKNOWN_SCHOOL';

        if (!eventSchoolGroups.has(schoolName)) {
          eventSchoolGroups.set(schoolName, new Map());
        }
        const bMap = eventSchoolGroups.get(schoolName);
        if (!bMap.has(branchCode)) {
          bMap.set(branchCode, []);
        }
        bMap.get(branchCode).push(reg);
      }

      // Add to overall schoolsMap
      for (const [schoolName, branchMap] of eventSchoolGroups.entries()) {
        if (!schoolsMap.has(schoolName)) {
          schoolsMap.set(schoolName, []);
        }

        const sortedBranches = Array.from(branchMap.keys()).sort().map(bCode => {
          const regs = branchMap.get(bCode);
          regs.sort((a, b) => {
            const yA = parseInt(a.substring(0, 2), 10);
            const yB = parseInt(b.substring(0, 2), 10);
            if (yA !== yB) return yA - yB;
            return a.localeCompare(b);
          });
          return {
            branchCode: bCode,
            students: regs
          };
        });

        schoolsMap.get(schoolName).push({
          eventName: event.eventName + (event.isMultiDay ? ` (Day ${day.dayIndex})` : ''),
          date: day.date,
          venue: day.venue,
          time: normalizedTime,
          branches: sortedBranches
        });
      }

      summaryReportData.push({
        eventName: event.eventName,
        dayIndex: day.dayIndex,
        isMultiDay: event.isMultiDay,
        date: day.date,
        venue: day.venue,
        time: normalizedTime,
        studentCount: uniqueRegs.length,
        filesCount: filesForDay.length
      });
    }
  }

  // Generate Styled School Excel Workbooks using ExcelJS
  const zip = new JSZip();

  for (const [schoolName, eventBlocks] of schoolsMap.entries()) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Smart Attendance & Event Management Portal';
    const ws = wb.addWorksheet(schoolName.substring(0, 31));

    let currentRow = 1;
    let maxColsUsed = 1;

    for (const block of eventBlocks) {
      // Row 1: Event Name
      const r1 = ws.getRow(currentRow);
      r1.getCell(1).value = block.eventName;
      r1.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
      currentRow++;

      // Row 2: Date | Venue | Time
      const r2 = ws.getRow(currentRow);
      r2.getCell(1).value = `Date: ${block.date} | Venue: ${block.venue} | Time: ${block.time}`;
      r2.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
      r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      currentRow++;

      // Row 3: Branch Headers
      const r3 = ws.getRow(currentRow);
      block.branches.forEach((b, idx) => {
        const col = idx + 1;
        if (col > maxColsUsed) maxColsUsed = col;
        const c = r3.getCell(col);
        c.value = b.branchCode;
        c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
      });
      currentRow++;

      // Row 4+: Students
      let maxStu = 0;
      block.branches.forEach(b => {
        if (b.students.length > maxStu) maxStu = b.students.length;
      });

      for (let i = 0; i < maxStu; i++) {
        const r = ws.getRow(currentRow + i);
        block.branches.forEach((b, idx) => {
          const col = idx + 1;
          const reg = b.students[i];
          if (reg) {
            const c = r.getCell(col);
            c.value = reg;
            c.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
          }
        });
      }

      currentRow += maxStu;
      currentRow++; // Blank row before next event block
    }

    ws.getColumn(1).width = 46;
    for (let c = 2; c <= Math.max(maxColsUsed, 10); c++) {
      ws.getColumn(c).width = 18;
    }

    const buf = await wb.xlsx.writeBuffer();
    zip.file(`${schoolName}.xlsx`, buf);
  }

  // Generate Text Summary Report
  const summaryLines = [];
  summaryLines.push('================================================================');
  summaryLines.push('  SMART ATTENDANCE PORTAL - MULTI-EVENT BATCH SEGREGATION REPORT');
  summaryLines.push(`  Generated: ${new Date().toLocaleString()}`);
  summaryLines.push('================================================================\n');

  summaryLines.push('--- EVENTS & SESSIONS PROCESSED ---');
  summaryReportData.forEach(item => {
    const dayLabel = item.isMultiDay ? ` [Day ${item.dayIndex}]` : '';
    summaryLines.push(`* ${item.eventName}${dayLabel}`);
    summaryLines.push(`  Date: ${item.date} | Venue: ${item.venue} | Time: ${item.time}`);
    summaryLines.push(`  Attendance: ${item.studentCount} students (${item.filesCount} files)\n`);
  });

  summaryLines.push('----------------------------------------------------------------');
  summaryLines.push('--- SCHOOL-WISE ATTENDANCE BREAKDOWN ---');
  let rank = 1;
  const schoolCounts = [];
  for (const [sch, blocks] of schoolsMap.entries()) {
    let count = 0;
    blocks.forEach(b => b.branches.forEach(br => count += br.students.length));
    schoolCounts.push({ school: sch, count });
  }
  schoolCounts.sort((a, b) => b.count - a.count);

  schoolCounts.forEach(s => {
    summaryLines.push(` ${String(rank++).padStart(2, ' ')}. ${s.school.padEnd(12, ' ')} : ${s.count} students`);
  });

  summaryLines.push('\n----------------------------------------------------------------');
  summaryLines.push(`  TOTAL STUDENTS PROCESSED : ${grandTotalStudents}`);
  summaryLines.push(`  TOTAL SPREADSHEETS PARSED: ${totalFilesProcessed}`);
  summaryLines.push(`  TOTAL SCHOOL WORKBOOKS   : ${schoolsMap.size}`);
  summaryLines.push('================================================================');

  zip.file('BATCH_SEGREGATION_SUMMARY.txt', summaryLines.join('\n'));

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob: zipBlob,
    schoolsCount: schoolsMap.size,
    totalStudents: grandTotalStudents,
    totalFiles: totalFilesProcessed,
    eventsCount: eventSlots.length
  };
}

