// frontend/components/forum/PostCard.jsx
'use client';

import { useState, useCallback } from 'react';
import { timeAgo } from '../../lib/formatters';
import { useVote } from '../../hooks/useForum';

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#00d68f','#f59e0b','#ff4d6d','#06b6d4','#ec4899'];
const STOCK_COLORS  = { RELIANCE:'#3b82f6',WIPRO:'#00d68f',TCS:'#8b5cf6',INFY:'#f59e0b',HDFCBANK:'#ff4d6d',SBIN:'#06b6d4',default:'#8b9ab0' };

function avatarColor(name) {
  let h = 0;
  for (const c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) { return (name || 'U').slice(0, 2).toUpperCase(); }
function stockColor(sym) { return STOCK_COLORS[sym] || STOCK_COLORS.default; }

/**
 * PostCard — Reddit-style post card
 *
 * Features:
 * - Vote column with optimistic updates
 * - Stock tag chips (clickable → filter by stock)
 * - Sentiment badge (AI-computed)
 * - Award icons
 * - Pinned indicator
 * - New post flash animation
 */
export default function PostCard({ post, isNew, onOpen, onStockClick }) {
  const { vote, userVote, score } = useVote(post.id, post.votes, post.user_vote);

  const sentimentCls = post.sentiment === 'bullish' ? 'sb-bull' : post.sentiment === 'bearish' ? 'sb-bear' : 'sb-neut';
  const sentimentTxt = post.sentiment === 'bullish' ? '▲ Bullish' : post.sentiment === 'bearish' ? '▼ Bearish' : '— Neutral';
  const avatarC      = avatarColor(post.username);
  const scoreClass   = score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero';

  return (
    <div
      className={`post-card ${post.is_pinned ? 'pinned' : ''} ${isNew ? 'new-post' : ''}`}
      id={`post-${post.id}`}
    >
      {/* Vote column */}
      <div className="vote-col">
        <button
          className={`vote-btn ${userVote === 'up' ? 'voted-up' : ''}`}
          onClick={e => { e.stopPropagation(); vote('up'); }}
          aria-label="Upvote"
        >▲</button>
        <span className={`vote-score ${scoreClass}`}>{score}</span>
        <button
          className={`vote-btn ${userVote === 'down' ? 'voted-down' : ''}`}
          onClick={e => { e.stopPropagation(); vote('down'); }}
          aria-label="Downvote"
        >▼</button>
      </div>

      {/* Post body */}
      <div className="post-body-wrap" onClick={onOpen} role="button" tabIndex={0}>
        <div className="post-top">
          <div
            className="post-avatar"
            style={{ background:`${avatarC}22`, color:avatarC, border:`1px solid ${avatarC}44` }}
          >
            {initials(post.username)}
          </div>
          <span className="post-user">{post.username}</span>
          {post.user_badge && (
            <span
              className="user-badge"
              style={{ color:post.badge_color, background:post.badge_bg, borderColor:`${post.badge_color}44` }}
            >
              {post.user_badge}
            </span>
          )}
          <span className="post-time">{timeAgo(post.created_at)}</span>
          {post.is_pinned && <span className="pinned-flag">📌 Pinned</span>}
          {post.awards?.map(a => <span key={a} style={{ fontSize:10 }}>{a}</span>)}
        </div>

        <div className="post-title">{post.title}</div>
        <div className="post-preview">{post.body?.replace(/\*\*/g,'').split('\n')[0]}</div>

        <div className="post-tags-row">
          {post.stocks?.map(sym => (
            <span
              key={sym}
              className="stock-tag"
              onClick={e => { e.stopPropagation(); onStockClick?.(sym); }}
              style={{ color:stockColor(sym), background:`${stockColor(sym)}18`, borderColor:`${stockColor(sym)}44` }}
            >
              {sym}
            </span>
          ))}
          {post.tags?.slice(0,3).map(tag => (
            <span key={tag} className="hash-tag">#{tag}</span>
          ))}
        </div>

        <div className="post-footer">
          <button className="pf-btn" onClick={onOpen}>💬 {post.comment_count} comments</button>
          <button className="pf-btn" onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(window.location.origin + `/forum/post/${post.id}`); }}>↗ Share</button>
          <button className="pf-btn" onClick={e => { e.stopPropagation(); reportPost(post.id); }}>⚑ Report</button>
          <span className="pf-btn">👁 {post.view_count?.toLocaleString()}</span>
          {post.awards?.length > 0 && <span className="pf-btn pf-award">🏆 Awarded</span>}
          <span className={`sent-badge ${sentimentCls}`}>{sentimentTxt}</span>
        </div>
      </div>
    </div>
  );
}

