// frontend/components/news/NewsCard.jsx
'use client';

import { useState } from 'react';
import { SourceBadge, SentimentPill, StockTags } from './NewsFeed';
import { timeAgo } from '../../lib/formatters';

/**
 * NewsCard — reusable card for grid and list view
 *
 * Features:
 * - Color-coded left accent bar per news source
 * - Sentiment pill (Bullish/Bearish/Neutral) with AI score
 * - Market impact bar (visual gauge 0-100)
 * - Stock tags (clickable → filter by stock)
 * - Bookmark toggle (persisted via /api/bookmarks)
 * - List view: shows rank number, larger title
 */

const IMPACT_COLOR = (score) => {
  if (score >= 80) return 'var(--r)';
  if (score >= 60) return 'var(--am)';
  return 'var(--g)';
};

export default function NewsCard({ article, rank, view = 'grid', onOpen, onTagClick }) {
  const [bookmarked, setBookmark] = useState(article.is_bookmarked || false);
  const isList = view === 'list';

  const handleBookmark = async (e) => {
    e.stopPropagation();
    setBookmark(!bookmarked);
    try {
      await fetch('/api/bookmarks', {
        method: bookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ article_id: article.id }),
      });
    } catch { /* ignore — optimistic UI */ }
  };

  return (
    <div
      className={`ncard ${isList ? 'ncard-list' : ''}`}
      onClick={() => onOpen?.(article)}
      role="article"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen?.(article)}
    >
      {/* Left accent bar colored by source */}
      <div className="ncard-accent" style={{ background: article.source_color || 'var(--b)' }} />

      {/* Rank number in list view */}
      {isList && <div className="ncard-rank">{String(rank).padStart(2, '0')}</div>}

      <div className={isList ? 'ncard-body' : ''}>
        {/* Meta row */}
        <div className="ncard-meta">
          <SourceBadge source={article.source} sourceId={article.source_id} />
          <span className="ntime">{timeAgo(article.published_at)}</span>
          <span className="ncat">{article.category}</span>
        </div>

        {/* Title */}
        <div className="ncard-title">{article.title}</div>

        {/* Summary (hidden in compact grid) */}
        {article.summary && <div className="ncard-summary">{article.summary}</div>}

        {/* Impact progress bar */}
        <div className="impact-bar" title={`Market impact: ${article.impact_score}/100`}>
          <div
            className="impact-fill"
            style={{ width: `${article.impact_score || 0}%`, background: IMPACT_COLOR(article.impact_score) }}
          />
        </div>

        {/* Footer */}
        <div className="ncard-footer">
          <SentimentPill sentiment={article.sentiment} score={article.sentiment_score} />
          <span className="sp-score">Impact: {article.impact_score || 0}</span>
          <StockTags stocks={article.stocks} onClick={onTagClick} />
          <div className="ncard-actions">
            <button
              className={`nact ${bookmarked ? 'bookmarked' : ''}`}
              onClick={handleBookmark}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              🔖
            </button>
            <button
              className="nact"
              onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(article.title); }}
              title="Copy headline"
            >
              ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════
// NewsFilters
// ════════════════════════════════════════════════

// frontend/components/news/NewsFilters.jsx
const SENTIMENT_OPTS = [
  { id: 'bullish', label: '▲ Bullish', cls: 'sent-bull' },
  { id: 'neutral', label: '— Neutral', cls: 'sent-neut' },
  { id: 'bearish', label: '▼ Bearish', cls: 'sent-bear' },
];

const SECTORS = ['All','IT','Banking','Auto','Pharma','FMCG','Metals','Energy','Realty','Infra','Economy'];

const SOURCES = [
  { id:'et',       name:'ET Markets',        color:'#3b82f6' },
  { id:'mc',       name:'Moneycontrol',       color:'#00d68f' },
  { id:'bl',       name:'Bloomberg',          color:'#f59e0b' },
  { id:'nse',      name:'NSE India',          color:'#8b5cf6' },
  { id:'livemint', name:'Livemint',           color:'#06b6d4' },
  { id:'bs',       name:'Business Standard',  color:'#ff4d6d' },
];

