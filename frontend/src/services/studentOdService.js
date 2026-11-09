/**
 * Student OD Service & Official PDF Generator
 * Queries student OD records by normalized registration number, calculates statistics,
 * and exports official institutional OD certificates/reports via jsPDF.
 */

import jsPDF from 'jspdf';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { getDb } from '../firebase/firebaseConfig';
import { normalizeRegNo } from './studentAuthService';

const OD_RECORDS_CACHE_KEY = 'smart_att_od_records_store';

/**
 * Format date YYYY-MM-DD to DD-MM-YYYY
 */
export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return 'N/A';
  const s = String(dateStr).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  const parts = s.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return s;
}

/**
 * Fetch all OD records matching a student's normalized registration number
 * Sources from Firestore first, with fallback to local cache
 */
export async function getStudentODRecords(registrationNumber) {
  const cleanRegNo = normalizeRegNo(registrationNumber);
  if (!cleanRegNo) return [];

  let records = [];
  const db = getDb();

  if (db) {
    try {
      const q = query(
        collection(db, 'student_od_records'),
        where('normalizedRegistrationNumber', '==', cleanRegNo)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn('Error querying Firestore for student OD records:', err);
    }
  }

  // Fallback to local cache
  if (records.length === 0) {
    try {
      const raw = localStorage.getItem(OD_RECORDS_CACHE_KEY);
      if (raw) {
        const allCached = JSON.parse(raw);
        if (Array.isArray(allCached)) {
          records = allCached.filter(
            r => normalizeRegNo(r.normalizedRegistrationNumber || r.registrationNumber) === cleanRegNo
          );
        }
      }
    } catch (e) {
      console.warn('Local cache read error for student OD:', e);
    }
  }

  // Sort descending by event date (newest first)
  records.sort((a, b) => {
    const dateA = new Date(a.eventDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.eventDate || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return records;
}

/**
 * Calculate student OD statistics
 * Total OD records, unique OD dates, total events, upcoming OD dates
 */
export function calculateStudentODStats(records = []) {
  const totalRecords = records.length;

  const uniqueDatesSet = new Set();
  const uniqueEventsSet = new Set();
  let upcomingCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const rec of records) {
    if (rec.eventDate) {
      uniqueDatesSet.add(rec.eventDate);
      if (rec.eventDate >= todayStr) {
        upcomingCount++;
      }
    }
    if (rec.eventId || rec.eventName) {
      uniqueEventsSet.add(rec.eventId || rec.eventName);
    }
  }

  return {
    totalRecords,
    uniqueDatesCount: uniqueDatesSet.size,
    totalEventsCount: uniqueEventsSet.size,
    upcomingDatesCount: upcomingCount
  };
}

/**
 * Generate and download an Official Institutional OD Verification Report (PDF)
 * Styled with VIT institutional layout, student credentials, and verified OD table.
 */
export function generateStudentODPdf(studentProfile, records = [], stats = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // 1. Institutional Top Header Bar (Deep Navy/Purple #190059)
  doc.setFillColor(25, 0, 89);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VELLORE INSTITUTE OF TECHNOLOGY', pageWidth / 2, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Office of Innovation, Startup and Technology Transfer (VIT-IST)', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(250, 204, 21); // Amber / Gold
  doc.text('OFFICIAL ON DUTY (OD) ATTENDANCE STATEMENT', pageWidth / 2, 23, { align: 'center' });

  // 2. Student Details Box
  let y = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 26, 3, 3, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STUDENT PROFILE', margin + 6, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text('Student Name:', margin + 6, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(studentProfile?.name || 'VIT Student').toUpperCase(), margin + 35, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Registration No:', margin + 6, y + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25, 0, 89);
  doc.text(String(studentProfile?.registrationNumber || 'N/A').toUpperCase(), margin + 35, y + 21);

  // Right column of student details
  const col2X = margin + 100;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Email Address:', col2X, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(studentProfile?.email || 'N/A'), col2X + 28, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Generated On:', col2X, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), col2X + 28, y + 21);

  // 3. OD Summary Badges
  y += 32;
  const badgeWidth = (pageWidth - (margin * 2) - 9) / 4;
  const badgeHeight = 16;

  const statItems = [
    { label: 'TOTAL OD RECORDS', val: String(stats.totalRecords || records.length) },
    { label: 'UNIQUE OD DATES', val: String(stats.uniqueDatesCount || 0) },
    { label: 'TOTAL EVENTS', val: String(stats.totalEventsCount || 0) },
    { label: 'STATUS', val: 'OFFICIALLY VERIFIED' }
  ];

  statItems.forEach((item, idx) => {
    const bx = margin + (idx * (badgeWidth + 3));
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, badgeWidth, badgeHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 0, 89);
    doc.text(item.val, bx + (badgeWidth / 2), y + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, bx + (badgeWidth / 2), y + 12, { align: 'center' });
  });

  // 4. OD Records Table
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RECORDED ON DUTY (OD) EVENTS', margin, y);

  y += 4;
  // Table Header
  doc.setFillColor(25, 0, 89);
  doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  doc.text('#', margin + 3, y + 5.5);
  doc.text('EVENT NAME', margin + 12, y + 5.5);
  doc.text('OD DATE', margin + 95, y + 5.5);
  doc.text('SCHEDULED TIMING', margin + 122, y + 5.5);
  doc.text('SCHOOL', margin + 163, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (records.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No On Duty (OD) records found for this registration number.', margin + 6, y + 10);
    y += 18;
  } else {
    records.forEach((rec, idx) => {
      // Page overflow check
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 20;

        // Re-print table header
        doc.setFillColor(25, 0, 89);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('#', margin + 3, y + 5.5);
        doc.text('EVENT NAME', margin + 12, y + 5.5);
        doc.text('OD DATE', margin + 95, y + 5.5);
        doc.text('SCHEDULED TIMING', margin + 122, y + 5.5);
        doc.text('SCHOOL', margin + 163, y + 5.5);
        y += 8;
        doc.setFont('helvetica', 'normal');
      }

      // Alternate row backgrounds
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, pageWidth - (margin * 2), 7.5, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5);

      doc.setTextColor(71, 85, 105);
      doc.text(String(idx + 1), margin + 3, y + 5);

      doc.setTextColor(15, 23, 42);
      const evName = rec.eventName && rec.eventName.length > 45
        ? rec.eventName.substring(0, 42) + '...'
        : (rec.eventName || 'Institutional Event');
      doc.text(evName, margin + 12, y + 5);

      doc.text(formatDateDDMMYYYY(rec.eventDate), margin + 95, y + 5);

      const timing = rec.odStartTime && rec.odEndTime
        ? `${rec.odStartTime} - ${rec.odEndTime}`
        : (rec.odStartTime || 'Timing not available');
      doc.text(timing, margin + 122, y + 5);

      doc.text(rec.school || 'VIT School', margin + 163, y + 5);

      y += 7.5;
    });
  }

  // 5. Verification Footer & Legal Disclaimer
  const footerY = pageHeight - 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Disclaimer: This document is an automated electronic OD attendance statement generated from verified event segregation archives.', margin, footerY);
  doc.text('Valid only for institutional verification by VIT-IST & Academic Coordinators. For queries, contact vitist@vit.ac.in', margin, footerY + 4);

  // Institutional Verification Seal / Stamp watermark
  doc.setTextColor(25, 0, 89);
  doc.setFont('helvetica', 'bold');
  doc.text('VIT-IST DIGITAL VERIFICATION RECORD', pageWidth - margin, footerY + 2, { align: 'right' });

  // Download PDF
  const filename = `OD_Statement_${studentProfile?.registrationNumber || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
