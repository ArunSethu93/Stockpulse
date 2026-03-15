// frontend/hooks/useForum.js
'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useState, useCallback, useOptimistic } from 'react';
import { useWebSocket } from './useWebSocket';

const fetcher = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

// ── useForumFeed ──────────────────────────────────────────────────
/**
 * Paginated forum feed with sort, category, and stock filter
 *
 * Endpoint: GET /api/forum/posts
 * Query params: sort, category, symbol, page, per_page
 */
export function useForumFeed({ sort = 'hot', category = 'all', symbol, perPage = 20 } = {}) {
  const getKey = (pageIndex, prevData) => {
    if (prevData && !prevData.has_more) return null;
    const params = new URLSearchParams({ sort, page: pageIndex + 1, per_page: perPage });
    if (category && category !== 'all') params.set('category', category);
    if (symbol) params.set('symbol', symbol);
    return `/api/forum/posts?${params}`;
  };

  const { data, size, setSize, isLoading } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: true,
    revalidateOnFocus:   false,
    dedupingInterval:    30000,
  });

  const posts   = data ? data.flatMap(p => p.posts || []) : [];
  const hasMore = data?.[data.length - 1]?.has_more ?? false;
  const total   = data?.[0]?.total ?? 0;

  return { posts, hasMore, loadMore: () => setSize(size + 1), loading: isLoading, total };
}

// ── usePost ───────────────────────────────────────────────────────
/**
 * Single post with full body
 */
