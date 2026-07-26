'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { sessionsApi, type Session } from '@/lib/api';
import { Button, Card, Skeleton, MOOD_EMOJI } from '@/components/ui';

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    sessionsApi.get(sessionId)
      .then((r) => setSession(r.session))
      .catch(() => router.replace('/history'))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (loading) {
    return (
      <AppShell>
        <div style={styles.page}>
          <Skeleton height={40} width={200} />
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={80} />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!session) return null;

  return (
    <AppShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <Button variant="ghost" onClick={() => router.back()} style={{ padding: '6px 10px', fontSize: 13 }}>
            ← Back
          </Button>
          <div>
            <h1 style={styles.title}>
              {new Date(session.startedAt).toLocaleDateString('en', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </h1>
            <div style={styles.meta}>
              {session.endedAt && (
                <span>{formatDuration(session.startedAt, session.endedAt)}</span>
              )}
              <span style={statusStyle(session.status)}>{session.status}</span>
            </div>
          </div>
        </div>

        {/* Mood comparison */}
        {session.moodBefore != null && session.moodAfter != null && (
          <Card style={styles.moodCard}>
            <div style={styles.moodRow}>
              <MoodBlock label="Before" value={session.moodBefore} />
              <div style={styles.moodArrow}>→</div>
              <MoodBlock
                label="After"
                value={session.moodAfter}
                positive={session.moodAfter >= session.moodBefore}
              />
            </div>
          </Card>
        )}

        {/* Summary card */}
        {session.summaryCard && (
          <Card>
            <div style={styles.sectionLabel}>Session summary</div>
            {session.summaryCard.themes?.length > 0 && (
              <div style={styles.tagRow}>
                {session.summaryCard.themes.map((t) => (
                  <span key={t} style={styles.tag}>{t}</span>
                ))}
              </div>
            )}
            {session.summaryCard.reflection && (
              <p style={styles.reflection}>{session.summaryCard.reflection}</p>
            )}
            {session.summaryCard.nextTopic && (
              <div style={styles.nextTopic}>
                <span style={styles.nextTopicLabel}>For next time: </span>
                {session.summaryCard.nextTopic}
              </div>
            )}
          </Card>
        )}

        {/* Messages */}
        {session.messages && session.messages.length > 0 && (
          <Card>
            <div style={styles.sectionLabel}>Conversation ({session.messages.length} messages)</div>
            <div style={styles.messages}>
              {session.messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.msgRow,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && <div style={styles.ariaAvatar}>✦</div>}
                  <div style={{
                    ...styles.bubble,
                    ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAria),
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function MoodBlock({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>{MOOD_EMOJI[value - 1]}</div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: positive === undefined ? 'var(--text)' : positive ? 'var(--green)' : 'var(--red)',
        marginTop: 4,
      }}>
        {value}/10
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusStyle(status: string): React.CSSProperties {
  return {
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: status === 'ended' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
    color: status === 'ended' ? 'var(--green)' : 'var(--amber)',
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '28px 28px', maxWidth: 760, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  meta: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)' },
  moodCard: { marginBottom: 14 },
  moodRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 },
  moodArrow: { fontSize: 24, color: 'var(--text-dim)' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: {
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: 'var(--accent-glow)', border: '1px solid rgba(124,106,247,0.3)', color: 'var(--accent)',
  },
  reflection: { fontSize: 14, color: 'var(--text)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 12 },
  nextTopic: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 },
  nextTopicLabel: { fontWeight: 600, color: 'var(--text)' },
  messages: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  ariaAvatar: {
    width: 26, height: 26, borderRadius: '50%',
    background: 'var(--accent-glow)', border: '1px solid var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, color: 'var(--accent)', flexShrink: 0,
  },
  bubble: {
    maxWidth: '75%', padding: '10px 14px', borderRadius: 14,
    fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  bubbleUser: { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 },
  bubbleAria: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', borderBottomLeftRadius: 4 },
};
