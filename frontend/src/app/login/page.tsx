'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { signIn, signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui';

function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  return 'http://localhost:5001';
}

const API_BASE = getApiBase();

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  // If the user is already authenticated, skip the login screen.
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.consentAcceptedAt) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get('error');
    if (!oauthError) return;

    setError(formatOauthError(oauthError));
  }, []);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split('@')[0],
        });

        if (signUpError) {
          throw new Error(signUpError.message || 'Could not create account');
        }
      } else {
        const { error: signInError } = await signIn.email({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw new Error(signInError.message || 'Invalid email or password');
        }
      }

      const refreshedUser = await refresh();
      if (refreshedUser && !refreshedUser.consentAcceptedAt) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setError('Unable to reach the backend service. Please check your connection.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: `${window.location.origin}/auth/callback`,
          errorCallbackURL: `${window.location.origin}/login?error=oauth`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const signInUrl = typeof data.url === 'string'
        ? data.url
        : typeof data.data?.url === 'string'
          ? data.data.url
          : null;

      if (!res.ok || !signInUrl) {
        throw new Error(data.message || data.error || 'Could not start Google sign-in');
      }

      window.location.href = signInUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start Google sign-in';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setError('Unable to reach the backend service. Please check your connection.');
      } else {
        setError(msg);
      }
      setGoogleLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="glass animate-fade-in">
        <div style={styles.logo}>
          <span style={styles.logoIcon}>✦</span>
          <span style={styles.logoText}>Aria</span>
        </div>
        <h1 style={styles.heading}>Welcome to Aria</h1>
        <p style={styles.sub}>Your calm, private space to talk things through.</p>

        <div style={styles.tabRow}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); }}
            style={{
              ...styles.tabBtn,
              ...(mode === 'signin' ? styles.tabBtnActive : {}),
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            style={{
              ...styles.tabBtn,
              ...(mode === 'signup' ? styles.tabBtnActive : {}),
            }}
          >
            Create Account
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleEmailAuth} style={styles.form}>
          {mode === 'signup' && (
            <div style={styles.field}>
              <label style={styles.label}>Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                required
                style={styles.input}
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              style={styles.input}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            style={{ width: '100%', padding: '12px', marginTop: 4 }}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        <Button
          type="button"
          onClick={handleGoogle}
          loading={googleLoading}
          variant="soft"
          style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {!googleLoading && <GoogleIcon />}
          Continue with Google
        </Button>

        <p style={styles.footer}>
          By continuing you agree to talk with an AI companion. Aria is supportive,
          not a substitute for professional care.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" />
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71l2.84 2.2c1.66-1.53 2.76-3.78 2.76-6.56z" />
      <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.79.53-1.84.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.44 15.98 5.48 18 9 18z" />
    </svg>
  );
}

function formatOauthError(error: string) {
  if (error === 'account_not_linked') {
    return 'This Google account matches an existing Aria account. Please try signing in again to link it.';
  }

  if (error === 'oauth') {
    return 'Google sign-in did not complete. Please try again.';
  }

  return `Google sign-in failed: ${error.replaceAll('_', ' ')}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 70%)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logoIcon: { fontSize: 22, color: 'var(--accent)' },
  logoText: { fontSize: 20, fontWeight: 700, color: 'var(--text)' },
  heading: { fontSize: 24, fontWeight: 700, color: 'var(--text)' },
  sub: { fontSize: 14, color: 'var(--text-muted)', marginTop: -8 },
  tabRow: {
    display: 'flex',
    borderRadius: 8,
    background: 'var(--bg-elevated)',
    padding: 4,
    gap: 4,
    border: '1px solid var(--border)',
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '4px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  dividerText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  error: { fontSize: 13, color: 'var(--red)', margin: 0 },
  footer: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 },
};
