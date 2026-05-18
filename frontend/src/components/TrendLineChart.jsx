import React, { useMemo, useState } from 'react';
import { CalendarRange, GitBranch, TrendingUp } from 'lucide-react';
import { parseDate } from '../utils/dateUtils.js';

const granularityOptions = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatKeyDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getApplicationDate(row) {
  return parseDate(row.APPLICATION_DATE || row.ISSUE_DATE || row.REPORT_DATE || row.CURRENT_STEP_START_DATE);
}

function groupLabel(granularity, date) {
  if (granularity === 'day') {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  if (granularity === 'week') {
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
  }
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function groupKey(granularity, date) {
  if (granularity === 'day') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return { key: formatKeyDate(d), start: d };
  }

  if (granularity === 'week') {
    const monday = startOfWeek(date);
    return { key: formatKeyDate(monday), start: monday };
  }

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return { key: `${monthStart.getFullYear()}-${pad(monthStart.getMonth() + 1)}`, start: monthStart };
}

function buildPath(points) {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export default function TrendLineChart({ rows, branches }) {
  const [granularity, setGranularity] = useState('day');
  const [branch, setBranch] = useState('All');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = useMemo(() => {
    const grouped = new Map();

    rows
      .filter(row => branch === 'All' || row.BRANCH_NAME === branch)
      .forEach(row => {
        const date = getApplicationDate(row);
        if (!date) return;

        const bucket = groupKey(granularity, date);
        const current = grouped.get(bucket.key);

        if (current) {
          current.count += 1;
        } else {
          grouped.set(bucket.key, {
            key: bucket.key,
            start: bucket.start,
            count: 1,
          });
        }
      });

    return [...grouped.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(item => ({
        ...item,
        label: groupLabel(granularity, item.start),
      }));
  }, [rows, branch, granularity]);

  const stats = useMemo(() => {
    const total = series.reduce((sum, item) => sum + item.count, 0);
    const peak = series.reduce((best, item) => (item.count > best.count ? item : best), { count: 0, label: '-' });
    const average = series.length ? (total / series.length).toFixed(1) : '0.0';
    return { total, peak, average };
  }, [series]);

  const chart = useMemo(() => {
    const width = 1000;
    const height = 330;
    const padding = { top: 24, right: 36, bottom: 50, left: 36 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    if (!series.length) {
      return { width, height, points: [], linePath: '', areaPath: '', ticks: [0, 1, 2, 3, 4] };
    }

    const maxValue = Math.max(...series.map(item => item.count), 1);
    const step = series.length > 1 ? innerWidth / (series.length - 1) : 0;

    const points = series.map((item, index) => {
      const x = padding.left + (series.length > 1 ? step * index : innerWidth / 2);
      const y = padding.top + innerHeight - (item.count / maxValue) * innerHeight;
      return { ...item, x, y };
    });

    const linePath = buildPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(scale => Math.round(maxValue * scale));

    return { width, height, points, linePath, areaPath, ticks, maxValue, padding, innerHeight };
  }, [series]);

  return (
    <div className="trend-panel">
      <div className="trend-head">
        <div>
          <h3>LOS Applications Trend</h3>
          <p>Track incoming case volume over time by day, week, or month, with branch-level filtering.</p>
        </div>
        <div className="trend-controls">
          <div className="pill-group" role="group" aria-label="Trend granularity">
            {granularityOptions.map(option => (
              <button
                key={option.value}
                type="button"
                className={`pill-btn ${granularity === option.value ? 'active' : ''}`}
                onClick={() => setGranularity(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="branch-select-wrap">
            <GitBranch size={16} />
            <span className="sr-only">Select Branch</span>
            <select value={branch} onChange={event => setBranch(event.target.value)}>
              <option value="All">All Branches</option>
              {branches.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="trend-stats">
        <div className="trend-stat-card">
          <CalendarRange size={16} />
          <span>Total Applications</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="trend-stat-card">
          <TrendingUp size={16} />
          <span>Peak Period</span>
          <strong>{stats.peak.label}</strong>
        </div>
        <div className="trend-stat-card">
          <span>Avg / Period</span>
          <strong>{stats.average}</strong>
        </div>
      </div>

      {chart.points.length ? (
        <div className="trend-chart-wrap">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="trend-chart"
            role="img"
            aria-label="LOS applications trend line"
          >
            <defs>
              <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(20, 99, 216, 0.35)" />
                <stop offset="100%" stopColor="rgba(20, 99, 216, 0.02)" />
              </linearGradient>
            </defs>

            {chart.ticks.map((tick, index) => {
              const y = chart.padding.top + chart.innerHeight - (tick / chart.maxValue) * chart.innerHeight;
              return (
                <g key={`${tick}-${index}`}>
                  <line
                    x1={chart.padding.left}
                    y1={y}
                    x2={chart.width - chart.padding.right}
                    y2={y}
                    className="trend-grid-line"
                  />
                  <text x={chart.padding.left - 8} y={y + 4} textAnchor="end" className="trend-y-label">
                    {tick}
                  </text>
                </g>
              );
            })}

            <path d={chart.areaPath} className="trend-area" />
            <path d={chart.linePath} className="trend-line" />

            {chart.points.map((point, index) => (
              <g key={`${point.key}-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPoint?.key === point.key ? 7 : 5}
                  className="trend-point"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {(index === 0 || index === chart.points.length - 1 || index % Math.ceil(chart.points.length / 6) === 0) && (
                  <text x={point.x} y={chart.height - 18} textAnchor="middle" className="trend-x-label">
                    {point.label}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {hoveredPoint ? (
            <div className="trend-tooltip" style={{ left: `${(hoveredPoint.x / chart.width) * 100}%` }}>
              <strong>{hoveredPoint.count} applications</strong>
              <span>{hoveredPoint.label}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="trend-empty">No records available for the selected branch.</div>
      )}
    </div>
  );
}
