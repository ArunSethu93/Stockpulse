// frontend/components/dashboard/CompanyAnalytics.jsx
'use client';

import { useState, useEffect } from 'react';



const METRIC_GROUPS = [
  {
    id: 'valuation',
    title: 'Valuation Ratios',
    metrics: [
      { key: 'market_cap_cr',   label: 'Market Cap',      format: 'crore'   },
      { key: 'pe_ratio',        label: 'P/E Ratio',       format: 'x'       },
      { key: 'pb_ratio',        label: 'P/B Ratio',       format: 'x'       },
      { key: 'ev_ebitda',       label: 'EV/EBITDA',       format: 'x'       },
      { key: 'dividend_yield',  label: 'Dividend Yield',  format: 'pct'     },
      { key: 'peg_ratio',       label: 'PEG Ratio',       format: 'raw'     },
    ],
  },
  {
    id: 'profitability',
    title: 'Profitability',
    metrics: [
      { key: 'roe',             label: 'ROE',             format: 'pct', good: v => v > 15 },
      { key: 'roce',            label: 'ROCE',            format: 'pct', good: v => v > 15 },
      { key: 'net_margin',      label: 'Net Margin',      format: 'pct', good: v => v > 10 },
      { key: 'op_margin',       label: 'Operating Margin',format: 'pct', good: v => v > 15 },
      { key: 'gross_margin',    label: 'Gross Margin',    format: 'pct', good: v => v > 30 },
      { key: 'asset_turnover',  label: 'Asset Turnover',  format: 'raw'     },
    ],
  },
  {
    id: 'growth',
    title: 'Growth Metrics (YoY)',
    metrics: [
      { key: 'revenue_growth',  label: 'Revenue Growth',  format: 'pct_delta' },
      { key: 'pat_growth',      label: 'PAT Growth',      format: 'pct_delta' },
      { key: 'ebitda_growth',   label: 'EBITDA Growth',   format: 'pct_delta' },
      { key: 'eps_growth',      label: 'EPS Growth',      format: 'pct_delta' },
      { key: 'sales_cagr_3y',   label: 'Sales CAGR (3Y)', format: 'pct'       },
      { key: 'profit_cagr_3y',  label: 'Profit CAGR (3Y)',format: 'pct'       },
    ],
  },
  {
    id: 'balance_sheet',
    title: 'Balance Sheet',
    metrics: [
      { key: 'total_debt_cr',   label: 'Total Debt',      format: 'crore'     },
      { key: 'cash_cr',         label: 'Cash & Equiv.',   format: 'crore'     },
      { key: 'debt_equity',     label: 'Debt / Equity',   format: 'raw', good: v => v < 1 },
      { key: 'current_ratio',   label: 'Current Ratio',   format: 'raw', good: v => v > 1.5 },
      { key: 'interest_cov',    label: 'Interest Coverage',format: 'x', good: v => v > 4 },
      { key: 'book_value',      label: 'Book Value/Share', format: 'price'    },
    ],
  },
];

function formatValue(val, fmt) {
  if (val === null || val === undefined) return '—';
  switch (fmt) {
    case 'crore':
      if (val >= 100000) return `₹${(val/100000).toFixed(2)}L Cr`;
      if (val >= 1000)   return `₹${(val/1000).toFixed(2)}K Cr`;
      return `₹${val.toFixed(0)} Cr`;
    case 'x':
      return `${val.toFixed(1)}x`;
    case 'pct':
      return `${val.toFixed(2)}%`;
    case 'pct_delta':
      return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
    case 'price':
      return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
    case 'raw':
    default:
      return val.toFixed(2);
  }
}

function MetricRow({ label, value, format, good }) {
  const formatted = formatValue(value, format);
  const isGood = good ? good(value) : null;
  const cls = format === 'pct_delta'
    ? value > 0 ? 'positive' : 'negative'
    : isGood === true ? 'positive' : isGood === false ? 'negative' : '';

  return (
    <div className="screener-row">
      <span className="screener-key">{label}</span>
      <span className={`screener-val ${cls}`}>{formatted}</span>
    </div>
  );
}

