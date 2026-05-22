import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Database,
  RefreshCw,
} from 'lucide-react';
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

const EXCLUDED_PRODUCTS = new Set(['Credit Card', 'Credit Card Against TD']);
const EXCLUDED_LOAN_TYPES = new Set(['Restructure', 'Other Request']);

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
  const [source, setSource] = useState('sample');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    branch: 'All',
    product: 'All',
    losSort: 'default',
  });

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const result = await fetchLosCases();
      const allowed = (result.data || []).filter(row =>
        !EXCLUDED_PRODUCTS.has(row.PRODUCTS) &&
        !EXCLUDED_LOAN_TYPES.has(row.LOAN_TYPE)
      );
      setCases(allowed);
      setSource(result.source);
    } catch (err) {
      setError(err.message || 'Failed to fetch Google Sheet data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const rows = cases.filter(row => {
      const searchable = [
        row.APPLICATION_NUMBER_ID,
        row.CUSTOMER_NAME,
        row.BRANCH_NAME,
        row.RM_NAME,
        row.APPLICATION_SOURCE,
        row.PRODUCTS,
        row.STATUS,
        getRemarkText(row),
      ]
        .join(' ')
        .toLowerCase();

      return (!search || searchable.includes(search))
        && (filters.status === 'All' || statusMatches(row.STATUS, [filters.status]))
        && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
        && (filters.product === 'All' || row.PRODUCTS === filters.product);
    });

    if (filters.losSort === 'asc') {
      return [...rows].sort((a, b) => getLosDays(a) - getLosDays(b));
    }

    if (filters.losSort === 'desc') {
      return [...rows].sort((a, b) => getLosDays(b) - getLosDays(a));
    }

    return rows;
  }, [cases, filters]);

  // Cascading filter options — each set of options is derived from cases
  // filtered by all OTHER active filters, so dropdowns only show valid choices.
  const baseFilter = (row, search) => {
    const searchable = [
      row.APPLICATION_NUMBER_ID,
      row.CUSTOMER_NAME,
      row.BRANCH_NAME,
      row.RM_NAME,
      row.APPLICATION_SOURCE,
      row.PRODUCTS,
      row.STATUS,
      getRemarkText(row),
    ].join(' ').toLowerCase();
    return !search || searchable.includes(search);
  };

  const branches = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const pool = cases.filter(row =>
      baseFilter(row, search)
      && (filters.status === 'All' || statusMatches(row.STATUS, [filters.status]))
      && (filters.product === 'All' || row.PRODUCTS === filters.product)
    );
    return unique(pool.map(row => row.BRANCH_NAME));
  }, [cases, filters.search, filters.status, filters.product]);

  const products = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const pool = cases.filter(row =>
      baseFilter(row, search)
      && (filters.status === 'All' || statusMatches(row.STATUS, [filters.status]))
      && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
    );
    return unique(pool.map(row => row.PRODUCTS));
  }, [cases, filters.search, filters.status, filters.branch]);

  const statuses = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const pool = cases.filter(row =>
      baseFilter(row, search)
      && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
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
  }, [cases, filters.search, filters.branch, filters.product]);

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
          <div className="brand-block">
            <div className="logo-placeholder">
              <img src={chipMongBankLogo} alt="Chip Mong Bank" className="brand-logo" />
            </div>
            <div>
              <h1>LOS Executive Command Center</h1>
              <p>Enterprise-level LOS oversight, trend intelligence, and end-to-end workflow excellence</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" type="button" aria-label="Calendar"><CalendarDays size={20} /></button>
            <button className="icon-btn" type="button" aria-label="Notifications"><Bell size={20} /></button>
            <div className="avatar-chip">MS</div>
          </div>
        </header>

        <div className="source-pill"><Database size={16} /> Data source: {source === 'sheet' ? 'Google Sheet' : 'Sample Data'}</div>

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

        <FilterBar
            filters={filters}
            setFilters={setFilters}
            branches={branches}
            products={products}
            statuses={statuses}
            onExport={() => exportCsv(filtered)}
          />

        <WorkflowTracker cases={filtered} branches={branches} globalBranch={filters.branch} />

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Case Tracking Table</h2>
            </div>
            <button className="refresh-btn" onClick={loadData} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          </div>

          <TrendLineChart rows={filtered} branches={branches} />

          {loading
            ? <div className="loader">Loading LOS cases...</div>
            : <CaseTable rows={filtered} onSelectCase={setSelectedCase} selectedCase={selectedCase} />}
          <div className="table-footer">Showing {filtered.length} of {cases.length} cases</div>
        </section>
      </main>

      <RemarkModal
        row={selectedCase}
        saving={saving}
        onClose={() => setSelectedCase(null)}
        onSave={handleSaveRemark}
      />
    </div>
  );
}
