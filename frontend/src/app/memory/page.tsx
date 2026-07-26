'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { memoryApi, type MemoryProfile } from '@/lib/api';
import { Card, EmptyState, Skeleton } from '@/components/ui';

export default function MemoryPage() {
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    memoryApi.get()
      .then((r) => setProfile(r.profile))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasData = profile && (
    profile.recurringThemes.length > 0 ||
    profile.keyPeople.length > 0 ||
    profile.triggers.length > 0 ||
    profile.copingStrategies.length > 0 ||
    profile.progressNotes.length > 0 ||
    profile.followUpTopics.length > 0 ||
    profile.moodTrend
  );

  return (
    <AppShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Aria&apos;s memory</h1>
          <p style={styles.sub}>
            Aria builds a private profile over time to personalise your sessions.
            This is what she remembers about you.
          </p>
        </div>

        {loading ? (
          <div style={styles.grid}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={120} />)}
          </div>
        ) : !hasData ? (
          <EmptyState
            icon="◉"
            title="No memories yet"
            hint="Complete a few sessions and Aria will start building your profile."
          />
        ) : (
          <div style={styles.grid}>
            {profile!.moodTrend && (
              <Card style={{ gridColumn: 'span 2' }}>
                <SectionTitle>Overall mood trend</SectionTitle>
                <p style={styles.moodTrend}>{profile!.moodTrend}</p>
              </Card>
            )}

            {profile!.recurringThemes.length > 0 && (
              <Card>
                <SectionTitle>Recurring themes</SectionTitle>
                <div style={styles.tagRow}>
                  {profile!.recurringThemes.map((t) => (
                    <span key={t} style={styles.tag}>{t}</span>
                  ))}
                </div>
              </Card>
            )}

            {profile!.triggers.length > 0 && (
              <Card>
                <SectionTitle>Known triggers</SectionTitle>
                <div style={styles.tagRow}>
                  {profile!.triggers.map((t) => (
                    <span key={t} style={{ ...styles.tag, ...styles.tagAmber }}>{t}</span>
                  ))}
                </div>
              </Card>
            )}

            {profile!.keyPeople.length > 0 && (
              <Card>
                <SectionTitle>Important people</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {profile!.keyPeople.map((p) => (
                    <div key={p.name} style={styles.personRow}>
                      <div style={styles.personAvatar}>{p.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={styles.personName}>{p.name}</div>
                        <div style={styles.personMeta}>{p.relationship}{p.dynamic ? ` · ${p.dynamic}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {profile!.copingStrategies.length > 0 && (
              <Card>
                <SectionTitle>Coping strategies</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {profile!.copingStrategies.map((c) => (
                    <div key={c.strategy} style={styles.strategyRow}>
                      <span style={styles.strategyName}>{c.strategy}</span>
                      <span style={{
                        ...styles.effectBadge,
                        color: c.effectiveness === 'high' ? 'var(--green)' : c.effectiveness === 'low' ? 'var(--red)' : 'var(--amber)',
                      }}>
                        {c.effectiveness}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {profile!.followUpTopics.length > 0 && (
              <Card>
                <SectionTitle>Suggested follow-up topics</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profile!.followUpTopics.map((t) => (
                    <div key={t} style={styles.followUpRow}>
                      <span style={{ color: 'var(--accent)', fontSize: 12 }}>→</span>
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {profile!.progressNotes.length > 0 && (
              <Card style={{ gridColumn: 'span 2' }}>
                <SectionTitle>Progress notes</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {profile!.progressNotes.slice(-5).map((n, i) => (
                    <div key={i} style={styles.noteRow}>
                      <span style={styles.noteDot} />
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 28px', maxWidth: 900, margin: '0 auto' },
  header: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 560 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  moodTrend: { fontSize: 15, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: 'var(--accent-glow)', border: '1px solid rgba(124,106,247,0.3)', color: 'var(--accent)',
  },
  tagAmber: {
    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--amber)',
  },
  personRow: { display: 'flex', alignItems: 'center', gap: 10 },
  personAvatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  personName: { fontSize: 14, fontWeight: 600 },
  personMeta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  strategyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 8 },
  strategyName: { fontSize: 13, color: 'var(--text)' },
  effectBadge: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  followUpRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  noteRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  noteDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 },
};
