export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();
  if (!text) return null;

  // Google Sheets often sends date values as serial numbers, for example 46106.
  // Serial date 1 means 1899-12-31 in Sheets/Excel style.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20_000 && serial < 80_000) {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400 * 1000;
      return new Date(utcValue);
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // Support date format like 02-Jan-2026.
  const match = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (match) {
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const [, d, m, y] = match;
    const monthIndex = months[m];
    if (monthIndex !== undefined) return new Date(Number(y), monthIndex, Number(d));
  }

  return null;
}

export function diffDays(start, end) {
  const s = parseDate(start);
  const e = parseDate(end) || new Date();
  if (!s || !e) return 0;

  const startDate = new Date(s);
  const endDate = new Date(e);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function getEndDate(row) {
  const status = String(row.STATUS || '').toLowerCase();
  if (status === 'drawdown' || status === 'approved') {
    return row.APPROVED_DATE || row.DRAWDOWN_DATE || row.REPORT_DATE;
  }
  return row.REPORT_DATE || new Date();
}

export function getLosDays(row) {
  return diffDays(row.APPLICATION_DATE || row.ISSUE_DATE, new Date());
}

export function getProcessDays(row) {
  const stepStart = row.CURRENT_STEP_START_DATE || row.PROCESS_START_DATE || row.STATUS_START_DATE;
  if (stepStart) return diffDays(stepStart, row.REPORT_DATE || new Date());

  // Fallback because the provided LOS sample has no stage-start column.
  // For true stage duration, add CURRENT_STEP_START_DATE to the Sheet.
  return getLosDays(row);
}

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
