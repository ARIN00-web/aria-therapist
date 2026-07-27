'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const MODALITIES = ['Auto', 'CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'];

const QUESTIONS = [
  { key: 'mainConcern', label: 'What brings you here today?', placeholder: 'e.g. stress, anxiety, relationship issues…' },
  { key: 'goals', label: 'What would you like to work on?', placeholder: 'e.g. feel calmer, improve sleep, build confidence…' },
  { key: 'previousTherapy', label: 'Have you tried therapy or counselling before?', placeholder: 'Optional — share as much or as little as you like' },
];

type Step = 'modality' | 'questions' | 'consent';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, setUser, refresh } = useAuth();

  const [step, setStep] = useState<Step>('modality');
  const [modality, setModality] = useState('Auto');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Onboarding is only reachable after Google OAuth. Guard the route:
  //  - not authenticated → back to login
  //  - already completed consent → straight to dashboard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.consentAcceptedAt) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  async function handleSubmit() {
    if (!consent) { setError('Please accept the terms to continue.'); return; }
    setError('');
    setLoading(true);
    try {
      const { user: updated } = await authApi.completeOnboardingOauth({
        preferredModality: modality,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        onboardingAnswers: answers,
        consentAccepted: true,
      });
      // Reflect the completed onboarding in context so guards see it immediately.
      if (updated) setUser(updated);
      else await refresh();
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // While the auth guard resolves (or is redirecting), avoid flashing the form.
  if (authLoading || !user || user.consentAcceptedAt) {
    return (
      <div style={styles.page}>
        <div style={styles.card} className="glass">
          <p style={styles.sub}>Loading…</p>
        </div>
      </div>
    );
  }

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <div style={styles.page}>
      <div style={styles.card} className="glass animate-fade-in">
        <ProgressBar step={step} />

        {step === 'modality' && (
          <div style={styles.section}>
            <div style={styles.bigIcon}>✦</div>
            <h1 style={styles.heading}>Welcome, {firstName}</h1>
            <p style={styles.sub}>
              Choose how you&apos;d like Aria to work with you. Auto lets Aria decide based on the conversation.
            </p>
            <div style={styles.modalityGrid}>
              {MODALITIES.map((m) => (
                <button
                  key={m}
                  onClick={() => setModality(m)}
                  style={{
                    ...styles.modalityBtn,
                    ...(modality === m ? styles.modalityBtnActive : {}),
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={styles.row}>
              <Button onClick={() => setStep('questions')}>Continue</Button>
            </div>
          </div>
        )}

        {step === 'questions' && (
          <div style={styles.section}>
            <h2 style={styles.heading}>A little more context</h2>
            <p style={styles.sub}>Optional — skip anything you prefer not to share.</p>
            <div style={styles.fields}>
              {QUESTIONS.map((q) => (
                <Field key={q.key} label={q.label}>
                  <textarea
                    style={{ ...styles.input, minHeight: 72, resize: 'vertical' }}
                    placeholder={q.placeholder}
                    value={answers[q.key] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
            <div style={styles.row}>
              <Button variant="soft" onClick={() => setStep('modality')}>Back</Button>
              <Button onClick={() => setStep('consent')}>Continue</Button>
            </div>
          </div>
        )}

        {step === 'consent' && (
          <div style={styles.section}>
            <h2 style={styles.heading}>Before we begin</h2>
            <div style={styles.consentBox}>
              <p style={styles.consentText}>
                Aria is an AI emotional support tool, not a licensed therapist or medical provider.
                Conversations are stored securely and encrypted. You can delete your data at any time.
                By continuing you confirm you are 18 or older and agree to use Aria responsibly.
              </p>
            </div>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text)' }}>
                I understand and agree to the above
              </span>
            </label>
            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.row}>
              <Button variant="soft" onClick={() => setStep('questions')}>Back</Button>
              <Button loading={loading} onClick={handleSubmit}>Start with Aria</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['modality', 'questions', 'consent'];
  const idx = steps.indexOf(step);
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i <= idx ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }}
        />
      ))}
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
  card: { width: '100%', maxWidth: 480, padding: '32px 36px' },
  section: { display: 'flex', flexDirection: 'column', gap: 16 },
  bigIcon: { fontSize: 40, color: 'var(--accent)', textAlign: 'center' },
  heading: { fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  sub: { fontSize: 14, color: 'var(--text-muted)', marginTop: -8 },
  body: { fontSize: 15, color: 'var(--text)', lineHeight: 1.6 },
  fields: { display: 'flex', flexDirection: 'column', gap: 14 },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  error: { fontSize: 13, color: 'var(--red)', margin: 0 },
  modalityGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  modalityBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modalityBtnActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-glow)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  consentBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
  },
  consentText: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 },
};
