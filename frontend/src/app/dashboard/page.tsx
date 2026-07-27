'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { sessionsApi, wellnessApi, type Session, type WellnessSummary } from '@/lib/api';
import { Card, Skeleton, MOOD_EMOJI } from '@/components/ui';
import { FadeIn } from '@/components/motion';
import { useChartTheme } from '@/lib/chartTheme';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const chart = useChartTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [wellness, setWellness] = useState<WellnessSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([sessionsApi.list(), wellnessApi.summary()])
      .then(([s, w]) => { setSessions(s.sessions); setWellness(w); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const moodData = wellness?.moods.map((m) => ({
    date: new Date(m.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    mood: m.mood,
  })) || [];

  const avgMood = moodData.length
    ? Math.round((moodData.reduce((s, d) => s + (d.mood || 0), 0) / moodData.length) * 10) / 10
    : null;

  const completedGoals = wellness?.goals.filter((g) => g.completed).length || 0;
  const totalGoals = wellness?.goals.length || 0;

  return (
    <AppShell>
      <div style={styles.page}>
        <FadeIn>
          <div style={styles.header}>
            <div>
              <h1 style={styles.greeting}>
                {getGreeting()}, {user?.name?.split(' ')[0]} ✦
              </h1>
              <p style={styles.sub}>Here&apos;s how you&apos;ve been doing.</p>
            </div>
            <Link href="/chat" style={styles.startBtn}>
              Start a session
            </Link>
          </div>
        </FadeIn>

        {/* Stats row */}
        <FadeIn delay={0.05}>
          <div style={styles.statsRow}>
          <StatCard
            label="Sessions"
            value={loading ? null : sessions.length}
            icon="❋"
            loading={loading}
          />
          <StatCard
            label="Avg mood"
            value={loading ? null : avgMood !== null ? `${avgMood}/10` : '—'}
            icon={avgMood ? MOOD_EMOJI[Math.round(avgMood) - 1] : '😐'}
            loading={loading}
          />
          <StatCard
            label="Goals done"
            value={loading ? null : `${completedGoals}/${totalGoals}`}
            icon="✓"
            loading={loading}
          />
          <StatCard
            label="Journal entries"
            value={loading ? null : wellness?.journals.length || 0}
            icon="✎"
            loading={loading}
          />
        </div>
        </FadeIn>

        <div style={styles.grid}>
          {/* Mood chart */}
          <Card style={{ gridColumn: 'span 2' }}>
            <div style={styles.cardTitle}>Mood over time</div>
            {loading ? (
              <Skeleton height={160} />
            ) : moodData.length === 0 ? (
              <div style={styles.empty}>No mood data yet. Log your mood in Wellness.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={moodData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chart.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chart.muted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1, 10]} tick={{ fontSize: 11, fill: chart.muted }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: chart.muted }}
                    itemStyle={{ color: chart.accent }}
                  />
                  <Area type="monotone" dataKey="mood" stroke={chart.accent} strokeWidth={2} fill="url(#moodGrad)" dot={{ fill: chart.accent, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Recent sessions */}
          <Card>
            <div style={styles.cardTitle}>Recent sessions</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={52} />)}
              </div>
            ) : sessions.length === 0 ? (
              <div style={styles.empty}>No sessions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.slice(0, 5).map((s) => (
                  <Link key={s._id} href={`/history/${s._id}`} style={styles.sessionRow}>
                    <div>
                      <div style={styles.sessionDate}>
                        {new Date(s.startedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      {s.summaryCard?.themes?.length ? (
                        <div style={styles.sessionThemes}>{s.summaryCard.themes.join(' · ')}</div>
                      ) : null}
                    </div>
                    {s.moodBefore && s.moodAfter && (
                      <div style={styles.moodChange}>
                        <span>{s.moodBefore}</span>
                        <span style={{ color: 'var(--text-dim)' }}>→</span>
                        <span style={{ color: s.moodAfter >= s.moodBefore ? 'var(--green)' : 'var(--red)' }}>{s.moodAfter}</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Goals */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={styles.cardTitle}>Goals</div>
              <Link href="/wellness" style={styles.seeAll}>See all →</Link>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map((i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : !wellness?.goals.length ? (
              <div style={styles.empty}>No goals yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wellness.goals.slice(0, 5).map((g) => (
                  <div key={g._id} style={styles.goalRow}>
                    <span style={{ ...styles.goalDot, background: g.completed ? 'var(--green)' : 'var(--border)' }} />
                    <span style={{ fontSize: 13, color: g.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: g.completed ? 'line-through' : 'none' }}>
                      {g.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Wellness resources */}
          <Card style={{ gridColumn: 'span 2' }}>
            <div style={styles.cardTitle}>Quick tools</div>
            <div style={styles.resourcesGrid}>
              {(wellness?.resources || []).map((r) => (
                <Link key={r.title} href={`/wellness?tab=tools&tool=${encodeURIComponent(r.title)}`} style={styles.resourceCard}>
                  <div style={styles.resourceCategory}>{r.category}</div>
                  <div style={styles.resourceTitle}>{r.title}</div>
                  <div style={styles.resourceDesc}>{r.description}</div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon, loading }: { label: string; value: string | number | null; icon: string; loading: boolean }) {
  return (
    <Card style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      {loading ? <Skeleton height={28} width={60} /> : (
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value ?? '—'}</div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </Card>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 28px', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  greeting: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--text-muted)' },
  startBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
  },
  statsRow: { display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 },
  empty: { fontSize: 13, color: 'var(--text-dim)', padding: '20px 0', textAlign: 'center' },
  sessionRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)',
    textDecoration: 'none', transition: 'background 0.15s',
  },
  sessionDate: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  sessionThemes: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  moodChange: { display: 'flex', gap: 4, fontSize: 13, fontWeight: 600, alignItems: 'center' },
  seeAll: { fontSize: 12, color: 'var(--accent)', textDecoration: 'none' },
  goalRow: { display: 'flex', alignItems: 'center', gap: 10 },
  goalDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  resourcesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  resourceCard: {
    padding: 14, borderRadius: 10, background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', textDecoration: 'none', display: 'block',
    transition: 'border-color 0.15s',
  },
  resourceCategory: { fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  resourceTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 },
  resourceDesc: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 },
};
