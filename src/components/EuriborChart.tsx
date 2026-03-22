import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEuro } from '@/lib/format';
import type { MonthlyPoint } from '@/lib/simulation';

interface Props {
  data: MonthlyPoint[];
  activeTenor: 3 | 6 | 12;
  nextResetMonth?: number;
}

const COLORS = {
  payment3m: '#3b82f6', // blue-500
  payment6m: '#22c55e', // green-500
  payment12m: '#f59e0b', // amber-500
};

const LABELS = {
  payment3m: '3m Euribor',
  payment6m: '6m Euribor',
  payment12m: '12m Euribor',
};

type Key = keyof typeof COLORS;

const TENOR_KEY: Record<3 | 6 | 12, Key> = {
  3: 'payment3m',
  6: 'payment6m',
  12: 'payment12m',
};

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
      <p className="font-medium text-foreground mb-2">
        {label === 0 ? 'Today' : `Month ${label}`}
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
            {formatEuro(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function legendFormatter(value: string) {
  return LABELS[value as Key] ?? value;
}

export function EuriborChart({ data, activeTenor, nextResetMonth }: Props) {
  const activeKey = TENOR_KEY[activeTenor];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <defs>
          {(Object.keys(COLORS) as Key[]).map((key) => (
            <linearGradient
              key={key}
              id={`fill-${key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={COLORS[key]} stopOpacity={0.18} />
              <stop offset="95%" stopColor={COLORS[key]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          strokeOpacity={0.25}
          vertical={false}
        />

        <XAxis
          dataKey="month"
          tickFormatter={(m: number) => (m === 0 ? 'Now' : `M${m}`)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          interval={3}
        />
        <YAxis
          tickFormatter={(v: number) => formatEuro(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          width={70}
          domain={['auto', 'auto']}
        />

        <Tooltip content={CustomTooltip} />

        <ReferenceLine
          x={0}
          stroke="var(--color-foreground)"
          strokeDasharray="4 3"
          strokeOpacity={0.4}
        />

        {nextResetMonth != null &&
          nextResetMonth > 0 &&
          nextResetMonth < 24 && (
            <ReferenceLine
              x={nextResetMonth}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{
                value: 'Next reset',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--color-muted-foreground)',
                dy: -4,
              }}
            />
          )}

        {(Object.keys(COLORS) as Key[]).map((key) => {
          const isActive = key === activeKey;
          return (
            <Area
              key={key}
              type="stepAfter"
              dataKey={key}
              stroke={COLORS[key]}
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeOpacity={isActive ? 1 : 0.45}
              fill={`url(#fill-${key})`}
              fillOpacity={isActive ? 1 : 0.4}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          );
        })}

        <Legend
          formatter={legendFormatter}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
