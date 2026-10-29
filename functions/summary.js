/**
 * Summary Generator Module
 * Produces SEGREGATION_SUMMARY.txt in the exact specified format.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Date object to "dd Mon yyyy, hh:mm AM/PM"
 */
function formatGeneratedDate(dateObj = new Date()) {
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

/**
 * Generates the text content for SEGREGATION_SUMMARY.txt
 * @param {Object} segResult - Segregation output from segregateAttendance()
 * @returns {string} - Formatted summary string
 */
function generateSummaryText(segResult) {
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

module.exports = {
  generateSummaryText,
  formatGeneratedDate
};
