// frontend/hooks/useStockData.js
'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

/**
 * useStockQuote — live stock quote with 15s refresh
 */
export function useStockQuote(symbol) {
  const { data, error, mutate } = useSWR(
    symbol ? `/api/stock/${symbol}` : null,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );
  return { quote: data, loading: !data && !error, error, refresh: mutate };
}

/**
 * useOHLCV — OHLCV data for chart, keyed by timeframe
 */
export function useOHLCV(symbol, timeframe = '1M') {
  const tfDays = { '1D':1, '1W':7, '1M':30, '3M':90, '6M':180, '1Y':365, '5Y':1825 };
  const days   = tfDays[timeframe] || 30;

  const { data, error } = useSWR(
    symbol ? `/api/market/ohlcv/${symbol}?days=${days}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  return { ohlcv: data || [], loading: !data && !error, error };
}

/**
 * useFinancials — P&L, Balance Sheet, Cash Flow data
 */
export function useFinancials(symbol, statement = 'pl', period = 'quarterly') {
  const { data, error } = useSWR(
    symbol ? `/api/financials/${symbol}?statement=${statement}&period=${period}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3600000 } // 1h cache — financials don't change often
  );
  return { financials: data, loading: !data && !error, error };
}

/**
 * useAnalytics — Screener-style computed ratios
 * Aggregated by backend from NSE/BSE/Yahoo Finance
 */
export function useAnalytics(symbol) {
  const { data, error } = useSWR(
    symbol ? `/api/analytics/${symbol}` : null,
    fetcher,
    { dedupingInterval: 900000 } // 15 min cache
  );
  return { analytics: data, loading: !data && !error, error };
}

/**
 * useShareholding — Promoter/FII/DII/Retail pattern
 * Source: BSE shareholding disclosure filings
 */
export function useShareholding(symbol) {
  const { data, error } = useSWR(
    symbol ? `/api/shareholding/${symbol}` : null,
    fetcher,
    { dedupingInterval: 86400000 } // 24h cache — quarterly data
  );
  return { shareholding: data, loading: !data && !error, error };
}

/**
 * usePeers — peer comparison table
 * Returns top 5-8 peers with key ratios
 */
export function usePeers(symbol, sector) {
  const { data, error } = useSWR(
    symbol ? `/api/peers/${symbol}?sector=${sector || ''}` : null,
    fetcher,
    { dedupingInterval: 300000 } // 5 min
  );
  return { peers: data?.peers || [], loading: !data && !error, error };
}

/**
 * useSentiment — AI sentiment scores for a stock
 * Computed by Celery task every 30 minutes from news + forum
 */
export function useSentiment(symbol) {
  const { data, error } = useSWR(
    symbol ? `/api/sentiment/${symbol}` : null,
    fetcher,
    { refreshInterval: 1800000 } // 30 min
  );
  return {
    sentiment: data || { bullish: 0, neutral: 0, bearish: 0, score: 0, label: 'neutral', sources: 0 },
    loading: !data && !error,
    error,
  };
}

/**
 * useForumPosts — paginated forum posts for a stock
 */
export function useForumPosts(symbol, sort = 'top') {
  const { data, size, setSize, isLoading } = useSWRInfinite(
    (pageIndex, prevData) => {
      if (prevData && !prevData.has_more) return null;
      return symbol ? `/api/forum/posts?symbol=${symbol}&sort=${sort}&page=${pageIndex + 1}&per_page=10` : null;
    },
    fetcher,
    { revalidateFirstPage: true, revalidateOnFocus: false }
  );

  const posts   = data ? data.flatMap(page => page.posts || []) : [];
  const hasMore = data ? data[data.length - 1]?.has_more : false;
  const loadMore = () => setSize(size + 1);

  return { posts, hasMore, loadMore, loading: isLoading };
}

/**
 * useAnalystRatings — analyst target prices and ratings
 */
export function useAnalystRatings(symbol) {
  const { data, error } = useSWR(
    symbol ? `/api/analyst/${symbol}` : null,
    fetcher,
    { dedupingInterval: 86400000 } // 24h
  );
  return { ratings: data?.ratings || [], consensus: data?.consensus, loading: !data && !error, error };
}

/**
 * useEvents — upcoming corporate events (earnings, dividends, AGM)
 */
export function useEvents(symbol) {
  const { data, error } = useSWR(
    symbol ? `/api/events/${symbol}` : null,
    fetcher,
    { dedupingInterval: 3600000 }
  );
  return { events: data?.events || [], loading: !data && !error, error };
}

/**
 * useNews — news articles tagged with a stock symbol
 */
export function useStockNews(symbol, limit = 10) {
  const { data, error } = useSWR(
    symbol ? `/api/news/by-symbol/${symbol}?limit=${limit}` : null,
    fetcher,
    { refreshInterval: 300000 } // 5 min
  );
  return { news: data?.articles || [], loading: !data && !error, error };
}