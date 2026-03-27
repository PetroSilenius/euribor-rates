import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRightIcon } from '@/components/ui/icons';
import {
  fetchEuriborHistory,
  type HistoricalPoint,
  PERIOD_MONTHS,
  type Period,
  periodStart,
} from '@/lib/euriborHistory';

// ─── Config ────────────────────────────────────────────────────────────────────

const COLORS = {
  rate3m: '#3b82f6',
  rate6m: '#22c55e',
  rate12m: '#f59e0b',
};
const LABELS = {
  rate3m: '3m Euribor',
  rate6m: '6m Euribor',
  rate12m: '12m Euribor',
};
type Key = keyof typeof COLORS;
const SERIES_ORDER: Key[] = ['rate3m', 'rate6m', 'rate12m'];
const TENOR_KEYS: [Key, string][] = [
  ['rate3m', '3m'],
  ['rate6m', '6m'],
  ['rate12m', '12m'],
];
const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y'];

// ─── Date helpers ───────────────────────────────────────────────────────────────

function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtTick(date: string, period: Period): string {
  const d = parseDay(date);
  if (period === '1M' || period === '3M' || period === '6M') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
function fmtFull(date: string): string {
  return parseDay(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const entries = (
    payload as unknown as {
      dataKey: string;
      value: number;
      color: string;
    }[]
  )
    .slice()
    .sort(
      (a, b) =>
        SERIES_ORDER.indexOf(a.dataKey as Key) -
        SERIES_ORDER.indexOf(b.dataKey as Key),
    );

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1 min-w-[170px]">
      <p className="font-medium text-foreground mb-2">
        {fmtFull(label as string)}
      </p>
      {entries.map((e) => (
        <div key={e.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ background: e.color }}
          />
          <span className="text-muted-foreground">
            {LABELS[e.dataKey as Key]}
          </span>
          <span className="font-medium ml-auto pl-4">
            {e.value.toFixed(3)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
      {SERIES_ORDER.map((key) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ background: COLORS[key] }}
          />
          <span className="text-muted-foreground">{LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Rate card ─────────────────────────────────────────────────────────────────

function RateCard({
  label,
  color,
  rate,
  change,
  loading,
}: {
  label: string;
  color: string;
  rate: number | null;
  change: number | null; // percentage point difference vs 1 month ago
  loading: boolean;
}) {
  const sign = change != null && change > 0 ? '+' : '';
  const changeColor =
    change == null
      ? ''
      : change < 0
        ? 'text-green-700 dark:text-green-400'
        : change > 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-muted-foreground';

  return (
    <div className="rounded-xl ring-1 ring-foreground/10 bg-card px-5 py-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block size-2.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
      ) : rate != null ? (
        <span className="text-4xl font-bold tracking-tight tabular-nums leading-none">
          {rate.toFixed(3)}%
        </span>
      ) : (
        <span className="text-4xl font-bold text-muted-foreground">—</span>
      )}
      {!loading && change != null && (
        <span className={`text-xs font-medium mt-0.5 ${changeColor}`}>
          {sign}
          {change.toFixed(2)}% vs last month
        </span>
      )}
    </div>
  );
}

// ─── Rates table ────────────────────────────────────────────────────────────────

function RatesTable({
  data,
  loading,
}: {
  data: HistoricalPoint[];
  loading: boolean;
}) {
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  // Newest-first rows for the last 30 calendar days
  const rows = data.filter((p) => p.date >= cutoff).reverse();

  function fmtTableDate(date: string): string {
    return parseDay(date).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  }

  function fmtRate(rate: number | null): string {
    if (rate == null) return '—';
    return rate.toLocaleString('fi-FI', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }

  const skeletonRows = 8;

  return (
    <div className="mt-10">
      <h2 className="text-base font-medium mb-4">Previous 30 days</h2>
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  {TENOR_KEYS.map(([key, label]) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-right font-medium text-muted-foreground"
                    >
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full shrink-0"
                          style={{ background: COLORS[key] }}
                        />
                        {label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: skeletonRows }).map((_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                        </td>
                        {TENOR_KEYS.map(([key]) => (
                          <td key={key} className="px-4 py-3 text-right">
                            <div className="h-4 w-14 rounded bg-muted animate-pulse ml-auto" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={row.date}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {fmtTableDate(row.date)}
                        </td>
                        {TENOR_KEYS.map(([key]) => (
                          <td
                            key={key}
                            className="px-4 py-3 text-right tabular-nums text-foreground"
                          >
                            {fmtRate(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function EuriborOverview() {
  const [period, setPeriod] = useState<Period>('3M');
  // Full 5Y dataset, fetched once
  const [allData, setAllData] = useState<HistoricalPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    // Read initial period from URL (client-only)
    const p = new URLSearchParams(window.location.search).get('period') ?? '';
    if ((PERIODS as string[]).includes(p)) setPeriod(p as Period);

    fetchEuriborHistory(periodStart(PERIOD_MONTHS['5Y']))
      .then((pts) => {
        setAllData(pts);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []); // fetch once on mount

  function selectPeriod(p: Period) {
    setPeriod(p);
    const params = new URLSearchParams(window.location.search);
    params.set('period', p);
    history.replaceState(null, '', `?${params}`);
  }

  const latest = allData.length > 0 ? allData[allData.length - 1] : null;

  // Find the trading day closest to 30 calendar days before the latest date
  const monthAgo = (() => {
    if (allData.length < 2 || !latest) return null;
    const target = new Date(latest.date);
    target.setDate(target.getDate() - 30);
    const targetStr = target.toISOString().slice(0, 10);
    for (let i = allData.length - 1; i >= 0; i--) {
      if (allData[i].date <= targetStr) return allData[i];
    }
    return allData[0];
  })();

  // Slice allData to the selected period window
  const cutoff = periodStart(PERIOD_MONTHS[period]);
  const chartData = allData.filter((d) => d.date >= cutoff);

  function ppChange(key: Key): number | null {
    if (!latest || !monthAgo) return null;
    const l = latest[key];
    const m = monthAgo[key];
    if (l == null || m == null) return null;
    return l - m; // difference in percentage points
  }

  const minTickGap =
    period === '1M' ? 24 : period === '3M' ? 32 : period === '6M' ? 44 : 56;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero: current rates */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Current Euribor Rates
        </h1>
        <p className="text-sm text-muted-foreground">
          European interbank offered rates, published daily.
        </p>
      </div>
      <div className="mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TENOR_KEYS.map(([key, label]) => (
            <RateCard
              key={key}
              label={label}
              color={COLORS[key]}
              rate={latest?.[key] ?? null}
              change={ppChange(key)}
              loading={status === 'loading'}
            />
          ))}
        </div>
        {status === 'error' && (
          <p className="text-sm text-destructive mt-3">
            Could not load rate data. Check your connection.
          </p>
        )}
        {latest && status === 'ok' && (
          <p className="text-xs text-muted-foreground mt-3">
            Last update: {fmtFull(latest.date)}
          </p>
        )}
      </div>

      {/* Historical chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">Historical</h2>
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => selectPeriod(p)}
                className={[
                  'px-2.5 py-1 rounded-md text-sm font-medium transition-colors',
                  period === p
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[260px] w-full">
          {status === 'loading' && (
            <div className="h-full rounded-xl bg-muted/40 animate-pulse" />
          )}
          {status === 'ok' && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => fmtTick(d, period)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  interval="preserveStartEnd"
                  minTickGap={minTickGap}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  width={54}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={ChartTooltip} />
                {SERIES_ORDER.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[key]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                <Legend
                  content={<ChartLegend />}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 30-day rates table */}
      <RatesTable data={allData} loading={status === 'loading'} />

      {/* CTA to compare page */}
      <Card className="mt-10">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="flex-1">
            <p className="font-medium text-sm">
              Deciding between 3, 6 and 12 month Euribor?
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter your loan details to see how your monthly payment changes
              under each scenario.
            </p>
          </div>
          <a
            href="/compare"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
          >
            <span>Compare euribor rates</span>
            <ArrowRightIcon />
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        Not financial advice. Source:{' '}
        <a
          href="https://www.suomenpankki.fi/fi/tilastot/taulukot-ja-kuviot/korot/kuviot/korot_kuviot/euriborkorot_pv_chrt_fi/"
          className="underline hover:text-foreground transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bank of Finland / Suomen Pankki
        </a>
        .
      </p>
    </div>
  );
}
