import React, { useState } from 'react';
import { Clock, MessageCircle, UserRound } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatDate, formatDateTime, getLosDays } from '../utils/dateUtils.js';
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
            <th>Application Date</th>
            <th>Customer</th>
            <th>Branch</th>
            <th>Source</th>
            <th>Product</th>
            <th>Total Exposure</th>
            <th className="status-column">Status</th>
            <th>Purpose</th>
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
            const customerName = String(row.CUSTOMER_NAME || '').trim();
            const rmName = String(row.RM_NAME || row.RM_Name || row.rm_name || '').trim();
            const purpose = String(row.PURPOSE || '').trim();

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
                <td className="purpose-cell">{purpose || '-'}</td>
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
