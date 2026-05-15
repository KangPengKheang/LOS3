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
  if (s === 'drawdown' || s === 'approved') return 'success';
  if (s.includes('returned')) return 'warning';
  if (s.includes('reject')) return 'danger';
  if (s.includes('cancel')) return 'neutral';
  if (s.includes('approval') || s.includes('documentation') || s.includes('disbursement')) return 'purple';
  if (s.includes('credit')) return 'blue';
  if (s.includes('bm')) return 'orange';
  return 'info';
}

export function getStatusLabel(status = '') {
  const label = String(status || '-').trim();
  const normalized = label.toLowerCase();

  const labels = {
    'rm submission': 'RM Submit',
    'credit assessment': 'Credit Assess',
    'credit operation': 'Credit Ops',
    'approval committee': 'Committee',
    'legal & documentation': 'Legal Docs',
    'disbursement preparation': 'Disbursement',
    'returned to rm': 'Return RM',
    'waiting approve from head of credit management': 'Head Credit Approval',
  };

  if (labels[normalized]) return labels[normalized];

  return label
    .replace(/\bwaiting\b/ig, 'Wait')
    .replace(/\bapprove\b/ig, 'Approval')
    .replace(/\bapproval\b/ig, 'Approval')
    .replace(/\bmanagement\b/ig, 'Mgmt')
    .replace(/\bdocumentation\b/ig, 'Docs')
    .replace(/\bassessment\b/ig, 'Assess')
    .replace(/\boperation\b/ig, 'Ops')
    .replace(/\bpreparation\b/ig, 'Prep')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function StatusBadge({ status }) {
  const label = status || '-';
  const displayLabel = getStatusLabel(status);
  return (
    <span className={`status-badge ${getStatusClass(status)}`} title={label}>
      <span className="status-badge-text">{displayLabel}</span>
    </span>
  );
}
