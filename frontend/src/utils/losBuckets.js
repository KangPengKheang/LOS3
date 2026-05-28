// Utility to bucket LOS days into the required ranges
export function getLosBucket(days) {
  if (days < 10) return 'lt10';
  if (days < 20) return '10to20';
  if (days < 50) return '20to50';
  if (days < 100) return '50to100';
  return 'gt100';
}

export const LOS_BUCKETS = [
  { id: 'lt10', label: 'Less Than 10' },
  { id: '10to20', label: '10 - 20' },
  { id: '20to50', label: '20 - 50' },
  { id: '50to100', label: '50 - 100' },
  { id: 'gt100', label: 'More than 100' },
];
