// frontend/lib/newsHelpers.js

/**
 * newsHelpers.js
 *
 * Client-side utilities for news processing, categorization,
 * RSS feed management, and sentiment interpretation.
 *
 * The heavy-duty NLP sentiment scoring is done backend-side
 * (see backend/tasks/sentiment.py — Celery + HuggingFace).
 * These helpers handle display logic, categorization, and
 * article filtering on the frontend.
 */

// ── Source configuration ────────────────────────────────────────────
export const NEWS_SOURCES = {
  et:         { name:'ET Markets',          color:'#3b82f6', rss:'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',      trust: 9 },
  mc:         { name:'Moneycontrol',         color:'#00d68f', rss:'https://www.moneycontrol.com/rss/MCtopnews.xml',                            trust: 9 },
  bloomberg:  { name:'Bloomberg',            color:'#f59e0b', rss:'https://feeds.bloomberg.com/markets/news.rss',                              trust:10 },
  nse:        { name:'NSE India',            color:'#8b5cf6', api:'https://www.nseindia.com/api/corporate-announcements?index=equities',       trust:10 },
  bse:        { name:'BSE India',            color:'#ec4899', api:'https://api.bseindia.com/BseIndiaAPI/api/Corpfinal/w?scripcode=&status=',   trust:10 },
  livemint:   { name:'Livemint',             color:'#06b6d4', rss:'https://www.livemint.com/rss/markets',                                      trust: 8 },
  bs:         { name:'Business Standard',    color:'#ff4d6d', rss:'https://www.business-standard.com/rss/markets-106.rss',                     trust: 8 },
  reuters:    { name:'Reuters India',        color:'#f59e0b', rss:'https://feeds.reuters.com/reuters/INtopNews',                               trust:10 },
  hindu_biz:  { name:'Hindu BusinessLine',   color:'#8b5cf6', rss:'https://www.thehindubusinessline.com/markets/feeder/default.rss',           trust: 8 },
  tickertape: { name:'Tickertape',           color:'#06b6d4', api:'https://api.tickertape.in/stocks/info/',                                    trust: 7 },
};

// ── Article categorization ──────────────────────────────────────────

const CATEGORY_RULES = [
  {
    category: 'Earnings',
    keywords: ['Q1','Q2','Q3','Q4','quarterly','results','profit','revenue','EPS','PAT','EBITDA',
               'net income','guidance','beat','miss','exceeds','disappoint','quarterly report'],
  },
  {
    category: 'Economy',
    keywords: ['RBI','GDP','inflation','CPI','WPI','repo rate','fiscal deficit','budget',
               'monetary policy','MPC','IMF','World Bank','PMI','IIP','manufacturing'],
  },
  {
    category: 'IPO',
    keywords: ['IPO','initial public offering','listing','grey market','GMP','allotment',
               'subscription','mainboard','SME IPO','FPO','OFS','DRHP'],
  },
  {
    category: 'Corporate',
    keywords: ['merger','acquisition','M&A','stake','buyback','dividend','bonus shares',
               'split','rights issue','demerger','board meeting','AGM','management change'],
  },
  {
    category: 'Commodities',
    keywords: ['gold','silver','crude oil','natural gas','MCX','copper','aluminium',
               'commodity','metal','crude','OPEC','WTI','Brent'],
  },
  {
    category: 'Global',
    keywords: ['Fed','Federal Reserve','ECB','US market','Nasdaq','S&P 500','Dow Jones',
               'China','Japan','Europe','dollar','forex','currency','DXY','FII','FPI'],
  },
  {
    category: 'Regulation',
    keywords: ['SEBI','NSE','BSE','regulation','circular','penalty','enforcement','compliance',
               'insider trading','settlement','NCLT','IBC','court','tribunal'],
  },
  {
    category: 'Markets',
    keywords: ['Nifty','Sensex','rally','correction','bull','bear','technical','breakout',
               'support','resistance','52-week','all-time high','ATH','market cap'],
  },
];

/**
 * Categorize an article based on its title and summary
 */
