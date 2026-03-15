// frontend/components/news/NewsFeed.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import NewsCard from './NewsCard';
import NewsFilters from './NewsFilters';
import NewsArticleModal from './NewsArticleModal';
import BreakingNewsBanner from './BreakingNewsBanner';
import { useNewsFeed, useBreakingNews, useNewsSentimentOverview } from '../../hooks/useNews';

/**
 * NewsFeed — Main news aggregation page
 *
 * Layout:
 * - BreakingNewsBanner (fixed strip above ticker)
 * - FilterBar (sector, sentiment, source chips)
 * - StatsBar (total, bullish, bearish, high-impact counts)
 * - Featured article card
 * - Categorized news grids (Market Moving / Earnings / Economy)
 * - Infinite scroll via IntersectionObserver
 *
 * Data flow:
 * - useNewsFeed() → SWR paginated fetch from /api/news
 * - useBreakingNews() → WebSocket subscription to breaking:* channel
 * - Filtering/sorting happens client-side for instant UX
 */

const SORT_OPTIONS = [
  { value: 'latest',   label: 'Latest First'  },
  { value: 'trending', label: 'Trending'       },
  { value: 'bullish',  label: 'Most Bullish'   },
  { value: 'bearish',  label: 'Most Bearish'   },
  { value: 'impact',   label: 'Market Impact'  },
];

const VIEW_MODES = ['grid', 'list'];

