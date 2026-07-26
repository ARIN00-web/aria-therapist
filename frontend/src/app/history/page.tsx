'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { sessionsApi, type Session } from '@/lib/api';
import { Card, Skeleton, EmptyState, MOOD_EMOJI } from '@/components/ui';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionsApi.list()
      .then((r) => setSessions(r.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Session history</h1>
          <Link href="/chat" style={styles.newBtn}>+ New session</Link>
        </div>

        {loading ? (
          <div style={styles.list}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={100} />)}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon="❋" title="No sessions yet" hint="Start a conversation with Aria to see your history here." />
        ) : (
          <div style={styles.list}>
            {sessions.map((s) => (
              <Link key={s._id} href={`/history/${s._id}`} style={{ textDecoration: 'none' }}>
                <Card style={styles.sessionCard} className="animate-fade-in">
                  <div style={styles.sessionTop}>
                    <div>
                      <div style={styles.sessionDate}>
                        {new Date(s.startedAt).toLocaleDateString('en', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                        })}
                      </div>
                      <div style={styles.sessionMeta}>
                        {s.endedAt && (
                          <span>{formatDuration(s.startedAt, s.endedAt)}</span>
                        )}
                        <span style={statusBadgeStyle(s.status)}>{s.status}</span>
                      </div>
                    </div>
                    {s.moodBefore != null && s.moodAfter != null && (
                      <div style={styles.moodPair}>
                        <div style={styles.moodItem}>
                          <div style={styles.moodEmoji}>{MOOD_EMOJI[s.moodBefore - 1]}</div>
                          <div style={styles.moodNum}>{s.moodBefore}</div>
                        </div>
                        <div style={{ color: 'var(--text-dim)', fontSize: 16 }}>→</div>
                        <div style={styles.moodItem}>
                          <div style={styles.moodEmoji}>{MOOD_EMOJI[s.moodAfter - 1]}</div>
                          <div style={{ ...styles.moodNum, color: s.moodAfter >= s.moodBefore ? 'var(--green)' : 'var(--red)' }}>
                            {s.moodAfter}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {s.summaryCard && (
                    <div style={styles.summarySection}>
                      {s.summaryCard.themes?.length > 0 && (
                        <div style={styles.tagRow}>
                          {s.summaryCard.themes.map((t) => (
                            <span key={t} style={styles.tag}>{t}</span>
                          ))}
                        </div>
                      )}
                      {s.summaryCard.reflection && (
                        <p style={styles.reflection}>{s.summaryCard.reflection}</p>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  return {
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: status === 'ended' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
    color: status === 'ended' ? 'var(--green)' : 'var(--amber)',
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 28px', maxWidth: 800, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700 },
  newBtn: {
    padding: '9px 16px', background: 'var(--accent)', color: '#fff',
    borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 600,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  sessionCard: { cursor: 'pointer', transition: 'border-color 0.15s' },
  sessionTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionDate: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  sessionMeta: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' },
  moodPair: { display: 'flex', alignItems: 'center', gap: 10 },
  moodItem: { textAlign: 'center' },
  moodEmoji: { fontSize: 20 },
  moodNum: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  summarySection: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: 'var(--accent-glow)', border: '1px solid rgba(124,106,247,0.3)', color: 'var(--accent)',
  },
  reflection: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' },
};
