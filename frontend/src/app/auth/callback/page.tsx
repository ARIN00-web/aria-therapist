'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * OAuth return handler. better-auth has just set the session cookie and
 * redirected the browser here. We resolve the current user (via AuthContext,
 * which checks the better-auth cookie session), then route:
 *   - no consentAcceptedAt  → /onboarding  (brand-new Google user)
 *   - consentAcceptedAt set  → /dashboard   (returning user)
 *   - could not resolve      → /login
 *
 * There can be a brief lag between landing here and the cookie being readable,
 * so we retry `refresh()` a few times before giving up.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [message, setMessage] = useState('Signing you in…');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    let cancelled = false;
    const MAX_ATTEMPTS = 6;

    async function resolve() {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        const user = await refresh();
        if (cancelled) return;
        if (user) {
          if (!user.consentAcceptedAt) {
            router.replace('/onboarding');
          } else {
            router.replace('/dashboard');
          }
          return;
        }
        // Cookie may not be readable yet — wait and retry.
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!cancelled) {
        setMessage('We couldn’t sign you in. Redirecting…');
        router.replace('/login?error=oauth');
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [refresh, router]);

  return (
    <div style={styles.page}>
      <div style={styles.inner} className="animate-fade-in">
        <div style={styles.dots} aria-hidden="true">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <p style={styles.text} role="status" aria-live="polite">{message}</p>
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
    background: 'radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 70%)',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  dots: { display: 'flex', gap: 6 },
  text: { fontSize: 15, color: 'var(--text-muted)' },
};
