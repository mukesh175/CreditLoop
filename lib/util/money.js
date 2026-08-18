/**
 * Money helpers.
 *
 * Store credit is currency-specific. Amounts of different currencies must never
 * be added, compared or aggregated together — every helper here enforces that.
 */

export class CurrencyMismatchError extends Error {
  constructor(a, b) {
    super(`Currency mismatch: ${a} vs ${b}. Store credit amounts cannot be combined across currencies.`);
    this.name = 'CurrencyMismatchError';
    this.code = 'CURRENCY_MISMATCH';
  }
}

export function assertSameCurrency(a, b) {
  if (!a || !b) throw new Error('Currency code is required.');
  if (String(a).toUpperCase() !== String(b).toUpperCase()) {
    throw new CurrencyMismatchError(a, b);
  }
  return String(a).toUpperCase();
}

/** Round to 2 decimals using integer cents to avoid float drift. */
export function round2(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

export function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents) {
  return round2(Number(cents) / 100);
}

export function addMoney(a, b) {
  assertSameCurrency(a.currencyCode, b.currencyCode);
  return {
    amount: fromCents(toCents(a.amount) + toCents(b.amount)),
    currencyCode: String(a.currencyCode).toUpperCase(),
  };
}

export function isPositiveAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0;
}

/** Sums a list of {amount, currencyCode}, grouped by currency. Never mixes. */
export function sumByCurrency(entries) {
  const totals = {};
  for (const entry of entries || []) {
    const code = String(entry.currencyCode || '').toUpperCase();
    if (!code) continue;
    totals[code] = fromCents((toCents(totals[code] || 0) + toCents(entry.amount || 0)));
  }
  return totals;
}

const SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', INR: '₹', JPY: '¥' };

export function formatMoney(amount, currencyCode = 'USD', { compact = false } = {}) {
  const code = String(currencyCode || 'USD').toUpperCase();
  const n = Number(amount) || 0;
  if (compact && Math.abs(n) >= 1000) {
    const symbol = SYMBOLS[code] || '';
    const value = Math.abs(n) >= 1_000_000 ? `${round2(n / 1_000_000)}M` : `${round2(n / 1000)}K`;
    return symbol ? `${symbol}${value}` : `${value} ${code}`;
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${SYMBOLS[code] || ''}${n.toFixed(2)} ${code}`;
  }
}

export function formatPercent(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}
