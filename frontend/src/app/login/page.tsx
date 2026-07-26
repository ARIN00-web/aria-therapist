'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase());
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('No account')) {
        setError('No account found. Please sign up first.');
      } else {
        setError(msg);
      }
    } finally {
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
        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Enter your email to continue your journey.</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <Button type="submit" loading={loading} style={{ width: '100%', padding: '12px' }}>
            Continue
          </Button>
        </form>

        <p style={styles.footer}>
          New here?{' '}
          <a href="/onboarding" style={styles.link}>Create an account</a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.08) 0%, transparent 70%)',
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
  form: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
  },
  error: { fontSize: 13, color: 'var(--red)', margin: 0 },
  footer: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 },
};
