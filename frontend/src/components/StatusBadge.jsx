import React from 'react';

export const statusOrder = [
  'RM Submission',
  'BM Review',
  'Credit Assessment',
  'Credit Operation',
  'Approval Committee',
  'Legal & Documentation',
  'Disbursement Preparation',
  'Drawdown',
  'Returned to RM',
  'Rejected',
  'Cancelled'
];

export function getStatusClass(status = '') {
  const s = status.toLowerCase();
  if (s === 'drawdown') return 'success';
  if (s.includes('returned')) return 'warning';
  if (s.includes('reject')) return 'danger';
  if (s.includes('cancel')) return 'neutral';
  if (s.includes('approval') || s.includes('documentation') || s.includes('disbursement')) return 'purple';
  if (s.includes('credit')) return 'blue';
  if (s.includes('bm')) return 'orange';
  return 'info';
}

export default function StatusBadge({ status }) {
  return <span className={`status-badge ${getStatusClass(status)}`}>{status || '-'}</span>;
}
