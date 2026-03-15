# StockPulse — Phase 1: Frontend Shell

## What's been built in Phase 1

### Files Created
```
stockpulse/
├── frontend/
│   ├── index.html                         ← ✅ STANDALONE DEMO (open in browser)
│   ├── package.json                       ← Next.js dependencies
│   ├── styles/
│   │   └── globals.css                    ← Complete dark trading CSS design system
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx              ← Root layout wrapper
│   │   │   └── Sidebar.jsx                ← Navigation + watchlist
│   │   └── dashboard/
│   │       ├── MarketDashboard.jsx        ← Main dashboard page
│   │       └── CompanyAnalytics.jsx       ← Screener-style financials
│   ├── hooks/
│   │   └── useWebSocket.js                ← WebSocket hook with auto-reconnect
│   └── lib/
│       └── formatters.js                  ← INR formatters, time, sentiment
```

### Features in Phase 1 Frontend
- ✅ Live scrolling market ticker bar (animated, hover-to-pause)
- ✅ Sticky top navigation with live search autocomplete
- ✅ Left sidebar with nav sections + live watchlist
- ✅ Right panel: AI sentiment, trending tickers, forum buzz, alerts
- ✅ 4-column index cards with sparkline charts (Nifty 50, Sensex, Bank, IT)
- ✅ Interactive featured chart (Chart.js) with timeframe switching
- ✅ Top Gainers / Losers / Most Active tables (tabbed)
- ✅ Sector heatmap with color intensity by % change
- ✅ **Screener.in-style company analytics** — 4 panels:
  - Valuation Ratios (P/E, P/B, EV/EBITDA, etc.)
  - Profitability (ROE, ROCE, margins)
  - Growth Metrics (revenue, PAT, EBITDA, CAGR)
  - Balance Sheet (debt, cash, ratios)
- ✅ Quarterly results table (5 quarters)
- ✅ Trend sparkline cards for key metrics
- ✅ News grid with AI sentiment badges
- ✅ Simulated live price updates (WebSocket-ready)
- ✅ Market clock (IST) with open/closed detection
- ✅ Fully responsive (mobile, tablet, desktop)

## Quick Start (Standalone Demo)

```bash
# Just open the HTML file in your browser — no build needed
open frontend/index.html
```

## Next.js Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your API URL
npm run dev
# → http://localhost:3000
```

## Data Sources Strategy

### For company analytics (Screener-style):
Our backend aggregates from multiple public sources:

1. **NSE Official API** (free, no key needed):
   - `https://www.nseindia.com/api/quote-equity?symbol=RELIANCE`
   - Returns: price, volume, OHLC, deliverables

2. **BSE XML Feeds** (public):
   - `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Scrip_Cd=500325`

3. **Yahoo Finance (unofficial JSON)**:
   - `https://query1.finance.yahoo.com/v10/finance/quoteSummary/RELIANCE.NS?modules=financialData,defaultKeyStatistics,incomeStatementHistory`

4. **Screener.in Export**:
   - Screener provides company data pages at `https://www.screener.in/company/RELIANCE/`
   - Our backend can scrape & cache this with BeautifulSoup (respectful rate limiting)
   - Alternatively, use `https://www.screener.in/api/company/?q=RELIANCE` (public)

5. **Tickertape Public API**:
   - `https://api.tickertape.in/stocks/info/RELI`

All sources are cached in Redis (TTL: 15 min for prices, 6 hours for financials)

## Upcoming Phases

| Phase | Status |
|-------|--------|
| 1 — Frontend Shell      | ✅ Done  |
| 2 — Stock Detail Page   | 🔜 Next  |
| 3 — News Feed UI        | ⏳ Queued |
| 4 — Community Forum     | ⏳ Queued |
| 5 — Auth & User Profile | ⏳ Queued |
| 6 — FastAPI Backend     | ⏳ Queued |
| 7 — Database Schema     | ⏳ Queued |
| 8 — WebSocket Engine    | ⏳ Queued |
| 9 — AI Sentiment Module | ⏳ Queued |
| 10 — Docker + Deploy    | ⏳ Queued |