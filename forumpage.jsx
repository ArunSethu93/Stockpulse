// frontend/components/forum/ForumPage.jsx
'use client';

import { useState, useCallback } from 'react';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import CommentThread from './CommentThread';
import ModerationPanel from './ModerationPanel';
import { useForumFeed, useForumCategories } from '../../hooks/useForum';

/**
 * ForumPage — master community forum layout
 *
 * Routes:
 * /forum             → feed (hot/new/top/rising)
 * /forum/post/:id    → single post + comments
 * /forum/category/:c → category filtered feed
 * /forum/stock/:sym  → stock-tagged posts
 *
 * Auth-gated actions: post, comment, vote (redirect to /login)
 */

const SORT_OPTIONS = [
  { id:'hot',    label:'🔥 Hot'     },
  { id:'new',    label:'🆕 New'     },
  { id:'top',    label:'⬆ Top'     },
  { id:'rising', label:'📈 Rising'  },
];

const CATEGORIES = [
  { id:'all',       label:'All Posts',        color:'var(--b)',  icon:'◉' },
  { id:'analysis',  label:'Analysis',          color:'var(--b)',  icon:'●' },
  { id:'technical', label:'Technical',         color:'var(--g)',  icon:'●' },
  { id:'macro',     label:'Macro & Economy',   color:'var(--am)', icon:'●' },
  { id:'ipo',       label:'IPO Watch',         color:'var(--pu)', icon:'●' },
  { id:'results',   label:'Results & Earnings',color:'var(--cy)', icon:'●' },
  { id:'beginner',  label:'Beginner Q&A',      color:'var(--pi)', icon:'●' },
];

export default function ForumPage({ initialSymbol, initialCategory, initialPostId }) {
  const [sort, setSort]                 = useState('hot');
  const [category, setCategory]         = useState(initialCategory || 'all');
  const [stockFilter, setStockFilter]   = useState(initialSymbol || null);
  const [openPostId, setOpenPostId]     = useState(initialPostId || null);
  const [showModPanel, setModPanel]     = useState(false);
  const [newPostFlash, setNewPostFlash] = useState(null);

  const { posts, hasMore, loadMore, loading, total } =
    useForumFeed({ sort, category, symbol: stockFilter });

  const handleNewPost = useCallback((post) => {
    setNewPostFlash(post.id);
    setTimeout(() => setNewPostFlash(null), 3000);
  }, []);

  const clearStockFilter = () => setStockFilter(null);

  return (
    <div className="forum-page">

      {/* Forum stats header */}
      <ForumHeader onModClick={() => setModPanel(true)} />

      {/* Post composer */}
      <PostComposer onSubmit={handleNewPost} />

      {/* Sort + filter bar */}
      <div className="sort-bar">
        <div className="sort-tabs">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`stab ${sort === opt.id ? 'act' : ''}`}
              onClick={() => setSort(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {stockFilter && (
          <div className="active-filter" onClick={clearStockFilter}>
            <span>{stockFilter}</span>
            <span>✕</span>
          </div>
        )}

        <span className="post-count">{total?.toLocaleString()} posts</span>
      </div>

      {/* Posts feed */}
      {loading && !posts.length ? (
        <PostsSkeleton />
      ) : (
        <>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isNew={post.id === newPostFlash}
              onOpen={() => setOpenPostId(post.id)}
              onStockClick={setStockFilter}
            />
          ))}

          {hasMore && (
            <button className="load-more-btn" onClick={loadMore} disabled={loading}>
              {loading ? 'Loading…' : '↓ Load more posts'}
            </button>
          )}

          {!posts.length && (
            <EmptyState category={category} stockFilter={stockFilter} />
          )}
        </>
      )}

      {/* Single post modal */}
      {openPostId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpenPostId(null)}>
          <div className="modal" style={{ maxWidth: 820 }}>
            <CommentThread postId={openPostId} onClose={() => setOpenPostId(null)} />
          </div>
        </div>
      )}

      {/* Moderation panel */}
      {showModPanel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModPanel(false)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <ModerationPanel onClose={() => setModPanel(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forum header ──────────────────────────────────────────────────

function ForumHeader({ onModClick }) {
  return (
    <div className="forum-hdr">
      <div className="fh-top">
        <div>
          <div className="fh-title">StockPulse Community</div>
          <div className="fh-sub">Discuss stocks, share analysis, and learn from fellow traders</div>
        </div>
        <div className="fh-stats">
          {[
            { val:'48,291', label:'Members'    },
            { val:'2,847',  label:'Online Now', color:'var(--g)' },
            { val:'1.2M',   label:'Total Posts' },
          ].map(s => (
            <div key={s.label} className="fhs">
              <div className="fhs-val" style={{ color: s.color }}>{s.val}</div>
              <div className="fhs-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="fh-actions">
        <span className="live-badge"><span className="live-dot" />LIVE</span>
        <span style={{ fontSize:11, color:'var(--t3)' }}>247 new posts today · 5 trending</span>
        <button className="abtn abtn-buy" style={{ marginLeft:'auto' }}>✎ New Post</button>
        <button className="abtn abtn-watch" onClick={onModClick}>⚑ Mod Queue</button>
      </div>
    </div>
  );
}

function PostsSkeleton() {
  return (
    <div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="post-card" style={{ height: 120, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

function EmptyState({ category, stockFilter }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t3)' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>◉</div>
      <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>
        No posts yet
      </div>
      <div style={{ fontSize:12, marginBottom:20 }}>
        {stockFilter
          ? `No discussions tagged with ${stockFilter}. Be the first to post!`
          : `No posts in "${category}" yet. Start the conversation!`}
      </div>
    </div>
  );
}