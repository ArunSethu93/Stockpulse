// frontend/lib/forumHelpers.js

/**
 * forumHelpers.js
 *
 * Client-side utilities for the community forum:
 * - Hot score algorithm (Reddit-inspired)
 * - Markdown to safe HTML renderer
 * - Avatar color/initials
 * - Badge system
 * - Spam signal heuristics (client-side pre-check; full NLP is backend)
 * - Post categorization
 */

// ── Hot Score ─────────────────────────────────────────────────────
/**
 * Reddit-style "hot" ranking algorithm
 * Decays over time, boosted by early votes
 *
 * @param {number} ups      - upvotes
 * @param {number} downs    - downvotes
 * @param {Date}   created  - post creation date
 * @returns {number}         - hot score
 */
export function hotScore(ups, downs, created) {
  const score = ups - downs;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign  = score > 0 ? 1 : score < 0 ? -1 : 0;
  const epoch = new Date('2024-01-01').getTime() / 1000;
  const seconds = new Date(created).getTime() / 1000 - epoch;
  return Math.round(sign * order + seconds / 45000);
}

/**
 * "Rising" score — posts gaining votes faster than average
 */
export function risingScore(ups, downs, created) {
  const age = (Date.now() - new Date(created).getTime()) / 3600000; // hours
  const score = ups - downs;
  return age > 0 ? score / Math.sqrt(age) : score;
}

/**
 * Wilson score lower bound — better for ranking with few votes
 */
export function wilsonScore(ups, total) {
  if (total === 0) return 0;
  const phat = ups / total;
  const z = 1.96; // 95% confidence
  return (phat + z*z/(2*total) - z*Math.sqrt((phat*(1-phat)+z*z/(4*total))/total)) / (1+z*z/total);
}

// ── Karma & Badge System ──────────────────────────────────────────

export const KARMA_THRESHOLDS = [
  { min:10000, badge:'Legend',   color:'#f59e0b', bg:'rgba(245,158,11,.08)',  border:'rgba(245,158,11,.2)' },
  { min:5000,  badge:'Expert',   color:'#8b5cf6', bg:'rgba(139,92,246,.08)', border:'rgba(139,92,246,.2)' },
  { min:2000,  badge:'Veteran',  color:'#06b6d4', bg:'rgba(6,182,212,.08)',  border:'rgba(6,182,212,.2)'  },
  { min:500,   badge:'Premium',  color:'#f59e0b', bg:'rgba(245,158,11,.08)', border:'rgba(245,158,11,.2)' },
  { min:100,   badge:'Member',   color:'#3b82f6', bg:'rgba(59,130,246,.1)',  border:'rgba(59,130,246,.2)' },
  { min:0,     badge:'Newcomer', color:'#4a5a6e', bg:'rgba(74,90,110,.08)',  border:'rgba(74,90,110,.2)'  },
];

export function getBadgeForKarma(karma) {
  return KARMA_THRESHOLDS.find(t => karma >= t.min) || KARMA_THRESHOLDS[KARMA_THRESHOLDS.length - 1];
}

// Special badges (granted by admins or earned actions)
export const SPECIAL_BADGES = {
  verified: { label:'Verified',  color:'#3b82f6', icon:'✓' },
  analyst:  { label:'Analyst',   color:'#00d68f', icon:'◈' },
  moderator:{ label:'Mod',       color:'#ff4d6d', icon:'⚑' },
  admin:    { label:'Admin',     color:'#8b5cf6', icon:'⚙' },
};

// ── Avatar ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3b82f6','#8b5cf6','#00d68f','#f59e0b',
  '#ff4d6d','#06b6d4','#ec4899','#10b981',
];

