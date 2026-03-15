// frontend/components/auth/LoginForm.jsx
'use client';

import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { validateEmail, validatePassword } from '../../lib/authHelpers';

/**
 * LoginForm — JWT login with demo credentials + OAuth buttons
 * Wires into useAuth() → POST /api/auth/login
 */
export function LoginForm({ onSwitch, redirectTo = '/' }) {
  const { login } = useAuth();
  const router = useRouter();

  const [identifier, setId] = useState('');
  const [password, setPw]   = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRem]  = useState(true);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) { setError('Enter your email and password.'); return; }
    setLoad(true); setError('');

    const result = await login({ identifier, password, remember });
    setLoad(false);
    if (result.success) {
      router.push(redirectTo);
    } else {
      setError(result.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="auth-form">
      {error && <div className="form-alert alert-error show">{error}</div>}

      <div className="form-group">
        <label className="form-label">Email or Username</label>
        <input
          className="form-input"
          type="text"
          placeholder="you@example.com"
          value={identifier}
          onChange={e => setId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label className="form-label" style={{ display:'flex', justifyContent:'space-between' }}>
          Password
          <a className="forgot-link" onClick={() => onSwitch('forgot')}>Forgot?</a>
        </label>
        <div style={{ position:'relative' }}>
          <input
            className="form-input"
            type={showPw ? 'text' : 'password'}
            placeholder="Your password"
            value={password}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="current-password"
            style={{ paddingRight: 36 }}
          />
          <span className="input-icon" onClick={() => setShowPw(!showPw)}>
            {showPw ? '🙈' : '👁'}
          </span>
        </div>
      </div>

      <label className="checkbox-row" style={{ cursor:'pointer' }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRem(e.target.checked)}
          style={{ display:'none' }}
        />
        <div className={`custom-cb ${remember ? 'checked' : ''}`} onClick={() => setRem(!remember)} />
        <span className="cb-text">Keep me signed in for 30 days</span>
      </label>

      <button className={`submit-btn ${loading ? 'loading' : ''}`} onClick={handleSubmit} disabled={loading}>
        <span className="btn-text">Sign In →</span>
        <div className="btn-loader" />
      </button>

      <div className="or-divider">or continue with</div>

      <OAuthButtons />

      <DemoBanner />
    </div>
  );
}


// ── RegisterForm ──────────────────────────────────────────────────

// frontend/components/auth/RegisterForm.jsx
import { useState as useStateReg } from 'react';
import { useAuth as useAuthReg } from '../../hooks/useAuth';
import { validateEmail as vEmail, validateUsername, getPasswordStrength } from '../../lib/authHelpers';

const STEPS = [
  { id: 1, label: 'Basic Info'   },
  { id: 2, label: 'Security'     },
  { id: 3, label: 'Preferences' },
];

const TRADING_STYLES = [
  { id:'intraday',   label:'📈 Intraday'    },
  { id:'swing',      label:'🔄 Swing'       },
  { id:'positional', label:'📊 Positional'  },
  { id:'longterm',   label:'🏦 Long-term'   },
];

const SECTORS = ['IT','Banking','Auto','Pharma','FMCG','Metals','Energy','Realty','Infra'];

export function RegisterForm({ onSwitch }) {
  const { register, verifyOTP } = useAuthReg();
  const router = useRouter();

  const [step, setStep]         = useStateReg(1);
  const [showOTP, setShowOTP]   = useStateReg(false);
  const [loading, setLoad]      = useStateReg(false);
  const [error, setError]       = useStateReg('');

  // Form fields
  const [name, setName]         = useStateReg('');
  const [email, setEmail]       = useStateReg('');
  const [username, setUser]     = useStateReg('');
  const [password, setPw]       = useStateReg('');
  const [pwConfirm, setPwConf]  = useStateReg('');
  const [style, setStyle]       = useStateReg('positional');
  const [sectors, setSectors]   = useStateReg([]);
  const [termsAccepted, setTerms] = useStateReg(false);
  const [otp, setOtp]           = useStateReg(['','','','','','']);

  // Field errors
  const [fieldErrors, setFE]    = useStateReg({});

  const pwStrength = getPasswordStrength(password);

  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!name.trim() || name.trim().length < 2) errs.name = 'Enter your full name';
      if (!vEmail(email))                          errs.email = 'Enter a valid email';
      const userResult = validateUsername(username);
      if (!userResult.valid)                       errs.username = userResult.error;
    }
    if (s === 2) {
      if (password.length < 8)        errs.password = 'Password must be at least 8 characters';
      if (password !== pwConfirm)     errs.pwConfirm = 'Passwords do not match';
      if (pwStrength.level < 2)       errs.password = 'Password is too weak';
    }
    if (s === 3) {
      if (!termsAccepted) errs.terms = 'You must accept the Terms of Service';
    }
    setFE(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = (to) => {
    if (!validateStep(step)) return;
    setStep(to);
    setError('');
  };

  const handleRegister = async () => {
    if (!validateStep(3)) return;
    setLoad(true); setError('');

    const result = await register({ name, email, username, password, trading_style: style, sectors });
    setLoad(false);
    if (result.success) setShowOTP(true);
    else setError(result.error || 'Registration failed');
  };

  const handleOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setLoad(true);
    const result = await verifyOTP({ email, otp: code });
    setLoad(false);
    if (result.success) router.push('/dashboard');
    else setError(result.error || 'Invalid code');
  };

  const toggleSector = (s) => setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  if (showOTP) {
    return (
      <div className="auth-form">
        <OTPInput
          email={email}
          otp={otp}
          setOtp={setOtp}
          onVerify={handleOTP}
          loading={loading}
          error={error}
          onResend={() => register({ name, email, username, password, trading_style: style, sectors })}
        />
      </div>
    );
  }

  return (
    <div className="auth-form">
      {error && <div className="form-alert alert-error show">{error}</div>}

      {/* Step progress */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {STEPS.map(s => (
          <div key={s.id} style={{ flex:1, height:3, borderRadius:2, background: s.id <= step ? 'var(--b)' : 'var(--bg3)', transition:'background .3s' }} />
        ))}
      </div>
      <div style={{ fontFamily:'var(--fm)', fontSize:10, color:'var(--t3)', marginBottom:18 }}>
        Step {step} of 3 — {STEPS[step-1].label}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <>
          <FormField label="Full Name" error={fieldErrors.name}>
            <input className={`form-input ${fieldErrors.name ? 'error' : name ? 'success' : ''}`}
              type="text" placeholder="Arjun Sharma"
              value={name} onChange={e => setName(e.target.value)}
              autoComplete="name" />
          </FormField>
          <FormField label="Email Address" error={fieldErrors.email}>
            <input className={`form-input ${fieldErrors.email ? 'error' : vEmail(email) ? 'success' : ''}`}
              type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" />
          </FormField>
          <FormField label="Username" error={fieldErrors.username}>
            <UsernameInput value={username} onChange={setUser} />
          </FormField>
          <button className="submit-btn" onClick={() => nextStep(2)}>Continue →</button>
        </>
      )}

      {/* Step 2: Security */}
      {step === 2 && (
        <>
          <FormField label="Password" error={fieldErrors.password}>
            <input className={`form-input ${fieldErrors.password ? 'error' : ''}`}
              type="password" placeholder="Min 8 characters"
              value={password} onChange={e => setPw(e.target.value)}
              autoComplete="new-password" />
            <PasswordStrengthBar strength={pwStrength} />
          </FormField>
          <FormField label="Confirm Password" error={fieldErrors.pwConfirm}>
            <input className={`form-input ${fieldErrors.pwConfirm ? 'error' : pwConfirm && pwConfirm === password ? 'success' : ''}`}
              type="password" placeholder="Repeat your password"
              value={pwConfirm} onChange={e => setPwConf(e.target.value)}
              autoComplete="new-password" />
          </FormField>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setStep(1)} style={{ flex:1, padding:12, background:'transparent', border:'1px solid var(--br)', borderRadius:7, color:'var(--t2)', cursor:'pointer', fontFamily:'var(--fd)', fontSize:13, fontWeight:600 }}>← Back</button>
            <button className="submit-btn" style={{ flex:2 }} onClick={() => nextStep(3)}>Continue →</button>
          </div>
        </>
      )}

      {/* Step 3: Preferences */}
      {step === 3 && (
        <>
          <div className="form-group">
            <label className="form-label">Trading Style</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {TRADING_STYLES.map(ts => (
                <div
                  key={ts.id}
                  className={`style-opt ${style === ts.id ? 'sel' : ''}`}
                  onClick={() => setStyle(ts.id)}
                >
                  {ts.label}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Sectors of Interest</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {SECTORS.map(s => (
                <div
                  key={s}
                  className={`sector-chip ${sectors.includes(s) ? 'sel' : ''}`}
                  onClick={() => toggleSector(s)}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {fieldErrors.terms && <div className="field-error" style={{ display:'flex', marginBottom:8 }}>⚠ {fieldErrors.terms}</div>}

          <label className="checkbox-row" style={{ cursor:'pointer' }}>
            <div className={`custom-cb ${termsAccepted ? 'checked' : ''}`} onClick={() => setTerms(!termsAccepted)} />
            <span className="cb-text">I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>. StockPulse does not provide SEBI-registered investment advice.</span>
          </label>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setStep(2)} style={{ flex:1, padding:12, background:'transparent', border:'1px solid var(--br)', borderRadius:7, color:'var(--t2)', cursor:'pointer', fontFamily:'var(--fd)', fontSize:13, fontWeight:600 }}>← Back</button>
            <button className={`submit-btn ${loading ? 'loading' : ''}`} style={{ flex:2 }} onClick={handleRegister} disabled={loading}>
              <span className="btn-text">Create Account →</span>
              <div className="btn-loader" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── ProtectedRoute HOC ────────────────────────────────────────────

// frontend/components/auth/ProtectedRoute.jsx
import { useEffect } from 'react';

export function ProtectedRoute({ children, redirectTo = '/login' }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [user, loading]);

  if (loading) return <AuthLoadingScreen />;
  if (!user)   return null;
  return children;
}

function AuthLoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--fd)', fontSize:20, fontWeight:800, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:10, height:10, background:'var(--g)', borderRadius:'50%', display:'inline-block', animation:'pd 2s ease-in-out infinite' }} />
          StockPulse
        </div>
        <div style={{ width:32, height:32, border:'3px solid var(--bg3)', borderTopColor:'var(--b)', borderRadius:'50%', animation:'spin .6s linear infinite', margin:'0 auto' }} />
      </div>
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────

function FormField({ label, error, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {error && <div className="field-error" style={{ display:'flex' }}>⚠ {error}</div>}
    </div>
  );
}

function UsernameInput({ value, onChange }) {
  const [state, setState] = useState('idle'); // idle | checking | available | taken
  let debounce;

  const check = (v) => {
    onChange(v);
    if (v.length < 3) { setState('idle'); return; }
    setState('checking');
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(v)}`);
        const { available } = await res.json();
        setState(available ? 'available' : 'taken');
      } catch { setState('idle'); }
    }, 600);
  };

  return (
    <div style={{ position:'relative' }}>
      <input
        className={`form-input ${state === 'taken' ? 'error' : state === 'available' ? 'success' : ''}`}
        type="text"
        placeholder="arjun_trades"
        value={value}
        onChange={e => check(e.target.value)}
        autoComplete="username"
        style={{ paddingRight:30 }}
      />
      <span className="input-icon" style={{ color: state==='available' ? 'var(--g)' : state==='taken' ? 'var(--r)' : 'var(--t3)' }}>
        {{ checking:'⟳', available:'✓', taken:'✗', idle:'' }[state]}
      </span>
      {state === 'available' && <div className="field-success">✓ Username available</div>}
      {state === 'taken'     && <div className="field-error" style={{ display:'flex' }}>⚠ Username taken</div>}
    </div>
  );
}

function PasswordStrengthBar({ strength }) {
  const colors = ['var(--r)','var(--r)','var(--am)','var(--b)','var(--g)'];
  const labels  = ['','Too weak','Weak','Fair','Good','Strong'];
  return (
    <div className="pw-strength">
      <div className="pw-bars">
        {[0,1,2,3].map(i => (
          <div key={i} className="pw-bar" style={{ background: i < strength.level ? colors[strength.level] : 'var(--bg3)' }} />
        ))}
      </div>
      <div className="pw-label" style={{ color: colors[strength.level] || 'var(--t3)' }}>
        {strength.level > 0 ? labels[strength.level] : 'Enter a password'}
      </div>
    </div>
  );
}

function OTPInput({ email, otp, setOtp, onVerify, loading, error, onResend }) {
  const update = (idx, val) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.querySelectorAll('.otp-cell')[idx + 1]?.focus();
  };

  return (
    <>
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, marginBottom:6 }}>Verify your email</div>
        <div style={{ fontSize:12, color:'var(--t2)' }}>We sent a 6-digit code to <strong>{email}</strong></div>
      </div>
      {error && <div className="form-alert alert-error show">{error}</div>}
      <div className="otp-inputs">
        {otp.map((val, idx) => (
          <input key={idx} className="otp-cell" value={val} maxLength={1}
            onChange={e => update(idx, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !val && idx > 0) document.querySelectorAll('.otp-cell')[idx-1]?.focus(); }}
          />
        ))}
      </div>
      <button className={`submit-btn ${loading ? 'loading' : ''}`} onClick={onVerify} disabled={loading || otp.join('').length < 6}>
        <span className="btn-text">Verify & Continue →</span>
        <div className="btn-loader" />
      </button>
      <div style={{ textAlign:'center', marginTop:14, fontSize:12, color:'var(--t3)' }}>
        Didn't receive? <span style={{ color:'var(--b)', cursor:'pointer' }} onClick={onResend}>Resend code</span>
      </div>
    </>
  );
}

function OAuthButtons() {
  const { oauthLogin } = useAuth();
  return (
    <div className="oauth-grid">
      <div className="oauth-btn" onClick={() => oauthLogin('google')}>
        <span className="oauth-icon">G</span> Google
      </div>
      <div className="oauth-btn" onClick={() => oauthLogin('github')}>
        <span className="oauth-icon">◆</span> GitHub
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div style={{ marginTop:16, padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--br)', borderRadius:6, fontSize:11, color:'var(--t2)' }}>
      <span style={{ fontFamily:'var(--fm)', fontSize:9, color:'var(--b)', marginRight:6 }}>DEMO</span>
      Use <strong style={{ color:'var(--t1)' }}>demo@stockpulse.in</strong> / <strong style={{ color:'var(--t1)' }}>demo1234</strong>
    </div>
  );
}