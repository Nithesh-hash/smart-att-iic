/**
 * Segregation Logic Module
 * Groups students by school and branch, sorts events chronologically,
 * eliminates duplicate files/events, and compiles counts.
 */

const { buildBranchToSchoolMap } = require('./parser');

/**
 * Normalizes reg number sorting: year prefix (first 2 digits) then full reg number
 */
function sortRegNumbers(regs) {
  return [...regs].sort((a, b) => {
    const yearA = parseInt(a.substring(0, 2), 10);
    const yearB = parseInt(b.substring(0, 2), 10);
    if (yearA !== yearB) return yearA - yearB;
    return a.localeCompare(b);
  });
}

/**
 * Segregates events and their students into school buckets.
 * @param {Array} events - List of parsed/edited event objects
 * @param {Object} customMappings - Custom school branch mapping overrides
 */
function segregateAttendance(events, customMappings = null) {
  const { branchMap } = buildBranchToSchoolMap(customMappings);

  // 1. Deduplicate identical files/events (same event and same reg list)
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

  // 2. Sort events chronologically:
  // Sort by dateIso, then startMinutes, then eventName
  uniqueEvents.sort((a, b) => {
    const dateA = a.dateIso || '9999-99-99';
    const dateB = b.dateIso || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    if (a.startMinutes !== b.startMinutes) return (a.startMinutes || 0) - (b.startMinutes || 0);
    return a.eventName.localeCompare(b.eventName);
  });

  // Determine overall date range
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

  // 3. Segregate by school
  // schoolData: Map<schoolName, { schoolName: string, events: Array<{ eventName, eventDate, eventTime, branches: Map<branchCode, Array<regNo>> }> }>
  const schoolsMap = new Map();
  const unknownBranchesFound = new Set();
  const allDiscrepancies = [];

  for (const ev of uniqueEvents) {
    if (ev.discrepancies && ev.discrepancies.length > 0) {
      allDiscrepancies.push(...ev.discrepancies.map(d => ({ ...d, eventName: ev.eventName })));
    }

    // Temporary grouping for this event: school -> branch -> [regs]
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

    // Now record for each school that has students in this event
    for (const [schoolName, branches] of eventSchools.entries()) {
      if (!schoolsMap.has(schoolName)) {
        schoolsMap.set(schoolName, {
          schoolName,
          events: [],
          totalStudents: 0
        });
      }

      const schoolEntry = schoolsMap.get(schoolName);

      // Convert branch map to array of sorted branch blocks
      const branchList = [];
      let eventStudentCountForSchool = 0;

      // Sort branch codes alphabetically for consistency
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

  // 4. Compute school-wise student counts sorted descending
  const schoolSummaryList = Array.from(schoolsMap.values()).map(s => ({
    schoolName: s.schoolName,
    totalStudents: s.totalStudents
  }));

  schoolSummaryList.sort((a, b) => {
    if (b.totalStudents !== a.totalStudents) return b.totalStudents - a.totalStudents;
    return a.schoolName.localeCompare(b.schoolName);
  });

  const totalStudentsProcessed = schoolSummaryList.reduce((acc, curr) => acc + curr.totalStudents, 0);

  // Generate suggested zip filename: all_schools_<firstDate>_to_<lastDate>.zip
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

module.exports = {
  segregateAttendance,
  sortRegNumbers
};
