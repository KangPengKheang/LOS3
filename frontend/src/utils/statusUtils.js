export const statusOrder = [
  'RM Submission',
  'BM Review',
  'Credit Assessment',
  'Credit Operation',
  'Approval Committee',
  'Legal & Documentation',
  'Disbursement Preparation',
  'Approved',
  'Drawdown',
  'Returned to RM',
  'Rejected',
  'Cancelled'
];

export const terminalStatusLabels = [
  'Approved',
  'Drawdown',
  'Rejected',
  'Cancelled',
  'Cancel',
];

export function normalizeStatus(status = '') {
  return String(status || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function statusMatches(status, matches) {
  const normalized = normalizeStatus(status);
  return matches.some(match => normalizeStatus(match) === normalized);
}

export function isTerminalStatus(status) {
  return statusMatches(status, terminalStatusLabels);
}

