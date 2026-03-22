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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  fetchEuriborHistory,
  type HistoricalPoint,
  PERIOD_MONTHS,
  type Period,
  periodStart,
} from '@/lib/euriborHistory';

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

const PERIODS: Period[] = ['3M', '6M', '1Y', '2Y', '5Y'];

/** Format a daily date string for X-axis ticks */
function fmtTick(date: string, period: Period): string {
  const d = new Date(`${date}T00:00:00`);
  if (period === '3M' || period === '6M') {
    // "15 Jan"
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  // "Jan 25"
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

/** Full date for tooltip header */
function fmtFull(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
      <p className="font-medium text-foreground mb-2">
        {fmtFull(label as string)}
      </p>
      {(
        payload as unknown as {
          dataKey: string;
          value: number;
          color: string;
        }[]
      ).map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">
            {LABELS[entry.dataKey as Key]}
          </span>
          <span className="font-medium ml-auto pl-4">
            {entry.value.toFixed(3)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function legendFormatter(value: string) {
  return LABELS[value as Key] ?? value;
}

export function HistoricalRates() {
  const [period, setPeriod] = useState<Period>('3M');
  const [data, setData] = useState<HistoricalPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
    fetchEuriborHistory(periodStart(PERIOD_MONTHS[period]))
      .then((pts) => {
        setData(pts);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, [period]);

  // Latest available data point for the rate badges
  const latest = data.length > 0 ? data[data.length - 1] : null;

  // minTickGap controls label density — wider for longer periods
  const minTickGap = period === '3M' ? 28 : period === '6M' ? 40 : 55;

  return (
    <Card className="mb-6">
      <CardHeader className="border-b">
        <CardTitle>Euribor Historical Rates</CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPeriod(p)}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Latest rate badges */}
        {latest && (
          <div className="flex flex-wrap gap-4 mb-4">
            {(['rate3m', 'rate6m', 'rate12m'] as Key[]).map((key, i) => {
              const val = latest[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ background: COLORS[key] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {['3m', '6m', '12m'][i]}
                  </span>
                  <span className="text-sm font-semibold">
                    {val != null ? `${val.toFixed(3)}%` : '—'}
                  </span>
                </div>
              );
            })}
            <span className="text-xs text-muted-foreground self-center">
              as of {fmtFull(latest.date)}
            </span>
          </div>
        )}

        {/* Chart area */}
        <div className="h-[220px] w-full">
          {status === 'loading' && (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {status === 'error' && (
            <div className="h-full flex items-center justify-center text-sm text-destructive">
              Failed to load ECB data. Check your connection and try again.
            </div>
          )}
          {status === 'ok' && data.length === 0 && (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No data available for this period.
            </div>
          )}
          {status === 'ok' && data.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
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
                <Tooltip content={CustomTooltip} />
                {(['rate3m', 'rate6m', 'rate12m'] as Key[]).map((key) => (
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
                  formatter={legendFormatter}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