export function categorizeArticle(title, summary = '') {
  const text = `${title} ${summary}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const matched = rule.keywords.some(kw => text.includes(kw.toLowerCase()));
    if (matched) return rule.category;
  }

  return 'Markets'; // default
}

/**
 * Extract stock symbols mentioned in text
 * Uses a simple regex + known NSE symbol list approach.
 * Backend does a more thorough NER-based extraction.
 */
export function extractStockMentions(text, knownSymbols = []) {
  if (!text) return [];
  const mentioned = [];

  // Match capitalized 2-10 char words that look like tickers
  const tickerPattern = /\b([A-Z]{2,10})\b/g;
  const candidates = text.match(tickerPattern) || [];

  // Filter against known NSE symbols
  if (knownSymbols.length > 0) {
    const symbolSet = new Set(knownSymbols);
    candidates.forEach(sym => {
      if (symbolSet.has(sym) && !mentioned.includes(sym)) mentioned.push(sym);
    });
  } else {
    // Fallback: common NIFTY 50 symbols
    const nifty50 = ['RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC',
      'SBIN','BAJFINANCE','BHARTIARTL','KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI',
      'WIPRO','HCLTECH','TITAN','ULTRACEMCO','NESTLEIND','ADANIENT','POWERGRID',
      'NTPC','COALINDIA','ONGC','TATAMOTORS','TATASTEEL','JSWSTEEL','HINDALCO','GRASIM'];
    candidates.forEach(sym => {
      if (nifty50.includes(sym) && !mentioned.includes(sym)) mentioned.push(sym);
    });
  }

  return mentioned.slice(0, 8); // max 8 tags
}

// ── Sentiment interpretation ────────────────────────────────────────

/**
 * Map numerical sentiment score to label + class
 * Score range: 0 (most bearish) to 100 (most bullish)
 */
export function interpretSentiment(score) {
  if (score === null || score === undefined) return { label: 'neutral', cls: 'sp-neut', arrow: '—' };
  if (score >= 65) return { label: 'bullish', cls: 'sp-bull', arrow: '▲', color: 'var(--g)' };
  if (score <= 35) return { label: 'bearish', cls: 'sp-bear', arrow: '▼', color: 'var(--r)' };
  return { label: 'neutral', cls: 'sp-neut', arrow: '—', color: 'var(--am)' };
}

/**
 * Calculate overall market sentiment from a list of articles
 */
export function aggregateSentiment(articles) {
  if (!articles?.length) return { bullish: 0, neutral: 0, bearish: 0, score: 50 };

  const counts = { bullish: 0, neutral: 0, bearish: 0 };
  let totalScore = 0;

  articles.forEach(a => {
    counts[a.sentiment || 'neutral']++;
    totalScore += a.sentiment_score || 50;
  });

  const total = articles.length;
  return {
    bullish:      Math.round(counts.bullish / total * 100),
    neutral:      Math.round(counts.neutral / total * 100),
    bearish:      Math.round(counts.bearish / total * 100),
    score:        Math.round(totalScore / total),
    total_articles: total,
  };
}

// ── Impact score display ────────────────────────────────────────────

/**
 * Get color and label for market impact score (0-100)
 */
export function getImpactLevel(score) {
  if (score >= 80) return { label: 'Critical',  color: 'var(--r)',  bg: 'var(--rd)' };
  if (score >= 65) return { label: 'High',       color: 'var(--am)', bg: 'var(--amd)' };
  if (score >= 40) return { label: 'Medium',     color: 'var(--b)',  bg: 'var(--bd)'  };
  return               { label: 'Low',        color: 'var(--t3)', bg: 'var(--bg3)' };
}

// ── Article filtering ───────────────────────────────────────────────

/**
 * Filter and sort articles client-side
 * Mirrors the backend filter logic for instant UX
 */
export function filterArticles(articles, { sentiment, sector, source, query, sort }) {
  let filtered = [...articles];

  // Text search
  if (query?.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.summary?.toLowerCase().includes(q) ||
      a.stocks?.some(s => s.toLowerCase().includes(q)) ||
      a.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  // Sentiment filter
  if (sentiment?.length) {
    filtered = filtered.filter(a => sentiment.includes(a.sentiment));
  }

  // Sector filter
  if (sector?.length && !sector.includes('All')) {
    filtered = filtered.filter(a => sector.includes(a.sector) || sector.includes(a.category));
  }

  // Source filter
  if (source?.length) {
    filtered = filtered.filter(a => source.includes(a.source_id));
  }

  // Sort
  const sorters = {
    latest:   (a, b) => new Date(b.published_at) - new Date(a.published_at),
    trending: (a, b) => (b.view_count || 0) - (a.view_count || 0),
    bullish:  (a, b) => (b.sentiment_score || 50) - (a.sentiment_score || 50),
    bearish:  (a, b) => (a.sentiment_score || 50) - (b.sentiment_score || 50),
    impact:   (a, b) => (b.impact_score || 0) - (a.impact_score || 0),
  };

  filtered.sort(sorters[sort] || sorters.latest);
  return filtered;
}

// ── RSS Feed utilities ──────────────────────────────────────────────

/**
 * RSS Feed URLs used by backend scraper (Celery task)
 * Included here for documentation and frontend admin panel display
 */
export const RSS_FEEDS = [
  { id:'et_markets',    url:'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',      source:'et',      interval:300  },
  { id:'mc_topnews',    url:'https://www.moneycontrol.com/rss/MCtopnews.xml',                            source:'mc',      interval:300  },
  { id:'livemint',      url:'https://www.livemint.com/rss/markets',                                      source:'livemint',interval:600  },
  { id:'bs_markets',    url:'https://www.business-standard.com/rss/markets-106.rss',                     source:'bs',      interval:600  },
  { id:'hindu_biz',     url:'https://www.thehindubusinessline.com/markets/feeder/default.rss',           source:'hindu',   interval:900  },
  { id:'reuters_india', url:'https://feeds.reuters.com/reuters/INtopNews',                               source:'reuters', interval:600  },
  { id:'nse_announce',  url:'https://www.nseindia.com/api/corporate-announcements?index=equities',       source:'nse',     interval:60   },
  { id:'bse_filings',   url:'https://api.bseindia.com/BseIndiaAPI/api/Corpfinal/w?scripcode=&status=',  source:'bse',     interval:60   },
];

/**
 * Format RSS feed last-fetch time as relative string
 */
export function rssStatusLabel(lastFetchIso) {
  if (!lastFetchIso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(lastFetchIso)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/**
 * Get feed health color
 * green = < 10 min, amber = 10-30 min, red = > 30 min
 */
export function rssFeedHealth(lastFetchIso, intervalSec = 600) {
  if (!lastFetchIso) return 'var(--r)';
  const diff = Math.floor((Date.now() - new Date(lastFetchIso)) / 1000);
  if (diff < intervalSec * 1.5)  return 'var(--g)';
  if (diff < intervalSec * 3)    return 'var(--am)';
  return 'var(--r)';
}