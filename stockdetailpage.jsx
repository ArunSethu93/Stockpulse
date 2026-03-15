// frontend/components/stock/StockDetailPage.jsx
'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import CandlestickChart from '../charts/CandlestickChart';
import FinancialTabs from './FinancialTabs';
import PeerComparison from './PeerComparison';
import ShareholdingPattern from './ShareholdingPattern';
import StockDiscussion from './StockDiscussion';
import { formatPrice, formatPct, dirClass } from '../../lib/formatters';
import { usePriceStream } from '../../hooks/useWebSocket';

const fetcher = url => fetch(url).then(r => r.json());

/**
 * StockDetailPage — full stock analysis page
 *
 * Data flow:
 * 1. SWR fetches /api/stock/:symbol for static data (cached 5 min)
 * 2. usePriceStream() provides live price updates via WebSocket
 * 3. Each sub-component fetches its own data slice
 *
 * Analytics data sourced from:
 * - NSE API: price, OHLC, delivery volume
 * - Yahoo Finance: financials, ratios
 * - Backend scraper: shareholding pattern (from BSE filings)
 * - Redis cache: sentiment scores (updated hourly by Celery)
 */

const TABS = [
  { id:'chart',    label:'Chart'          },
  { id:'pl',       label:'P&L'            },
  { id:'bs',       label:'Balance Sheet'  },
  { id:'cf',       label:'Cash Flow'      },
  { id:'ratios',   label:'Ratios'         },
  { id:'peers',    label:'Peers'          },
  { id:'sh',       label:'Shareholding'   },
  { id:'analyst',  label:'Analyst Ratings'},
  { id:'discuss',  label:'Discussion'     },
];

export default function StockDetailPage({ symbol }) {
  const [activeTab, setTab] = useState('chart');

  // Fetch base stock data
  const { data: stock, error } = useSWR(`/api/stock/${symbol}`, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
    fallbackData: getStockFallback(symbol),
  });

  // Live price stream
  const { prices } = usePriceStream([symbol]);
  const livePrice  = prices[symbol];

  const displayPrice  = livePrice?.price    ?? stock?.price;
  const displayChange = livePrice?.change    ?? stock?.change;
  const displayPct    = livePrice?.change_pct ?? stock?.change_pct;

  if (error) return <ErrorState symbol={symbol} />;
  if (!stock) return <StockDetailSkeleton />;

  return (
    <div className="stock-detail">
      {/* Stock Header */}
      <StockHeader
        stock={stock}
        price={displayPrice}
        change={displayChange}
        changePct={displayPct}
        isLive={!!livePrice}
      />

      {/* Tab Navigation */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tbtn ${activeTab === tab.id ? 'act' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'chart'   && <CandlestickChart symbol={symbol} />}
        {activeTab === 'pl'      && <FinancialTabs symbol={symbol} statement="pl" />}
        {activeTab === 'bs'      && <FinancialTabs symbol={symbol} statement="bs" />}
        {activeTab === 'cf'      && <FinancialTabs symbol={symbol} statement="cf" />}
        {activeTab === 'ratios'  && <FinancialTabs symbol={symbol} statement="ratios" />}
        {activeTab === 'peers'   && <PeerComparison symbol={symbol} sector={stock.sector} />}
        {activeTab === 'sh'      && <ShareholdingPattern symbol={symbol} />}
        {activeTab === 'analyst' && <AnalystRatings symbol={symbol} />}
        {activeTab === 'discuss' && <StockDiscussion symbol={symbol} stockName={stock.name} />}
      </div>
    </div>
  );
}

// ── Stock Header ─────────────────────────────────────────────────

