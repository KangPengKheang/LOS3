
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Database,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import FilterBar from './components/FilterBar.jsx';
import CaseTable from './components/CaseTable.jsx';
import TrendLineChart from './components/TrendLineChart.jsx';
import WorkflowTracker from './components/WorkflowTracker.jsx';
import RemarkModal from './components/RemarkModal.jsx';
import chipMongBankLogo from './assets/chip-mong-bank-logo.png.jpg';
import { fetchLosCases, saveCaseRemark } from './services/sheetApi.js';
import { getLosDays } from './utils/dateUtils.js';
import { getRemarkText } from './utils/remarks.js';
import { normalizeStatus, statusOrder, statusMatches } from './utils/statusUtils.js';
import { isReportableLosCase } from './utils/caseFilters.js';
import ExportPdfModal from './components/ExportPdfModal.jsx';
import RmActivityDashboard from './components/RmActivityDashboard.jsx';

function getRmName(row) {
  return String(row.RM_NAME || row.RM_Name || row.rm_name || '').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function exportCsv(rows) {
  const headers = [
    'APPLICATION_NUMBER_ID',
    'APPLICATION_DATE',
    'CUSTOMER_NAME',
    'RM_NAME',
    'BRANCH_NAME',
    'APPLICATION_SOURCE',
    'PRODUCTS',
    'TOTAL_EXPOSURE',
    'TOTAL_NEW_REQUEST_AMOUNT',
    'STATUS',
    'PURPOSE',
    'FOLLOW_UP_REMARK',
    'REMARK_UPDATED_BY',
    'REMARK_UPDATED_AT',
  ];

  const csv = [headers.join(',')]
    .concat(rows.map(row => headers.map(h => {
      const value = h === 'RM_NAME' ? (row.RM_NAME ?? row.RM_Name ?? row.rm_name) : row[h];
      return `"${String(value ?? '').replaceAll('"', '""')}"`;
    }).join(',')))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'los_cases_filtered.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [cases, setCases] = useState([]);
  const [excludedPurposeCases, setExcludedPurposeCases] = useState([]);
  const [activeView, setActiveView] = useState('case');
  const [source, setSource] = useState('sample');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    branch: 'All',
    rm: 'All',
    product: 'All',
    losSort: 'default',
  });

  // Helper: filter function for searching cases
  function baseFilter(row, search) {
    if (!search) return true;
    const values = [
      row.APPLICATION_NUMBER_ID,
      row.CUSTOMER_NAME,
      row.RM_NAME || row.RM_Name || row.rm_name,
      row.BRANCH_NAME,
      row.PRODUCTS,
      row.STATUS,
      row.PURPOSE,
      row.FOLLOW_UP_REMARK,
      row.REMARK,
    ];
    return values.some(val => String(val || '').toLowerCase().includes(search));
  }

  // Memoized filtered cases
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return cases.filter(row =>
      baseFilter(row, search)
      && (filters.status === 'All' || row.STATUS === filters.status)
      && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
      && (filters.rm === 'All' || getRmName(row) === filters.rm)
      && (filters.product === 'All' || row.PRODUCTS === filters.product)
    );
  }, [cases, filters]);

  // Memoized unique lists for filter dropdowns
  const branches = useMemo(() => unique(cases.map(row => row.BRANCH_NAME)), [cases]);
  const products = useMemo(() => unique(cases.map(row => row.PRODUCTS)), [cases]);
  const rms = useMemo(() => unique(cases.map(getRmName)), [cases]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const result = await fetchLosCases();
      const allowed = (result.data || []).filter(isReportableLosCase);
      setCases(allowed);
      setExcludedPurposeCases([]);
      setSource(result.source);
    } catch (err) {
      setError(err.message || 'Failed to fetch Google Sheet data');
    } finally {
      setLoading(false);
    }
  }

  // ...existing code...

  const statuses = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const pool = cases.filter(row =>
      baseFilter(row, search)
      && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
      && (filters.rm === 'All' || getRmName(row) === filters.rm)
      && (filters.product === 'All' || row.PRODUCTS === filters.product)
    );
    const statusByKey = new Map();
    pool.forEach(row => {
      const status = String(row.STATUS || '').trim();
      const key = normalizeStatus(status);
      if (key && !statusByKey.has(key)) statusByKey.set(key, status);
    });
    const ordered = statusOrder.filter(status => statusByKey.has(normalizeStatus(status)));
    const orderedKeys = new Set(ordered.map(normalizeStatus));
    const remaining = [...statusByKey.entries()]
      .filter(([key]) => !orderedKeys.has(key))
      .map(([, status]) => status)
      .sort();
    return [...ordered, ...remaining];
  }, [cases, filters.search, filters.branch, filters.rm, filters.product]);

  // Auto-reset a filter value when it's no longer in the valid options
  useEffect(() => {
    if (filters.status !== 'All' && !statuses.includes(filters.status)) {
      setFilters(prev => ({ ...prev, status: 'All' }));
    }
  }, [statuses]);

  useEffect(() => {
    if (filters.branch !== 'All' && !branches.includes(filters.branch)) {
      setFilters(prev => ({ ...prev, branch: 'All' }));
    }
  }, [branches]);

  useEffect(() => {
    if (filters.product !== 'All' && !products.includes(filters.product)) {
      setFilters(prev => ({ ...prev, product: 'All' }));
    }
  }, [products]);

  useEffect(() => {
    if (filters.rm !== 'All' && !rms.includes(filters.rm)) {
      setFilters(prev => ({ ...prev, rm: 'All' }));
    }
  }, [rms]);

  const filteredExcludedPurposeCases = useMemo(() => (
    filters.rm === 'All'
      ? excludedPurposeCases
      : excludedPurposeCases.filter(row => getRmName(row) === filters.rm)
  ), [excludedPurposeCases, filters.rm]);

  async function handleSaveRemark(row, remark) {
    const applicationId = row.APPLICATION_NUMBER_ID;
    const updatedBy = 'Current User';
    const updatedAt = new Date().toISOString();

    try {
      setSaving(true);
      setError('');

      if (source === 'sheet') {
        await saveCaseRemark({ applicationId, remark, updatedBy, updatedAt });
      }

      setCases(prev => prev.map(item => (
        item.APPLICATION_NUMBER_ID === applicationId
          ? {
              ...item,
              FOLLOW_UP_REMARK: remark,
              REMARK: remark,
              REMARK_UPDATED_BY: updatedBy,
              REMARK_UPDATED_AT: updatedAt,
            }
          : item
      )));

      setSelectedCase(null);
      setToast('Remark saved successfully');
    } catch (err) {
      setError(err.message || 'Could not save follow-up remark');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="layout-shell">
      <main className="app-shell">

        <header className="topbar">
          <div className="brand-block" style={{ width: '100%' }}>
            <div className="logo-placeholder hide-mobile" style={{ marginBottom: 0 }}>
              <img src={chipMongBankLogo} alt="Chip Mong Bank" className="brand-logo" />
            </div>
            <div style={{ width: '100%' }}>
              <h1 style={{ fontSize: '1.2em', marginBottom: 4 }}>LOS Command Center</h1>
              <p className="hide-mobile" style={{ fontSize: '1em', margin: 0 }}>Enterprise-level LOS oversight, trend intelligence, and end-to-end workflow excellence</p>
            </div>
          </div>
          <div className="topbar-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <button
              className="export-pdf-btn"
              type="button"
              onClick={() => setShowPdfModal(true)}
              style={{ fontSize: '1em', padding: '8px 10px', width: '100%' }}
            >
              <FileDown size={17} />
              <span className="hide-mobile">Export PDF</span>
            </button>
            <button className="icon-btn hide-mobile" type="button" aria-label="Calendar"><CalendarDays size={20} /></button>
            <button className="icon-btn hide-mobile" type="button" aria-label="Notifications"><Bell size={20} /></button>
            <div className="avatar-chip hide-mobile">MS</div>
          </div>
        </header>

        <div className="source-pill hide-mobile"><Database size={16} /> Data source: {source === 'sheet' ? 'Google Sheet' : 'Sample Data'}</div>

        {toast ? (
          <div className="toast-success">
            <CheckCircle2 size={20} />
            <span>{toast}</span>
            <button type="button" onClick={() => setToast('')} aria-label="Close toast">x</button>
          </div>
        ) : null}

        {error ? (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={loadData}>Retry</button>
          </div>
        ) : null}

        <div style={{ width: '100%' }}>
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            branches={branches}
            rms={rms}
            products={products}
            statuses={statuses}
            onExport={() => exportCsv(filtered)}
          />
        </div>

        <div className="view-switcher responsive-grid" role="tablist" aria-label="Dashboard view switcher" style={{ margin: '10px 0' }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'case'}
            className={`view-switch-btn${activeView === 'case' ? ' view-switch-btn--active' : ''}`}
            onClick={() => setActiveView('case')}
            style={{ fontSize: '1em', padding: '10px', width: '100%' }}
          >
            Case Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'rm'}
            className={`view-switch-btn${activeView === 'rm' ? ' view-switch-btn--active' : ''}`}
            onClick={() => setActiveView('rm')}
            style={{ fontSize: '1em', padding: '10px', width: '100%' }}
          >
            RM Dashboard
          </button>
        </div>

        <WorkflowTracker
          cases={filtered}
          branches={branches}
          globalBranch={filters.branch}
          excludedPurposeCases={filteredExcludedPurposeCases}
        />

        {activeView === 'case' ? (
          <section className="panel" style={{ width: '100%', padding: '0 0 10px 0' }}>
            <div className="panel-head responsive-grid" style={{ alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.1em', margin: 0 }}>Case Tracking Table</h2>
              </div>
              <button className="refresh-btn hide-mobile" onClick={loadData} disabled={loading}><RefreshCw size={16} /> Refresh</button>
              <button className="refresh-btn hide-desktop" onClick={loadData} disabled={loading} style={{ fontSize: '1em', padding: '6px 10px' }}><RefreshCw size={16} /></button>
            </div>

            <div style={{ width: '100%', overflowX: 'auto' }}>
              <div className="hide-mobile">
                <TrendLineChart rows={filtered} branches={branches} />
              </div>
            </div>

            <div style={{ width: '100%', overflowX: 'auto' }}>
              {loading
                ? <div className="loader">Loading LOS cases...</div>
                : <CaseTable rows={filtered} onSelectCase={setSelectedCase} selectedCase={selectedCase} />}
            </div>
            <div className="table-footer hide-mobile" style={{ fontSize: '0.95em', padding: '6px 0', width: '100%' }}>Showing {filtered.length} of {cases.length} cases</div>
          </section>
        ) : (
          <RmActivityDashboard cases={filtered} onBack={() => setActiveView('case')} />
        )}
      </main>

      <RemarkModal
        row={selectedCase}
        saving={saving}
        onClose={() => setSelectedCase(null)}
        onSave={handleSaveRemark}
      />

      {showPdfModal && (
        <ExportPdfModal
          cases={filtered}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
}
