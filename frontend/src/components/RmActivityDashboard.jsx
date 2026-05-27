/**
 * RmActivityDashboard.jsx
 * 
 * Drop this file into: frontend/src/components/RmActivityDashboard.jsx
 * 
 * Then add to App.jsx:
 *   import RmActivityDashboard from './components/RmActivityDashboard.jsx';
 *   <RmActivityDashboard cases={cases} />   ← place after <WorkflowTracker … />
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  UserX,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Search,
  BarChart2,
  FileWarning,
  ArrowUpRight,
} from 'lucide-react';
import { getLosDays, formatDate } from '../utils/dateUtils.js';
import { isTerminalStatus } from '../utils/statusUtils.js';

/* ─── Configurable thresholds ─────────────────────────────── */
const INACTIVE_DAYS   = 30;   // No new LOS for this many days → "inactive"
const LOS_LONG_DAYS   = 45;   // Active case older than this → "LOS too long"
const STALLED_DAYS    = 14;   // Case stuck in same step for this many days → "stalled"
const PAGE_SIZE       = 10;

/* ─── Helpers ─────────────────────────────────────────────── */
function getRmName(row) {
  return String(row.RM_NAME || row.RM_Name || row.rm_name || '').trim();
}

function getBranchName(row) {
  return String(row.BRANCH_NAME || '').trim();
}

/**
 * Days since a case was last updated (step change or remark).
 * Falls back to LOS days so we never return null.
 */