async function reportPost(postId) {
  try {
    await fetch(`/api/forum/posts/${postId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason: 'user_report' }),
    });
    alert('Post reported. Moderators will review it.');
  } catch {
    alert('Please sign in to report posts.');
  }
}


// ════════════════════════════════════════════════════════════
// PostComposer
// ════════════════════════════════════════════════════════════

// frontend/components/forum/PostComposer.jsx
import { useState, useRef } from 'react';

const MAX_CHARS = 5000;
const MAX_TAGS  = 6;

export function PostComposer({ onSubmit, replyTo }) {
  const [tab, setTab]         = useState('post');
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [tags, setTags]       = useState([]);
  const [tagInput, setTagIn]  = useState('');
  const [sentiment, setSent]  = useState('bullish');
  const [submitting, setSub]  = useState(false);
  const [error, setError]     = useState('');
  const bodyRef = useRef(null);

  const charCount = title.length + body.length;
  const canSubmit = title.trim().length >= 5 && body.trim().length >= 10 && tags.length >= 1 && !submitting;

  const handleTagKey = (e) => {
    if ([' ','Enter',','].includes(e.key) && tagInput.trim()) {
      e.preventDefault();
      const sym = tagInput.trim().toUpperCase().replace(/[^A-Z0-9&]/g,'').slice(0,10);
      if (sym && !tags.includes(sym) && tags.length < MAX_TAGS) {
        setTags([...tags, sym]);
      }
      setTagIn('');
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0,-1));
    }
  };

  const removeTag = (sym) => setTags(tags.filter(t => t !== sym));

  const insertFormat = (fmt) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = body.slice(start, end) || 'text';
    const wrappers = { bold:`**${sel}**`, italic:`_${sel}_`, code:`\`${sel}\`` };
    const newBody = body.slice(0, start) + (wrappers[fmt] || sel) + body.slice(end);
    setBody(newBody);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSub(true);
    setError('');
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, body, stocks: tags, sentiment, reply_to: replyTo }),
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(await res.text());
      const post = await res.json();
      onSubmit?.(post);
      setTitle(''); setBody(''); setTags([]); setTagIn('');
    } catch (err) {
      setError(err.message || 'Failed to post. Please try again.');
    }
    setSub(false);
  };

  return (
    <div className="composer">
      <div className="composer-tabs">
        {['Post','Analysis','Poll'].map(t => (
          <div key={t} className={`ctab ${tab === t.toLowerCase() ? 'act' : ''}`} onClick={() => setTab(t.toLowerCase())}>{t}</div>
        ))}
      </div>

      <div className="composer-body">
        <div className="composer-row">
          <div className="cavatar">SP</div>
          <div style={{ flex:1 }}>
            <input
              className="ctitle-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Post title — be specific and descriptive…`}
              maxLength={200}
            />
            <textarea
              ref={bodyRef}
              className="cbody-input"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Share your analysis, trade idea, or question. **bold**, _italic_, `code` supported."
              rows={4}
            />
          </div>
        </div>
        {error && <div style={{ color:'var(--r)', fontSize:11, padding:'0 0 8px', fontFamily:'var(--fm)' }}>{error}</div>}
      </div>

      <div className="composer-footer">
        {/* Tag input */}
        <span style={{ fontSize:11, color:'var(--t3)', fontFamily:'var(--fm)' }}>#</span>
        <div className="tag-input-wrap">
          <div className="added-tags">
            {tags.map(t => (
              <span key={t} className="atag" onClick={() => removeTag(t)}>
                <span style={{ color: stockColor(t) }}>{t}</span>
                <span className="rm">✕</span>
              </span>
            ))}
          </div>
          <input
            className="tag-input"
            value={tagInput}
            onChange={e => setTagIn(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder={tags.length ? '' : 'Add stock tags (RELIANCE, TCS…)'}
          />
        </div>

        {/* Formatting */}
        <div className="fmt-btns">
          {[['bold','B'],['italic','I'],['code','{ }']].map(([fmt,label]) => (
            <button key={fmt} className="fmt-btn" onClick={() => insertFormat(fmt)} title={fmt}><b>{label}</b></button>
          ))}
        </div>

        {/* Sentiment */}
        <div className="sent-btns">
          {[['bullish','▲ Bull','sbtn-bull'],['neutral','— Neut','sbtn-neut'],['bearish','▼ Bear','sbtn-bear']].map(([s,l,c]) => (
            <div key={s} className={`sbtn ${c} ${sentiment===s?'sel':''}`} onClick={() => setSent(s)}>{l}</div>
          ))}
        </div>

        <span className={`char-count ${charCount > MAX_CHARS * 0.9 ? 'negative' : ''}`}>{charCount} / {MAX_CHARS}</span>
        <button className="post-btn" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// CommentThread
// ════════════════════════════════════════════════════════════

// frontend/components/forum/CommentThread.jsx
import useSWR from 'swr';
import { useState } from 'react';

const fetcher = url => fetch(url).then(r => r.json());

export function CommentThread({ postId, onClose }) {
  const { data: post }     = useSWR(postId ? `/api/forum/posts/${postId}` : null, fetcher);
  const { data: commData } = useSWR(postId ? `/api/forum/posts/${postId}/comments` : null, fetcher, { refreshInterval: 30000 });
  const [commentSort, setSort] = useState('best');
  const [replyDraft, setDraft] = useState('');

  const comments = commData?.comments || getCommFallback();

  if (!post) return <div style={{ padding:40, textAlign:'center', color:'var(--t3)' }}>Loading…</div>;

  return (
    <div className="post-detail">
      {/* Post header */}
      <div className="pd-header">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div style={{ flex:1 }}>
            <PostMetaRow post={post} />
            <div style={{ fontFamily:'var(--fd)', fontSize:18, fontWeight:800, letterSpacing:'-.02em', margin:'10px 0' }}>
              {post.title}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {post.stocks?.map(s => (
                <a key={s} href={`/stock/${s}`}
                  className="stock-tag"
                  style={{ color:stockColor(s), background:`${stockColor(s)}18`, borderColor:`${stockColor(s)}44` }}>
                  {s}
                </a>
              ))}
              {post.tags?.map(t => <span key={t} className="hash-tag">#{t}</span>)}
            </div>
          </div>
          <button className="ibtn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Post body */}
      <div className="pd-body" dangerouslySetInnerHTML={{ __html: formatMarkdown(post.body || '') }} />

      {/* Actions */}
      <div className="pd-actions">
        <span className="pf-btn">▲ {post.votes} votes</span>
        <span className="pf-btn">💬 {comments.length} comments</span>
        <span className="pf-btn">↗ Share</span>
        <span className={`sent-badge ${post.sentiment === 'bullish' ? 'sb-bull' : post.sentiment === 'bearish' ? 'sb-bear' : 'sb-neut'}`}>
          {post.sentiment === 'bullish' ? '▲ Bullish' : post.sentiment === 'bearish' ? '▼ Bearish' : '— Neutral'}
        </span>
      </div>

      {/* Comments */}
      <div className="comments-area">
        <div className="comments-header">
          <div className="comments-count">💬 {comments.length} Comments</div>
          <div className="comment-sort">
            {['best','new','top'].map(s => (
              <div key={s} className={`csort-btn ${commentSort===s?'act':''}`} onClick={() => setSort(s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </div>
            ))}
          </div>
        </div>

        {/* Main reply input */}
        <div className="reply-composer">
          <div className="fmt-btns" style={{ marginBottom:8, gap:4, display:'flex' }}>
            {[['B','bold'],['I','italic'],['{ }','code']].map(([l,f]) => (
              <button key={f} className="fmt-btn">{l}</button>
            ))}
          </div>
          <textarea
            className="reply-input"
            placeholder="Add a comment — be specific, share data, cite sources…"
            value={replyDraft}
            onChange={e => setDraft(e.target.value)}
          />
          <div className="reply-footer">
            <span style={{ fontSize:11, color:'var(--t3)', fontFamily:'var(--fm)' }}>Markdown supported</span>
            <span className="cancel-btn" onClick={() => setDraft('')}>Clear</span>
            <button className="reply-btn" onClick={() => { setDraft(''); }}>Comment</button>
          </div>
        </div>

        {/* Comment list */}
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} depth={0} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, depth }) {
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [localVotes, setLocalVotes]   = useState(comment.votes || 0);
  const [voted, setVoted]             = useState(null);
  const [draft, setDraft]             = useState('');
  const avatarC = avatarColor(comment.author || comment.username);

  const handleVote = (dir) => {
    if (voted === dir) { setLocalVotes(v => v + (dir==='up'?-1:1)); setVoted(null); }
    else { if (voted) setLocalVotes(v => v + (voted==='up'?-1:1)); setLocalVotes(v => v + (dir==='up'?1:-1)); setVoted(dir); }
  };

  return (
    <div className="comment">
      <div className="comment-row">
        {depth > 0 && <div className="thread-line" onClick={() => setShowReplies(!showReplies)} />}
        <div className="comment-avatar" style={{ background:`${avatarC}22`, color:avatarC, border:`1px solid ${avatarC}44` }}>
          {initials(comment.author || comment.username)}
        </div>
        <div className="comment-content">
          <div className="comment-meta">
            <span className="c-user">{comment.author || comment.username}</span>
            {comment.badge && <span className="c-badge" style={{ color:comment.badgeColor, background:comment.badgeBg, borderColor:`${comment.badgeColor}44` }}>{comment.badge}</span>}
            <span className="c-time">{timeAgo(comment.created_at || comment.time)}</span>
          </div>

          <div className="comment-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(comment.text || comment.body || '') }} />

          <div className="comment-actions">
            <div className={`ca-btn ${voted==='up'?'voted':''}`} onClick={() => handleVote('up')}>▲ {localVotes}</div>
            <div className={`ca-btn ${voted==='down'?'downvoted':''}`} onClick={() => handleVote('down')}>▼</div>
            <div className="ca-btn" onClick={() => setShowReplyBox(!showReplyBox)}>↩ Reply</div>
            <div className="ca-btn">↗ Share</div>
            <div className="ca-btn">⚑</div>
            {comment.replies?.length > 0 && (
              <div className="collapse-btn" onClick={() => setShowReplies(!showReplies)}>
                {showReplies ? `▲ Collapse` : `▼ ${comment.replies.length} replies`}
              </div>
            )}
          </div>

          {showReplyBox && (
            <div style={{ marginTop:8 }}>
              <textarea
                style={{ width:'100%', background:'var(--bgc)', border:'1px solid var(--br)', borderRadius:5, padding:'7px 10px', color:'var(--t1)', fontFamily:'var(--fb)', fontSize:12, outline:'none', resize:'vertical', minHeight:56 }}
                placeholder={`Reply to ${comment.author || comment.username}…`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button className="reply-btn" style={{ fontSize:11, padding:'5px 14px' }} onClick={() => { setDraft(''); setShowReplyBox(false); }}>Reply</button>
                <span className="cancel-btn" onClick={() => setShowReplyBox(false)}>Cancel</span>
              </div>
            </div>
          )}

          {showReplies && comment.replies?.length > 0 && (
            <div className="nested-replies">
              {comment.replies.map(reply => (
                <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostMetaRow({ post }) {
  const ac = avatarColor(post.username);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
      <div className="post-avatar" style={{ width:24, height:24, background:`${ac}22`, color:ac, border:`1px solid ${ac}44`, fontSize:9 }}>{initials(post.username)}</div>
      <span style={{ fontSize:12, fontWeight:500 }}>{post.username}</span>
      {post.user_badge && <span className="user-badge" style={{ color:post.badge_color, background:`${post.badge_color}22` }}>{post.user_badge}</span>}
      <span style={{ fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)' }}>{timeAgo(post.created_at)}</span>
    </div>
  );
}

function formatMarkdown(text) {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-family:var(--fm);font-size:11px">$1</code>')
    .split('\n').map(l => l.trim() ? `<p>${l}</p>` : '').join('');
}

function getCommFallback() {
  return [
    { id:'c1', author:'InstitutionalEye', badge:'Verified', badgeColor:'var(--b)', badgeBg:'var(--bd)', time:'1h ago', created_at: new Date(Date.now()-3600000).toISOString(), text:'Strong analysis. The BFSI recovery is the key signal to watch — when it comes back properly, IT companies see 200-300 bps margin expansion.', votes:89, replies:[
      { id:'c1r1', author:'TradingTiger92', badge:'Premium', badgeColor:'var(--am)', badgeBg:'var(--amd)', time:'45m ago', created_at: new Date(Date.now()-45*60000).toISOString(), text:'Exactly. And deal TCV data is the strongest leading indicator — revenue from Q3 wins will show up in Q1/Q2 FY26.', votes:42, replies:[] },
    ]},
    { id:'c2', author:'SkepticalTrader', badge:'', badgeColor:'', badgeBg:'', time:'1.5h ago', created_at: new Date(Date.now()-90*60000).toISOString(), text:'I would be cautious. Wipro has missed guidance 3 out of the last 5 quarters. The 4-6% range is wide and the lower end would disappoint at current valuations.', votes:34, replies:[] },
  ];
}


// ════════════════════════════════════════════════════════════
// ModerationPanel
// ════════════════════════════════════════════════════════════

// frontend/components/forum/ModerationPanel.jsx
import { useModQueue } from '../../hooks/useForum';

export function ModerationPanel({ onClose }) {
  const { queue, loading, approve, remove, dismissAll } = useModQueue();

  const TYPE_META = {
    spam:   { label:'🤖 Spam',        cls:'mt-spam' },
    hate:   { label:'⚠ Hate Speech', cls:'mt-hate' },
    report: { label:'🚩 Reported',    cls:'mt-report' },
  };

  return (
    <div className="mod-panel">
      <div className="mod-header">
        <span style={{ fontSize:16 }}>⚑</span>
        <div className="mod-title">Moderation Queue</div>
        <div className="mod-badge">{queue.length} pending</div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="mact mact-keep" onClick={() => dismissAll('keep')}>✓ Keep All</button>
          <button className="mact mact-remove" onClick={() => dismissAll('remove')}>✕ Remove All</button>
          <button className="ibtn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--br)', background:'var(--bg3)', display:'flex', gap:8, flexWrap:'wrap' }}>
        {['All','Spam','Hate Speech','Reported'].map(f => (
          <button key={f} className="chip" style={{ padding:'3px 10px', borderRadius:12, fontSize:11 }}>{f}</button>
        ))}
        <span style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)' }}>
          AI spam detection · threshold 70%
        </span>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--t3)' }}>Loading queue…</div>
      ) : queue.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--g)', fontFamily:'var(--fm)', fontSize:12 }}>
          ✓ Queue is clear
        </div>
      ) : (
        queue.map(item => {
          const meta = TYPE_META[item.flag_type] || TYPE_META.report;
          const spamColor = item.ai_score >= 80 ? 'var(--r)' : item.ai_score >= 50 ? 'var(--am)' : 'var(--g)';
          return (
            <div key={item.id} className="mod-item" id={`mod-${item.id}`}>
              <div className={`mod-type ${meta.cls}`}>{meta.label}</div>
              <div className="mod-content">
                <div className="mod-text">"{item.content_preview}"</div>
                <div className="mod-meta">
                  <span>by {item.reported_user}</span>
                  <span>·</span>
                  <span>{timeAgo(item.created_at)}</span>
                  <span>·</span>
                  <div className="spam-score">
                    <span>AI: {item.ai_score}/100</span>
                    <div className="spam-bar">
                      <div className="spam-fill" style={{ width:`${item.ai_score}%`, background:spamColor }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mod-actions">
                <div className="mact mact-remove" onClick={() => remove(item.id)}>✕ Remove</div>
                <div className="mact mact-keep" onClick={() => approve(item.id)}>✓ Keep</div>
              </div>
            </div>
          );
        })
      )}

      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--br)', fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)' }}>
        Last scan: 2 min ago · Model: DistilBERT fine-tuned on financial spam
      </div>
    </div>
  );
}