export default function NewsFeed() {
  const [filters, setFilters]     = useState({ sentiment:[], sector:[], source:[] });
  const [sort, setSort]           = useState('latest');
  const [view, setView]           = useState('grid');
  const [query, setQuery]         = useState('');
  const [selectedArticle, select] = useState(null);

  const { articles, hasMore, loadMore, loading, total } = useNewsFeed({ filters, sort, query });
  const { breaking }   = useBreakingNews();
  const { overview }   = useNewsSentimentOverview();

  const handleFilterChange = useCallback((type, value) => {
    setFilters(prev => {
      const current = prev[type];
      if (value === 'All') return { ...prev, [type]: [] };
      const exists = current.includes(value);
      return { ...prev, [type]: exists ? current.filter(v => v !== value) : [...current, value] };
    });
  }, []);

  // Group articles by category
  const grouped = groupArticles(articles);

  return (
    <div className="news-feed-page">
      {/* Breaking news banner is rendered inside AppLayout */}

      {/* Page header */}
      <div className="page-hdr">
        <div>
          <h1 className="page-title">Financial News Feed</h1>
          <LiveUpdateClock total={total} />
        </div>
        <div className="hdr-right">
          {/* View toggle */}
          <div className="view-toggle">
            {VIEW_MODES.map(v => (
              <button key={v} className={`vtbtn ${view === v ? 'act' : ''}`} onClick={() => setView(v)}>
                {v === 'grid' ? '⊞ Grid' : '☰ List'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Stats bar */}
      <NewsStatsBar articles={articles} overview={overview} />

      {/* Filters */}
      <NewsFilters
        filters={filters}
        onChange={handleFilterChange}
        query={query}
        onSearch={setQuery}
        count={articles.length}
        total={total}
      />

      {/* Featured article */}
      {grouped.featured && (
        <FeaturedArticle article={grouped.featured} onOpen={select} />
      )}

      {/* Categorized sections */}
      {[
        { key: 'market',   title: 'Market Moving', dot: 'var(--r)' },
        { key: 'earnings', title: 'Earnings & Results', dot: 'var(--g)' },
        { key: 'economy',  title: 'Economy & Policy', dot: 'var(--am)' },
        { key: 'global',   title: 'Global Markets', dot: 'var(--cy)' },
      ].map(sec => (
        <NewsSection
          key={sec.key}
          title={sec.title}
          dot={sec.dot}
          articles={grouped[sec.key] || []}
          view={view}
          onSelect={select}
        />
      ))}

      {/* Load more */}
      {hasMore && (
        <button className="load-more-btn" onClick={loadMore} disabled={loading}>
          {loading ? 'Loading…' : '↓ Load more articles'}
        </button>
      )}

      {/* Article modal */}
      {selectedArticle && (
        <NewsArticleModal article={selectedArticle} onClose={() => select(null)} />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function NewsStatsBar({ articles, overview }) {
  const bull = articles.filter(a => a.sentiment === 'bullish').length;
  const bear = articles.filter(a => a.sentiment === 'bearish').length;
  const highImpact = articles.filter(a => a.impact_score >= 75).length;

  return (
    <div className="stats-bar">
      <div className="stats-cell">
        <div className="stats-lbl">Articles Today</div>
        <div className="stats-val">{(overview?.total_today || 2847).toLocaleString()}</div>
        <div className="stats-sub">↑ 12% vs yesterday</div>
      </div>
      <div className="stats-cell">
        <div className="stats-lbl">Bullish Stories</div>
        <div className="stats-val positive">{bull}</div>
        <div className="stats-sub positive">in current view</div>
      </div>
      <div className="stats-cell">
        <div className="stats-lbl">Bearish Stories</div>
        <div className="stats-val negative">{bear}</div>
        <div className="stats-sub negative">in current view</div>
      </div>
      <div className="stats-cell">
        <div className="stats-lbl">High Impact</div>
        <div className="stats-val" style={{ color: 'var(--am)' }}>{highImpact}</div>
        <div className="stats-sub">score ≥ 75/100</div>
      </div>
    </div>
  );
}

function FeaturedArticle({ article, onOpen }) {
  return (
    <div className="featured-article" onClick={() => onOpen(article)}>
      <div className="featured-label">⭐ Featured Story</div>
      <div className="featured-title">{article.title}</div>
      <div className="featured-summary">{article.summary}</div>
      <div className="featured-meta">
        <SourceBadge source={article.source} sourceId={article.source_id} />
        <span className="ntime">{article.time_ago}</span>
        <span className="ncat">{article.category}</span>
        <SentimentPill sentiment={article.sentiment} score={article.sentiment_score} />
        <StockTags stocks={article.stocks} />
      </div>
    </div>
  );
}

function NewsSection({ title, dot, articles, view, onSelect }) {
  if (!articles.length) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div className="news-section-title">
        <div className="nst-dot" style={{ background: dot }} />
        <div className="nst-text">{title}</div>
        <div className="nst-line" />
        <div className="nst-count">{articles.length} articles</div>
      </div>
      <div className={`news-grid ${view === 'list' ? 'list-view' : ''}`}>
        {articles.map((article, i) => (
          <NewsCard key={article.id} article={article} rank={i + 1} view={view} onOpen={onSelect} />
        ))}
      </div>
    </section>
  );
}

function LiveUpdateClock({ total }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="page-sub">
      <span className="livedot" style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:'var(--r)', animation:'bk 1s ease-in-out infinite', marginRight:5 }} />
      Updated {time} IST · {(total || 12847).toLocaleString()} articles indexed
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────

export function SourceBadge({ source, sourceId }) {
  const SOURCE_COLORS = {
    'et': '#3b82f6', 'mc': '#00d68f', 'bl': '#f59e0b',
    'nse': '#8b5cf6', 'bse': '#ec4899', 'livemint': '#06b6d4',
    'bs': '#ff4d6d', 'reuters': '#f59e0b',
  };
  const color = SOURCE_COLORS[sourceId] || '#8b9ab0';
  return (
    <span
      className="source-badge"
      style={{ color, background: `${color}18`, borderColor: `${color}44` }}
    >
      {source}
    </span>
  );
}

export function SentimentPill({ sentiment, score }) {
  const cls = sentiment === 'bullish' ? 'sp-bull' : sentiment === 'bearish' ? 'sp-bear' : 'sp-neut';
  const arrow = sentiment === 'bullish' ? '▲' : sentiment === 'bearish' ? '▼' : '—';
  return (
    <span className={`sent-pill ${cls}`}>
      {arrow} {sentiment?.charAt(0).toUpperCase() + sentiment?.slice(1)}
      {score != null && <span className="sp-score"> · {score}</span>}
    </span>
  );
}

export function StockTags({ stocks = [], max = 3, onClick }) {
  return (
    <div className="stock-tags">
      {stocks.slice(0, max).map(sym => (
        <span
          key={sym}
          className="stag"
          style={{ background: 'var(--bg3)', color: 'var(--t3)', border: '1px solid var(--br)' }}
          onClick={e => { e.stopPropagation(); onClick?.(sym); }}
        >
          {sym}
        </span>
      ))}
    </div>
  );
}

// ── Group articles by category ────────────────────────────────────

function groupArticles(articles) {
  return {
    featured: articles.find(a => a.is_featured) || articles[0],
    market:   articles.filter(a => ['Markets','Commodities'].includes(a.category)),
    earnings: articles.filter(a => a.category === 'Earnings'),
    economy:  articles.filter(a => ['Economy','Regulation','Policy'].includes(a.category)),
    global:   articles.filter(a => a.category === 'Global'),
  };
}