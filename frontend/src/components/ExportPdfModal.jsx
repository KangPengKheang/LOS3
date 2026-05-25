import React, { useEffect, useMemo, useState } from 'react';
import { X, FileDown, Calendar, Loader2 } from 'lucide-react';
import { statusOrder, normalizeStatus } from '../utils/statusUtils.js';
import { parseDate } from '../utils/dateUtils.js';

// ── Short column labels for PDF header row ────────────────────────────────────
const STATUS_SHORT = {
  'RM Submission':            'RM Sub.',
  'BM Review':                'BM Rev.',
  'Credit Assessment':        'Credit Assess.',
  'Credit Operation':         'Credit Op.',
  'Approval Committee':       'Approval Com.',
  'Legal & Documentation':    'Legal & Doc.',
  'Disbursement Preparation': 'Disb. Prep.',
  'Approved':                 'Approved',
  'Drawdown':                 'Drawdown',
  'Returned to RM':           'Ret. to RM',
  'Rejected':                 'Rejected',
  'Cancelled':                'Cancelled',
};

// ── Chipmong Bank green palette (RGB arrays for jsPDF) ───────────────────────
const CM = {
  dark:    [0,  61,  36],
  mid:     [0,  97,  60],
  green:   [18, 129,  67],
  light:   [76, 175, 128],
  pale:    [232, 245, 237],
  paleAlt: [244, 251, 247],
  white:   [255, 255, 255],
  gray:    [99,  112, 138],
  navy:    [11,   29,  74],
};

function buildMatrix(cases, branches) {
  const counts = {};
  branches.forEach(b => {
    counts[b] = {};
    statusOrder.forEach(s => { counts[b][s] = 0; });
  });
  cases.forEach(row => {
    const branch = row.BRANCH_NAME;
    const matched = statusOrder.find(s => normalizeStatus(s) === normalizeStatus(row.STATUS));
    if (branch && counts[branch] && matched) {
      counts[branch][matched]++;
    }
  });
  return counts;
}

