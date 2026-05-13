import React from 'react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatDate } from '../utils/dateUtils.js';

export default function CaseDetailTooltip({ row }) {
  if (!row) return null;
  return (
    <div className="case-tooltip">
      <h4>Case Detail</h4>
      <div className="detail-grid"><span>Application ID:</span><b>{row.APPLICATION_NUMBER_ID}</b></div>
      <div className="detail-grid"><span>Customer:</span><b>{row.CUSTOMER_NAME}</b></div>
      <div className="detail-grid"><span>RM:</span><b>{row.RM_NAME || '-'}</b></div>
      <div className="detail-grid"><span>Branch:</span><b>{row.BRANCH_NAME || '-'}</b></div>
      <div className="detail-grid"><span>Program:</span><b>{row.PROGRAM || '-'}</b></div>
      <div className="detail-grid"><span>Credit Score:</span><b>{row['CREDIT SCORING'] || '-'}</b></div>
      <div className="detail-grid"><span>Request:</span><b>{formatCurrency(row.TOTAL_NEW_REQUEST_AMOUNT)}</b></div>
      <div className="detail-grid"><span>Application Date:</span><b>{formatDate(row.APPLICATION_DATE)}</b></div>
      <div className="detail-grid"><span>Current Status:</span><b><StatusBadge status={row.STATUS} /></b></div>
      <div className="detail-full"><span>Purpose:</span><p>{row.PURPOSE || '-'}</p></div>
      <div className="detail-full"><span>Approver Comment:</span><p>{row.COMMENT_FROM_APPROVER || '-'}</p></div>
    </div>
  );
}