function StockHeader({ stock, price, change, changePct, isLive }) {
  const [inWatchlist, setWatchlist] = useState(false);
  const [alertModal, setAlertModal] = useState(false);
  const dir = changePct >= 0 ? 'up' : 'down';

  const toggleWatchlist = async () => {
    try {
      const method = inWatchlist ? 'DELETE' : 'POST';
      await fetch('/api/watchlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol: stock.symbol }),
      });
      setWatchlist(!inWatchlist);
    } catch {
      // Redirect to login
      window.location.href = '/login';
    }
  };

  return (
    <div className="shead">
      <div className="shead-top">
        <div className="shead-left">
          <div className="sticker-row">
            <span className="sticker">{stock.symbol}</span>
            <span className="sector-tag">{stock.sector} · {stock.industry}</span>
            <span className="snse">NSE · BSE: {stock.bse_code} · ISIN: {stock.isin}</span>
            {isLive && <span className="live-badge"><span className="live-dot" />LIVE</span>}
          </div>
          <div className="sname">{stock.name}</div>

          <div className="sprice-row">
            <span className={`sprice ${dir}`}>{formatPrice(price)}</span>
            <span className={`schg-big ${dir}`}>
              {changePct >= 0 ? '▲' : '▼'} {change >= 0 ? '+' : ''}{change?.toFixed(2)} ({formatPct(changePct)})
            </span>
            <span className="sday">Day: {formatPrice(stock.day_low)} – {formatPrice(stock.day_high)}</span>
          </div>

          <div className="squick">
            {[
              { label:'Open',      value: formatPrice(stock.open)            },
              { label:'Prev Close',value: formatPrice(stock.prev_close)      },
              { label:'Volume',    value: stock.volume_str                   },
              { label:'Avg Volume',value: stock.avg_volume_str               },
              { label:'Market Cap',value: stock.market_cap_str               },
              { label:'P/E Ratio', value: `${stock.pe_ratio?.toFixed(1)}x`  },
            ].map(cell => (
              <div key={cell.label} className="sqcell">
                <div className="sqlbl">{cell.label}</div>
                <div className="sqval">{cell.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="shead-right">
          <div className="action-btns">
            <button className="abtn abtn-buy">▲ Buy</button>
            <button
              className={`abtn abtn-watch ${inWatchlist ? 'active' : ''}`}
              onClick={toggleWatchlist}
              style={inWatchlist ? { color: 'var(--am)', borderColor: 'var(--am)' } : {}}
            >
              {inWatchlist ? '★ Watchlisted' : '☆ Watchlist'}
            </button>
            <button className="abtn abtn-alert" onClick={() => setAlertModal(true)}>
              ⚡ Set Alert
            </button>
          </div>

          {/* 52-week range indicator */}
          <div className="range-indicator">
            <div className="range-label">52-Week Range</div>
            <div className="range-values">
              {formatPrice(stock.week52_low)} — {formatPrice(stock.week52_high)}
            </div>
            <RangeBar current={price} low={stock.week52_low} high={stock.week52_high} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeBar({ current, low, high }) {
  const pct = Math.min(Math.max(((current - low) / (high - low)) * 100, 0), 100);
  return (
    <div style={{ marginTop: 8, position: 'relative' }}>
      <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 4, width: 160, position: 'relative' }}>
        <div style={{ position: 'absolute', height: '100%', background: 'var(--b)', borderRadius: 4, width: `${pct}%` }} />
        <div style={{ position: 'absolute', width: 8, height: 8, background: 'var(--t1)', borderRadius: '50%', top: -2, left: `calc(${pct}% - 4px)` }} />
      </div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>
        Current: {pct.toFixed(1)}% of 52W range
      </div>
    </div>
  );
}

// ── Analyst Ratings ───────────────────────────────────────────────

function AnalystRatings({ symbol }) {
  const { data } = useSWR(`/api/analyst/${symbol}`, fetcher, {
    fallbackData: getAnalystFallback(symbol),
  });

  const ratings = data?.ratings || [];
  const buys    = ratings.filter(r => r.rating === 'Buy').length;
  const holds   = ratings.filter(r => r.rating === 'Hold').length;
  const sells   = ratings.filter(r => r.rating === 'Sell').length;
  const avgTgt  = ratings.length ? (ratings.reduce((a, r) => a + r.target, 0) / ratings.length).toFixed(0) : null;

  return (
    <div className="analyst-section">
      {/* Consensus summary */}
      <div className="consensus-grid">
        <div className="consensus-card">
          <div className="cc-label">Consensus</div>
          <div className="cc-value positive">BUY</div>
        </div>
        <div className="consensus-card">
          <div className="cc-label">Avg. Target</div>
          <div className="cc-value">₹{avgTgt}</div>
        </div>
        <div className="consensus-card">
          <div className="cc-label">Upside</div>
          <div className="cc-value positive">+7.2%</div>
        </div>
        <div className="consensus-card">
          <div className="cc-label">Coverage</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span className="positive">{buys} Buy</span>
            <span style={{ color: 'var(--am)' }}>{holds} Hold</span>
            <span className="negative">{sells} Sell</span>
          </div>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1, marginTop: 6 }}>
            <div style={{ background: 'var(--g)', flex: buys }} />
            <div style={{ background: 'var(--am)', flex: holds }} />
            <div style={{ background: 'var(--r)', flex: sells }} />
          </div>
        </div>
      </div>

      {/* Individual ratings */}
      <div className="ratings-list">
        {ratings.map((r, i) => (
          <div key={i} className="analyst-row">
            <div className="an-firm">{r.firm}</div>
            <div className="an-date">{r.date}</div>
            <div className="an-target">
              ₹{r.target}
              <span className={r.upside >= 0 ? 'positive' : 'negative'} style={{ fontSize: 10, marginLeft: 4 }}>
                ({r.upside >= 0 ? '+' : ''}{r.upside}%)
              </span>
            </div>
            <div className={`an-rating ${r.rating === 'Buy' ? 'an-buy' : r.rating === 'Hold' ? 'an-hold' : 'an-sell'}`}>
              {r.rating}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function getStockFallback(symbol) {
  return {
    symbol, name: `${symbol} Ltd`, bse_code: '500325', isin: 'INE002A01018',
    sector: 'Oil & Gas', industry: 'Conglomerate', exchange: 'NSE',
    price: 2847.5, change: 34.45, change_pct: 1.24,
    open: 2811, prev_close: 2813.05, day_low: 2798.2, day_high: 2863.45,
    week52_low: 2180.3, week52_high: 3024.9,
    volume_str: '42.1M', avg_volume_str: '28.4M',
    market_cap_str: '₹19.28L Cr', pe_ratio: 29.4,
  };
}

function getAnalystFallback(symbol) {
  return {
    ratings: [
      { firm:'Goldman Sachs',    target:3200, rating:'Buy',  upside:12.4, date:'Jan 2025' },
      { firm:'Morgan Stanley',   target:3100, rating:'Buy',  upside:8.9,  date:'Jan 2025' },
      { firm:'Kotak Securities', target:3050, rating:'Buy',  upside:7.1,  date:'Dec 2024' },
      { firm:'ICICI Securities', target:2950, rating:'Hold', upside:3.6,  date:'Dec 2024' },
      { firm:'Emkay Global',     target:2800, rating:'Hold', upside:-1.7, date:'Dec 2024' },
      { firm:'Axis Capital',     target:2600, rating:'Sell', upside:-8.7, date:'Nov 2024' },
    ],
  };
}

function StockDetailSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: 120, background: 'var(--bg2)', borderRadius: 8, marginBottom: 16 }} />
      <div style={{ height: 40, background: 'var(--bg2)', borderRadius: 8, marginBottom: 16 }} />
      <div style={{ height: 400, background: 'var(--bg2)', borderRadius: 8 }} />
    </div>
  );
}

function ErrorState({ symbol }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <div style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Stock Not Found</div>
      <div style={{ color: 'var(--t2)', marginBottom: 20 }}>Could not load data for "{symbol}"</div>
      <a href="/" style={{ color: 'var(--b)', fontSize: 13 }}>← Back to Dashboard</a>
    </div>
  );
}