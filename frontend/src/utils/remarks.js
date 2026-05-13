export function getRemarkText(row) {
  if (!row) return '';
  return String(row.FOLLOW_UP_REMARK || row.REMARK || row.FOLLOWUP_REMARK || '').trim();
}

export function hasRemark(row) {
  return getRemarkText(row).length > 0;
}
