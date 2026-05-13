import React, { useState } from 'react';
import { Clock, MessageCircle, UserRound } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatDateTime, getLosDays, getProcessDays } from '../utils/dateUtils.js';
import { getRemarkText, hasRemark } from '../utils/remarks.js';

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

  return (
    <div className="table-wrap">
      <table className="case-table">
        <thead>
          <tr>
            <th>Application ID</th>
            <th>Customer</th>
            <th>Branch</th>
            <th>Source</th>
            <th>Product</th>
            <th>Request Amount</th>
            <th>Status</th>
            <th>Current Step / Remark</th>
            <th>Process Days</th>
            <th>LOS Days</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const remarked = hasRemark(row);
            const isSelected = selectedCase?.APPLICATION_NUMBER_ID === row.APPLICATION_NUMBER_ID;
            const applicationId = row.APPLICATION_NUMBER_ID;
            const isRemarkPinned = pinnedRemarkId === applicationId;

            return (
              <tr
                key={`${applicationId}-${index}`}
                className={`${isSelected ? 'selected-row' : ''} ${remarked ? 'remarked-row' : ''}`}
              >
                <td className="mono">{applicationId}</td>
                <td>
                  <button
                    type="button"
                    className="customer-link"
                    onClick={() => onSelectCase(row)}
                    title="View details and add/edit remark"
                  >
                    {row.CUSTOMER_NAME || '-'}
                  </button>
                </td>
                <td>{row.BRANCH_NAME || '-'}</td>
                <td>{row.APPLICATION_SOURCE || '-'}</td>
                <td>{row.PRODUCTS || '-'}</td>
                <td>{formatCurrency(row.TOTAL_NEW_REQUEST_AMOUNT)}</td>
                <td><StatusBadge status={row.STATUS} /></td>
                <td className="remark-preview">{row.COMMENT_FROM_APPROVER || row.PURPOSE || '-'}</td>
                <td className="days-cell process-days">{getProcessDays(row)}</td>
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
    </div>
  );
}
