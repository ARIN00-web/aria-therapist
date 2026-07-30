'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // If the user is already authenticated (either mode), skip the login screen.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  async function handleGoogle() {
    setError('');
    setLoading(true);
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
      if (!res.ok || typeof data.url !== 'string') {
        throw new Error(data.message || data.error || 'Could not start Google sign-in');
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start Google sign-in';
      setError(msg);
      setLoading(false);
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

        {error && <p style={styles.error}>Sign-in didn&apos;t work. Please try again.</p>}

        <Button
          type="button"
          onClick={handleGoogle}
          loading={loading}
          style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {!loading && <GoogleIcon />}
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
    maxWidth: 400,
    padding: '40px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logoIcon: { fontSize: 22, color: 'var(--accent)' },
  logoText: { fontSize: 20, fontWeight: 700, color: 'var(--text)' },
  heading: { fontSize: 24, fontWeight: 700, color: 'var(--text)' },
  sub: { fontSize: 14, color: 'var(--text-muted)', marginTop: -8 },
  error: { fontSize: 13, color: 'var(--red)', margin: 0 },
  footer: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 },
};
