// Finnish locale formatting helpers

const fi = 'fi-FI';

/** Format a euro amount: €200 000 or €1 234,50 */
export function formatEuro(amount: number, decimals = 0): string {
  return new Intl.NumberFormat(fi, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Format a percentage: 2.15% */
export function formatPercent(rate: number, decimals = 2): string {
  return new Intl.NumberFormat(fi, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rate);
}

/** Format a plain number with Finnish thousands separator */
export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat(fi, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
