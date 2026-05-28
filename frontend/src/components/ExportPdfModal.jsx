import React, { useEffect, useMemo, useState } from 'react';
import { X, FileDown, Calendar, Loader2 } from 'lucide-react';
import { statusMatches } from '../utils/statusUtils.js';
import { parseDate } from '../utils/dateUtils.js';
import { FLOW_STEPS, SPECIAL_STEPS } from './WorkflowTracker.jsx';
import { BRANCH_MASTER_LIST } from '../data/branchMasterList.js';
import chipMongBankLogo from '../assets/chip-mong-bank-logo.png.jpg';

// All workflow columns in PDF order: pipeline steps then special outcomes
const ALL_STEPS = [...FLOW_STEPS, ...SPECIAL_STEPS];
const UNKNOWN_BRANCH_LABEL = '(Unknown Branch)';
const UNMAPPED_STEP = {
  id: '__unmapped__',
  label: 'Unmapped',
  fullName: 'Unmapped Status',
  statuses: [],
};
const REPORT_STEPS = [...ALL_STEPS, UNMAPPED_STEP];

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
  danger:  [200,   40,  40],
};

function buildMatrix(cases, branches) {
  const branchSet = new Set(branches);
  const counts = {};
  branches.forEach(b => {
    counts[b] = {};
    REPORT_STEPS.forEach(step => { counts[b][step.id] = 0; });
  });
  cases.forEach(row => {
    const branch = normalizeBranchName(row.BRANCH_NAME);
    if (!branchSet.has(branch)) return;
    const step = ALL_STEPS.find(s => statusMatches(row.STATUS, s.statuses));
    const targetStepId = step?.id || UNMAPPED_STEP.id;
    counts[branch][targetStepId]++;
  });
  return counts;
}

function buildBranchCaseTotals(cases, branches) {
  const branchSet = new Set(branches);
  const totals = {};
  branches.forEach(branch => { totals[branch] = 0; });
  cases.forEach(row => {
    const branch = normalizeBranchName(row.BRANCH_NAME);
    if (!branchSet.has(branch)) return;
    totals[branch] += 1;
  });
  return totals;
}