export function usePost(postId) {
  const { data, error, mutate } = useSWR(
    postId ? `/api/forum/posts/${postId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { post: data, loading: !data && !error, error, refresh: mutate };
}

// ── useComments ───────────────────────────────────────────────────
/**
 * Nested comment tree for a post
 * Refreshes every 30s to show new comments
 * Also listens for real-time comment events via WebSocket
 */
export function useComments(postId) {
  const { data, error, mutate } = useSWR(
    postId ? `/api/forum/posts/${postId}/comments` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: wsData } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL
      ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/forum`
      : null,
    { subscriptions: [`post:${postId}:comments`] }
  );

  // Apply live comment update
  if (wsData?.type === 'new_comment' && wsData.post_id === postId) {
    mutate(); // revalidate
  }

  const submitComment = async ({ body, sentiment = 'neutral', parentId }) => {
    const res = await fetch(`/api/forum/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body, sentiment, parent_id: parentId }),
    });
    if (res.status === 401) { window.location.href = '/login'; throw new Error('Auth required'); }
    if (!res.ok) throw new Error(await res.text());
    mutate();
    return res.json();
  };

  return {
    comments:  data?.comments || [],
    loading:   !data && !error,
    error,
    submitComment,
    refresh:   mutate,
  };
}

// ── useVote ───────────────────────────────────────────────────────
/**
 * Optimistic voting hook for posts and comments
 *
 * Returns the current vote state and a vote() function.
 * Immediately updates UI, then calls API. Reverts on failure.
 */
export function useVote(entityId, initialScore, initialVote, entityType = 'post') {
  const [score, setScore]     = useState(initialScore ?? 0);
  const [userVote, setVote]   = useState(initialVote ?? null);

  const vote = useCallback(async (direction) => {
    // Optimistic update
    const wasVoted = userVote === direction;
    const prevScore = score;
    const prevVote  = userVote;

    if (wasVoted) {
      setScore(s => s + (direction === 'up' ? -1 : 1));
      setVote(null);
    } else {
      if (userVote) setScore(s => s + (userVote === 'up' ? -1 : 1));
      setScore(s => s + (direction === 'up' ? 1 : -1));
      setVote(direction);
    }

    // API call
    try {
      const endpoint = entityType === 'comment'
        ? `/api/forum/comments/${entityId}/vote`
        : `/api/forum/posts/${entityId}/vote`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ direction }),
      });

      if (res.status === 401) {
        // Revert and redirect
        setScore(prevScore);
        setVote(prevVote);
        window.location.href = '/login';
      }
    } catch {
      // Revert on network error
      setScore(prevScore);
      setVote(prevVote);
    }
  }, [entityId, userVote, score, entityType]);

  return { score, userVote, vote };
}

// ── useModQueue ───────────────────────────────────────────────────
/**
 * Moderation queue for admin/moderator panel
 * Requires moderator-level JWT
 */
export function useModQueue() {
  const { data, error, mutate } = useSWR('/api/moderation/queue', fetcher, {
    refreshInterval: 30000,
    shouldRetryOnError: false,
  });

  const queue = data?.items || MOD_FALLBACK;

  const takeAction = async (itemId, action) => {
    // Optimistic remove
    const el = document.getElementById(`mod-${itemId}`);
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }
    try {
      await fetch(`/api/moderation/queue/${itemId}/${action}`, {
        method: 'POST', credentials: 'include'
      });
      mutate();
    } catch { mutate(); }
  };

  const dismissAll = async (action) => {
    document.querySelectorAll('.mod-item').forEach(el => {
      el.style.opacity = '0'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300);
    });
    try {
      await fetch(`/api/moderation/queue/bulk/${action}`, { method: 'POST', credentials: 'include' });
      mutate();
    } catch { mutate(); }
  };

  return {
    queue,
    loading:    !data && !error,
    approve:    (id) => takeAction(id, 'approve'),
    remove:     (id) => takeAction(id, 'remove'),
    dismissAll,
  };
}

// ── useForumCategories ────────────────────────────────────────────
export function useForumCategories() {
  const { data } = useSWR('/api/forum/categories', fetcher, { dedupingInterval: 3600000 });
  return { categories: data?.categories || CATEGORY_FALLBACK };
}

// ── useForumSearch ────────────────────────────────────────────────
export function useForumSearch(query, debounceMs = 300) {
  const [debounced, setDebounced] = useState(query);

  // Debounce
  useCallback(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query])();

  const { data } = useSWR(
    debounced?.length >= 2 ? `/api/forum/search?q=${encodeURIComponent(debounced)}&limit=8` : null,
    fetcher,
    { dedupingInterval: 5000 }
  );

  return { results: data?.posts || [], loading: !!debounced && debounced.length >= 2 && !data };
}

// ── useTopContributors ────────────────────────────────────────────
export function useTopContributors(limit = 10) {
  const { data } = useSWR(`/api/forum/contributors?limit=${limit}`, fetcher, { dedupingInterval: 3600000 });
  return { contributors: data?.contributors || CONTRIB_FALLBACK };
}

// ── useForumLiveUpdates ───────────────────────────────────────────
/**
 * WebSocket subscription for real-time forum events:
 * - new_post: a new post was created
 * - new_comment: a comment was added to a followed post
 * - vote_update: a post's vote count changed significantly
 */
export function useForumLiveUpdates() {
  const [newPosts, setNewPosts]   = useState([]);
  const [notifications, setNotif] = useState([]);
  const { data, isConnected }     = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/forum` : null,
    { subscriptions: ['forum:new_posts', 'forum:trending'] }
  );

  if (data?.type === 'new_post')     setNewPosts(p => [data.post, ...p].slice(0, 5));
  if (data?.type === 'notification') setNotif(n => [data, ...n].slice(0, 20));

  return { newPosts, notifications, isConnected };
}

// ── Fallback data ─────────────────────────────────────────────────

const CATEGORY_FALLBACK = [
  { id:'all',       label:'All Posts',         count:12847 },
  { id:'analysis',  label:'Analysis',           count:3241  },
  { id:'technical', label:'Technical',          count:2814  },
  { id:'macro',     label:'Macro & Economy',    count:1923  },
  { id:'ipo',       label:'IPO Watch',          count:847   },
  { id:'results',   label:'Results & Earnings', count:1521  },
  { id:'beginner',  label:'Beginner Q&A',       count:2501  },
];

const CONTRIB_FALLBACK = [
  { username:'TradingTiger92',  karma:14820, badge:'Premium'  },
  { username:'InstitutionalEye',karma:12341, badge:'Verified' },
  { username:'NiftySage',       karma:9872,  badge:'Analyst'  },
  { username:'LongTermLearner', karma:8214,  badge:'Veteran'  },
  { username:'ValueHunter_IN',  karma:7103,  badge:''         },
];

const MOD_FALLBACK = [
  { id:'m1', flag_type:'spam',   content_preview:'AMAZING RETURNS GUARANTEED!! WhatsApp for daily tips 500% profit', reported_user:'suspicious_user_99', ai_score:97, created_at:new Date(Date.now()-5*60000).toISOString() },
  { id:'m2', flag_type:'hate',   content_preview:'All Adani investors are idiots who deserve to lose money.', reported_user:'angrytroll_44', ai_score:82, created_at:new Date(Date.now()-18*60000).toISOString() },
  { id:'m3', flag_type:'report', content_preview:'This seems like a pump and dump post for a small cap stock.', reported_user:'reporter_verified', ai_score:45, created_at:new Date(Date.now()-32*60000).toISOString() },
  { id:'m4', flag_type:'spam',   content_preview:'FREE DEMAT ACCOUNT! Click here for ₹500 bonus.', reported_user:'affiliate_bot', ai_score:91, created_at:new Date(Date.now()-44*60000).toISOString() },
  { id:'m5', flag_type:'report', content_preview:'Post contains personal information about another user.', reported_user:'privacy_guard', ai_score:70, created_at:new Date(Date.now()-3600000).toISOString() },
  { id:'m6', flag_type:'hate',   content_preview:'People who invest in PSU banks are economically illiterate.', reported_user:'crypto_evangelist', ai_score:58, created_at:new Date(Date.now()-2*3600000).toISOString() },
  { id:'m7', flag_type:'report', content_preview:'This post analysis appears copied from a paid newsletter verbatim.', reported_user:'original_author', ai_score:65, created_at:new Date(Date.now()-3*3600000).toISOString() },
];