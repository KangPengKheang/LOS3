import React from 'react';
import { MessageCircle } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { getLosDays, getProcessDays } from '../utils/dateUtils.js';
import { hasRemark } from '../utils/remarks.js';

export default function CaseTable({ rows, onSelectCase, selectedCase }) {
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

            return (
              <tr
                key={`${row.APPLICATION_NUMBER_ID}-${index}`}
                className={`${isSelected ? 'selected-row' : ''} ${remarked ? 'remarked-row' : ''}`}
              >
                <td className="mono">{row.APPLICATION_NUMBER_ID}</td>
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
                    <button type="button" className="remark-badge" onClick={() => onSelectCase(row)}>
                      <MessageCircle size={15} />
                      <span>Remarked</span>
                    </button>
                  ) : (
                    <button type="button" className="add-remark-mini" onClick={() => onSelectCase(row)}>
                      Add
                    </button>
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