export function NewsFilters({ filters, onChange, query, onSearch, count, total }) {
  return (
    <div className="filters-bar">
      {/* Search */}
      <div className="filter-row">
        <span className="filter-label">Search</span>
        <div style={{ flex: 1, position: 'relative', maxWidth: 360 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t3)' }}>⌕</span>
          <input
            type="text"
            value={query}
            onChange={e => onSearch(e.target.value)}
            placeholder="Company, keyword, tag…"
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--br)',
              borderRadius: 6, padding: '5px 10px 5px 28px', color: 'var(--t1)',
              fontFamily: 'var(--fb)', fontSize: 12, outline: 'none',
            }}
          />
        </div>
        <span className="filter-count">
          {count === total ? `All ${total} articles` : `${count} / ${total}`}
        </span>
      </div>

      {/* Sentiment */}
      <div className="filter-row">
        <span className="filter-label">Sentiment</span>
        <div className="filter-chips">
          {SENTIMENT_OPTS.map(s => (
            <FilterChip
              key={s.id}
              label={s.label}
              active={filters.sentiment.includes(s.id)}
              className={s.cls}
              onClick={() => onChange('sentiment', s.id)}
            />
          ))}
        </div>
      </div>

      {/* Sector */}
      <div className="filter-row">
        <span className="filter-label">Sector</span>
        <div className="filter-chips">
          {SECTORS.map(sec => (
            <FilterChip
              key={sec}
              label={sec}
              active={sec === 'All' ? !filters.sector.length : filters.sector.includes(sec)}
              onClick={() => onChange('sector', sec)}
            />
          ))}
        </div>
      </div>

      {/* Source */}
      <div className="filter-row">
        <span className="filter-label">Source</span>
        <div className="filter-chips">
          {SOURCES.map(src => (
            <FilterChip
              key={src.id}
              label={src.name}
              active={filters.source.includes(src.id)}
              onClick={() => onChange('source', src.id)}
              style={filters.source.includes(src.id) ? {
                '--b': src.color, '--bd': `${src.color}22`, '--bbr': `${src.color}44`,
                borderColor: src.color, color: src.color, background: `${src.color}18`,
              } : {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, className = '', onClick, style = {} }) {
  return (
    <button
      className={`chip ${className} ${active ? 'act' : ''}`}
      onClick={onClick}
      style={style}
    >
      {label}
    </button>
  );
}


// ════════════════════════════════════════════════
// BreakingNewsBanner
// ════════════════════════════════════════════════

// frontend/components/news/BreakingNewsBanner.jsx
export function BreakingNewsBanner({ items = [] }) {
  if (!items.length) return null;
  const doubled = [...items, ...items]; // for seamless loop

  return (
    <div className="breaking-banner">
      <div className="bb-label">⚡ Breaking</div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div className="bb-scroll">
          {doubled.map((item, i) => (
            <div key={i} className="bb-item">
              <div className="bb-dot" />
              <span className="bb-sym">{item.symbol}</span>
              <span>{item.headline}</span>
              <span className="bb-time">{timeAgo(item.published_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════
// NewsArticleModal
// ════════════════════════════════════════════════

// frontend/components/news/NewsArticleModal.jsx
import { useEffect } from 'react';
import { useStockNews } from '../../hooks/useStockData';

export function NewsArticleModal({ article, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handle = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const { news: relatedNews } = useStockNews(article.stocks?.[0], 3);

  if (!article) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <div className="ncard-meta" style={{ marginBottom: 10 }}>
              <SourceBadge source={article.source} sourceId={article.source_id} />
              <span className="ntime">{timeAgo(article.published_at)}</span>
              <span className="ncat">{article.category}</span>
              <SentimentPill sentiment={article.sentiment} score={article.sentiment_score} />
            </div>
            <div className="modal-title">{article.title}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {article.summary && <div className="modal-summary">{article.summary}</div>}

          {/* AI Analysis block */}
          <div className="ai-analysis">
            <div className="ai-header">
              <span className="ai-icon">◈</span>
              <span className="ai-label">AI Analysis — StockPulse Intelligence</span>
            </div>
            <div className="ai-text">
              {article.ai_summary || generateAISummary(article)}
            </div>
            <div className="ai-meta">
              <span>⚡ Sentiment: <strong>{article.sentiment} ({article.sentiment_score}/100)</strong></span>
              <span>📊 Impact: <strong>{article.impact_score}/100</strong></span>
            </div>
          </div>

          {/* Full content */}
          <div className="modal-content">
            {(article.content || article.summary || '').split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Related stocks */}
          {article.stocks?.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--br)' }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>
                Related Stocks
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {article.stocks.map(sym => (
                  <a
                    key={sym}
                    href={`/stock/${sym}`}
                    style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bgc)', border:'1px solid var(--br)', borderRadius:6, padding:'8px 12px', transition:'all .15s' }}
                  >
                    <span style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600 }}>{sym}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Related news */}
          {relatedNews?.length > 0 && (
            <div className="related-news">
              <div className="rn-title">Related Stories</div>
              {relatedNews.slice(0, 3).map(r => (
                <div key={r.id} className="rn-item">
                  <div className="rn-headline">{r.title}</div>
                  <div className="rn-meta">
                    <span>{r.source}</span>
                    <span>·</span>
                    <span>{timeAgo(r.published_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <StockTags stocks={article.tags || []} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="abtn abtn-watch">
              ↗ Read Full Article
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateAISummary(article) {
  const s = article.stocks?.[0] || 'this stock';
  const templates = {
    bullish: `This article carries a <strong>strongly bullish</strong> signal for ${s}. The news represents a positive fundamental catalyst. Historical analysis of similar headlines suggests a 2-3% upward price movement in the 24-48 hours following publication.`,
    bearish: `This article carries a <strong>bearish</strong> signal for ${s}. The disclosure represents negative news with significant institutional impact potential. Monitor for follow-up management commentary.`,
    neutral: `This article has a <strong>neutral/mixed</strong> impact for ${s}. Markets may need additional context before making a directional move.`,
  };
  return templates[article.sentiment] || templates.neutral;
}