function daysSinceLastUpdate(row) {
  const candidates = [
    row.REMARK_UPDATED_AT,
    row.CURRENT_STEP_START_DATE,
    row.PROCESS_START_DATE,
  ].filter(Boolean);

  if (candidates.length === 0) return getLosDays(row);

  const latest = candidates.reduce((best, d) => {
    const parsed = new Date(d);
    return !isNaN(parsed) && parsed > best ? parsed : best;
  }, new Date(0));

  const ms = Date.now() - latest.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Most-recent APPLICATION_DATE for an RM (to detect "no new LOS").
 */
function latestAppDate(rows) {
  let latest = null;
  rows.forEach(row => {
    const d = new Date(row.APPLICATION_DATE || row.ISSUE_DATE || '');
    if (!isNaN(d) && (!latest || d > latest)) latest = d;
  });
  return latest;
}

function daysSince(date) {
  if (!date) return Infinity;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

function getFlagSeverity(flagKey) {
  if (flagKey === 'inactive') return 'High';
  if (flagKey === 'stalled') return 'High';
  if (flagKey === 'losLong') return 'Medium';
  return 'Watch';
}

function getFlagAction(flagKey) {
  if (flagKey === 'inactive') return 'Review RM pipeline generation plan and prospecting schedule.';
  if (flagKey === 'stalled') return 'Escalate blocked cases and request immediate status updates.';
  if (flagKey === 'losLong') return 'Prioritize aged files and clear pending approvals/documents.';
  return 'Coach RM on portfolio depth and cross-sell opportunities.';
}

function getFlagInsight(profile, flag) {
  if (flag.key === 'inactive') {
    return `No new application for ${profile.sinceLastLos === Infinity ? 'N/A' : `${profile.sinceLastLos} days`}. Last application: ${formatDate(profile.lastLosDate) || 'Unknown'}.`;
  }

  if (flag.key === 'stalled') {
    const worst = Math.max(...(flag.cases || []).map(c => daysSinceLastUpdate(c)), 0);
    return `${flag.cases?.length || 0} case(s) have no meaningful update for at least ${STALLED_DAYS} days. Longest stall: ${worst} days.`;
  }

  if (flag.key === 'losLong') {
    const worst = Math.max(...(flag.cases || []).map(c => getLosDays(c)), 0);
    return `${flag.cases?.length || 0} case(s) exceeded LOS threshold of ${LOS_LONG_DAYS} days. Oldest LOS: ${worst} days.`;
  }

  return `Low current throughput: ${profile.active} active case(s), ${profile.total} total case(s).`;
}

function getCaseFlagReason(flagKey, row) {
  const los = getLosDays(row);
  const stalled = daysSinceLastUpdate(row);
  if (flagKey === 'stalled') return `No update for ${stalled}d`;
  if (flagKey === 'losLong') return `LOS ${los}d > ${LOS_LONG_DAYS}d`;
  return 'Flagged by policy threshold';
}

/* ─── Flag types ──────────────────────────────────────────── */
const FLAG = {
  INACTIVE:  { key: 'inactive',  label: 'No LOS ≥ 30 d',     color: '#c84b1e', bg: '#fff1ec', icon: UserX },
  LOS_LONG:  { key: 'losLong',   label: 'LOS > 45 d',         color: '#b45309', bg: '#fffbeb', icon: Clock },
  STALLED:   { key: 'stalled',   label: 'Stalled ≥ 14 d',     color: '#6d28d9', bg: '#f3f0fe', icon: AlertTriangle },
  LOW_VOL:   { key: 'lowVol',    label: '≤ 1 active case',    color: '#0369a1', bg: '#eff8ff', icon: TrendingDown },
};

/* ─── Data computation ────────────────────────────────────── */
function buildRmProfiles(cases) {
  if (!cases || cases.length === 0) return [];

  /* Group by RM */
  const byRm = new Map();
  cases.forEach(row => {
    const name = getRmName(row);
    if (!name) return;
    if (!byRm.has(name)) {
      byRm.set(name, { name, branch: getBranchName(row), rows: [] });
    }
    byRm.get(name).rows.push(row);
  });

  const profiles = [];

  byRm.forEach(({ name, branch, rows }) => {
    const active = rows.filter(r => !isTerminalStatus(r.STATUS));
    const total  = rows.length;
    const flags  = [];

    /* 1 — No new LOS ≥ INACTIVE_DAYS */
    const lastLos = latestAppDate(rows);
    const sinceLastLos = daysSince(lastLos);
    if (sinceLastLos >= INACTIVE_DAYS) {
      flags.push({ ...FLAG.INACTIVE, detail: `Last application ${sinceLastLos} days ago` });
    }

    /* 2 — Active cases with LOS > LOS_LONG_DAYS */
    const longLosCases = active.filter(r => getLosDays(r) > LOS_LONG_DAYS);
    if (longLosCases.length > 0) {
      flags.push({
        ...FLAG.LOS_LONG,
        detail: `${longLosCases.length} case${longLosCases.length > 1 ? 's' : ''} over ${LOS_LONG_DAYS} days`,
        cases: longLosCases,
      });
    }

    /* 3 — Cases stalled in same step ≥ STALLED_DAYS */
    const stalledCases = active.filter(r => daysSinceLastUpdate(r) >= STALLED_DAYS);
    if (stalledCases.length > 0) {
      flags.push({
        ...FLAG.STALLED,
        detail: `${stalledCases.length} case${stalledCases.length > 1 ? 's' : ''} stalled ≥ ${STALLED_DAYS} d`,
        cases: stalledCases,
      });
    }

    /* 4 — Low volume: ≤ 1 active case */
    if (active.length <= 1 && total > 0) {
      flags.push({ ...FLAG.LOW_VOL, detail: `Only ${active.length} active case` });
    }

    if (flags.length > 0) {
      profiles.push({
        name,
        branch,
        total,
        active: active.length,
        flags,
        sinceLastLos,
        lastLosDate: lastLos,
        avgLos: active.length
          ? Math.round(active.reduce((s, r) => s + getLosDays(r), 0) / active.length)
          : 0,
        rows,
      });
    }
  });

  /* Sort: most flags first, then most severe (longest sinceLastLos) */
  profiles.sort((a, b) => b.flags.length - a.flags.length || b.sinceLastLos - a.sinceLastLos);
  return profiles;
}

/* ─── Sub-components ──────────────────────────────────────── */

function FlagBadge({ flag }) {
  const Icon = flag.icon;
  return (
    <span
      className="rmad-flag-badge"
      style={{ '--flag-color': flag.color, '--flag-bg': flag.bg }}
      title={flag.detail}
    >
      <Icon size={11} />
      {flag.label}
    </span>
  );
}

function RmRow({ profile, rank }) {
  const [open, setOpen] = useState(false);
  const topFlag = profile.flags[0];

  return (
    <>
      <tr
        className={`rmad-tr ${open ? 'rmad-tr--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <td className="rmad-td rmad-td--rank">
          <span className="rmad-rank">{rank}</span>
        </td>
        <td className="rmad-td rmad-td--name">
          <div className="rmad-rm-name">{profile.name}</div>
          <div className="rmad-rm-branch">{profile.branch}</div>
        </td>
        <td className="rmad-td">
          <div className="rmad-flags-wrap">
            {profile.flags.map((f, i) => <FlagBadge key={i} flag={f} />)}
          </div>
        </td>
        <td className="rmad-td rmad-td--num">{profile.active}</td>
        <td className="rmad-td rmad-td--num">{profile.total}</td>
        <td className="rmad-td rmad-td--num">
          <span className={profile.avgLos > LOS_LONG_DAYS ? 'rmad-num--warn' : ''}>
            {profile.avgLos > 0 ? `${profile.avgLos}d` : '—'}
          </span>
        </td>
        <td className="rmad-td rmad-td--num">
          {profile.sinceLastLos === Infinity ? '—' : `${profile.sinceLastLos}d`}
        </td>
        <td className="rmad-td rmad-td--chevron">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </td>
      </tr>

      {open && (
        <tr className="rmad-detail-row">
          <td colSpan={8} className="rmad-detail-td">
            <div className="rmad-detail-inner">
              {profile.flags.map((flag, fi) => (
                <div key={fi} className="rmad-detail-flag-block">
                  <div
                    className="rmad-detail-flag-title"
                    style={{ '--flag-color': flag.color }}
                  >
                    <flag.icon size={13} />
                    <strong>{flag.label}</strong>
                    <span className="rmad-detail-flag-detail">— {flag.detail}</span>
                  </div>

                  <div className="rmad-insight-grid">
                    <div className="rmad-insight-card">
                      <span className="rmad-insight-k">Severity</span>
                      <span className="rmad-insight-v">{getFlagSeverity(flag.key)}</span>
                    </div>
                    <div className="rmad-insight-card">
                      <span className="rmad-insight-k">Insight</span>
                      <span className="rmad-insight-v">{getFlagInsight(profile, flag)}</span>
                    </div>
                    <div className="rmad-insight-card">
                      <span className="rmad-insight-k">Suggested Action</span>
                      <span className="rmad-insight-v">{getFlagAction(flag.key)}</span>
                    </div>
                  </div>

                  {flag.cases && flag.cases.length > 0 && (
                    <table className="rmad-detail-tbl">
                      <thead>
                        <tr>
                          <th>App ID</th>
                          <th>Customer</th>
                          <th>Product</th>
                          <th>Status</th>
                          <th>App Date</th>
                          <th>LOS</th>
                          <th>Days Stalled</th>
                          <th>Why Flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flag.cases.map((c, ci) => {
                          const los = getLosDays(c);
                          const stalled = daysSinceLastUpdate(c);
                          return (
                            <tr key={ci}>
                              <td className="rmad-detail-mono">{c.APPLICATION_NUMBER_ID}</td>
                              <td>{c.CUSTOMER_NAME}</td>
                              <td>{c.PRODUCTS}</td>
                              <td>
                                <span className="rmad-status-chip">{c.STATUS}</span>
                              </td>
                              <td>{formatDate(c.APPLICATION_DATE || c.ISSUE_DATE)}</td>
                              <td className={los > LOS_LONG_DAYS ? 'rmad-num--warn rmad-detail-num' : 'rmad-detail-num'}>
                                {los}d
                              </td>
                              <td className={stalled >= STALLED_DAYS ? 'rmad-num--warn rmad-detail-num' : 'rmad-detail-num'}>
                                {stalled}d
                              </td>
                              <td>
                                <span className="rmad-reason-chip">{getCaseFlagReason(flag.key, c)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {(!flag.cases || flag.cases.length === 0) && (
                    <div className="rmad-detail-empty-note">
                      No individual case rows for this flag. This signal is based on RM-level activity and trend thresholds.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Summary KPI bar ─────────────────────────────────────── */
function SummaryBar({ profiles, total }) {
  const inactiveCount = profiles.filter(p => p.flags.some(f => f.key === 'inactive')).length;
  const longLosCount  = profiles.filter(p => p.flags.some(f => f.key === 'losLong')).length;
  const stalledCount  = profiles.filter(p => p.flags.some(f => f.key === 'stalled')).length;

  return (
    <div className="rmad-summary-bar">
      <div className="rmad-summary-kpi rmad-summary-kpi--red">
        <UserX size={18} />
        <div>
          <span className="rmad-summary-val">{inactiveCount}</span>
          <span className="rmad-summary-lbl">Inactive RM</span>
        </div>
      </div>
      <div className="rmad-summary-kpi rmad-summary-kpi--amber">
        <Clock size={18} />
        <div>
          <span className="rmad-summary-val">{longLosCount}</span>
          <span className="rmad-summary-lbl">Long LOS Cases</span>
        </div>
      </div>
      <div className="rmad-summary-kpi rmad-summary-kpi--purple">
        <AlertTriangle size={18} />
        <div>
          <span className="rmad-summary-val">{stalledCount}</span>
          <span className="rmad-summary-lbl">Stalled Cases</span>
        </div>
      </div>
      <div className="rmad-summary-kpi rmad-summary-kpi--blue">
        <BarChart2 size={18} />
        <div>
          <span className="rmad-summary-val">{total}</span>
          <span className="rmad-summary-lbl">Total RMs Tracked</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function RmActivityDashboard({ cases, onBack }) {
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortField, setSortField] = useState('flags');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const allProfiles = useMemo(() => buildRmProfiles(cases), [cases]);

  const filteredProfiles = useMemo(() => {
    let list = allProfiles;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.branch.toLowerCase().includes(q)
      );
    }

    if (flagFilter !== 'all') {
      list = list.filter(p => p.flags.some(f => f.key === flagFilter));
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortField === 'flags')       return dir * (a.flags.length - b.flags.length);
      if (sortField === 'active')      return dir * (a.active - b.active);
      if (sortField === 'avgLos')      return dir * (a.avgLos - b.avgLos);
      if (sortField === 'sinceLastLos')return dir * (a.sinceLastLos - b.sinceLastLos);
      return 0;
    });
  }, [allProfiles, search, flagFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, flagFilter, sortField, sortDir, cases]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedProfiles = useMemo(() => (
    filteredProfiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  ), [filteredProfiles, page]);

  /* Count all RMs even without flags for the summary bar total */
  const allRmCount = useMemo(() => {
    const names = new Set((cases || []).map(getRmName).filter(Boolean));
    return names.size;
  }, [cases]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span className="rmad-sort-icon rmad-sort-icon--idle">↕</span>;
    return <span className="rmad-sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (!cases || cases.length === 0) {
    return (
      <section className="panel rmad-empty">
        <FileWarning size={32} />
        <p>No case data available for RM activity analysis.</p>
      </section>
    );
  }

  return (
    <section className="panel rmad-panel">

      {/* ── Header ── */}
      <div className="panel-head rmad-panel-head">
        <div>
          <h2 className="rmad-title">
            <AlertTriangle size={20} className="rmad-title-icon" />
            RM Activity Dashboard
          </h2>
          <p className="rmad-subtitle">
            Flagged RMs · inactive ≥{INACTIVE_DAYS}d · LOS &gt;{LOS_LONG_DAYS}d · stalled ≥{STALLED_DAYS}d
          </p>
        </div>
        <div className="rmad-head-right">
          {onBack ? (
            <button type="button" className="rmad-back-btn" onClick={onBack}>
              Back to Case Tracking
            </button>
          ) : null}
          <span className="rmad-flagged-pill">
            <ArrowUpRight size={13} />
            {allProfiles.length} flagged of {allRmCount} RMs
          </span>
        </div>
      </div>

      {/* ── Summary KPIs ── */}
      <SummaryBar profiles={allProfiles} total={allRmCount} />

      {/* ── Controls ── */}
      <div className="rmad-controls">
        <div className="rmad-search-wrap">
          <Search size={15} className="rmad-search-icon" />
          <input
            className="rmad-search-input"
            placeholder="Search RM or branch…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="rmad-filter-tabs">
          {[
            { key: 'all',      label: 'All Flags' },
            { key: 'inactive', label: 'Inactive' },
            { key: 'losLong',  label: 'Long LOS' },
            { key: 'stalled',  label: 'Stalled' },
            { key: 'lowVol',   label: 'Low Volume' },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              className={`rmad-filter-tab ${flagFilter === t.key ? 'rmad-filter-tab--active' : ''}`}
              onClick={() => setFlagFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {filteredProfiles.length === 0 ? (
        <div className="rmad-no-results">
          No flagged RMs match the current filter.
        </div>
      ) : (
        <div className="rmad-table-wrap">
          <table className="rmad-table">
            <thead>
              <tr>
                <th className="rmad-th">#</th>
                <th className="rmad-th rmad-th--name">RM / Branch</th>
                <th className="rmad-th">Flags</th>
                <th
                  className="rmad-th rmad-th--sortable"
                  onClick={() => toggleSort('active')}
                >
                  Active <SortIcon field="active" />
                </th>
                <th className="rmad-th">Total</th>
                <th
                  className="rmad-th rmad-th--sortable"
                  onClick={() => toggleSort('avgLos')}
                >
                  Avg LOS <SortIcon field="avgLos" />
                </th>
                <th
                  className="rmad-th rmad-th--sortable"
                  onClick={() => toggleSort('sinceLastLos')}
                >
                  Since Last LOS <SortIcon field="sinceLastLos" />
                </th>
                <th className="rmad-th" />
              </tr>
            </thead>
            <tbody>
              {pagedProfiles.map((p, i) => (
                <RmRow key={p.name} profile={p} rank={(page - 1) * PAGE_SIZE + i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredProfiles.length > 0 && (
        <div className="rmad-pagination">
          <button
            type="button"
            className="rmad-page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="rmad-page-info">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredProfiles.length)} of {filteredProfiles.length}
          </span>
          <button
            type="button"
            className="rmad-page-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}

      <style>{`
        /* ── RM Activity Dashboard Styles ──────────────────── */

        .rmad-panel { margin-top: 24px; }

        .rmad-panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .rmad-title {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: var(--navy);
        }

        .rmad-title-icon { color: #c84b1e; flex-shrink: 0; }

        .rmad-subtitle {
          margin: 5px 0 0;
          font-size: 13px;
          color: var(--gray);
        }

        .rmad-head-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rmad-back-btn {
          border: 1px solid #b8cef4;
          background: #ffffff;
          color: #1256bf;
          font-size: 12px;
          font-weight: 800;
          border-radius: 10px;
          padding: 7px 12px;
        }

        .rmad-back-btn:hover { background: #f0f6ff; }

        .rmad-flagged-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 99px;
          background: #fff1ec;
          color: #c84b1e;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid #fcd4c2;
        }

        /* ── Summary bar ── */
        .rmad-summary-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin: 18px 0 20px;
        }

        @media (max-width: 780px) {
          .rmad-summary-bar { grid-template-columns: repeat(2, 1fr); }
        }

        .rmad-summary-kpi {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1.5px solid transparent;
        }

        .rmad-summary-kpi--red    { background: #fff1ec; border-color: #fcd4c2; color: #c84b1e; }
        .rmad-summary-kpi--amber  { background: #fffbeb; border-color: #fde68a; color: #92400e; }
        .rmad-summary-kpi--purple { background: #f3f0fe; border-color: #d4c8fc; color: #5b21b6; }
        .rmad-summary-kpi--blue   { background: #eff8ff; border-color: #bae0fd; color: #075985; }

        .rmad-summary-kpi > svg { flex-shrink: 0; opacity: 0.8; }

        .rmad-summary-kpi > div {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .rmad-summary-val {
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
        }

        .rmad-summary-lbl {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          opacity: 0.75;
        }

        /* ── Controls ── */
        .rmad-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .rmad-search-wrap {
          position: relative;
          flex: 0 0 220px;
        }

        .rmad-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray);
          pointer-events: none;
        }

        .rmad-search-input {
          width: 100%;
          padding: 8px 10px 8px 32px;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: white;
          font-size: 13px;
          color: var(--navy);
          outline: none;
          transition: border-color 0.15s;
        }

        .rmad-search-input:focus { border-color: var(--blue); }

        .rmad-filter-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .rmad-filter-tab {
          padding: 6px 14px;
          border-radius: 8px;
          border: 1.5px solid var(--line);
          background: white;
          font-size: 12px;
          font-weight: 700;
          color: var(--gray);
          transition: all 0.15s;
        }

        .rmad-filter-tab:hover { border-color: var(--blue); color: var(--blue); }

        .rmad-filter-tab--active {
          background: var(--navy);
          color: white;
          border-color: var(--navy);
        }

        /* ── Table ── */
        .rmad-table-wrap {
          overflow-x: auto;
          border-radius: 14px;
          border: 1.5px solid var(--line);
        }

        .rmad-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }

        .rmad-th {
          padding: 10px 14px;
          background: linear-gradient(135deg, #f7f9ff, #eef3ff);
          color: #2e3c5f;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: left;
          border-bottom: 1.5px solid var(--line);
          white-space: nowrap;
        }

        .rmad-th--sortable {
          cursor: pointer;
          user-select: none;
        }

        .rmad-th--sortable:hover { color: var(--blue); }

        .rmad-sort-icon {
          display: inline-block;
          margin-left: 4px;
          font-size: 11px;
          color: var(--blue);
        }

        .rmad-sort-icon--idle { color: #b0bdd4; }

        .rmad-th--name { min-width: 180px; }

        .rmad-tr {
          cursor: pointer;
          transition: background 0.12s;
        }

        .rmad-tr:hover td { background: #f5f8ff; }

        .rmad-tr--open td { background: #f0f5ff !important; }

        .rmad-td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--line);
          color: var(--navy);
          vertical-align: middle;
        }

        .rmad-td--rank {
          width: 42px;
          text-align: center;
        }

        .rmad-rank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e8f0ff, #d4e3ff);
          color: var(--navy);
          font-size: 11px;
          font-weight: 900;
        }

        .rmad-td--num { text-align: center; font-weight: 700; }

        .rmad-td--chevron { width: 30px; text-align: right; color: var(--gray); }

        .rmad-rm-name { font-weight: 800; }

        .rmad-rm-branch {
          font-size: 11.5px;
          color: var(--gray);
          margin-top: 1px;
        }

        .rmad-flags-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .rmad-flag-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 800;
          color: var(--flag-color);
          background: var(--flag-bg);
          border: 1px solid var(--flag-color);
          white-space: nowrap;
        }

        .rmad-num--warn {
          color: #c84b1e;
          font-weight: 900;
        }

        /* ── Detail row ── */
        .rmad-detail-row td { border-bottom: 1.5px solid var(--blue-soft); padding: 0; }

        .rmad-detail-td { padding: 0 !important; }

        .rmad-detail-inner {
          padding: 16px 20px 18px 20px;
          background: #f8faff;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .rmad-detail-flag-block { display: flex; flex-direction: column; gap: 10px; }

        .rmad-insight-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .rmad-insight-card {
          border: 1px solid #dde6f7;
          border-radius: 10px;
          background: white;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rmad-insight-k {
          font-size: 10px;
          color: #7a8eaf;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .rmad-insight-v {
          font-size: 12px;
          color: #18335e;
          line-height: 1.4;
          font-weight: 700;
        }

        .rmad-detail-flag-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--flag-color, var(--navy));
        }

        .rmad-detail-flag-detail {
          font-size: 12px;
          color: var(--gray);
          font-weight: 500;
        }

        .rmad-detail-tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--line);
        }

        .rmad-detail-tbl th {
          padding: 7px 10px;
          background: var(--navy);
          color: white;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .rmad-detail-tbl td {
          padding: 7px 10px;
          border-bottom: 1px solid var(--line);
          color: var(--navy);
        }

        .rmad-detail-tbl tbody tr:nth-child(even) td { background: #f0f6ff; }
        .rmad-detail-tbl tbody tr:hover td { background: #e4eeff; }

        .rmad-detail-mono {
          font-family: ui-monospace, monospace;
          font-size: 11.5px;
          color: var(--blue-dark);
        }

        .rmad-detail-num { text-align: center; font-weight: 700; }

        .rmad-status-chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          background: var(--blue-soft);
          color: var(--blue-dark);
          font-size: 11px;
          font-weight: 700;
        }

        .rmad-reason-chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          border: 1px solid #f7c7b7;
          background: #fff2ec;
          color: #b5471f;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .rmad-detail-empty-note {
          border: 1px dashed #d5e0f4;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          color: #607596;
          background: #f5f9ff;
          font-weight: 600;
        }

        /* ── Misc ── */
        .rmad-no-results {
          padding: 36px;
          text-align: center;
          color: var(--gray);
          font-style: italic;
          font-size: 14px;
        }

        .rmad-pagination {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .rmad-page-btn {
          border: 1px solid #c7d7f3;
          background: #ffffff;
          color: #184489;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          padding: 6px 11px;
        }

        .rmad-page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rmad-page-info {
          font-size: 12px;
          color: #637ba1;
          font-weight: 700;
        }

        @media (max-width: 860px) {
          .rmad-insight-grid { grid-template-columns: 1fr; }
        }

        .rmad-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 48px;
          color: var(--gray);
        }
      `}</style>
    </section>
  );
}