function normalizeBranchName(value) {
  const branch = String(value ?? '').trim();
  return branch || UNKNOWN_BRANCH_LABEL;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCode(value) {
  return String(value || '').trim();
}

function getRowBranchCode(row) {
  return normalizeCode(
    row['BRANCH/OUTLET CODE']
    || row.BRANCH_CODE
    || row.BRANCHCODE
    || row.BRANCH_CODE_ID
    || row.BRANCH_ID
  );
}

function buildOrderedBranches(filteredCases) {
  // Inactive branch detection by both name and code from master list
  const inactiveNames = new Set();
  const inactiveCodes = new Set();
  const masterInactiveBranches = [];
  BRANCH_MASTER_LIST.forEach(branch => {
    if (branch.status === 'inactive') {
      inactiveNames.add(normalizeName(branch.name));
      if (branch.code) inactiveCodes.add(normalizeCode(branch.code));
      masterInactiveBranches.push(branch.name);
    }
  });

  // Raw branch names exactly as they appear in data — same as dashboard table
  const rawBranches = [...new Set(
    filteredCases
      .map(row => normalizeBranchName(row.BRANCH_NAME))
  )].sort((a, b) => a.localeCompare(b));

  // Filter out inactive branches by name or code
  const activeBranches = rawBranches.filter(branchName => {
    if (inactiveNames.has(normalizeName(branchName))) return false;
    const sampleRow = filteredCases.find(r => String(r.BRANCH_NAME || '').trim() === branchName);
    const code = sampleRow ? getRowBranchCode(sampleRow) : '';
    if (code && inactiveCodes.has(code)) return false;
    return true;
  });

  // Track what's already covered by code and normalized name
  const activeBranchNormNames = new Set(activeBranches.map(normalizeName));
  const activeBranchCodes = new Set(
    filteredCases
      .filter(row => activeBranches.includes(String(row.BRANCH_NAME || '').trim()))
      .map(getRowBranchCode)
      .filter(Boolean)
  );

  // Append missing master active branches as zero rows at bottom
  BRANCH_MASTER_LIST.forEach(branch => {
    if (branch.status === 'inactive') return;
    if (activeBranchNormNames.has(normalizeName(branch.name))) return;
    if (branch.code && activeBranchCodes.has(normalizeCode(branch.code))) return;
    activeBranches.push(branch.name);
  });

  return { branches: activeBranches, inactiveBranches: masterInactiveBranches };
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
  return parseDate(
    row.APPLICATION_DATE
    || row.ISSUE_DATE
    || row.REPORT_DATE
    || row.CREATED_AT
  );
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

function loadImageDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.95),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function generatePdf(jsPDF, autoTable, cases, branches, inactiveBranches, matrix, branchCaseTotals, dateFrom, dateTo, logoMeta) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const matrixGrandTotal = branches.reduce(
    (sum, branch) => sum + REPORT_STEPS.reduce((rowTotal, step) => rowTotal + (matrix[branch]?.[step.id] ?? 0), 0),
    0,
  );

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.setFillColor(...CM.dark);
  doc.rect(0, 0, W, 30, 'F');

  // Logo block
  doc.setFillColor(...CM.mid);
  doc.roundedRect(8, 5, 38, 20, 2, 2, 'F');
  doc.setFillColor(...CM.white);
  doc.roundedRect(9.5, 6.5, 35, 17, 1.5, 1.5, 'F');
  if (logoMeta?.dataUrl && logoMeta?.width && logoMeta?.height) {
    const boxX = 10.5;
    const boxY = 7.2;
    const boxW = 33;
    const boxH = 15.5;
    const imageRatio = logoMeta.width / logoMeta.height;
    const boxRatio = boxW / boxH;

    let drawW = boxW;
    let drawH = boxH;
    if (imageRatio > boxRatio) {
      drawH = boxW / imageRatio;
    } else {
      drawW = boxH * imageRatio;
    }

    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxY + (boxH - drawH) / 2;

    doc.addImage(logoMeta.dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
  } else {
    doc.setTextColor(...CM.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CHIP MONG', 27, 13.5, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('BANK', 27, 19, { align: 'center' });
  }

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
  doc.text(`Total Cases: ${matrixGrandTotal}  |  Branches: ${branches.length}`, W - 8, 22, { align: 'right' });

  // Accent line under header
  doc.setFillColor(...CM.light);
  doc.rect(0, 30, W, 2.5, 'F');

  // ── KPI summary bar ────────────────────────────────────────────────────────
  const countForStep = id => branches.reduce((sum, b) => sum + (matrix[b]?.[id] ?? 0), 0);
  const activeCount   = FLOW_STEPS.slice(0, -1).reduce((n, s) => n + countForStep(s.id), 0); // pipeline excl. Approved
  const approvedCount = countForStep('approved');
  const retCount      = countForStep('returned');
  const rejectedCount = countForStep('rejected');
  const cancelledCount = countForStep('cancelled');
  const unmappedCount = countForStep(UNMAPPED_STEP.id);

  const kpis = [
    { label: 'Total Cases',    value: matrixGrandTotal, color: CM.mid },
    { label: 'In Pipeline',    value: activeCount,     color: CM.green },
    { label: 'Approved',       value: approvedCount,   color: [0, 130, 60] },
    { label: 'Returned to RM', value: retCount,        color: [150, 100, 10] },
    { label: 'Rejected',       value: rejectedCount,   color: [180, 50, 50] },
    { label: 'Cancelled',      value: cancelledCount,  color: [100, 100, 110] },
    { label: 'Unmapped',       value: unmappedCount,   color: [64, 86, 119] },
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
  const colHeaders = REPORT_STEPS.map(s => s.label);
  const totalColIdx = REPORT_STEPS.length + 1;

  const bodyRows = branches.map(branch => {
    const rowTotal = REPORT_STEPS.reduce((sum, s) => sum + (matrix[branch]?.[s.id] ?? 0), 0);
    return [branch, ...REPORT_STEPS.map(s => matrix[branch]?.[s.id] || 0), rowTotal];
  });
  const colTotals = REPORT_STEPS.map(s => branches.reduce((sum, b) => sum + (matrix[b]?.[s.id] ?? 0), 0));
  const tableGrandTotal = colTotals.reduce((a, b) => a + b, 0);
  bodyRows.push(['TOTAL', ...colTotals, tableGrandTotal]);

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
      }

      if (data.section === 'body' && data.column.index === totalColIdx) {
        const val = Number(data.cell.raw);
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = Number.isFinite(val) && val <= 5 ? CM.danger : CM.mid;
        data.cell.styles.textColor = CM.white;
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

  if (inactiveBranches.length > 0) {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...CM.danger);
    const note = `Inactive branches removed from table: ${inactiveBranches.join(', ')}`;
    const noteLines = doc.splitTextToSize(note, W - 16);
    const lineHeight = 3.1;
    const startY = Math.max(H - 14 - (noteLines.length - 1) * lineHeight, 186);
    doc.text(noteLines, 8, startY);
  }

  const ds = `${(dateFrom || 'all').replace(/-/g, '')}to${(dateTo || 'all').replace(/-/g, '')}`;
  doc.save(`LOS_Branch_Workflow_${ds}.pdf`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportPdfModal({ cases, onClose }) {
  const [reportType, setReportType] = useState('workflow'); // 'workflow' or 'losdays'
  const bounds = useMemo(() => getDateBounds(cases), [cases]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState(false);

  // Close on Escape
  useEffect(() => {

    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return cases;

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

  const { branches, inactiveBranches } = useMemo(() => (
    buildOrderedBranches(filtered)
  ), [filtered]);


  // --- Matrix and totals for both report types ---
  // --- LOS Days logic ---
  const LOS_DAYS_RANGES = [
    { label: 'Less Than 10', min: 0, max: 9 },
    { label: '10 - 20', min: 10, max: 20 },
    { label: '20 - 50', min: 21, max: 50 },
    { label: '50 - 100', min: 51, max: 100 },
    { label: 'More than 100', min: 101, max: Infinity },
  ];
  const ACTIVE_STATUSES = [
    ...FLOW_STEPS.flatMap(s => s.statuses.map(st => st.toLowerCase()))
  ];
  const SPECIAL_STATUSES = ['returned', 'cancelled', 'rejected', 'returned to rm', 'cancel', 'reject'];
  function isActiveStatus(status) {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return ACTIVE_STATUSES.includes(s) && !SPECIAL_STATUSES.includes(s);
  }
  function getLosDaysValue(row, refDate) {
    const appDate = parseDate(row.APPLICATION_DATE || row.ISSUE_DATE || row.REPORT_DATE || row.CREATED_AT);
    if (!appDate) return 0;
    return Math.floor((refDate - appDate) / (1000 * 60 * 60 * 24));
  }
  const matrix = useMemo(() => {
    if (reportType === 'workflow') return buildMatrix(filtered, branches);
    // LOS Days matrix: count all cases that are active (not special) as of end of selected range
    const branchSet = new Set(branches);
    const counts = {};
    branches.forEach(b => {
      counts[b] = LOS_DAYS_RANGES.map(() => 0);
    });
    // Use end of range (or today) as reference
    const to = dateTo ? parseDate(dateTo) : new Date();
    cases.forEach(row => {
      const branch = normalizeBranchName(row.BRANCH_NAME);
      if (!branchSet.has(branch)) return;
      const status = String(row.STATUS || '').toLowerCase();
      if (!isActiveStatus(status)) return;
      const appDate = parseDate(row.APPLICATION_DATE || row.ISSUE_DATE || row.REPORT_DATE || row.CREATED_AT);
      if (!appDate) return;
      // Only count if LOS was created before or on the end of the range
      if (appDate > to) return;
      const los = getLosDaysValue(row, to);
      const idx = LOS_DAYS_RANGES.findIndex(r => los >= r.min && los <= r.max);
      if (idx !== -1) counts[branch][idx]++;
    });
    return counts;
  }, [filtered, branches, reportType, cases, dateTo]);

  const branchCaseTotals = useMemo(() => {
    const totals = {};
    branches.forEach(branch => { totals[branch] = 0; });
    if (reportType === 'workflow') {
      filtered.forEach(row => {
        const branch = normalizeBranchName(row.BRANCH_NAME);
        if (!totals.hasOwnProperty(branch)) return;
        totals[branch] += 1;
      });
    } else {
      filtered.forEach(row => {
        const branch = normalizeBranchName(row.BRANCH_NAME);
        if (!totals.hasOwnProperty(branch)) return;
        totals[branch] += 1;
      });
    }
    return totals;
  }, [filtered, branches, reportType]);

  const sortedBranches = useMemo(() => (
    [...branches].sort((a, b) => {
      const aTotal = branchCaseTotals[a] ?? 0;
      const bTotal = branchCaseTotals[b] ?? 0;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.localeCompare(b);
    })
  ), [branches, branchCaseTotals]);

  const colTotals = useMemo(() => {
    if (reportType === 'workflow') {
      return REPORT_STEPS.map(s => branches.reduce((sum, b) => sum + (matrix[b]?.[s.id] ?? 0), 0));
    } else {
      return LOS_DAYS_RANGES.map((_, idx) => branches.reduce((sum, b) => sum + (matrix[b]?.[idx] ?? 0), 0));
    }
  }, [branches, matrix, reportType]);

  const matrixGrandTotal = useMemo(() => colTotals.reduce((sum, value) => sum + value, 0), [colTotals]);

  function handleGenerate() {
    setGenerating(true);
    Promise.all([
      import('jspdf').then(m => m.jsPDF),
      import('jspdf-autotable').then(m => m.default),
      loadImageDataUrl(chipMongBankLogo),
    ]).then(([jsPDF, autoTable, logoMeta]) => {
      try {
        if (reportType === 'workflow') {
          generatePdf(jsPDF, autoTable, filtered, sortedBranches, inactiveBranches, matrix, branchCaseTotals, dateFrom, dateTo, logoMeta);
        } else {
          generateLosDaysPdf(jsPDF, autoTable, filtered, sortedBranches, inactiveBranches, matrix, branchCaseTotals, dateFrom, dateTo, logoMeta);
        }
      } finally {
        setGenerating(false);
      }
    }).catch(() => setGenerating(false));
  }

  // --- PDF generator for LOS Days ---
  function generateLosDaysPdf(jsPDF, autoTable, cases, branches, inactiveBranches, matrix, branchCaseTotals, dateFrom, dateTo, logoMeta) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297;
    const H = 210;
    const matrixGrandTotal = branches.reduce(
      (sum, branch) => sum + LOS_DAYS_RANGES.reduce((rowTotal, _, idx) => rowTotal + (matrix[branch]?.[idx] ?? 0), 0),
      0,
    );

    // Header bar (same as before)
    doc.setFillColor(...CM.dark);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(...CM.mid);
    doc.roundedRect(8, 5, 38, 20, 2, 2, 'F');
    doc.setFillColor(...CM.white);
    doc.roundedRect(9.5, 6.5, 35, 17, 1.5, 1.5, 'F');
    if (logoMeta?.dataUrl && logoMeta?.width && logoMeta?.height) {
      const boxX = 10.5;
      const boxY = 7.2;
      const boxW = 33;
      const boxH = 15.5;
      const imageRatio = logoMeta.width / logoMeta.height;
      const boxRatio = boxW / boxH;
      let drawW = boxW;
      let drawH = boxH;
      if (imageRatio > boxRatio) {
        drawH = boxW / imageRatio;
      } else {
        drawW = boxH * imageRatio;
      }
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = boxY + (boxH - drawH) / 2;
      doc.addImage(logoMeta.dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
    } else {
      doc.setTextColor(...CM.dark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CHIP MONG', 27, 13.5, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('BANK', 27, 19, { align: 'center' });
    }
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CM.white);
    doc.text('LOS Days Summary Report', 54, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CM.light);
    doc.text(`Application Date: ${fmtDate(dateFrom)}  –  ${fmtDate(dateTo)}`, 54, 22);
    doc.setFontSize(8);
    doc.setTextColor(...CM.pale);
    const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`Generated: ${genDate}`, W - 8, 14, { align: 'right' });
    doc.text(`Total Cases: ${matrixGrandTotal}  |  Branches: ${branches.length}`, W - 8, 22, { align: 'right' });
    doc.setFillColor(...CM.light);
    doc.rect(0, 30, W, 2.5, 'F');

    // KPI summary bar
    const kpis = [
      { label: 'Total Cases', value: matrixGrandTotal, color: CM.mid },
      ...LOS_DAYS_RANGES.map((bucket, idx) => ({
        label: bucket.label,
        value: branches.reduce((sum, b) => sum + (matrix[b]?.[idx] ?? 0), 0),
        color: CM.green,
      })),
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
    doc.setFillColor(...CM.mid);
    doc.rect(0, 48.5, W, 0.6, 'F');

    // Main table
    const colHeaders = LOS_DAYS_RANGES.map(b => b.label);
    const totalColIdx = LOS_DAYS_RANGES.length + 1;
    const bodyRows = branches.map(branch => {
      const rowTotal = LOS_DAYS_RANGES.reduce((sum, _, idx) => sum + (matrix[branch]?.[idx] ?? 0), 0);
      return [branch, ...LOS_DAYS_RANGES.map((_, idx) => matrix[branch]?.[idx] || 0), rowTotal];
    });
    const colTotals = LOS_DAYS_RANGES.map((_, idx) => branches.reduce((sum, br) => sum + (matrix[br]?.[idx] ?? 0), 0));
    const tableGrandTotal = colTotals.reduce((a, b) => a + b, 0);
    bodyRows.push(['TOTAL', ...colTotals, tableGrandTotal]);

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
        }
        if (data.section === 'body' && data.column.index === totalColIdx) {
          const val = Number(data.cell.raw);
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = Number.isFinite(val) && val <= 5 ? CM.danger : CM.mid;
          data.cell.styles.textColor = CM.white;
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

    if (inactiveBranches.length > 0) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setPage(pageCount);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...CM.danger);
      const note = `Inactive branches removed from table: ${inactiveBranches.join(', ')}`;
      const noteLines = doc.splitTextToSize(note, W - 16);
      const lineHeight = 3.1;
      const startY = Math.max(H - 14 - (noteLines.length - 1) * lineHeight, 186);
      doc.text(noteLines, 8, startY);
    }

    const ds = `${(dateFrom || 'all').replace(/-/g, '')}to${(dateTo || 'all').replace(/-/g, '')}`;
    doc.save(`LOS_Branch_LOSDays_${ds}.pdf`);
  }
              data.cell.styles.textColor = [140, 180, 160]; // brighter but still subtle
              data.cell.raw = '0';
              data.cell.text = ['0'];
            } else {
              data.cell.styles.textColor = [195, 215, 205];
              data.cell.raw = '—';
              data.cell.text = ['—'];
            }
          }
        }
      },
      didDrawPage(data) {
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
    if (inactiveBranches.length > 0) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setPage(pageCount);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...CM.danger);
      const note = `Inactive branches removed from table: ${inactiveBranches.join(', ')}`;
      const noteLines = doc.splitTextToSize(note, W - 16);
      const lineHeight = 3.1;
      const startY = Math.max(H - 14 - (noteLines.length - 1) * lineHeight, 186);
      doc.text(noteLines, 8, startY);
    }
    const ds = `${(dateFrom || 'all').replace(/-/g, '')}to${(dateTo || 'all').replace(/-/g, '')}`;
    doc.save(`LOS_Branch_LOSDays_${ds}.pdf`);
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
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <label htmlFor="pdf-report-type" style={{ fontWeight: 600, color: `rgb(${CM.green.join(',')})`, fontSize: 15, letterSpacing: 0.2, marginRight: 8 }}>
              Report Type:
            </label>
            <select
              id="pdf-report-type"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              style={{
                background: `linear-gradient(90deg, rgb(${CM.pale.join(',')}), rgb(${CM.paleAlt.join(',')}))`,
                border: `2px solid rgb(${CM.green.join(',')})`,
                color: `rgb(${CM.dark.join(',')})`,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
                padding: '6px 18px',
                outline: 'none',
                boxShadow: `0 1px 6px 0 rgba(${CM.green.join(',')},0.08)`,
                transition: 'border 0.2s',
                cursor: 'pointer',
                minWidth: 160,
              }}
            >
              <option value="workflow">Workflow Stages</option>
              <option value="losdays">LOS Days</option>
            </select>
          </div>
          <p className="pdf-modal-desc">
            {reportType === 'workflow' ? (
              <>Generates a <strong>landscape A4 PDF</strong> with all branches as rows and each workflow stage as columns, showing case counts for the selected application date range.</>
            ) : (
              <>Generates a <strong>landscape A4 PDF</strong> with all branches as rows and LOS Days buckets as columns, showing active cases by LOS days in each range.</>
            )}
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
              <span className="pdf-kpi-val">{ALL_STEPS.length}</span>
              <span className="pdf-kpi-lbl">Workflow Stages</span>
            </div>
            <div className="pdf-kpi-item">
              <span className="pdf-kpi-val">{branches.includes(UNKNOWN_BRANCH_LABEL) ? 'Yes' : 'No'}</span>
              <span className="pdf-kpi-lbl">Unknown Branch Found</span>
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
                    {reportType === 'workflow'
                      ? REPORT_STEPS.map(s => (
                          <th key={s.id} title={s.fullName}>{s.label}</th>
                        ))
                      : LOS_BUCKETS.map(b => (
                          <th key={b.id}>{b.label}</th>
                        ))}
                    <th className="pdf-th-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan={(reportType === 'workflow' ? REPORT_STEPS.length : LOS_BUCKETS.length) + 2} className="pdf-empty-cell">
                        No data in selected date range
                      </td>
                    </tr>
                  ) : (
                    sortedBranches.map(branch => {
                      const rowTotal = branchCaseTotals[branch] ?? 0;
                      return (
                        <tr key={branch}>
                          <td className="pdf-td-branch">{branch}</td>
                          {reportType === 'workflow'
                            ? REPORT_STEPS.map(s => {
                                const v = matrix[branch]?.[s.id] ?? 0;
                                return (
                                  <td key={s.id} className={v > 0 ? 'pdf-td-pos' : 'pdf-td-zero'}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                );
                              })
                            : LOS_BUCKETS.map(b => {
                                const v = matrix[branch]?.[b.id] ?? 0;
                                return (
                                  <td key={b.id} className={v > 0 ? 'pdf-td-pos' : 'pdf-td-zero'}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                );
                              })}
                          <td className={rowTotal <= 5 ? 'pdf-td-rowtotal pdf-td-rowtotal-low' : 'pdf-td-rowtotal'}>{rowTotal}</td>
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
                      <td className="pdf-td-rowtotal pdf-tf-cell">{matrixGrandTotal}</td>
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
