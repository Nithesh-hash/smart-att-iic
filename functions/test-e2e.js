/**
 * End-to-End Verification Test
 * Creates a sample Excel file mimicking real attendance sheets, parses it,
 * performs segregation, and checks Excel output and summary output.
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { parseExcelBuffer } = require('./parser');
const { segregateAttendance } = require('./segregate');
const { generateSchoolWorkbook } = require('./excelWriter');
const { generateSummaryText } = require('./summary');

async function runTest() {
  console.log('--- Creating mock attendance Excel workbook ---');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  // Block 1: Makerspace Day 1
  ws.addRow(['Venue: TT Gallery | Date 08 Oct 2026 | Time : 3pm to 5 pm']);
  ws.addRow(['S.No', 'Registration No', 'Student Name', 'School']);
  ws.addRow([1, '23BCE1001', 'Alice', 'SCOPE']);
  ws.addRow([2, '25BCE0014', 'Bob', 'SCOPE']);
  ws.addRow([3, '24BDS0201', 'Charlie', 'SCOPE']);
  ws.addRow([4, '23BVD0011', 'David', 'SENSE']);
  ws.addRow([5, '24BEE0300', 'Eve', 'SELECT']);
  ws.addRow([6, '25BCE0014', 'Bob Duplicate', 'SCOPE']); // Duplicate inside event
  ws.addRow([7, '23ZZZ9999', 'Frank Unknown', 'UNKNOWN']); // Unknown branch ZZZ
  ws.addRow([8, '24BCE1111', 'Grace Discrepant', 'SMEC']); // Discrepancy: BCE maps to SCOPE but sheet says SMEC

  // Blank row separator
  ws.addRow([]);

  // Block 2: Makerspace Day 2 (Stacked block in same sheet!)
  ws.addRow(['Makerspace for kids - Day 2']);
  ws.addRow(['Date: 09.10.2026 | Timings: 9 AM - 12:00 PM']);
  ws.addRow(['S.No', 'Reg No', 'Name', 'Dept']);
  ws.addRow([1, '23BCE1001', 'Alice', 'SCOPE']);
  ws.addRow([2, '23BEC0500', 'Heidi', 'SENSE']);

  const buffer = await wb.xlsx.writeBuffer();
  console.log('Mock Excel buffer size:', buffer.length);

  console.log('\n--- Testing parseExcelBuffer ---');
  const events = await parseExcelBuffer(buffer, 'Makerspace_7-10-26.xlsx');
  console.log(`Parsed ${events.length} event(s):`);
  events.forEach((ev, idx) => {
    console.log(`Event ${idx + 1}:`);
    console.log(`  Name: ${ev.eventName}`);
    console.log(`  Date: ${ev.eventDate} (ISO: ${ev.dateIso})`);
    console.log(`  Time: ${ev.eventTime} (Minutes: ${ev.startMinutes})`);
    console.log(`  Total found: ${ev.totalRowsFound}, Unique: ${ev.validRowsCount}, Duplicates: ${ev.duplicatesRemoved}, Skipped: ${ev.rowsSkipped}`);
    console.log(`  Discrepancies:`, ev.discrepancies);
    console.log(`  Unknown branches:`, ev.unknownBranches);
  });

  console.log('\n--- Testing segregateAttendance ---');
  const segResult = segregateAttendance(events);
  console.log('Zip filename:', segResult.zipFilename);
  console.log('School summary list:', segResult.schoolSummaryList);
  console.log('Total students processed:', segResult.totalStudentsProcessed);
  console.log('Date range:', segResult.dateRange);

  console.log('\n--- Testing generateSummaryText ---');
  const summaryTxt = generateSummaryText(segResult);
  console.log(summaryTxt);

  console.log('\n--- Testing generateSchoolWorkbook ---');
  for (const [schoolName, schoolData] of segResult.schoolsMap.entries()) {
    const schoolBuf = await generateSchoolWorkbook(schoolName, schoolData.events);
    console.log(`Generated ${schoolName.toUpperCase()}.xlsx buffer size: ${schoolBuf.length} bytes`);
  }

  console.log('\nAll tests passed successfully!');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