export default function CompanyAnalytics({ symbol }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setTab]  = useState('overview');

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetch(`/api/analytics/${symbol}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => {
        // Demo fallback data for RELIANCE
        setData(getDemoData(symbol));
        setLoading(false);
      });
  }, [symbol]);

  if (loading) return <div className="analytics-skeleton" />;
  if (!data)   return <div className="analytics-error">No data available</div>;

  return (
    <div className="company-analytics">
      {/* Quarterly results mini table */}
      <div className="quarterly-strip">
        <div className="q-header">Quarterly Results (₹ Cr)</div>
        <div className="q-table">
          <div className="q-col header">
            <div>Quarter</div>
            <div>Revenue</div>
            <div>EBITDA</div>
            <div>PAT</div>
            <div>EPS</div>
          </div>
          {(data.quarters || []).slice(0, 5).map(q => (
            <div key={q.period} className="q-col">
              <div className="q-period">{q.period}</div>
              <div className="q-val">{formatValue(q.revenue, 'crore')}</div>
              <div className="q-val">{formatValue(q.ebitda, 'crore')}</div>
              <div className={`q-val ${q.pat_growth >= 0 ? 'positive' : 'negative'}`}>
                {formatValue(q.pat, 'crore')}
              </div>
              <div className="q-val mono">{q.eps?.toFixed(2) || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ratio panels */}
      <div className="screener-grid">
        {METRIC_GROUPS.map(group => (
          <div key={group.id} className="screener-card">
            <div className="screener-card-header">{group.title}</div>
            {group.metrics.map(m => (
              <MetricRow
                key={m.key}
                label={m.label}
                value={data[m.key]}
                format={m.format}
                good={m.good}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Trend sparklines for key metrics */}
      <div className="metrics-trend">
        {(data.trend_data || []).map(trend => (
          <TrendMiniCard key={trend.metric} data={trend} />
        ))}
      </div>
    </div>
  );
}

function TrendMiniCard({ data }) {
  const isUp = data.values[data.values.length - 1] >= data.values[0];
  return (
    <div className="trend-card">
      <div className="trend-label">{data.label}</div>
      <div className={`trend-current ${isUp ? 'positive' : 'negative'}`}>
        {formatValue(data.current, data.format)}
      </div>
      <TrendSparkline values={data.values} isUp={isUp} />
    </div>
  );
}

function TrendSparkline({ values, isUp }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const W = 100, H = 30;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = isUp ? '#00d68f' : '#ff4d6d';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 30 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Demo data factory ───────────────────────────────────────────

function getDemoData(symbol) {
  const base = {
    symbol,
    market_cap_cr: 1928000, pe_ratio: 29.4, pb_ratio: 2.14,
    ev_ebitda: 16.8, dividend_yield: 0.41, peg_ratio: 1.82,
    roe: 7.28, roce: 9.14, net_margin: 7.22, op_margin: 14.6,
    gross_margin: 32.1, asset_turnover: 0.62,
    revenue_growth: 10.2, pat_growth: 6.8, ebitda_growth: 11.4, eps_growth: 6.1,
    sales_cagr_3y: 9.4, profit_cagr_3y: 12.7,
    total_debt_cr: 312000, cash_cr: 188000, debt_equity: 0.49,
    current_ratio: 1.62, interest_cov: 6.8, book_value: 1329,
    quarters: [
      { period:'Q3 FY25', revenue:251000, ebitda:42000, pat:18540, eps:27.4, pat_growth:8.2 },
      { period:'Q2 FY25', revenue:238000, ebitda:39800, pat:17120, eps:25.3, pat_growth:6.1 },
      { period:'Q1 FY25', revenue:228000, ebitda:37200, pat:15920, eps:23.5, pat_growth:4.8 },
      { period:'Q4 FY24', revenue:240000, ebitda:40100, pat:18951, eps:28.1, pat_growth:10.6 },
      { period:'Q3 FY24', revenue:231000, ebitda:38600, pat:17143, eps:25.3, pat_growth:9.4 },
    ],
    trend_data: [
      { metric:'revenue', label:'Revenue (₹Cr)', format:'crore', current:251000,
        values:[185000, 204000, 218000, 228000, 238000, 251000] },
      { metric:'pat', label:'PAT (₹Cr)', format:'crore', current:18540,
        values:[12000, 13800, 15200, 15920, 17120, 18540] },
      { metric:'roe', label:'ROE (%)', format:'pct', current:7.28,
        values:[5.1, 5.8, 6.2, 6.9, 7.1, 7.28] },
      { metric:'debt_equity', label:'D/E Ratio', format:'raw', current:0.49,
        values:[0.78, 0.71, 0.64, 0.58, 0.53, 0.49] },
    ],
  };
  return base;
}
