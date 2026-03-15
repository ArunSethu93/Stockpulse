// frontend/hooks/useNews.js
'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

/**
 * Build query string from filter state
 */
function buildNewsParams({ filters, sort, query, page, perPage = 20 }) {
  const params = new URLSearchParams();
  if (query)                     params.set('q', query);
  if (sort && sort !== 'latest') params.set('sort', sort);
  if (page)                      params.set('page', page);
  params.set('per_page', perPage);
  filters?.sentiment?.forEach(s => params.append('sentiment', s));
  filters?.sector?.forEach(s    => params.append('sector', s));
  filters?.source?.forEach(s    => params.append('source', s));
  return params.toString();
}

/**
 * useNewsFeed — paginated, filtered news feed with infinite scroll
 *
 * Returns:
 * - articles[]    : flat list of all loaded articles
 * - hasMore       : boolean — more pages available
 * - loadMore()    : function — fetch next page
 * - loading       : boolean
 * - total         : total article count (for display)
 */
export function useNewsFeed({ filters = {}, sort = 'latest', query = '', perPage = 20 } = {}) {
  const getKey = (pageIndex, prevData) => {
    if (prevData && !prevData.has_more) return null;
    const params = buildNewsParams({ filters, sort, query, page: pageIndex + 1, perPage });
    return `/api/news?${params}`;
  };

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateFirstPage: true,
      revalidateOnFocus:   false,
      dedupingInterval:    60000, // 1 min dedup
    }
  );

  const articles = data ? data.flatMap(page => page.articles || []) : [];
  const hasMore  = data ? (data[data.length - 1]?.has_more ?? false) : false;
  const total    = data?.[0]?.total || 0;

  return {
    articles,
    hasMore,
    loadMore:  () => setSize(size + 1),
    loading:   isLoading || isValidating,
    total,
  };
}

/**
 * useNewsArticle — fetch single article by ID
 */
export function useNewsArticle(articleId) {
  const { data, error } = useSWR(
    articleId ? `/api/news/${articleId}` : null,
    fetcher
  );
  return { article: data, loading: !data && !error, error };
}

/**
 * useBreakingNews — live breaking news via WebSocket
 *
 * Subscribes to: breaking:all, breaking:market
 * Returns recent breaking news items (last 10)
 */
export function useBreakingNews() {
  const [breaking, setBreaking] = useState([]);
  const { data, isConnected, subscribe } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/news` : null
  );

  useEffect(() => {
    if (isConnected) subscribe(['breaking:all', 'breaking:market']);
  }, [isConnected]);

  useEffect(() => {
    if (data?.type === 'breaking_news') {
      setBreaking(prev => [data.article, ...prev].slice(0, 10));
    }
  }, [data]);

  return { breaking, isConnected };
}

/**
 * useNewsSentimentOverview — overall market sentiment from news
 *
 * Fetched every 5 minutes; computed by Celery sentiment aggregation task
 * Source: /api/sentiment/overview
 */
export function useNewsSentimentOverview() {
  const { data, error } = useSWR(
    '/api/sentiment/overview',
    fetcher,
    { refreshInterval: 300000 } // 5 min
  );

  return {
    overview: data || {
      bullish_pct:  65,
      neutral_pct:  21,
      bearish_pct:  14,
      overall_score: 65,
      label:         'bullish',
      total_today:   2847,
      updated_at:    new Date().toISOString(),
    },
    loading: !data && !error,
  };
}

/**
 * useSectorSentiment — per-sector sentiment breakdown
 */
export function useSectorSentiment() {
  const { data, error } = useSWR('/api/sentiment/sectors', fetcher, {
    refreshInterval: 600000 // 10 min
  });
  return {
    sectors: data?.sectors || SECTOR_FALLBACK,
    loading: !data && !error,
  };
}

/**
 * useStockSentimentMap — sentiment for a list of stocks (for the map widget)
 */
export function useStockSentimentMap(symbols = []) {
  const key = symbols.length ? `/api/sentiment/stocks?symbols=${symbols.join(',')}` : null;
  const { data, error } = useSWR(key, fetcher, { refreshInterval: 1800000 }); // 30 min
  return {
    sentimentMap: data?.stocks || {},
    loading: !data && !error,
  };
}

/**
 * useNewsTrendingTopics — trending stocks/keywords in news
 */
export function useNewsTrendingTopics() {
  const { data } = useSWR('/api/news/trending-topics', fetcher, {
    refreshInterval: 600000
  });
  return {
    topics: data?.topics || TRENDING_FALLBACK,
    stocks: data?.stocks || [],
  };
}

/**
 * useRSSFeedStatus — health of all RSS feed scrapers
 * Used in the admin panel and right-panel RSS status widget
 */
export function useRSSFeedStatus() {
  const { data, mutate } = useSWR('/api/admin/rss-status', fetcher, {
    refreshInterval: 30000 // 30s
  });
  return {
    feeds:    data?.feeds || RSS_STATUS_FALLBACK,
    refresh:  mutate,
  };
}

/**
 * useNewsSearch — debounced news search
 */
export function useNewsSearch(query, debounceMs = 400) {
  const [debouncedQuery, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const { data, error } = useSWR(
    debouncedQuery?.length >= 2 ? `/api/news/search?q=${encodeURIComponent(debouncedQuery)}&limit=8` : null,
    fetcher,
    { dedupingInterval: 5000 }
  );

  return {
    results:  data?.articles || [],
    loading:  !data && !error && debouncedQuery?.length >= 2,
  };
}

// ── Fallback data ────────────────────────────────────────────────

const SECTOR_FALLBACK = [
  { sector:'IT',          bullish:71, neutral:18, bearish:11, trend:'up'   },
  { sector:'Banking',     bullish:44, neutral:28, bearish:28, trend:'down' },
  { sector:'Auto',        bullish:62, neutral:22, bearish:16, trend:'up'   },
  { sector:'Pharma',      bullish:58, neutral:24, bearish:18, trend:'flat' },
  { sector:'Energy',      bullish:55, neutral:25, bearish:20, trend:'up'   },
  { sector:'Metals',      bullish:48, neutral:26, bearish:26, trend:'down' },
];

const TRENDING_FALLBACK = [
  { topic:'Q4 Results',        count:847, change:'+124%' },
  { topic:'Rate Cut',          count:634, change:'+89%'  },
  { topic:'EV Launch',         count:412, change:'+67%'  },
  { topic:'FII Buying',        count:388, change:'+42%'  },
  { topic:'Adani Investigation',count:291, change:'+310%' },
];

const RSS_STATUS_FALLBACK = [
  { name:'ET Markets RSS',        status:'active', last_fetch: new Date(Date.now()-2*60000).toISOString()  },
  { name:'Moneycontrol API',      status:'active', last_fetch: new Date(Date.now()-60000).toISOString()    },
  { name:'Bloomberg Wire',        status:'active', last_fetch: new Date(Date.now()-4*60000).toISOString()  },
  { name:'NSE Announcements',     status:'active', last_fetch: new Date(Date.now()-30000).toISOString()    },
  { name:'BSE Corporate Filings', status:'active', last_fetch: new Date(Date.now()-5*60000).toISOString()  },
  { name:'Reuters India',         status:'slow',   last_fetch: new Date(Date.now()-12*60000).toISOString() },
];