function fmtDate(iso) {
  if (!iso) return 'All';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function toIsoDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  const local = new Date(d);
  local.setHours(0, 0, 0, 0);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCaseDate(row) {
  return parseDate(row.APPLICATION_DATE || row.ISSUE_DATE);
}

function getDateBounds(rows) {
  let min = null;
  let max = null;
  rows.forEach(row => {
    const d = getCaseDate(row);
    if (!d) return;
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    if (!min || day < min) min = day;
    if (!max || day > max) max = day;
  });
  return {
    min: min ? toIsoDate(min) : '',
    max: max ? toIsoDate(max) : '',
  };
}

function generatePdf(jsPDF, autoTable, cases, branches, matrix, dateFrom, dateTo) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.setFillColor(...CM.dark);
  doc.rect(0, 0, W, 30, 'F');

  // Logo block
  doc.setFillColor(...CM.mid);
  doc.roundedRect(8, 5, 38, 20, 2, 2, 'F');
  doc.setFillColor(...CM.light);
  doc.roundedRect(10, 7, 34, 16, 1.5, 1.5, 'F');
  doc.setTextColor(...CM.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CHIP MONG', 27, 13.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('BANK', 27, 19, { align: 'center' });

  // Title
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CM.white);
  doc.text('LOS Workflow Summary Report', 54, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CM.light);
  doc.text(`Application Date: ${fmtDate(dateFrom)}  –  ${fmtDate(dateTo)}`, 54, 22);

  // Right info
  doc.setFontSize(8);
  doc.setTextColor(...CM.pale);
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Generated: ${genDate}`, W - 8, 14, { align: 'right' });
  doc.text(`Total Cases: ${cases.length}  |  Branches: ${branches.length}`, W - 8, 22, { align: 'right' });

  // Accent line under header
  doc.setFillColor(...CM.light);
  doc.rect(0, 30, W, 2.5, 'F');

  // ── KPI summary bar ────────────────────────────────────────────────────────
  const activeStatuses = [
    'RM Submission', 'BM Review', 'Credit Assessment', 'Credit Operation',
    'Approval Committee', 'Legal & Documentation', 'Disbursement Preparation',
  ];
  const activeCount   = cases.filter(c => activeStatuses.some(s => normalizeStatus(s) === normalizeStatus(c.STATUS))).length;
  const approvedCount = cases.filter(c => normalizeStatus(c.STATUS) === normalizeStatus('Approved')).length;
  const drawdownCount = cases.filter(c => normalizeStatus(c.STATUS) === normalizeStatus('Drawdown')).length;
  const retCount      = cases.filter(c => normalizeStatus(c.STATUS) === normalizeStatus('Returned to RM')).length;
  const rejectedCount = cases.filter(c => normalizeStatus(c.STATUS) === normalizeStatus('Rejected')).length;

  const kpis = [
    { label: 'Total Cases',    value: cases.length,   color: CM.mid },
    { label: 'In Pipeline',    value: activeCount,    color: CM.green },
    { label: 'Approved',       value: approvedCount,  color: [0, 130, 60] },
    { label: 'Drawdown',       value: drawdownCount,  color: [0, 110, 50] },
    { label: 'Returned to RM', value: retCount,       color: [150, 100, 10] },
    { label: 'Rejected',       value: rejectedCount,  color: [180, 50, 50] },
  ];

  const kpiW = W / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = i * kpiW;
    doc.setFillColor(...(i % 2 === 0 ? CM.pale : CM.paleAlt));
    doc.rect(x, 32.5, kpiW, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...kpi.color);
    doc.text(String(kpi.value), x + kpiW / 2, 42, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...CM.gray);
    doc.text(kpi.label, x + kpiW / 2, 47, { align: 'center' });
  });

  // Divider
  doc.setFillColor(...CM.mid);
  doc.rect(0, 48.5, W, 0.6, 'F');

  // ── Main table ─────────────────────────────────────────────────────────────
  const colHeaders = statusOrder.map(s => STATUS_SHORT[s] ?? s);
  const totalColIdx = statusOrder.length + 1;

  const bodyRows = branches.map(branch => {
    const rowTotal = statusOrder.reduce((sum, s) => sum + (matrix[branch]?.[s] ?? 0), 0);
    return [branch, ...statusOrder.map(s => matrix[branch]?.[s] || 0), rowTotal];
  });
  const colTotals = statusOrder.map(s => branches.reduce((sum, b) => sum + (matrix[b]?.[s] ?? 0), 0));
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);
  bodyRows.push(['TOTAL', ...colTotals, grandTotal]);

  autoTable(doc, {
    startY: 51,
    head: [['Branch', ...colHeaders, 'TOTAL']],
    body: bodyRows,
    tableWidth: W - 16,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      valign: 'middle',
      halign: 'center',
      lineColor: [210, 232, 218],
      lineWidth: 0.25,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: CM.mid,
      textColor: CM.white,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      minCellHeight: 10,
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', fillColor: CM.pale, cellWidth: 42 },
      [totalColIdx]: { fontStyle: 'bold', fillColor: CM.pale, textColor: CM.mid, cellWidth: 18 },
    },
    alternateRowStyles: { fillColor: CM.paleAlt },
    bodyStyles: { fillColor: CM.white },
    didParseCell(data) {
      const isLastRow = data.row.index === bodyRows.length - 1;
      if (data.section === 'body' && isLastRow) {
        data.cell.styles.fillColor = CM.mid;
        data.cell.styles.textColor = CM.white;
        data.cell.styles.fontStyle = 'bold';
      } else if (data.section === 'body' && data.column.index > 0 && data.column.index < totalColIdx) {
        const val = Number(data.cell.raw);
        if (val > 0) {
          data.cell.styles.textColor = CM.mid;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [195, 215, 205];
          data.cell.raw = '—';
          data.cell.text = ['—'];
        }
      }
    },
    didDrawPage(data) {
      // Re-draw footer on each page
      doc.setFillColor(...CM.dark);
      doc.rect(0, H - 9, W, 9, 'F');
      doc.setFillColor(...CM.mid);
      doc.rect(0, H - 9, W, 1, 'F');
      doc.setTextColor(...CM.pale);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Chip Mong Bank  —  LOS Dashboard', 8, H - 3);
      doc.text(`Page ${data.pageNumber}  |  CONFIDENTIAL`, W / 2, H - 3, { align: 'center' });
      doc.text(new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }), W - 8, H - 3, { align: 'right' });
    },
    margin: { left: 8, right: 8, bottom: 13 },
  });

  const ds = `${(dateFrom || 'all').replace(/-/g, '')}to${(dateTo || 'all').replace(/-/g, '')}`;
  doc.save(`LOS_Branch_Workflow_${ds}.pdf`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportPdfModal({ cases, onClose }) {
  const bounds = useMemo(() => getDateBounds(cases), [cases]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setDateFrom(prev => prev || bounds.min || '');
    setDateTo(prev => prev || bounds.max || '');
  }, [bounds.min, bounds.max]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const from = parseDate(dateFrom);
    const to = parseDate(dateTo);
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);

    return cases.filter(row => {
      const d = getCaseDate(row);
      if (!d) return true;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [cases, dateFrom, dateTo]);

  const branches = useMemo(() => (
    [...new Set(filtered.map(r => r.BRANCH_NAME).filter(Boolean))].sort()
  ), [filtered]);

  const matrix = useMemo(() => buildMatrix(filtered, branches), [filtered, branches]);

  const colTotals = useMemo(() => (
    statusOrder.map(s => branches.reduce((sum, b) => sum + (matrix[b]?.[s] ?? 0), 0))
  ), [branches, matrix]);

  function handleGenerate() {
    setGenerating(true);
    // Dynamically import heavy PDF libs so they don't bloat the initial bundle
    Promise.all([
      import('jspdf').then(m => m.jsPDF),
      import('jspdf-autotable').then(m => m.default),
    ]).then(([jsPDF, autoTable]) => {
      try {
        generatePdf(jsPDF, autoTable, filtered, branches, matrix, dateFrom, dateTo);
      } finally {
        setGenerating(false);
      }
    }).catch(() => setGenerating(false));
  }

  return (
    <div className="pdf-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Export PDF Report">
      <div className="pdf-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pdf-modal-header">
          <div className="pdf-modal-title">
            <FileDown size={20} />
            <span>Export PDF Report</span>
          </div>
          <button className="pdf-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="pdf-modal-body">
          <p className="pdf-modal-desc">
            Generates a <strong>landscape A4 PDF</strong> with all branches as rows and each
            workflow stage as columns, showing case counts for the selected application date range.
          </p>

          {/* Date pickers */}
          <div className="pdf-date-row">
            <div className="pdf-date-field">
              <label htmlFor="pdf-from"><Calendar size={13} /> Application Date From</label>
              <input
                id="pdf-from"
                type="date"
                value={dateFrom}
                min={bounds.min || undefined}
                max={dateTo || bounds.max || undefined}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="pdf-date-arrow">→</div>
            <div className="pdf-date-field">
              <label htmlFor="pdf-to"><Calendar size={13} /> To</label>
              <input
                id="pdf-to"
                type="date"
                value={dateTo}
                min={dateFrom || bounds.min || undefined}
                max={bounds.max || undefined}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* KPI pills */}
          <div className="pdf-kpi-row">
            <div className="pdf-kpi-item">
              <span className="pdf-kpi-val">{filtered.length}</span>
              <span className="pdf-kpi-lbl">Cases in Range</span>
            </div>
            <div className="pdf-kpi-item">
              <span className="pdf-kpi-val">{branches.length}</span>
              <span className="pdf-kpi-lbl">Branches</span>
            </div>
            <div className="pdf-kpi-item">
              <span className="pdf-kpi-val">{statusOrder.length}</span>
              <span className="pdf-kpi-lbl">Workflow Stages</span>
            </div>
          </div>

          {/* Preview table */}
          <div className="pdf-preview-wrap">
            <div className="pdf-preview-label">
              <span>Data Preview</span>
              <span className="pdf-preview-note">Scroll horizontally to see all columns</span>
            </div>
            <div className="pdf-tbl-scroll">
              <table className="pdf-preview-tbl">
                <thead>
                  <tr>
                    <th className="pdf-th-branch">Branch</th>
                    {statusOrder.map(s => (
                      <th key={s} title={s}>{STATUS_SHORT[s] ?? s}</th>
                    ))}
                    <th className="pdf-th-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan={statusOrder.length + 2} className="pdf-empty-cell">
                        No data in selected date range
                      </td>
                    </tr>
                  ) : (
                    branches.map(branch => {
                      const rowTotal = statusOrder.reduce((sum, s) => sum + (matrix[branch]?.[s] ?? 0), 0);
                      return (
                        <tr key={branch}>
                          <td className="pdf-td-branch">{branch}</td>
                          {statusOrder.map(s => {
                            const v = matrix[branch]?.[s] ?? 0;
                            return (
                              <td key={s} className={v > 0 ? 'pdf-td-pos' : 'pdf-td-zero'}>
                                {v > 0 ? v : '—'}
                              </td>
                            );
                          })}
                          <td className="pdf-td-rowtotal">{rowTotal}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {branches.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="pdf-tf-label">Total</td>
                      {colTotals.map((v, i) => (
                        <td key={i} className={v > 0 ? 'pdf-td-pos pdf-tf-cell' : 'pdf-td-zero pdf-tf-cell'}>
                          {v > 0 ? v : '—'}
                        </td>
                      ))}
                      <td className="pdf-td-rowtotal pdf-tf-cell">{filtered.length}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pdf-modal-footer">
          <span className="pdf-footer-note">Landscape A4  ·  Chipmong Bank branded</span>
          <div className="pdf-footer-actions">
            <button className="pdf-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="pdf-generate-btn"
              onClick={handleGenerate}
              disabled={generating || branches.length === 0}
            >
              {generating
                ? <><Loader2 size={15} className="pdf-spin-icon" /> Generating…</>
                : <><FileDown size={15} /> Generate PDF</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
