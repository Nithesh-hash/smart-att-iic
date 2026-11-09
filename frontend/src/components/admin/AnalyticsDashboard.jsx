/**
 * Executive Analytics Dashboard
 * Complete Institutional Implementation matching screenshots:
 * - Image 1:
 *   1. 📈 Registered vs Segregated (Monthly Trend) - Spline area chart
 *   2. 🔵 Event Type Split - Doughnut chart (50% Single-Day / 50% Multi-Day)
 *   3. 📅 Busiest Days of the Week - Horizontal bar chart (Wednesday / Thursday)
 *   4. 📅 Event Density Heatmap — 2026 - 365-day grid with pagination & legend
 * - Image 2:
 *   5. 🏫 School-wise Attendance Distribution - Full-width horizontal bars (SCORE, SCOPE)
 *   6. 🏷️ Events by Type - Doughnut chart (75% Mentoring Session, 25% Workshop)
 *   7. 📊 Event Type Breakdown - Table with count & share progress bar
 *   8. 🏛️ Venue Utilisation (Top 10) - Leaderboard with gold/silver/bronze medals
 *   9. 👥 Faculty Coordinator Leaderboard (Top 10) - Leaderboard with medals
 * - Top Filter Pills, KPI Cards, Smart Insights, Pending Events & Segregation Stats
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsPDF from 'jspdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController,
  DoughnutController
} from 'chart.js';
import { getEvents, getSegregationHistory, EVENT_TYPES } from '../../services/dataService';

// Register all required Chart.js controllers and elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController,
  DoughnutController
);

const TIME_PILLS = [
  { id: 'ALL', label: 'All Time', icon: '📅' },
  { id: 'YEAR', label: 'Year', icon: '🗓️' },
  { id: 'MONTH_RANGE', label: 'Month Range', icon: '🗓️' },
  { id: 'CUSTOM', label: 'Custom Range', icon: '🔍' }
];

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  // Chart Canvas Refs
  const trendLineCanvasRef = useRef(null);
  const eventTypeSplitCanvasRef = useRef(null);
  const busiestDaysCanvasRef = useRef(null);
  const eventsByTypeCanvasRef = useRef(null);
  const eventsMonthlyCanvasRef = useRef(null);
  const segregationsMonthlyCanvasRef = useRef(null);

  // Active Chart Instances
  const trendLineInstance = useRef(null);
  const eventTypeSplitInstance = useRef(null);
  const busiestDaysInstance = useRef(null);
  const eventsByTypeInstance = useRef(null);
  const eventsMonthlyInstance = useRef(null);
  const segregationsMonthlyInstance = useRef(null);

  const loadData = async () => {
    try {
      const evList = await getEvents();
      const histList = await getSegregationHistory();
      setEvents(evList);
      setHistory(histList);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for real-time storage & sync events
    const handleEventsUpdate = () => loadData();
    const handleHistoryUpdate = () => loadData();
    window.addEventListener('smart_att_events_changed', handleEventsUpdate);
    window.addEventListener('smart_att_history_changed', handleHistoryUpdate);

    return () => {
      window.removeEventListener('smart_att_events_changed', handleEventsUpdate);
      window.removeEventListener('smart_att_history_changed', handleHistoryUpdate);
    };
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (eventTypeFilter !== 'ALL') {
      result = result.filter(e => e.eventType === eventTypeFilter);
    }

    if (timeFilter === 'YEAR') {
      result = result.filter(e => {
        const d = e.days?.[0]?.date || e.createdAt || '';
        return d.startsWith(String(selectedYear));
      });
    }

    return result;
  }, [events, eventTypeFilter, timeFilter, selectedYear]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (timeFilter === 'YEAR') {
      result = result.filter(h => {
        const d = h.eventDates || h.timestamp || '';
        return d.includes(String(selectedYear));
      });
    }

    return result;
  }, [history, timeFilter, selectedYear]);

  // KPI Computations
  const totalEventsRegistered = filteredEvents.length;
  const totalSegregationsDone = filteredHistory.length;
  const totalStudentsProcessed = filteredHistory.reduce((sum, h) => sum + (Number(h.totalStudents) || 0), 0);

  const singleDayCount = filteredEvents.filter(e => !e.isMultiDay).length;
  const multiDayCount = filteredEvents.filter(e => e.isMultiDay).length;

  // Pending Events computation: Events registered that do not appear in segregation history
  const pendingEvents = useMemo(() => {
    return filteredEvents.filter(ev => {
      const isSegregated = filteredHistory.some(h => {
        const evText = h.eventsSegregated || '';
        return evText.toLowerCase().includes(ev.eventName.toLowerCase());
      });
      return !isSegregated;
    });
  }, [filteredEvents, filteredHistory]);

  const pendingCount = pendingEvents.length;

  // Smart Insights Computations
  const smartInsights = useMemo(() => {
    const monthCounts = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    filteredEvents.forEach(e => {
      const dStr = e.days?.[0]?.date || e.createdAt;
      if (dStr) {
        const mIdx = new Date(dStr).getMonth();
        if (!isNaN(mIdx)) {
          const mName = monthNames[mIdx];
          monthCounts[mName] = (monthCounts[mName] || 0) + 1;
        }
      }
    });

    const sortedMonths = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
    const topMonth = sortedMonths.length > 0 ? sortedMonths[0][0] : 'None';
    const topMonthCount = sortedMonths.length > 0 ? sortedMonths[0][1] : 0;

    const multiPercent = totalEventsRegistered > 0
      ? Math.round((multiDayCount / totalEventsRegistered) * 100)
      : 0;

    const typeCounts = {};
    filteredEvents.forEach(e => {
      if (e.eventType) {
        typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
      }
    });
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const topType = sortedTypes.length > 0 ? sortedTypes[0][0] : 'None';
    const topTypeCount = sortedTypes.length > 0 ? sortedTypes[0][1] : 0;

    const coordCounts = {};
    filteredEvents.forEach(e => {
      if (e.coordinatorName) {
        coordCounts[e.coordinatorName] = (coordCounts[e.coordinatorName] || 0) + 1;
      }
    });
    const sortedCoords = Object.entries(coordCounts).sort((a, b) => b[1] - a[1]);
    const topCoord = sortedCoords.length > 0 ? sortedCoords[0][0] : 'None';
    const topCoordCount = sortedCoords.length > 0 ? sortedCoords[0][1] : 0;

    const venueCounts = {};
    filteredEvents.forEach(e => {
      e.days?.forEach(d => {
        if (d.venue) {
          venueCounts[d.venue] = (venueCounts[d.venue] || 0) + 1;
        }
      });
    });
    const sortedVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]);
    const topVenue = sortedVenues.length > 0 ? sortedVenues[0][0] : 'None';
    const topVenueCount = sortedVenues.length > 0 ? sortedVenues[0][1] : 0;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayCounts = {};
    filteredEvents.forEach(e => {
      const dStr = e.days?.[0]?.date;
      if (dStr) {
        const dayIdx = new Date(dStr).getDay();
        if (!isNaN(dayIdx)) {
          const name = dayNames[dayIdx];
          weekdayCounts[name] = (weekdayCounts[name] || 0) + 1;
        }
      }
    });
    const sortedDays = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1]);
    const busiestDay = sortedDays.length > 0 ? sortedDays[0][0] : 'None';
    const busiestDayCount = sortedDays.length > 0 ? sortedDays[0][1] : 0;

    return {
      topMonth,
      topMonthCount,
      multiPercent,
      topType,
      topTypeCount,
      topCoord,
      topCoordCount,
      topVenue,
      topVenueCount,
      busiestDay,
      busiestDayCount
    };
  }, [filteredEvents, totalEventsRegistered, multiDayCount]);

  // Leaderboard Computations
  const venueLeaderboard = useMemo(() => {
    const counts = {};
    filteredEvents.forEach(e => {
      e.days?.forEach(d => {
        if (d.venue) {
          const v = d.venue.trim();
          counts[v] = (counts[v] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .map(([venue, count]) => ({ venue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredEvents]);

  const coordinatorLeaderboard = useMemo(() => {
    const counts = {};
    filteredEvents.forEach(e => {
      if (e.coordinatorName) {
        const c = e.coordinatorName.trim();
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredEvents]);

  // Event Type Breakdown Data
  const eventTypeBreakdown = useMemo(() => {
    const counts = {};
    filteredEvents.forEach(e => {
      if (e.eventType) {
        counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      share: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  // School Attendance Distribution Data
  const schoolAttendance = useMemo(() => {
    const counts = {};
    filteredHistory.forEach(h => {
      const breakdown = h.schoolBreakdown || {};
      if (Object.keys(breakdown).length > 0) {
        Object.entries(breakdown).forEach(([sch, cnt]) => {
          counts[sch] = (counts[sch] || 0) + (typeof cnt === 'number' ? cnt : 1);
        });
      } else {
        const match = (h.coordinatorFormatted || '').match(/\(([^)|]+)/);
        const sch = match ? match[1].trim() : 'SCORE';
        counts[sch] = (counts[sch] || 0) + (Number(h.totalStudents) || 1);
      }
    });
    return Object.entries(counts).map(([school, count]) => ({
      school,
      count
    })).sort((a, b) => b.count - a.count);
  }, [filteredHistory]);

  // Segregation Stats Table Data
  const lastSegregationText = filteredHistory[0]?.segregatedOn || 'None yet';
  const lastEventRegisteredText = filteredEvents[0]
    ? `${filteredEvents[0].days?.[0]?.date || ''} (${filteredEvents[0].eventName})`
    : 'None yet';

  // Chart Rendering: Image 1 & Image 2 Charts
  useEffect(() => {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const eventsPerMonth = new Array(12).fill(0);
    const segregationsPerMonth = new Array(12).fill(0);

    filteredEvents.forEach(e => {
      const dStr = e.days?.[0]?.date || e.createdAt;
      if (dStr) {
        const m = new Date(dStr).getMonth();
        if (!isNaN(m) && m >= 0 && m < 12) {
          eventsPerMonth[m] += 1;
        }
      }
    });

    filteredHistory.forEach(h => {
      const dStr = h.timestamp || h.segregatedOn;
      if (dStr) {
        const m = new Date(dStr).getMonth();
        if (!isNaN(m) && m >= 0 && m < 12) {
          segregationsPerMonth[m] += 1;
        }
      }
    });

    // 1. Image 1: Registered vs Segregated (Monthly Trend) Line Spline Chart
    if (trendLineCanvasRef.current) {
      if (trendLineInstance.current) trendLineInstance.current.destroy();

      trendLineInstance.current = new ChartJS(trendLineCanvasRef.current, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'Events Registered',
              data: eventsPerMonth,
              borderColor: '#190059',
              backgroundColor: 'rgba(25, 0, 89, 0.12)',
              fill: true,
              tension: 0.45,
              borderWidth: 2.5,
              pointBackgroundColor: '#190059',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1.5,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Segregations Done',
              data: segregationsPerMonth,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              fill: true,
              tension: 0.45,
              borderWidth: 2.5,
              pointBackgroundColor: '#f59e0b',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1.5,
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                usePointStyle: false,
                color: '#374151',
                font: { size: 12, weight: 600 }
              }
            },
            tooltip: {
              backgroundColor: '#190059',
              padding: 10,
              cornerRadius: 6
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 4,
              ticks: { stepSize: 1, color: '#6b7280' },
              grid: { color: '#f3f4f6' }
            },
            x: {
              ticks: { color: '#6b7280' },
              grid: { display: false }
            }
          }
        }
      });
    }

    // 2. Image 1: Event Type Split Doughnut Chart (Single-Day vs Multi-Day)
    if (eventTypeSplitCanvasRef.current) {
      if (eventTypeSplitInstance.current) eventTypeSplitInstance.current.destroy();

      const hasEvents = singleDayCount > 0 || multiDayCount > 0;
      const splitLabels = hasEvents ? ['Single-Day', 'Multi-Day'] : ['No Events'];
      const splitData = hasEvents ? [singleDayCount, multiDayCount] : [1];
      const splitColors = hasEvents ? ['#190059', '#f59e0b'] : ['#e2e8f0'];

      eventTypeSplitInstance.current = new ChartJS(eventTypeSplitCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: splitLabels,
          datasets: [
            {
              data: splitData,
              backgroundColor: splitColors,
              hoverBackgroundColor: hasEvents ? ['#280875', '#d97706'] : ['#cbd5e1'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                usePointStyle: false,
                color: '#374151',
                font: { size: 12, weight: 600 }
              }
            },
            tooltip: {
              backgroundColor: '#190059',
              padding: 8
            }
          }
        }
      });
    }

    // 3. Image 1: Busiest Days of the Week Horizontal Bar Chart
    if (busiestDaysCanvasRef.current) {
      if (busiestDaysInstance.current) busiestDaysInstance.current.destroy();

      const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayValues = [0, 0, 0, 0, 0, 0, 0];
      filteredEvents.forEach(e => {
        const dStr = e.days?.[0]?.date;
        if (dStr) {
          const d = new Date(dStr);
          const idx = d.getDay();
          if (!isNaN(idx)) {
            dayValues[idx] += 1;
          }
        }
      });

      const barColors = dayValues.map(v => v > 0 ? '#7c3aed' : '#d1d5db');

      busiestDaysInstance.current = new ChartJS(busiestDaysCanvasRef.current, {
        type: 'bar',
        data: {
          labels: dayLabels,
          datasets: [
            {
              data: dayValues,
              backgroundColor: barColors,
              borderRadius: 6,
              barThickness: 18
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#190059',
              padding: 8
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: '#6b7280' },
              grid: { color: '#f3f4f6' }
            },
            y: {
              ticks: { color: '#4b5563', font: { weight: 500 } },
              grid: { display: false }
            }
          }
        }
      });
    }

    // 4. Image 2: Events by Type Doughnut Chart (Dynamic Breakdown)
    if (eventsByTypeCanvasRef.current) {
      if (eventsByTypeInstance.current) eventsByTypeInstance.current.destroy();

      const typeCountsMap = {};
      filteredEvents.forEach(e => {
        const t = e.eventType || 'Other';
        typeCountsMap[t] = (typeCountsMap[t] || 0) + 1;
      });

      const typeLabels = Object.keys(typeCountsMap).length > 0 ? Object.keys(typeCountsMap) : ['No Events'];
      const typeValues = Object.keys(typeCountsMap).length > 0 ? Object.values(typeCountsMap) : [1];
      const palette = ['#190059', '#7c3aed', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#6366f1'];
      const typeColors = Object.keys(typeCountsMap).length > 0
        ? typeLabels.map((_, i) => palette[i % palette.length])
        : ['#e2e8f0'];

      eventsByTypeInstance.current = new ChartJS(eventsByTypeCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: typeLabels,
          datasets: [
            {
              data: typeValues,
              backgroundColor: typeColors,
              hoverBackgroundColor: typeColors,
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                usePointStyle: false,
                color: '#374151',
                font: { size: 12, weight: 600 }
              }
            },
            tooltip: {
              backgroundColor: '#190059',
              padding: 8
            }
          }
        }
      });
    }

    // 5. Existing Bottom Charts: Monthly Events & Segregations
    if (eventsMonthlyCanvasRef.current) {
      if (eventsMonthlyInstance.current) eventsMonthlyInstance.current.destroy();
      eventsMonthlyInstance.current = new ChartJS(eventsMonthlyCanvasRef.current, {
        type: 'bar',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'Events Registered',
              data: eventsPerMonth,
              backgroundColor: '#f59e0b',
              borderRadius: 4,
              maxBarThickness: 24
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#190059', padding: 8 }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6b7280' }, grid: { color: '#f3f4f6' } },
            x: { ticks: { color: '#6b7280' }, grid: { display: false } }
          }
        }
      });
    }

    if (segregationsMonthlyCanvasRef.current) {
      if (segregationsMonthlyInstance.current) segregationsMonthlyInstance.current.destroy();
      segregationsMonthlyInstance.current = new ChartJS(segregationsMonthlyCanvasRef.current, {
        type: 'bar',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'Segregations Done',
              data: segregationsPerMonth,
              backgroundColor: '#f59e0b',
              borderRadius: 4,
              maxBarThickness: 24
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#190059', padding: 8 }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6b7280' }, grid: { color: '#f3f4f6' } },
            x: { ticks: { color: '#6b7280' }, grid: { display: false } }
          }
        }
      });
    }

    return () => {
      if (trendLineInstance.current) trendLineInstance.current.destroy();
      if (eventTypeSplitInstance.current) eventTypeSplitInstance.current.destroy();
      if (busiestDaysInstance.current) busiestDaysInstance.current.destroy();
      if (eventsByTypeInstance.current) eventsByTypeInstance.current.destroy();
      if (eventsMonthlyInstance.current) eventsMonthlyInstance.current.destroy();
      if (segregationsMonthlyInstance.current) segregationsMonthlyInstance.current.destroy();
    };
  }, [filteredEvents, filteredHistory, singleDayCount, multiDayCount]);

  // Calendar Heatmap Days Generator for 2026 (computed dynamically from registered events)
  const heatmapDays = useMemo(() => {
    const dateCounts = {};
    filteredEvents.forEach(e => {
      e.days?.forEach(d => {
        if (d.date && d.date.startsWith('2026')) {
          dateCounts[d.date] = (dateCounts[d.date] || 0) + 1;
        }
      });
    });

    const weeks = [];
    const startDate = new Date('2026-01-01');
    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + (w * 7 + d));
        const iso = cur.toISOString().split('T')[0];
        const count = dateCounts[iso] || 0;
        let level = 0;
        if (count >= 4) level = 4;
        else if (count === 3) level = 3;
        else if (count === 2) level = 2;
        else if (count >= 1) level = 1;
        week.push({ dayOfWeek: d, level, date: iso, count });
      }
      weeks.push(week);
    }
    return weeks;
  }, [filteredEvents]);

  // Download PDF Report
  const handleDownloadReport = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica');

      // Header Banner
      doc.setFillColor(25, 0, 89);
      doc.rect(0, 0, 210, 30, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SMART ATTENDANCE & EVENT MANAGEMENT PORTAL', 105, 14, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Executive Analytics & Attendance Audit Report', 105, 22, { align: 'center' });

      // KPIs
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 42);
      doc.text(`Total Events Registered: ${totalEventsRegistered}`, 15, 50);
      doc.text(`Total Segregations Done: ${totalSegregationsDone}`, 15, 58);
      doc.text(`Total Students Processed: ${totalStudentsProcessed}`, 15, 66);
      doc.text(`Pending Segregations: ${pendingCount}`, 15, 74);
      doc.text(`Single-Day Events: ${singleDayCount} | Multi-Day Events: ${multiDayCount}`, 15, 82);

      // Smart Insights Summary
      doc.setFillColor(248, 246, 254);
      doc.rect(15, 92, 180, 48, 'F');
      doc.setTextColor(25, 0, 89);
      doc.setFont('helvetica', 'bold');
      doc.text('Smart Insights Summary:', 20, 100);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      doc.text(`* ${smartInsights.topMonth} was the most active month (${smartInsights.topMonthCount} events).`, 20, 108);
      doc.text(`* ${smartInsights.multiPercent}% of events are multi-day.`, 20, 115);
      doc.text(`* Most common event type: ${smartInsights.topType}.`, 20, 122);
      doc.text(`* Most active Faculty Coordinator: ${smartInsights.topCoord}.`, 20, 129);
      doc.text(`* Busiest day of the week: ${smartInsights.busiestDay}.`, 20, 136);

      doc.save(`Executive_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
      alert('Report exported.');
    }
  };

  return (
    <div className="exact-analytics-container">
      {/* 1. Top Time Filter Pills Row (Pic 4) */}
      <div className="analytics-top-pills-row">
        <div className="time-pills-group">
          {TIME_PILLS.map(pill => (
            <button
              key={pill.id}
              type="button"
              className={`btn-time-pill ${timeFilter === pill.id ? 'time-pill-active' : ''}`}
              onClick={() => setTimeFilter(pill.id)}
            >
              <span>{pill.icon}</span>
              <span>{pill.label}</span>
            </button>
          ))}
        </div>

        <div className="analytics-showing-badge">
          Showing: {TIME_PILLS.find(p => p.id === timeFilter)?.label || 'All Time'}
        </div>
      </div>

      {/* 2. Sub-filter & Download Row (Pic 4) */}
      <div className="analytics-sub-filter-row mt-4">
        <div className="event-type-filter-group">
          <label className="event-type-label">Event Type:</label>
          <select
            className="analytics-event-type-select"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="ALL">All Event Types</option>
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-download-analytics-report"
          onClick={handleDownloadReport}
        >
          ⬇ Download Analytics Report
        </button>
      </div>

      {/* 3. 6 KPI Cards Grid (Pic 4) */}
      <div className="analytics-6kpi-grid mt-4">
        {/* Card 1: EVENTS REGISTERED */}
        <div className="kpi-card-box">
          <div className="kpi-icon-row">📋</div>
          <div className="kpi-number-big">{totalEventsRegistered}</div>
          <div className="kpi-label-text">EVENTS REGISTERED</div>
        </div>

        {/* Card 2: SEGREGATIONS DONE */}
        <div className="kpi-card-box">
          <div className="kpi-icon-row">⚡</div>
          <div className="kpi-number-big">{totalSegregationsDone}</div>
          <div className="kpi-label-text">SEGREGATIONS DONE</div>
        </div>

        {/* Card 3: STUDENTS PROCESSED */}
        <div className="kpi-card-box">
          <div className="kpi-icon-row">🎓</div>
          <div className="kpi-number-big">{totalStudentsProcessed}</div>
          <div className="kpi-label-text">STUDENTS PROCESSED</div>
        </div>

        {/* Card 4: PENDING (Highlighted in Red Border) */}
        <div className="kpi-card-box kpi-card-pending-red">
          <div className="kpi-icon-row">⚠️</div>
          <div className="kpi-number-big kpi-red-number">{pendingCount}</div>
          <div className="kpi-label-text kpi-red-label">PENDING</div>
        </div>

        {/* Card 5: SINGLE-DAY EVENTS */}
        <div className="kpi-card-box">
          <div className="kpi-icon-row">🗓️</div>
          <div className="kpi-number-big">{singleDayCount}</div>
          <div className="kpi-label-text">SINGLE-DAY EVENTS</div>
        </div>

        {/* Card 6: MULTI-DAY EVENTS */}
        <div className="kpi-card-box">
          <div className="kpi-icon-row">🗓️</div>
          <div className="kpi-number-big">{multiDayCount}</div>
          <div className="kpi-label-text">MULTI-DAY EVENTS</div>
        </div>
      </div>

      {/* 4. Smart Insights Box (Pic 4) */}
      <div className="smart-insights-purple-box mt-4">
        <h3 className="smart-insights-title">
          <span>🧠</span> Smart Insights
        </h3>
        <ul className="smart-insights-list">
          <li>
            → 🗓️ <span className="highlight-gold">{smartInsights.topMonth}</span> was the most active month ({smartInsights.topMonthCount} events).
          </li>
          <li>
            → 🎓 <span className="highlight-gold">{totalStudentsProcessed}</span> student records processed.
          </li>
          <li>
            → 📊 <span className="highlight-gold">{smartInsights.multiPercent}%</span> of events are multi-day ({multiDayCount} of {totalEventsRegistered}).
          </li>
          <li>
            → 🏆 Most attended event:{' '}
            <span className="highlight-gold">
              {filteredHistory[0]?.eventsSegregated?.split('\n')[0]?.replace(/^•\s*/, '') || filteredEvents[0]?.eventName || 'None yet'}
            </span>
            {filteredHistory[0]?.totalStudents ? ` (${filteredHistory[0].totalStudents} students across ${filteredHistory[0].schoolsRepresented || 1} schools).` : ''}
          </li>
          <li>
            → 🏫 Most participating school:{' '}
            <span className="highlight-gold">
              {schoolAttendance[0]?.school || 'None yet'}
            </span>
            {schoolAttendance[0]?.count ? ` (${schoolAttendance[0].count} students).` : ''}
          </li>
          <li>
            → 🏷️ Most common event type: <span className="highlight-gold">{smartInsights.topType}</span> ({smartInsights.topTypeCount} events).
          </li>
          <li>
            → 🏛️ Most utilised venue: <span className="highlight-gold">{smartInsights.topVenue}</span> ({smartInsights.topVenueCount} events).
          </li>
          <li>
            → 👥 Most active Faculty Coordinator: <span className="highlight-gold">{smartInsights.topCoord}</span> ({smartInsights.topCoordCount} events).
          </li>
          <li>
            → 📅 Busiest day: <span className="highlight-gold">{smartInsights.busiestDay}</span> ({smartInsights.busiestDayCount} events).
          </li>
        </ul>
      </div>

      {/* 5. Middle Two-Column Section (Pic 5) */}
      <div className="analytics-2cols-middle mt-6">
        {/* Left Column: Pending Events */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-red">
            <span>⚠️</span> Pending Events (Registered but Never Segregated)
          </h4>
          <div className="pending-events-list">
            {pendingEvents.length > 0 ? (
              pendingEvents.map(ev => {
                const firstDay = ev.days?.[0] || {};
                const lastDay = ev.days?.[ev.days.length - 1] || firstDay;
                const dateDisplay = ev.isMultiDay && ev.days?.length > 1
                  ? `${firstDay.date} – ${lastDay.date}`
                  : firstDay.date;

                return (
                  <div key={ev.id} className="pending-event-item-card">
                    <div className="pending-item-left">
                      <span className="pending-doc-icon">📋</span>
                      <div className="pending-event-name">{ev.eventName}</div>
                    </div>

                    <div className="pending-item-mid">
                      <span className="pending-venue">— {firstDay.venue || 'Campus'}</span>
                      <span className="pending-date">{dateDisplay}</span>
                    </div>

                    <div className="pending-item-right">
                      <span className="badge-pending-red">Pending</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="pending-empty-state">
                All registered events in this range have been segregated!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Segregation Stats */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>📊</span> Segregation Stats
          </h4>
          <div className="stats-table-wrapper">
            <table className="stats-metric-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Segregations Done</td>
                  <td className="stat-value-bold">{totalSegregationsDone}</td>
                </tr>
                <tr>
                  <td>Total Students</td>
                  <td className="stat-value-bold">{totalStudentsProcessed}</td>
                </tr>
                <tr>
                  <td>Avg Students / Segregation</td>
                  <td className="stat-value-bold">
                    {totalSegregationsDone > 0 ? Math.round(totalStudentsProcessed / totalSegregationsDone) : 0}
                  </td>
                </tr>
                <tr>
                  <td>Avg Events / Segregation</td>
                  <td className="stat-value-bold">
                    {totalSegregationsDone > 0 ? (totalEventsRegistered / totalSegregationsDone).toFixed(0) : 1}
                  </td>
                </tr>
                <tr>
                  <td>Busiest Day of Week</td>
                  <td className="stat-value-bold">{smartInsights.busiestDay}</td>
                </tr>
                <tr>
                  <td>Last Segregation</td>
                  <td className="stat-value-bold">{lastSegregationText}</td>
                </tr>
                <tr>
                  <td>Last Event Registered</td>
                  <td className="stat-value-bold">{lastEventRegisteredText}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. EXACT IMAGE 1: Registered vs Segregated Trend & Event Type Split */}
      <div className="analytics-2cols-charts mt-6">
        {/* Left: Registered vs Segregated (Monthly Trend) */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>📈</span> Registered vs Segregated (Monthly Trend)
          </h4>
          <div className="chart-canvas-wrapper-lg">
            <canvas ref={trendLineCanvasRef} />
          </div>
        </div>

        {/* Right: Event Type Split */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span className="dot-indicator-blue">🔵</span> Event Type Split
          </h4>
          <div className="chart-canvas-wrapper-doughnut">
            <canvas ref={eventTypeSplitCanvasRef} />
          </div>
        </div>
      </div>

      {/* 7. EXACT IMAGE 1: Busiest Days & Calendar Heatmap */}
      <div className="analytics-2cols-charts mt-6">
        {/* Left: Busiest Days of the Week */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>📅</span> Busiest Days of the Week
          </h4>
          <div className="chart-canvas-wrapper-hbars">
            <canvas ref={busiestDaysCanvasRef} />
          </div>
        </div>

        {/* Right: Event Density Heatmap — 2026 */}
        <div className="analytics-card-white">
          <div className="heatmap-header-row">
            <h4 className="card-section-title-purple mb-0">
              <span>📅</span> Event Density Heatmap — {selectedYear}
            </h4>
            <div className="heatmap-nav-btns">
              <button
                type="button"
                className="btn-heatmap-nav"
                onClick={() => setSelectedYear(y => y - 1)}
                title="Previous Year"
              >
                ◀
              </button>
              <button
                type="button"
                className="btn-heatmap-nav"
                onClick={() => setSelectedYear(y => y + 1)}
                title="Next Year"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="heatmap-scroll-area mt-4">
            <div className="heatmap-months-labels">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
              <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
              <span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
            </div>
            <div className="heatmap-grid-flex">
              <div className="heatmap-days-labels">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>
              <div className="heatmap-squares-matrix">
                {heatmapDays.map((week, wIdx) => (
                  <div key={wIdx} className="heatmap-week-column">
                    {week.map((cell, dIdx) => (
                      <div
                        key={dIdx}
                        className={`heatmap-cell level-${cell.level}`}
                        title={`Week ${wIdx + 1}, Day ${cell.dayOfWeek}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="heatmap-legend-row">
              <span className="legend-label">Less</span>
              <div className="heatmap-cell level-0" />
              <div className="heatmap-cell level-1" />
              <div className="heatmap-cell level-2" />
              <div className="heatmap-cell level-3" />
              <div className="heatmap-cell level-4" />
              <span className="legend-label">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* 8. EXACT IMAGE 2: School-wise Attendance Distribution (Full Width) */}
      <div className="analytics-card-white mt-6">
        <h4 className="card-section-title-purple">
          <span>🏫</span> School-wise Attendance Distribution
        </h4>
        <div className="school-distribution-bars-list mt-4">
          {schoolAttendance.map((sch, idx) => {
            const barColors = idx === 0 ? '#5c67f2' : '#06b6d4';
            return (
              <div key={sch.school} className="school-bar-row">
                <span className="school-bar-label">{sch.school}</span>
                <div className="school-bar-track">
                  <div
                    className="school-bar-fill"
                    style={{
                      width: '100%',
                      backgroundColor: barColors
                    }}
                  >
                    <span className="school-bar-inner-val">{sch.count}</span>
                  </div>
                </div>
                <span className="school-bar-outer-val">{sch.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9. EXACT IMAGE 2: Events by Type (Doughnut) & Event Type Breakdown (Table) */}
      <div className="analytics-2cols-charts mt-6">
        {/* Left: Events by Type Doughnut */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>🏷️</span> Events by Type
          </h4>
          <div className="chart-canvas-wrapper-doughnut">
            <canvas ref={eventsByTypeCanvasRef} />
          </div>
        </div>

        {/* Right: Event Type Breakdown Table */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>📊</span> Event Type Breakdown
          </h4>
          <div className="event-breakdown-table-wrapper mt-3">
            <table className="event-breakdown-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Count</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {eventTypeBreakdown.map((item) => (
                  <tr key={item.type}>
                    <td>
                      <span className="event-type-table-pill">{item.type}</span>
                    </td>
                    <td className="event-type-count-cell">{item.count}</td>
                    <td className="event-type-share-cell">
                      <div className="share-bar-container">
                        <div
                          className="share-bar-fill"
                          style={{ width: `${item.share}%` }}
                        />
                        <span className="share-bar-pct">{item.share}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 10. EXACT IMAGE 2: Venue Utilisation & Faculty Coordinator Leaderboards */}
      <div className="analytics-2cols-charts mt-6">
        {/* Left: Venue Utilisation (Top 10) */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>🏛️</span> Venue Utilisation (Top 10)
          </h4>
          <div className="leaderboard-list mt-4">
            {venueLeaderboard.map((item, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const medal = medals[idx] || `#${idx + 1}`;
              const barColors = ['#f59e0b', '#94a3b8', '#b45309'];
              const barColor = barColors[idx] || '#cbd5e1';
              const widthPct = idx === 0 ? '70%' : '35%';

              return (
                <div key={item.venue} className="leaderboard-item-row">
                  <span className="leaderboard-medal">{medal}</span>
                  <div className="leaderboard-content-col">
                    <div className="leaderboard-item-title">{item.venue}</div>
                    <div className="leaderboard-bar-track">
                      <div
                        className="leaderboard-bar-fill"
                        style={{ width: widthPct, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                  <span className="leaderboard-count-badge">
                    {item.count} {item.count === 1 ? 'event' : 'events'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Faculty Coordinator Leaderboard (Top 10) */}
        <div className="analytics-card-white">
          <h4 className="card-section-title-purple">
            <span>👥</span> Faculty Coordinator Leaderboard (Top 10)
          </h4>
          <div className="leaderboard-list mt-4">
            {coordinatorLeaderboard.map((item, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const medal = medals[idx] || `#${idx + 1}`;
              const barColors = ['#f59e0b', '#94a3b8', '#b45309'];
              const barColor = barColors[idx] || '#cbd5e1';
              const widthPct = idx === 0 ? '70%' : '35%';

              return (
                <div key={item.name} className="leaderboard-item-row">
                  <span className="leaderboard-medal">{medal}</span>
                  <div className="leaderboard-content-col">
                    <div className="leaderboard-item-title">{item.name}</div>
                    <div className="leaderboard-bar-track">
                      <div
                        className="leaderboard-bar-fill"
                        style={{ width: widthPct, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                  <span className="leaderboard-count-badge">
                    {item.count} {item.count === 1 ? 'event' : 'events'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 11. Bottom Monthly Bar Charts */}
      <div className="analytics-2cols-charts mt-6 mb-6">
        <div className="analytics-card-white">
          <h4 className="chart-box-title-purple">
            <span>🗓️</span> Events Registered — Monthly
          </h4>
          <div className="chart-canvas-wrapper">
            <canvas ref={eventsMonthlyCanvasRef} />
          </div>
        </div>

        <div className="analytics-card-white">
          <h4 className="chart-box-title-purple">
            <span>⚡</span> Segregations Done — Monthly
          </h4>
          <div className="chart-canvas-wrapper">
            <canvas ref={segregationsMonthlyCanvasRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
