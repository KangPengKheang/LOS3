import React, { useEffect, useState } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Clock, MessageCircle, UserRound } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatDate, formatDateTime, getLosDays } from '../utils/dateUtils.js';
import { getRemarkText, hasRemark } from '../utils/remarks.js';

const PAGE_SIZE = 20;

function RemarkPreviewPopover({ row }) {
  const remark = getRemarkText(row);

  return (
    <div className="remark-popover" role="tooltip">
      <div className="remark-popover-head">
        <MessageCircle size={16} />
        <strong>Follow-up Remark</strong>
      </div>
      <p>{remark}</p>
      <div className="remark-popover-meta">
        <span><UserRound size={14} /> {row.REMARK_UPDATED_BY || row.LAST_REMARK_BY || 'Unknown user'}</span>
        <span><Clock size={14} /> {formatDateTime(row.REMARK_UPDATED_AT || row.LAST_REMARK_AT)}</span>
      </div>
    </div>
  );
}

export default function CaseTable({ rows, onSelectCase, selectedCase }) {
  const [pinnedRemarkId, setPinnedRemarkId] = useState('');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // Reset to page 1 whenever the row set changes (filters applied)
  useEffect(() => {
    setPage(1);
    setPageInput('1');
  }, [rows]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function goTo(target) {
    const p = Math.min(Math.max(1, target), totalPages);
    setPage(p);
    setPageInput(String(p));
  }

  function handlePageInputKeyDown(e) {
    if (e.key === 'Enter') {
      const parsed = parseInt(pageInput, 10);
      if (!Number.isNaN(parsed)) goTo(parsed);
    }
  }

  return (
    <div className="table-wrap">
      <table className="case-table">
        <thead>
          <tr>
            <th>Application ID</th>
            <th>Application Date</th>
            <th>Customer</th>
            <th>Branch</th>
            <th>Source</th>
            <th>Product</th>
            <th>Total Exposure</th>
            <th className="status-column">Status</th>
            <th>LOS Days</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, index) => {
            const remarked = hasRemark(row);
            const isSelected = selectedCase?.APPLICATION_NUMBER_ID === row.APPLICATION_NUMBER_ID;
            const applicationId = row.APPLICATION_NUMBER_ID;
            const isRemarkPinned = pinnedRemarkId === applicationId;
            const customerName = String(row.CUSTOMER_NAME || '').trim();
            const rmName = String(row.RM_NAME || row.RM_Name || row.rm_name || '').trim();

            return (
              <tr
                key={`${applicationId}-${index}`}
                className={`${isSelected ? 'selected-row' : ''} ${remarked ? 'remarked-row' : ''}`}
              >
                <td className="mono">{applicationId}</td>
                <td>{formatDate(row.APPLICATION_DATE)}</td>
                <td className="customer-table-cell">
                  <div className="customer-cell">
                    <button
                      type="button"
                      className="customer-link"
                      onClick={() => onSelectCase(row)}
                      title="View details and add/edit remark"
                    >
                      {customerName || '-'}
                    </button>
                    <span className="rm-name">RM: {rmName || '-'}</span>
                  </div>
                </td>
                <td>{row.BRANCH_NAME || '-'}</td>
                <td>{row.APPLICATION_SOURCE || '-'}</td>
                <td>{row.PRODUCTS || '-'}</td>
                <td>{formatCurrency(row.TOTAL_EXPOSURE)}</td>
                <td className="status-cell"><StatusBadge status={row.STATUS} /></td>
                <td className="days-cell los-days">{getLosDays(row)}</td>
                <td>
                  {remarked ? (
                    <div className={`remark-viewer ${isRemarkPinned ? 'is-open' : ''}`}>
                      <button
                        type="button"
                        className="remark-badge"
                        aria-label={`View saved remark for ${row.CUSTOMER_NAME || applicationId}`}
                        aria-expanded={isRemarkPinned}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPinnedRemarkId(current => (current === applicationId ? '' : applicationId));
                        }}
                      >
                        <MessageCircle size={15} />
                        <span>Remarked</span>
                      </button>
                      <RemarkPreviewPopover row={row} />
                    </div>
                  ) : (
                    <span className="remark-empty">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="pagination">
        <button className="pg-btn" onClick={() => goTo(1)} disabled={page === 1} aria-label="First page">
          <ChevronFirst size={16} />
        </button>
        <button className="pg-btn" onClick={() => goTo(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="pg-info">Page</span>
        <input
          className="pg-input"
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={e => setPageInput(e.target.value)}
          onKeyDown={handlePageInputKeyDown}
          onBlur={() => { const p = parseInt(pageInput, 10); if (!Number.isNaN(p)) goTo(p); }}
          aria-label="Page number"
        />
        <span className="pg-info">of {totalPages}</span>
        <button className="pg-btn" onClick={() => goTo(page + 1)} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
        <button className="pg-btn" onClick={() => goTo(totalPages)} disabled={page === totalPages} aria-label="Last page">
          <ChevronLast size={16} />
        </button>
        <span className="pg-count">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
      </div>
    </div>
  );
}
