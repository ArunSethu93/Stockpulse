// frontend/lib/authHelpers.js

/**
 * authHelpers.js — Client-side auth utilities
 *
 * Covers:
 * - Field validation (email, username, password)
 * - Password strength scoring
 * - JWT decode (for display — verification is always server-side)
 * - CSRF token management
 * - Session storage helpers
 */

// ── Email validation ──────────────────────────────────────────────
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email?.trim() || '');
}

// ── Username validation ───────────────────────────────────────────
export function validateUsername(username) {
  const u = username?.trim() || '';
  if (u.length < 3)  return { valid: false, error: 'Username must be at least 3 characters' };
  if (u.length > 30) return { valid: false, error: 'Username must be 30 characters or less' };
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return { valid: false, error: 'Only letters, numbers, _, ., - allowed' };
  if (/^[._-]/.test(u) || /[._-]$/.test(u)) return { valid: false, error: 'Cannot start or end with special characters' };
  const reserved = ['admin','root','stockpulse','api','support','help','moderator','mod','system','official'];
  if (reserved.includes(u.toLowerCase())) return { valid: false, error: 'This username is reserved' };
  return { valid: true };
}

// ── Password strength ─────────────────────────────────────────────
/**
 * Returns { level: 0-4, label, color }
 * 0 = empty, 1 = too weak, 2 = weak, 3 = good, 4 = strong
 */
export function getPasswordStrength(password) {
  if (!password) return { level: 0, label: 'Enter a password', color: 'var(--t3)' };

  let score = 0;
  const checks = {
    length8:   password.length >= 8,
    length12:  password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number:    /\d/.test(password),
    special:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  if (checks.length8)   score++;
  if (checks.length12)  score++;
  if (checks.lowercase) score += 0.5;
  if (checks.uppercase) score += 0.5;
  if (checks.number)    score++;
  if (checks.special)   score++;

  const levels = [
    { level:0, label:'Enter a password',  color:'var(--t3)' },
    { level:1, label:'Too weak',          color:'var(--r)'  },
    { level:2, label:'Weak',              color:'var(--r)'  },
    { level:3, label:'Fair',              color:'var(--am)' },
    { level:4, label:'Good',              color:'var(--b)'  },
    { level:5, label:'Strong',            color:'var(--g)'  },
  ];

  const level = password.length < 6 ? 1 : score < 2 ? 2 : score < 3 ? 3 : score < 4 ? 4 : 5;
  return levels[level];
}

export function getPasswordRequirements(password) {
  return [
    { label: 'At least 8 characters',         met: password.length >= 8        },
    { label: 'Contains uppercase letter',      met: /[A-Z]/.test(password)      },
    { label: 'Contains number',                met: /\d/.test(password)         },
    { label: 'Contains special character',     met: /[^A-Za-z0-9]/.test(password) },
  ];
}

// ── JWT decode (client-side, display only) ────────────────────────
/**
 * Decode JWT payload WITHOUT verifying signature
 * Never use for auth decisions — always verify server-side
 */
export function decodeJWTPayload(token) {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJWTPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 > payload.exp;
}

export function getTokenExpiry(token) {
  const payload = decodeJWTPayload(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}

// ── Session helpers ───────────────────────────────────────────────

const SESSION_KEY = 'sp_user';
const TOKEN_KEY   = 'sp_token';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setStoredUser(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
  catch {}
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  const user  = getStoredUser();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!user || !token) return false;
  if (isTokenExpired(token)) { clearStoredSession(); return false; }
  return true;
}

// ── Avatar utilities ──────────────────────────────────────────────

const GRADIENT_PAIRS = [
  ['#3b82f6','#8b5cf6'], // blue-purple
  ['#00d68f','#06b6d4'], // green-cyan
  ['#f59e0b','#ef4444'], // amber-red
  ['#8b5cf6','#ec4899'], // purple-pink
  ['#06b6d4','#3b82f6'], // cyan-blue
];

export function getUserGradient(username) {
  if (!username) return GRADIENT_PAIRS[0];
  let h = 0;
  for (const c of username) h = c.charCodeAt(0) + ((h << 5) - h);
  return GRADIENT_PAIRS[Math.abs(h) % GRADIENT_PAIRS.length];
}

export function getUserInitials(name) {
  if (!name) return 'U';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── CSRF ──────────────────────────────────────────────────────────
/**
 * CSRF token management for form submissions
 * Token is set as a non-httpOnly cookie by the server on page load
 * and must be included in state-changing requests
 */
export function getCSRFToken() {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

export function fetchWithCSRF(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
      ...options.headers,
    },
  });
}

// ── Badge / Karma system ──────────────────────────────────────────

export const KARMA_LEVELS = [
  { min: 10000, label: 'Legend',   color: '#f59e0b', icon: '⭐' },
  { min: 5000,  label: 'Expert',   color: '#8b5cf6', icon: '💎' },
  { min: 2000,  label: 'Veteran',  color: '#06b6d4', icon: '🏆' },
  { min: 500,   label: 'Premium',  color: '#f59e0b', icon: '⚡' },
  { min: 100,   label: 'Member',   color: '#3b82f6', icon: '✓'  },
  { min: 0,     label: 'Newcomer', color: '#4a5a6e', icon: '○'  },
];

export function getKarmaLevel(karma) {
  return KARMA_LEVELS.find(l => karma >= l.min) || KARMA_LEVELS[KARMA_LEVELS.length - 1];
}

// ── Alert validation ──────────────────────────────────────────────

export function validateAlert({ symbol, alertType, value, channelInApp, channelEmail, channelSMS }) {
  const errors = [];
  if (!symbol?.trim())              errors.push('Stock symbol is required');
  if (!alertType)                   errors.push('Alert type is required');
  if (!channelInApp && !channelEmail && !channelSMS)
    errors.push('Select at least one notification channel');
  if (['price_above','price_below'].includes(alertType) && (!value || isNaN(value) || value <= 0))
    errors.push('Enter a valid target price');
  if (alertType === 'pct_change' && (!value || isNaN(value) || value <= 0 || value > 100))
    errors.push('Enter a valid percentage (0-100)');
  if (alertType === 'volume_spike' && (!value || isNaN(value) || value < 1.5))
    errors.push('Volume multiplier must be at least 1.5×');
  return { isValid: errors.length === 0, errors };
}

// ── User preferences ─────────────────────────────────────────────

export const DEFAULT_PREFERENCES = {
  theme:               'dark',
  compact_view:        false,
  animated_prices:     true,
  sound_alerts:        false,
  notifications: {
    price_alerts:      true,
    breaking_news:     true,
    forum_replies:     true,
    forum_upvotes:     false,
    market_summary:    true,
    weekly_report:     false,
  },
  email_frequency:     'daily', // immediate | daily | weekly | never
  trading_style:       'positional',
  preferred_sectors:   [],
};

export function mergePreferences(stored, defaults = DEFAULT_PREFERENCES) {
  return { ...defaults, ...stored, notifications: { ...defaults.notifications, ...(stored?.notifications || {}) } };
}