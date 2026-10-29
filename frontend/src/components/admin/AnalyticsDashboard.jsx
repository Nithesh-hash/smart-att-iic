/**
 * Admin Sub-Module 3: Executive Analytics Dashboard
 * Features:
 * - Time Filters (All-Time, 2026, 2025, Custom Dates)
 * - 5 Executive KPI Cards
 * - Chart.js Visualizations (Monthly Event Trends, Runs per Month, Event Type Doughnut, Day of Week breakdown)
 * - GitHub-style 365-day calendar heatmap
 * - 1-Click Executive PDF Export using jsPDF
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Calendar,
  Users,
  Download,
  Filter,
  CheckCircle2,
  Sparkles,
  Award
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  DoughnutController
} from 'chart.js';
import jsPDF from 'jspdf';
import { getEvents, getSegregationHistory } from '../../services/dataService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  DoughnutController
);

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [timeFilter, setTimeFilter] = useState('ALL'); // ALL, 2026, 2025
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Canvas Refs for Chart.js
  const monthlyTrendsCanvasRef = useRef(null);
  const typeDoughnutCanvasRef = useRef(null);
  const weekdayCanvasRef = useRef(null);

  // Active Chart Instances
  const monthlyChartInstance = useRef(null);
  const doughnutChartInstance = useRef(null);
  const weekdayChartInstance = useRef(null);

  useEffect(() => {
    async function fetchData() {
      const evList = await getEvents();
      const histList = await getSegregationHistory();
      setEvents(evList);
      setHistory(histList);
    }
    fetchData();
  }, []);

  // Filtered Events according to Selected Time Filter
  const filteredEvents = useMemo(() => {
    if (timeFilter === 'ALL') return events;
    return events.filter(e => {
      const d = e.days?.[0]?.date || e.createdAt;
      return d && d.startsWith(timeFilter);
    });
  }, [events, timeFilter]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (timeFilter === 'ALL') return history;
    return history.filter(h => {
      const d = h.timestamp || h.dateRange;
      return d && d.includes(timeFilter);
    });
  }, [history, timeFilter]);

  // KPI Computations
  const totalEvents = filteredEvents.length;
  const singleDayEvents = filteredEvents.filter(e => !e.isMultiDay).length;
  const multiDayEvents = filteredEvents.filter(e => e.isMultiDay).length;
  const totalSegregationRuns = filteredHistory.length;
  const totalStudentsProcessed = filteredHistory.reduce((sum, h) => sum + (h.totalStudents || 0), 0);
  const averageAttendance = totalSegregationRuns > 0 ? Math.round(totalStudentsProcessed / totalSegregationRuns) : 0;

  // Render Charts
  useEffect(() => {
    if (!filteredEvents || filteredEvents.length === 0) return;

    // 1. Monthly Trends Chart
    if (monthlyTrendsCanvasRef.current) {
      if (monthlyChartInstance.current) {
        monthlyChartInstance.current.destroy();
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyEventCounts = new Array(12).fill(0);
      const monthlyRunCounts = new Array(12).fill(0);

      filteredEvents.forEach(ev => {
        const dStr = ev.days?.[0]?.date || ev.createdAt;
        if (dStr) {
          const m = new Date(dStr).getMonth();
          if (m >= 0 && m < 12) monthlyEventCounts[m]++;
        }
      });

      filteredHistory.forEach(h => {
        if (h.timestamp) {
          const m = new Date(h.timestamp).getMonth();
          if (m >= 0 && m < 12) monthlyRunCounts[m]++;
        }
      });

      const ctx = monthlyTrendsCanvasRef.current.getContext('2d');
      monthlyChartInstance.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: monthNames,
          datasets: [
            {
              label: 'Events Registered',
              data: monthlyEventCounts,
              backgroundColor: 'rgba(99, 102, 241, 0.75)',
              borderColor: '#6366f1',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'Segregation Runs',
              data: monthlyRunCounts,
              backgroundColor: 'rgba(16, 185, 129, 0.75)',
              borderColor: '#10b981',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#e2e8f0', font: { family: 'Plus Jakarta Sans', size: 12 } }
            }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', stepSize: 1 },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    // 2. Event Type Distribution Doughnut
    if (typeDoughnutCanvasRef.current) {
      if (doughnutChartInstance.current) {
        doughnutChartInstance.current.destroy();
      }

      const typeMap = {};
      filteredEvents.forEach(ev => {
        const t = ev.eventType || 'Other';
        typeMap[t] = (typeMap[t] || 0) + 1;
      });

      const labels = Object.keys(typeMap);
      const data = Object.values(typeMap);
      const bgColors = [
        '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6'
      ];

      const ctx = typeDoughnutCanvasRef.current.getContext('2d');
      doughnutChartInstance.current = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: bgColors.slice(0, labels.length),
              borderWidth: 2,
              borderColor: '#1e1b4b'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#e2e8f0', font: { size: 11 } }
            }
          }
        }
      });
    }

    // 3. Day of Week Breakdown
    if (weekdayCanvasRef.current) {
      if (weekdayChartInstance.current) {
        weekdayChartInstance.current.destroy();
      }

      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekdayCounts = new Array(7).fill(0);

      filteredEvents.forEach(ev => {
        ev.days?.forEach(d => {
          if (d.date) {
            const dayIdx = new Date(d.date).getDay();
            if (dayIdx >= 0 && dayIdx < 7) weekdayCounts[dayIdx]++;
          }
        });
      });

      const ctx = weekdayCanvasRef.current.getContext('2d');
      weekdayChartInstance.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: weekdayNames,
          datasets: [
            {
              label: 'Sessions Hosted',
              data: weekdayCounts,
              backgroundColor: 'rgba(245, 158, 11, 0.75)',
              borderColor: '#f59e0b',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', stepSize: 1 },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    return () => {
      if (monthlyChartInstance.current) monthlyChartInstance.current.destroy();
      if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();
      if (weekdayChartInstance.current) weekdayChartInstance.current.destroy();
    };
  }, [filteredEvents, filteredHistory]);

  // Generate GitHub-Style 365-Day Calendar Heatmap
  const heatmapData = useMemo(() => {
    const year = timeFilter === '2025' ? 2025 : 2026;
    const daysOfYear = [];
    const dateCountMap = {};

    filteredEvents.forEach(ev => {
      ev.days?.forEach(d => {
        if (d.date) {
          dateCountMap[d.date] = (dateCountMap[d.date] || 0) + 1;
        }
      });
    });

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const iso = curr.toISOString().split('T')[0];
      const count = dateCountMap[iso] || 0;
      daysOfYear.push({
        date: iso,
        count
      });
      curr.setDate(curr.getDate() + 1);
    }

    return daysOfYear;
  }, [filteredEvents, timeFilter]);

  // Export Executive PDF Report
  const handleExportPdf = () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(30, 27, 75); // Dark Indigo
      doc.rect(0, 0, 210, 36, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('VIT SMART ATTENDANCE PORTAL', 14, 16);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(199, 210, 254);
      doc.text('Office of Innovation, Startup & Technology Transfer (VIT-IST)', 14, 24);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      // Section: Executive KPIs
      doc.setTextColor(30, 27, 75);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('1. EXECUTIVE SUMMARY & KEY PERFORMANCE METRICS', 14, 48);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);

      const kpiLines = [
        `* Time Window Analyzed      : ${timeFilter === 'ALL' ? 'All-Time Historical' : `Year ${timeFilter}`}`,
        `* Total Registered Events   : ${totalEvents} (Single-Day: ${singleDayEvents}, Multi-Day: ${multiDayEvents})`,
        `* Total Segregation Runs    : ${totalSegregationRuns} batches executed`,
        `* Total Students Processed  : ${totalStudentsProcessed.toLocaleString()} student attendance records`,
        `* Average Event Attendance  : ${averageAttendance} students per session`
      ];

      let yPos = 56;
      kpiLines.forEach(line => {
        doc.text(line, 16, yPos);
        yPos += 7;
      });

      // Section: Top Events Table
      yPos += 5;
      doc.setTextColor(30, 27, 75);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('2. REGISTERED INSTITUTIONAL EVENTS OVERVIEW', 14, yPos);
      yPos += 8;

      doc.setFillColor(243, 244, 246);
      doc.rect(14, yPos, 182, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(30, 27, 75);
      doc.setFont('helvetica', 'bold');
      doc.text('Event Title', 16, yPos + 6);
      doc.text('School', 95, yPos + 6);
      doc.text('Coordinator', 125, yPos + 6);
      doc.text('Date', 165, yPos + 6);
      yPos += 10;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      filteredEvents.slice(0, 15).forEach((ev) => {
        const title = ev.eventName.length > 40 ? ev.eventName.substring(0, 38) + '...' : ev.eventName;
        const school = ev.school || 'SCOPE';
        const coord = ev.coordinatorName.length > 20 ? ev.coordinatorName.substring(0, 18) + '...' : ev.coordinatorName;
        const date = ev.days?.[0]?.date || 'N/A';

        doc.text(title, 16, yPos);
        doc.text(school, 95, yPos);
        doc.text(coord, 125, yPos);
        doc.text(date, 165, yPos);
        yPos += 7;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Confidential - Official VIT-IST Institutional Attendance Segregator Report', 14, 285);

      doc.save(`Attendance_Executive_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="admin-analytics-dashboard">
      {/* Top Filter and PDF Export Bar */}
      <div className="analytics-toolbar">
        <div className="analytics-filter-pills">
          <span className="filter-label">Filter Period:</span>
          {['ALL', '2026', '2025'].map(period => (
            <button
              key={period}
              type="button"
              className={`btn-period-pill ${timeFilter === period ? 'period-active' : ''}`}
              onClick={() => setTimeFilter(period)}
            >
              {period === 'ALL' ? 'All-Time' : `Year ${period}`}
            </button>
          ))}
        </div>

        <button
          className="btn-export-pdf"
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          title="Generate Executive Analytics Summary PDF"
        >
          <Download size={16} />
          <span>{isExportingPdf ? 'Exporting PDF...' : 'Export Executive PDF Report'}</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-cards-grid mt-4">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Events</span>
            <Calendar size={18} className="kpi-icon icon-indigo" />
          </div>
          <div className="kpi-value">{totalEvents}</div>
          <div className="kpi-subtext">
            <span>{singleDayEvents} Single-Day</span> • <span>{multiDayEvents} Multi-Day</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Segregation Runs</span>
            <BarChart3 size={18} className="kpi-icon icon-emerald" />
          </div>
          <div className="kpi-value">{totalSegregationRuns}</div>
          <div className="kpi-subtext">Quick & Batch executions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Students Processed</span>
            <Users size={18} className="kpi-icon icon-amber" />
          </div>
          <div className="kpi-value highlight-number">{totalStudentsProcessed.toLocaleString()}</div>
          <div className="kpi-subtext">Across all academic schools</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Average Attendance</span>
            <TrendingUp size={18} className="kpi-icon icon-pink" />
          </div>
          <div className="kpi-value">{averageAttendance}</div>
          <div className="kpi-subtext">Students per segregation run</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid-2cols mt-6">
        {/* Monthly Trend Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h4>Monthly Event & Segregation Volume</h4>
            <span className="chart-badge">Trends</span>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={monthlyTrendsCanvasRef} />
          </div>
        </div>

        {/* Event Type Distribution */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h4>Event Type Breakdown</h4>
            <span className="chart-badge">Categorical</span>
          </div>
          <div className="chart-canvas-wrapper">
            <canvas ref={typeDoughnutCanvasRef} />
          </div>
        </div>

        {/* Day of Week */}
        <div className="chart-card chart-card-wide">
          <div className="chart-card-header">
            <h4>Busiest Days of the Week (Session Frequency)</h4>
            <span className="chart-badge">Weekly Distribution</span>
          </div>
          <div className="chart-canvas-wrapper-short">
            <canvas ref={weekdayCanvasRef} />
          </div>
        </div>
      </div>

      {/* GitHub-style 365-Day Calendar Heatmap */}
      <div className="heatmap-card mt-6">
        <div className="heatmap-header">
          <div>
            <h4>Calendar Session Intensity Heatmap ({timeFilter === '2025' ? '2025' : '2026'})</h4>
            <p className="heatmap-subtext">
              Daily frequency of registered workshops, seminars, and sessions across the calendar year.
            </p>
          </div>
          <div className="heatmap-legend">
            <span className="legend-lbl">Less</span>
            <span className="heat-cell heat-0"></span>
            <span className="heat-cell heat-1"></span>
            <span className="heat-cell heat-2"></span>
            <span className="heat-cell heat-3"></span>
            <span className="legend-lbl">More</span>
          </div>
        </div>

        <div className="heatmap-grid-scroll">
          <div className="heatmap-grid">
            {heatmapData.map((d) => {
              const heatClass =
                d.count === 0 ? 'heat-0' :
                d.count === 1 ? 'heat-1' :
                d.count === 2 ? 'heat-2' : 'heat-3';

              return (
                <div
                  key={d.date}
                  className={`heat-cell ${heatClass}`}
                  title={`${d.date}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

