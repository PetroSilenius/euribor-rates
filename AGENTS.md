# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at localhost:4321
npm run build     # production build to ./dist/
npm run preview   # preview production build
npm test          # run vitest tests (node env, no browser)
npm run lint      # biome check (lint + format check)
npm run lint:fix  # biome check --write (auto-fix)
npm run typecheck # astro check (full TS + Astro typecheck)
```

## Architecture

Astro site with SSR via `@astrojs/node` (standalone mode). React components are used for all interactive UI (`client:load`). Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui components in `src/components/ui/`.

**Two pages:**
- `/` (`src/pages/index.astro`) — mounts `<EuriborOverview>`, shows current rates and historical chart
- `/compare` (`src/pages/compare.astro`) — mounts `<MortgageApp>`, mortgage tenor comparison tool

**Data flow:**
1. `GET /api/euribor` (`src/pages/api/euribor.ts`) — server-side proxy to Suomen Pankki XML API, cached 1h
2. `fetchEuriborHistory()` (`src/lib/euriborHistory.ts`) — client-side fetch to `/api/euribor`, parses XML with `DOMParser`, returns `HistoricalPoint[]` oldest-first
3. Both client components fetch the full 5Y dataset on mount and slice it client-side for period filtering

**Simulation logic** (`src/lib/simulation.ts`):
- `computePayments()` — calculates monthly payments for all three tenors at current rates
- `computeScenario()` — projects 24-month payment timeline per tenor under a rate scenario (`flat | rise12 | rise24 | fall12 | fall24`), re-computing annuity at each tenor's reset schedule (3m resets at months 0,3,6…; 6m at 0,6,12,18; 12m at 0,12)
- Rates in `SimulationInputs.euriborRates` are **decimals** (e.g. `0.0215`); historical data from the API is in **percentage points** (e.g. `2.15`) — `MortgageApp` divides by 100 when constructing `liveRates`

**Formatting** (`src/lib/format.ts`) — Finnish locale (`fi-FI`) helpers: `formatEuro`, `formatPercent`, `formatNumber`.

**Path alias:** `@/` maps to `src/`.

## Tests

Tests live in `src/lib/*.test.ts` (vitest, node environment). They cover `annuity`, `computePayments`, and `computeScenario` in `simulation.ts`. Note: some tests in `simulation.test.ts` reference scenario names (`'rise'`, `'fall'`) that don't exist in the current `Scenario` type — these will fail.
