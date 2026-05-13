import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  DollarSign,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import KpiCard from './components/KpiCard.jsx';
import FilterBar from './components/FilterBar.jsx';
import CaseTable from './components/CaseTable.jsx';
import RemarkModal from './components/RemarkModal.jsx';
import { fetchLosCases, saveCaseRemark } from './services/sheetApi.js';
import { formatCompactCurrency, toNumber } from './utils/format.js';
import { getLosDays } from './utils/dateUtils.js';
import { getRemarkText } from './utils/remarks.js';
import { statusOrder } from './components/StatusBadge.jsx';

const terminalStatuses = new Set(['Drawdown', 'Rejected', 'Cancelled']);

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function exportCsv(rows) {
  const headers = [
    'APPLICATION_NUMBER_ID',
    'CUSTOMER_NAME',
    'BRANCH_NAME',
    'APPLICATION_SOURCE',
    'PRODUCTS',
    'TOTAL_NEW_REQUEST_AMOUNT',
    'STATUS',
    'COMMENT_FROM_APPROVER',
    'FOLLOW_UP_REMARK',
    'REMARK_UPDATED_BY',
    'REMARK_UPDATED_AT',
  ];

  const csv = [headers.join(',')]
    .concat(rows.map(row => headers.map(h => `"${String(row[h] ?? '').replaceAll('"', '""')}"`).join(',')))
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
  const [filters, setFilters] = useState({ search: '', status: 'All', branch: 'All', product: 'All' });

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const result = await fetchLosCases();
      setCases(result.data || []);
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
    return cases.filter(row => {
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
        && (filters.status === 'All' || row.STATUS === filters.status)
        && (filters.branch === 'All' || row.BRANCH_NAME === filters.branch)
        && (filters.product === 'All' || row.PRODUCTS === filters.product);
    });
  }, [cases, filters]);

  const metrics = useMemo(() => {
    const total = cases.length;
    const drawdown = cases.filter(row => row.STATUS === 'Drawdown');
    const active = cases.filter(row => !terminalStatuses.has(row.STATUS));
    const amount = drawdown.reduce((sum, row) => sum + toNumber(row.TOTAL_NEW_REQUEST_AMOUNT), 0);
    const avgLosDays = total ? Math.round(cases.reduce((sum, row) => sum + getLosDays(row), 0) / total) : 0;
    return { total, drawdown: drawdown.length, active: active.length, amount, avgLosDays };
  }, [cases]);

  const branches = useMemo(() => unique(cases.map(row => row.BRANCH_NAME)), [cases]);
  const products = useMemo(() => unique(cases.map(row => row.PRODUCTS)), [cases]);
  const statuses = useMemo(() => {
    const present = new Set(cases.map(row => row.STATUS).filter(Boolean));
    const ordered = statusOrder.filter(status => present.has(status));
    return [...ordered, ...[...present].filter(status => !ordered.includes(status)).sort()];
  }, [cases]);

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
            <div>
              <h1>LOS Case Monitoring Dashboard</h1>
              <p>Workflow-stage monitoring, approval movement, and case-by-case tracking from Google Sheet</p>
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

        <section className="kpi-grid">
          <KpiCard icon={<FolderOpen />} title="Total LOS Cases" value={metrics.total} tone="blue" />
          <KpiCard icon={<CheckCircle2 />} title="Drawdown Cases" value={metrics.drawdown} tone="green" helper="Completed workflow" />
          <KpiCard icon={<DollarSign />} title="Drawdown Amount" value={formatCompactCurrency(metrics.amount)} tone="green" />
          <KpiCard icon={<Clock3 />} title="Active Processing Cases" value={metrics.active} tone="orange" helper={`Avg LOS Days: ${metrics.avgLosDays} days`} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Case Tracking Table</h2>
              <p>Core view: monitor where each case currently stands by workflow STATUS.</p>
              <div className="helper-note">
                <AlertCircle size={16} />
                <span>Click customer name to view case details and add follow-up remark.</span>
              </div>
            </div>
            <button className="refresh-btn" onClick={loadData} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          </div>

          <FilterBar
            filters={filters}
            setFilters={setFilters}
            branches={branches}
            products={products}
            statuses={statuses}
            onExport={() => exportCsv(filtered)}
          />

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
