# Euribor Rates

Live Euribor rate tracker and mortgage tenor comparison tool. Data is fetched daily from the Bank of Finland.

**[euribordata.com](https://euribordata.com)**

## Features

**Rates page (`/`)** — current 3m, 6m, and 12m Euribor rates with month-over-month change, and a historical chart with 1M–5Y period selection.

**Compare page (`/compare`)** — mortgage calculator that shows how monthly payments diverge across tenors over 24 months under five rate scenarios (flat, +1% over 12/24 months, −0.5% over 12/24 months). Enter your loan amount, term, bank margin, and switching fee to get a break-even analysis.

## Development

```bash
npm install
npm run dev       # localhost:4321
npm run build
npm run preview
npm test
npm run lint
npm run lint:fix
npm run typecheck
```

## Stack

- [Astro](https://astro.build) with SSR via `@astrojs/node`
- React for interactive components
- Tailwind CSS v4, shadcn/ui
- Recharts for charts
- Vitest for unit tests
- Biome for linting and formatting

## Data source

Euribor rates are proxied from the [Bank of Finland XML API](https://www.suomenpankki.fi/fi/tilastot/taulukot-ja-kuviot/korot/kuviot/korot_kuviot/euriborkorot_pv_chrt_fi/) via `/api/euribor`, cached for 1 hour.
