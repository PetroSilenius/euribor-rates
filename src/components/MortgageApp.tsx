import { useEffect, useMemo, useState } from 'react';
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
import { EuriborChart } from '@/components/EuriborChart';
import { LoanParameters } from '@/components/LoanParameters';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRightIcon } from '@/components/ui/icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchEuriborHistory, periodStart } from '@/lib/euriborHistory';
import {
  computeScenario,
  computeSimulatedRates,
  type Scenario,
  type SimulationInputs,
} from '@/lib/simulation';

// ─── Config ─────────────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<Scenario, string> = {
  flat: 'Rates hold',
  rise12: '+1% over 12 months',
  rise24: '+1% over 24 months',
  fall12: '−0.5% over 12 months',
  fall24: '−0.5% over 24 months',
};

const RATE_COLORS = {
  rate3m: '#3b82f6',
  rate6m: '#22c55e',
  rate12m: '#f59e0b',
};
const RATE_LABELS = {
  rate3m: '3m Euribor',
  rate6m: '6m Euribor',
  rate12m: '12m Euribor',
};
type RateKey = keyof typeof RATE_COLORS;
const RATE_SERIES_ORDER: RateKey[] = ['rate3m', 'rate6m', 'rate12m'];

// ─── Tooltip ────────────────────────────────────────────────────────────────────

