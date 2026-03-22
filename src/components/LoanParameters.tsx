import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatEuro } from '@/lib/format';

interface Props {
  loanAmount: number;
  termYears: number;
  marginPct: number;
  activeTenor: 3 | 6 | 12;
  switchingFee: number;
  nextResetMonths: string;
  monthlySaving: number;
  breakEvenMonths: number | null;
  cheapestTenor: 3 | 6 | 12;
  ratesLoading: boolean;
  onLoanAmount: (v: number) => void;
  onTermYears: (v: number) => void;
  onMarginPct: (v: number) => void;
  onTenor: (v: 3 | 6 | 12) => void;
  onSwitchingFee: (v: number) => void;
  onNextResetMonths: (v: string) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium shrink-0">{label}</Label>
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-24 h-7 text-right text-sm"
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span className="font-medium text-foreground">{displayValue}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function LoanParameters({
  loanAmount,
  termYears,
  marginPct,
  activeTenor,
  switchingFee,
  nextResetMonths,
  monthlySaving,
  breakEvenMonths,
  cheapestTenor,
  ratesLoading,
  onLoanAmount,
  onTermYears,
  onMarginPct,
  onTenor,
  onSwitchingFee,
  onNextResetMonths,
}: Props) {
  const saving = Math.round(monthlySaving);
  const shouldSwitch = cheapestTenor !== activeTenor;

  let badgeClass = 'bg-muted text-muted-foreground';
  let badgeText = 'All euribor rates comparable';
  if (!ratesLoading && shouldSwitch && saving > 20) {
    badgeClass =
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    badgeText = `Switch to ${cheapestTenor}-month euribor rate`;
  } else if (!ratesLoading && shouldSwitch && saving > 5) {
    badgeClass =
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    badgeText = `Marginal benefit to switch to ${cheapestTenor}m`;
  } else if (!ratesLoading && (!shouldSwitch || saving <= 0)) {
    badgeClass = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    badgeText = 'Stay on current euribor rate';
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left column */}
          <div className="space-y-6">
            <SliderRow
              label="Loan amount"
              value={loanAmount}
              min={0}
              max={1000000}
              step={5000}
              displayValue={formatEuro(loanAmount)}
              onChange={onLoanAmount}
            />
            <SliderRow
              label="Remaining term"
              value={termYears}
              min={1}
              max={30}
              step={1}
              displayValue={`${termYears} years`}
              onChange={onTermYears}
            />
            <SliderRow
              label="Your margin"
              value={marginPct}
              min={0.1}
              max={1.5}
              step={0.01}
              displayValue={`${marginPct.toFixed(2)}%`}
              onChange={onMarginPct}
            />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current euribor rate</Label>
              <Tabs
                value={String(activeTenor)}
                onValueChange={(v) => onTenor(parseInt(v, 10) as 3 | 6 | 12)}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="3" className="flex-1">
                    3 months
                  </TabsTrigger>
                  <TabsTrigger value="6" className="flex-1">
                    6 months
                  </TabsTrigger>
                  <TabsTrigger value="12" className="flex-1">
                    12 months
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                Highlights your line in the chart
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee" className="text-sm font-medium">
                  Switching fee
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    €
                  </span>
                  <Input
                    id="fee"
                    type="number"
                    value={switchingFee}
                    min={0}
                    step={10}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v >= 0) onSwitchingFee(v);
                    }}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on your bank fees
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset" className="text-sm font-medium">
                  Months to next reset
                </Label>
                <Input
                  id="reset"
                  type="number"
                  value={nextResetMonths}
                  min={1}
                  max={24}
                  placeholder="optional"
                  onChange={(e) => onNextResetMonths(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Shows reset line on chart
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Break-even row */}
        <div className="mt-6 pt-5 border-t flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1">
            {ratesLoading ? (
              <span className="inline-block h-4 w-64 rounded bg-muted animate-pulse" />
            ) : shouldSwitch && saving > 0 ? (
              <>
                Switching from {activeTenor}m → {cheapestTenor}m saves{' '}
                <span className="font-semibold text-foreground">
                  {formatEuro(saving)}/month
                </span>
                .{' '}
                {breakEvenMonths != null ? (
                  <>
                    Break-even on {formatEuro(switchingFee)} fee:{' '}
                    <span className="font-semibold text-foreground">
                      {breakEvenMonths} months
                    </span>
                    .
                  </>
                ) : (
                  'Switching covers the fee immediately.'
                )}
              </>
            ) : shouldSwitch && saving <= 0 ? (
              <>
                Staying on {activeTenor}m saves{' '}
                <span className="font-semibold text-foreground">
                  {formatEuro(Math.abs(saving))}/month
                </span>{' '}
                vs switching to {cheapestTenor}m.
              </>
            ) : (
              `${activeTenor}m is already the best-priced euribor rate at current rates.`
            )}
          </p>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${badgeClass}`}
          >
            {badgeText}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
