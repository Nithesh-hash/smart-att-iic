/**
 * Excel Writer Module for Attendance Segregator
 * Generates styled .xlsx files using ExcelJS strictly adhering to styling specifications:
 * - Plain white background, Calibri 11
 * - Column A width: 46, Other columns width: 18
 * - Row 1: Event Name (bold, size 12, black, no fill)
 * - Row 2: "Date <date> | Time : <time>" (light blue fill D9E1F2 in column A only)
 * - Row 3: Branch codes side by side (bold, yellow fill FFE699 on headers only)
 * - Row 4 onwards: Reg numbers sorted by year then number
 * - One blank row after longest column before next event block
 */

const ExcelJS = require('exceljs');

/**
 * Creates an Excel workbook buffer for a single school.
 * @param {string} schoolName - Name of the school (e.g. SCOPE)
 * @param {Array} events - Chronologically ordered list of events containing branch blocks
 * @returns {Promise<Buffer>} - Buffer of the .xlsx file
 */
async function generateSchoolWorkbook(schoolName, events) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VIT SMART Attendance Segregator';
  workbook.lastModifiedBy = 'VIT SMART Attendance Segregator';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Excel sheet name max 31 characters
  const safeSheetName = (schoolName || 'SHEET').substring(0, 31);
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ showGridLines: true }]
  });

  // Track max columns used across all event blocks
  let maxColsUsed = 1;

  let currentRow = 1;

  for (const event of events) {
    if (!event.branches || event.branches.length === 0) continue;

    // Row 1: event name, bold, size 12, black, no fill
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

    // Row 2: "Date 08 Oct 2026 | Time : 3:00 PM – 5:00 PM", with light blue fill (D9E1F2) in column A only
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

    // Row 3: branch codes side by side as column headers (A, B, C...), bold, with yellow fill (FFE699) on those header cells only
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

    // Row 4 onwards: the reg numbers under their branch column, sorted by year prefix then number
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

    // One blank row after the longest column, then the next event block.
    currentRow++; // Blank row
  }

  // Set column widths: Column A width 46, other columns width 18.
  worksheet.getColumn(1).width = 46;
  for (let c = 2; c <= Math.max(maxColsUsed, 10); c++) {
    worksheet.getColumn(c).width = 18;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateSchoolWorkbook
};