function RateTooltip({ active, payload, label }: TooltipContentProps) {
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
        RATE_SERIES_ORDER.indexOf(a.dataKey as RateKey) -
        RATE_SERIES_ORDER.indexOf(b.dataKey as RateKey),
    );

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1 min-w-[160px]">
      <p className="font-medium text-foreground mb-2">
        {(label as number) < 0.5
          ? 'Now'
          : `Month ${Math.round(label as number)}`}
      </p>
      {entries.map((e) => (
        <div key={e.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ background: e.color }}
          />
          <span className="text-muted-foreground">
            {RATE_LABELS[e.dataKey as RateKey]}
          </span>
          <span className="font-medium ml-auto pl-4">
            {e.value.toFixed(3)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function RateLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
      {RATE_SERIES_ORDER.map((key) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ background: RATE_COLORS[key] }}
          />
          <span className="text-muted-foreground">{RATE_LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function MortgageApp() {
  const [scenario, setScenario] = useState<Scenario>('flat');
  const [loanAmount, setLoanAmount] = useState(250_000);
  const [termYears, setTermYears] = useState(20);
  const [marginPct, setMarginPct] = useState(0.55);
  const [activeTenor, setActiveTenor] = useState<3 | 6 | 12>(12);
  const [switchingFee, setSwitchingFee] = useState(100);
  const [nextResetMonths, setNextResetMonths] = useState('');
  const [liveRates, setLiveRates] = useState<
    Record<3 | 6 | 12, number> | undefined
  >(undefined);

  useEffect(() => {
    fetchEuriborHistory(periodStart(1))
      .then((pts) => {
        const latest = pts[pts.length - 1];
        if (
          latest &&
          latest.rate3m != null &&
          latest.rate6m != null &&
          latest.rate12m != null
        ) {
          setLiveRates({
            3: latest.rate3m / 100,
            6: latest.rate6m / 100,
            12: latest.rate12m / 100,
          });
        }
      })
      .catch(() => {
        /* fall back to hardcoded rates */
      });
  }, []);

  const inputs: SimulationInputs = useMemo(
    () => ({
      loanAmount,
      termMonths: termYears * 12,
      marginDecimal: marginPct / 100,
      currentTenor: activeTenor,
      euriborRates: liveRates,
    }),
    [loanAmount, termYears, marginPct, activeTenor, liveRates],
  );

  const chartData = useMemo(
    () => computeScenario(inputs, scenario),
    [inputs, scenario],
  );
  const rateData = useMemo(
    () => computeSimulatedRates(inputs, scenario),
    [inputs, scenario],
  );

  const { monthlySaving, totalSavings, savingsHorizonMonths, breakEvenMonths, cheapestTenor } = useMemo(() => {
    const tenorPayment = (monthIdx: number, tenor: 3 | 6 | 12) => {
      const point = chartData[monthIdx];
      if (tenor === 3) return point?.payment3m ?? 0;
      if (tenor === 6) return point?.payment6m ?? 0;
      return point?.payment12m ?? 0;
    };

    const months = chartData.length;
    const totalPayment = (tenor: 3 | 6 | 12) =>
      chartData.reduce((sum, _, monthIdx) => sum + tenorPayment(monthIdx, tenor), 0);
    const avgPayment = (tenor: 3 | 6 | 12) =>
      months > 0
        ? totalPayment(tenor) / months
        : 0;

    const avgByTenor = {
      3: avgPayment(3),
      6: avgPayment(6),
      12: avgPayment(12),
    };
    const totalByTenor = {
      3: totalPayment(3),
      6: totalPayment(6),
      12: totalPayment(12),
    };
    const cheapest = ([3, 6, 12] as const).reduce((best, tenor) =>
      avgByTenor[tenor] < avgByTenor[best] ? tenor : best,
    );
    const fromPayment = avgByTenor[activeTenor];
    const saving = fromPayment - avgByTenor[cheapest];
    const cumulativeSaving = totalByTenor[activeTenor] - totalByTenor[cheapest];

    return {
      monthlySaving: saving,
      totalSavings: cumulativeSaving,
      savingsHorizonMonths: months,
      breakEvenMonths:
        saving > 0 && cheapest !== activeTenor
          ? Math.ceil(switchingFee / saving)
          : null,
      cheapestTenor: cheapest,
    };
  }, [chartData, activeTenor, switchingFee]);

  const nextResetMonth = nextResetMonths
    ? parseInt(nextResetMonths, 10)
    : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Euribor Rate Comparison
        </h1>
        <p className="text-sm text-muted-foreground">
          See how monthly payments diverge over 24 months across different rate
          scenarios.
        </p>
      </div>

      {/* Scenario tabs + payment chart */}
      <section>
        <Tabs
          value={scenario}
          onValueChange={(v) => setScenario(v as Scenario)}
          className="mb-4"
        >
          <TabsList>
            {(
              ['flat', 'rise12', 'rise24', 'fall12', 'fall24'] as Scenario[]
            ).map((s) => (
              <TabsTrigger key={s} value={s} className="px-4">
                {SCENARIO_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="h-[360px] w-full">
          {liveRates == null ? (
            <div className="h-full rounded-xl bg-muted/40 animate-pulse" />
          ) : (
            <EuriborChart
              data={chartData}
              activeTenor={activeTenor}
              nextResetMonth={nextResetMonth}
            />
          )}
        </div>
      </section>

      {/* Loan parameters */}
      <section>
        <LoanParameters
          loanAmount={loanAmount}
          termYears={termYears}
          marginPct={marginPct}
          activeTenor={activeTenor}
          switchingFee={switchingFee}
          nextResetMonths={nextResetMonths}
          monthlySaving={monthlySaving}
          totalSavings={totalSavings}
          savingsHorizonMonths={savingsHorizonMonths}
          breakEvenMonths={breakEvenMonths}
          cheapestTenor={cheapestTenor}
          ratesLoading={liveRates == null}
          onLoanAmount={setLoanAmount}
          onTermYears={setTermYears}
          onMarginPct={setMarginPct}
          onTenor={setActiveTenor}
          onSwitchingFee={setSwitchingFee}
          onNextResetMonths={setNextResetMonths}
        />
      </section>

      {/* Simulated Euribor rates chart */}
      <div className="mt-10">
        <h2 className="text-base font-medium mb-4">Simulated Euribor rates</h2>
        <div className="h-[260px] w-full">
          {liveRates == null ? (
            <div className="h-full rounded-xl bg-muted/40 animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rateData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  strokeOpacity={0.25}
                  vertical={false}
                />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[0, 23]}
                  ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
                  tickFormatter={(t: number) => (t === 0 ? 'Now' : `M${t}`)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  width={54}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={RateTooltip} />
                {RATE_SERIES_ORDER.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={RATE_COLORS[key]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
                <Legend
                  content={<RateLegend />}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <Card className="mt-10">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="flex-1">
            <p className="font-medium text-sm">
              Want to check current Euribor rates?
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              See live 3m, 6m and 12m rates with historical chart and recent
              trend.
            </p>
          </div>
          <a
            href="/"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
          >
            <span>View live rates</span>
            <ArrowRightIcon />
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        Not financial advice. Consult your bank before making changes.
      </p>
    </div>
  );
}
