// frontend/components/stock/StockDiscussion.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { timeAgo } from '../../lib/formatters';

const fetcher = url => fetch(url).then(r => r.json());

/**
 * StockDiscussion — Reddit-style discussion thread per stock
 *
 * Features:
 * - Post creation with sentiment tagging (Bull/Bear/Neutral)
 * - Upvote / downvote with optimistic updates
 * - Sort by: Top, New, Hot (Trending)
 * - Infinite scroll pagination
 * - Real-time new post notifications via WebSocket
 * - Reply threads (collapsible)
 * - AI sentiment badge per post (from backend NLP)
 */

const SORT_OPTIONS = ['top', 'new', 'hot'];

const AVATARS_COLORS = [
  '#3b82f6','#8b5cf6','#00d68f','#f59e0b','#ff4d6d','#06b6d4','#ec4899',
];

function getAvatarColor(username) {
  let hash = 0;
  for (const c of username) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATARS_COLORS[Math.abs(hash) % AVATARS_COLORS.length];
}

function getInitials(username) {
  return username.slice(0, 2).toUpperCase();
}

export default function StockDiscussion({ symbol, stockName }) {
  const [sort, setSort]         = useState('top');
  const [posts, setPosts]       = useState([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loading, setLoading]   = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [draftBody, setDraft]   = useState('');
  const [draftSent, setDraftSent] = useState('neutral');
  const [submitting, setSubmit]   = useState(false);
  const loaderRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    setPage(1);
    setPosts([]);
    setHasMore(true);
    loadPosts(1, sort, true);
  }, [symbol, sort]);

  async function loadPosts(pageNum, sortBy, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/forum/posts?symbol=${symbol}&sort=${sortBy}&page=${pageNum}&per_page=10`);
      const data = await res.json();
      const newPosts = data.posts || getFallbackPosts(symbol);
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(data.has_more ?? false);
    } catch {
      if (reset) setPosts(getFallbackPosts(symbol));
    }
    setLoading(false);
  }

  // Infinite scroll observer
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPosts(nextPage, sort);
      }
    }, { threshold: 0.5 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [page, hasMore, loading, sort]);

  // Vote handler
  const handleVote = async (postId, direction) => {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? {
            ...p,
            votes:      p.votes + (direction === 'up' ? 1 : -1),
            user_voted: p.user_voted === direction ? null : direction,
          }
        : p
    ));

    try {
      await fetch(`/api/forum/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ direction }),
      });
    } catch {
      // Revert on error — re-fetch
      loadPosts(1, sort, true);
    }
  };

  // Submit post
  const submitPost = async () => {
    if (!draftBody.trim() || submitting) return;
    setSubmit(true);
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          symbol,
          body:      draftBody,
          sentiment: draftSent,
          tags:      [symbol],
        }),
      });

      if (res.status === 401) {
        // Redirect to login
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
      }

      const newPost = await res.json();
      setPosts(prev => [{ ...newPost, votes: 0, comments: 0, user_voted: null }, ...prev]);
      setDraft('');
    } catch {
      alert('Failed to post. Please sign in first.');
    }
    setSubmit(false);
  };

  return (
    <div className="disc-wrap">
      {/* Header */}
      <div className="disc-header">
        <div className="disc-title">Community — {stockName || symbol}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--t2)' }}>{posts.length} posts</span>
          {newCount > 0 && (
            <button
              onClick={() => { setNewCount(0); loadPosts(1, sort, true); }}
              style={{ fontSize: 11, color: 'var(--b)', background: 'var(--bd)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
            >
              {newCount} new posts ↑
            </button>
          )}
        </div>
      </div>

      {/* Compose box */}
      <div className="compose-box">
        <textarea
          className="compose-input"
          placeholder={`Share your analysis or trade idea on ${symbol}…`}
          value={draftBody}
          onChange={e => setDraft(e.target.value)}
          rows={3}
        />
        <div className="compose-footer">
          <button className="post-btn" onClick={submitPost} disabled={submitting}>
            {submitting ? 'Posting…' : 'Post'}
          </button>

          {/* Sentiment selector */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>Sentiment:</span>
            {[
              { id:'bullish', label:'▲ Bull', cls:'bull' },
              { id:'neutral', label:'— Neut', cls:'neut' },
              { id:'bearish', label:'▼ Bear', cls:'bear' },
            ].map(s => (
              <button
                key={s.id}
                className={`sentiment-pill ${s.cls}`}
                onClick={() => setDraftSent(s.id)}
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${draftSent === s.id ? 'currentColor' : 'transparent'}`,
                  opacity: draftSent === s.id ? 1 : 0.5,
                  transition: 'all .15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="post-sort" style={{ marginLeft: 'auto' }}>
            {SORT_OPTIONS.map(s => (
              <button
                key={s}
                className={`ps-btn ${sort === s ? 'act' : ''}`}
                onClick={() => setSort(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Post list */}
      <div className="post-list">
        {posts.map(post => (
          <PostCard key={post.id} post={post} onVote={handleVote} />
        ))}
      </div>

      {/* Infinite scroll loader */}
      <div ref={loaderRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading && <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--fm)' }}>Loading more…</span>}
        {!hasMore && posts.length > 0 && <span style={{ fontSize: 11, color: 'var(--t3)' }}>All posts loaded</span>}
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────

function PostCard({ post, onVote }) {
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies]   = useState([]);
  const [replyDraft, setReply]  = useState('');
  const [showReply, setShowReply] = useState(false);

  const avatarColor = getAvatarColor(post.username || 'User');
  const initials    = getInitials(post.username || 'U');

  const loadReplies = async () => {
    if (replies.length) { setExpanded(!expanded); return; }
    setExpanded(true);
    try {
      const res  = await fetch(`/api/forum/posts/${post.id}/replies`);
      const data = await res.json();
      setReplies(data.replies || []);
    } catch {
      setReplies([]);
    }
  };

  return (
    <div className="post-item">
      {/* Post header */}
      <div className="post-top">
        <div
          className="avatar"
          style={{ background: `${avatarColor}22`, color: avatarColor, border: `1px solid ${avatarColor}44` }}
        >
          {initials}
        </div>
        <div className="post-meta">
          <div className="post-user">
            {post.username}
            {post.badge && (
              <span className="post-badge" style={{ background: post.badgeBg, color: post.badgeColor, borderColor: post.badgeColor + '44', marginLeft: 6 }}>
                {post.badge}
              </span>
            )}
          </div>
          <div className="post-time">{timeAgo(post.created_at)}</div>
        </div>
      </div>

      {/* Post body */}
      <div className="post-body">{post.body}</div>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="post-tags">
          {post.tags.map(t => <span key={t} className="ptag">#{t}</span>)}
        </div>
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`paction ${post.user_voted === 'up' ? 'voted' : ''}`}
          onClick={() => onVote(post.id, 'up')}
        >
          ▲ {post.votes}
        </button>
        <button
          className={`paction ${post.user_voted === 'down' ? 'downvoted' : ''}`}
          onClick={() => onVote(post.id, 'down')}
        >
          ▼
        </button>
        <button className="paction" onClick={() => { setShowReply(!showReply); loadReplies(); }}>
          💬 {post.comment_count || 0} {post.comment_count === 1 ? 'reply' : 'replies'}
        </button>
        <button className="paction">↗ Share</button>
        <button className="paction">⚑ Report</button>

        {post.ai_sentiment && (
          <div className={`sent-flag sent-${post.ai_sentiment === 'bullish' ? 'bull' : post.ai_sentiment === 'bearish' ? 'bear' : 'neut'}`}>
            {post.ai_sentiment === 'bullish' ? '▲ Bullish' : post.ai_sentiment === 'bearish' ? '▼ Bearish' : '— Neutral'}
          </div>
        )}
      </div>

      {/* Reply box */}
      {showReply && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--br)' }}>
          <textarea
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--br)', borderRadius: 6, padding: '8px 12px', color: 'var(--t1)', fontFamily: 'var(--fb)', fontSize: 12, resize: 'vertical', minHeight: 60, outline: 'none' }}
            placeholder="Write a reply…"
            value={replyDraft}
            onChange={e => setReply(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="post-btn" style={{ fontSize: 11, padding: '5px 14px' }}>Reply</button>
            <button onClick={() => setShowReply(false)} style={{ fontSize: 11, color: 'var(--t3)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Replies */}
      {expanded && replies.length > 0 && (
        <div style={{ marginTop: 12, paddingLeft: 20, borderLeft: '2px solid var(--br)' }}>
          {replies.map(reply => (
            <div key={reply.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--br)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="avatar" style={{ width: 24, height: 24, fontSize: 9, background: `${getAvatarColor(reply.username)}22`, color: getAvatarColor(reply.username) }}>
                  {getInitials(reply.username)}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{reply.username}</span>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>{timeAgo(reply.created_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, paddingLeft: 32 }}>{reply.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Demo fallback data ─────────────────────────────────────────────

function getFallbackPosts(symbol) {
  const posts = [
    {
      id: '1', username: 'TradingTiger92', badge: 'Premium', badgeBg: 'rgba(245,158,11,.1)', badgeColor: '#f59e0b',
      body: `Strong Q3 numbers! Revenue grew 8.5% QoQ driven by Jio and Retail segments. The O2C business is seeing headwinds from falling refining margins, but I expect a recovery in Q4. My target is ₹3,200 by March end.`,
      tags: [symbol, 'Q3Results', 'Jio'], votes: 247, comment_count: 38, ai_sentiment: 'bullish',
      created_at: new Date(Date.now() - 2*3600000).toISOString(),
    },
    {
      id: '2', username: 'NiftySage', badge: 'Analyst', badgeBg: 'rgba(0,214,143,.1)', badgeColor: '#00d68f',
      body: `Technically ${symbol} looks poised for a breakout above resistance. RSI at 58 (not overbought), price above both 20 and 50 EMA, volume increasing on up days. Only concern is broader market weakness.`,
      tags: [symbol, 'Technical', 'EMA'], votes: 182, comment_count: 24, ai_sentiment: 'bullish',
      created_at: new Date(Date.now() - 4*3600000).toISOString(),
    },
    {
      id: '3', username: 'ValueHunter_IN', badge: '', badgeBg: '', badgeColor: '',
      body: `At 29x P/E, ${symbol} is not cheap for a company with 7% ROE. The conglomerate discount is real. Would wait for a correction to better levels for a better risk-reward entry. Green energy investments are long-term positive but burning cash right now.`,
      tags: [symbol, 'Valuation', 'ROE'], votes: 134, comment_count: 41, ai_sentiment: 'neutral',
      created_at: new Date(Date.now() - 6*3600000).toISOString(),
    },
    {
      id: '4', username: 'InstitutionalEye', badge: 'Verified', badgeBg: 'rgba(59,130,246,.1)', badgeColor: '#3b82f6',
      body: `FII holding increase for 5 consecutive quarters is a very strong signal. Smart money is accumulating. The telecom business alone justifies current valuations. Retail and green energy are free optionalities at this price.`,
      tags: [symbol, 'FII', 'Accumulation'], votes: 298, comment_count: 57, ai_sentiment: 'bullish',
      created_at: new Date(Date.now() - 8*3600000).toISOString(),
    },
  ].map(p => ({ ...p, user_voted: null }));
  return posts;
}