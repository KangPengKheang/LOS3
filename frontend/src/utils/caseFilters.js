const EXCLUDED_PRODUCTS = new Set([
  'credit card',
  'credit card against td',
]);

const EXCLUDED_LOAN_TYPES = new Set([
  'other request',
  'restructure loan',
]);

export function normalizeFilterValue(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isExcludedProduct(product) {
  return EXCLUDED_PRODUCTS.has(normalizeFilterValue(product));
}

export function isExcludedLoanType(loanType) {
  return EXCLUDED_LOAN_TYPES.has(normalizeFilterValue(loanType));
}

export function isReportableLosCase(row) {
  return !isExcludedProduct(row?.PRODUCTS)
    && !isExcludedLoanType(row?.LOAN_TYPE);
}