export function getAvatarColor(username) {
  if (!username) return AVATAR_COLORS[0];
  let hash = 0;
  for (const c of username) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(username) {
  if (!username) return 'U';
  const words = username.trim().split(/[_\s.-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

// ── Stock tag colors ──────────────────────────────────────────────

const STOCK_COLORS = {
  RELIANCE:'#3b82f6', TCS:'#8b5cf6',     INFY:'#f59e0b',
  WIPRO:'#00d68f',    HDFCBANK:'#ff4d6d', ICICIBANK:'#ec4899',
  SBIN:'#06b6d4',     ADANIENT:'#ef4444', MARUTI:'#f97316',
  ITC:'#10b981',      NIFTY50:'#3b82f6',  SENSEX:'#8b5cf6',
};

export function getStockColor(symbol) {
  return STOCK_COLORS[symbol?.toUpperCase()] || '#8b9ab0';
}

// ── Markdown → Safe HTML ──────────────────────────────────────────
/**
 * Minimal safe markdown renderer for post bodies
 * Only supports: bold, italic, inline code, numbered lists, bullet lists
 * No HTML injection — all user content is escaped first
 */

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function renderMarkdown(raw) {
  if (!raw) return '';
  const escaped = escapeHtml(raw);

  return escaped
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--fd);font-size:14px;font-weight:700;margin:12px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-family:var(--fd);font-size:16px;font-weight:700;margin:14px 0 6px">$1</h2>')
    // Bold + italic
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--t1);font-weight:500">$1</strong>')
    .replace(/_(.*?)_/g,       '<em>$1</em>')
    // Inline code
    .replace(/`(.*?)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-family:var(--fm);font-size:11px;color:var(--cy)">$1</code>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:3px 0;color:var(--t2)">$1</li>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm,  '<li style="margin:3px 0;color:var(--t2)">$1</li>')
    // Paragraphs
    .split('\n\n')
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<li')) return trimmed;
      return `<p style="margin-bottom:10px;color:var(--t2);line-height:1.8">${trimmed}</p>`;
    })
    .join('\n');
}

// ── Client-side spam pre-check ────────────────────────────────────
/**
 * Lightweight spam signal detection before submitting
 * Returns { isSpam: boolean, signals: string[], score: number }
 * Heavy NLP runs server-side (DistilBERT in Celery task)
 */

const SPAM_PATTERNS = [
  { pattern:/whatsapp.*tip/i,             weight:40, label:'WhatsApp tip link'         },
  { pattern:/guaranteed.*return/i,        weight:35, label:'Guaranteed returns claim'  },
  { pattern:/\d{3}%.*profit/i,            weight:35, label:'Unrealistic profit claim'  },
  { pattern:/free.*demat|demat.*free/i,   weight:25, label:'Free demat promotion'      },
  { pattern:/join.*group|group.*join/i,   weight:20, label:'Group invite'              },
  { pattern:/[A-Z0-9]{8,}\.(com|in|net)/,weight:30, label:'Suspicious domain'         },
  { pattern:/₹.*lakh.*day|₹.*crore.*week/,weight:40,label:'Income claim'              },
  { pattern:/(call|contact|whatsapp).*\+91/i,weight:35,label:'Phone number solicitation'},
  { pattern:/pump|dump/i,                  weight:15, label:'Pump/dump language'        },
];

export function clientSpamCheck(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  let score = 0;
  const signals = [];

  for (const { pattern, weight, label } of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      score += weight;
      signals.push(label);
    }
  }

  // Extra checks
  if ((text.match(/!/g) || []).length > 5)          { score += 10; signals.push('Excessive exclamation marks'); }
  if ((text.match(/[A-Z]{4,}/g) || []).length > 3)  { score += 10; signals.push('Excessive caps'); }
  if (text.length < 20 && body.length < 20)          { score += 5;  signals.push('Very short content'); }

  return { isSpam: score >= 50, score: Math.min(score, 100), signals };
}

// ── Post validation ───────────────────────────────────────────────

export function validatePost(title, body, stocks) {
  const errors = [];
  if (!title?.trim())               errors.push('Title is required');
  if (title?.trim().length < 10)    errors.push('Title must be at least 10 characters');
  if (title?.trim().length > 200)   errors.push('Title too long (max 200 chars)');
  if (!body?.trim())                errors.push('Post body is required');
  if (body?.trim().length < 20)     errors.push('Post too short (min 20 characters)');
  if (body?.length > 5000)          errors.push('Post too long (max 5000 characters)');
  if (!stocks?.length)              errors.push('Add at least one stock tag');

  const spamCheck = clientSpamCheck(title, body);
  if (spamCheck.isSpam) errors.push(`Spam detected: ${spamCheck.signals.join(', ')}`);

  return { isValid: errors.length === 0, errors, spamScore: spamCheck.score };
}

// ── Post categories ───────────────────────────────────────────────

export function detectCategory(title, body, tags) {
  const text = `${title} ${body} ${tags.join(' ')}`.toLowerCase();
  if (/technical|chart|rsi|macd|ema|support|resistance|breakout/.test(text))  return 'technical';
  if (/q[1-4].*result|quarterly|earnings|pat|ebitda|guidance/.test(text))     return 'results';
  if (/ipo|gmp|grey market|allotment|listing/.test(text))                      return 'ipo';
  if (/rbi|gdp|inflation|budget|monetary policy|macro/.test(text))             return 'macro';
  if (/beginner|newbie|help|what is|how to|explain/.test(text))                return 'beginner';
  return 'analysis';
}