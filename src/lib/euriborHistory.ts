export interface HistoricalPoint {
  date: string; // "2026-03-20" — YYYY-MM-DD
  rate3m: number | null; // percentage points, e.g. 2.111
  rate6m: number | null;
  rate12m: number | null;
}

export type Period = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y';

export const PERIOD_MONTHS: Record<Period, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  '2Y': 24,
  '5Y': 60,
};

/** Returns YYYY-MM-DD string for (today - months) */
export function periodStart(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const SP_URL = '/api/euribor';

const RATE_NAMES: Record<'3m' | '6m' | '12m', string> = {
  '3m': '3 month (act/360)',
  '6m': '6 month (act/360)',
  '12m': '12 month (act/360)',
};

/** Fetch and parse Euribor history, filtered to dates >= startDate (YYYY-MM-DD) */
export async function fetchEuriborHistory(
  startDate: string,
): Promise<HistoricalPoint[]> {
  const res = await fetch(SP_URL);
  if (!res.ok) throw new Error(`Suomen Pankki: HTTP ${res.status}`);
  const xml = await res.text();

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const periods = doc.querySelectorAll('period');
  const result: HistoricalPoint[] = [];

  periods.forEach((period) => {
    const date = period.getAttribute('value') ?? '';
    if (!date || date < startDate) return;

    function rateFor(name: string): number | null {
      const rates = period.querySelectorAll('rate');
      for (const rate of rates) {
        if (rate.getAttribute('name') === name) {
          const val = parseFloat(
            rate.querySelector('intr')?.getAttribute('value') ?? '',
          );
          return Number.isNaN(val) ? null : val;
        }
      }
      return null;
    }

    result.push({
      date,
      rate3m: rateFor(RATE_NAMES['3m']),
      rate6m: rateFor(RATE_NAMES['6m']),
      rate12m: rateFor(RATE_NAMES['12m']),
    });
  });

  // XML is newest-first; reverse to oldest-first for the chart
  return result.reverse();
}
