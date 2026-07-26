'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { sessionsApi, type Session, type Message } from '@/lib/api';
import { streamMessage } from '@/lib/stream';
import { Button, MoodSlider } from '@/components/ui';

type Phase = 'mood-in' | 'chat' | 'mood-out' | 'summary';

export default function ChatPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('mood-in');
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [crisis, setCrisis] = useState<{ content: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function startSession() {
    setLoading(true);
    setError('');
    try {
      const { session: s } = await sessionsApi.create(moodBefore);
      setSession(s);
      setMessages([]);
      setPhase('chat');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start session');
    } finally {
      setLoading(false);
    }
  }

  const sendMessage = useCallback(async () => {
    if (!session || !input.trim() || streaming) return;
    const text = input.trim();
    setInput('');
    setError('');
    setStreaming(true);
    setStreamingText('');

    const userMsg: Message = { role: 'user', content: text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = '';

    await streamMessage(session._id, text, {
      onToken: (chunk) => {
        accumulated += chunk;
        setStreamingText(accumulated);
      },
      onCrisis: (data) => {
        setCrisis(data);
        setStreamingText('');
        setStreaming(false);
      },
      onDone: () => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: accumulated, ts: new Date().toISOString() },
        ]);
        setStreamingText('');
        setStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      onError: (msg) => {
        setError(msg);
        setStreamingText('');
        setStreaming(false);
      },
    });
  }, [session, input, streaming]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function endSession() {
    if (!session) return;
    setLoading(true);
    try {
      const { session: ended } = await sessionsApi.end(session._id, moodAfter);
      setSession(ended);
      setPhase('summary');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not end session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div style={styles.page}>
        {phase === 'mood-in' && (
          <div style={styles.centeredCard} className="glass animate-fade-in">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>✦</span>
              <h1 style={styles.cardTitle}>How are you feeling right now?</h1>
              <p style={styles.cardSub}>Take a moment to check in with yourself before we begin.</p>
            </div>
            <MoodSlider value={moodBefore} onChange={setMoodBefore} />
            {error && <p style={styles.error}>{error}</p>}
            <Button loading={loading} onClick={startSession} style={{ width: '100%', padding: 12 }}>
              Start session
            </Button>
          </div>
        )}

        {phase === 'chat' && (
          <div style={styles.chatWrap}>
            <div style={styles.chatHeader}>
              <div style={styles.ariaAvatar}>✦</div>
              <div>
                <div style={styles.ariaName}>Aria</div>
                <div style={styles.ariaStatus}>
                  {streaming ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : 'Here with you'}
                </div>
              </div>
              <Button
                variant="soft"
                style={{ marginLeft: 'auto', fontSize: 13 }}
                onClick={() => setPhase('mood-out')}
              >
                End session
              </Button>
            </div>

            <div style={styles.messages}>
              {messages.length === 0 && !streaming && (
                <div style={styles.emptyChat}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                  <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
                    Hi, I&apos;m Aria. I&apos;m here to listen. What&apos;s on your mind today?
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className="animate-fade-in"
                  style={{
                    ...styles.msgRow,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={styles.msgAvatar}>✦</div>
                  )}
                  <div
                    style={{
                      ...styles.bubble,
                      ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAria),
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {streamingText && (
                <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }} className="animate-fade-in">
                  <div style={styles.msgAvatar}>✦</div>
                  <div style={{ ...styles.bubble, ...styles.bubbleAria }}>
                    {streamingText}
                    <span style={{ opacity: 0.5 }}>▌</span>
                  </div>
                </div>
              )}

              {streaming && !streamingText && (
                <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
                  <div style={styles.msgAvatar}>✦</div>
                  <div style={{ ...styles.bubble, ...styles.bubbleAria }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              {crisis && (
                <div style={styles.crisisBox} className="animate-fade-in">
                  <div style={styles.crisisTitle}>⚠ Crisis Support</div>
                  <p style={styles.crisisText}>{crisis.content}</p>
                  <Button
                    variant="soft"
                    style={{ marginTop: 12, fontSize: 13 }}
                    onClick={() => setCrisis(null)}
                  >
                    Continue
                  </Button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div style={styles.inputArea}>
              {error && <p style={{ ...styles.error, marginBottom: 8 }}>{error}</p>}
              <div style={styles.inputRow}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Share what's on your mind… (Enter to send)"
                  disabled={streaming}
                  rows={1}
                  style={styles.textarea}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  style={{ flexShrink: 0, padding: '10px 16px' }}
                >
                  ↑
                </Button>
              </div>
              <p style={styles.inputHint}>Shift+Enter for new line · End session when you&apos;re ready</p>
            </div>
          </div>
        )}

        {phase === 'mood-out' && (
          <div style={styles.centeredCard} className="glass animate-fade-in">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>♥</span>
              <h1 style={styles.cardTitle}>How are you feeling now?</h1>
              <p style={styles.cardSub}>Check in with yourself after our conversation.</p>
            </div>
            <MoodSlider value={moodAfter} onChange={setMoodAfter} />
            {error && <p style={styles.error}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="soft" onClick={() => setPhase('chat')} style={{ flex: 1 }}>
                Back to chat
              </Button>
              <Button loading={loading} onClick={endSession} style={{ flex: 1 }}>
                Finish session
              </Button>
            </div>
          </div>
        )}

        {phase === 'summary' && session?.summaryCard && (
          <div style={styles.centeredCard} className="glass animate-slide-up">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>❋</span>
              <h1 style={styles.cardTitle}>Session complete</h1>
              <p style={styles.cardSub}>Here&apos;s a reflection from today&apos;s conversation.</p>
            </div>

            <div style={styles.moodDiff}>
              <div style={styles.moodDiffItem}>
                <div style={styles.moodDiffLabel}>Before</div>
                <div style={styles.moodDiffValue}>{session.moodBefore}/10</div>
              </div>
              <div style={styles.moodDiffArrow}>→</div>
              <div style={styles.moodDiffItem}>
                <div style={styles.moodDiffLabel}>After</div>
                <div style={styles.moodDiffValue}>{session.moodAfter}/10</div>
              </div>
            </div>

            {session.summaryCard.themes.length > 0 && (
              <div>
                <div style={styles.summaryLabel}>Themes explored</div>
                <div style={styles.tagRow}>
                  {session.summaryCard.themes.map((t) => (
                    <span key={t} style={styles.tag}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {session.summaryCard.reflection && (
              <div style={styles.reflectionBox}>
                <div style={styles.summaryLabel}>Reflection</div>
                <p style={styles.reflectionText}>{session.summaryCard.reflection}</p>
              </div>
            )}

            {session.summaryCard.nextTopic && (
              <div>
                <div style={styles.summaryLabel}>For next time</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {session.summaryCard.nextTopic}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Button variant="soft" onClick={() => router.push('/history')} style={{ flex: 1 }}>
                View history
              </Button>
              <Button onClick={() => router.push('/dashboard')} style={{ flex: 1 }}>
                Go to dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 480,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  cardHeader: { display: 'flex', flexDirection: 'column', gap: 8 },
  cardIcon: { fontSize: 28, color: 'var(--accent)' },
  cardTitle: { fontSize: 22, fontWeight: 700 },
  cardSub: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 },
  error: { fontSize: 13, color: 'var(--red)' },
  chatWrap: {
    width: '100%',
    maxWidth: 720,
    height: 'calc(100dvh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  ariaAvatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'var(--accent-glow)',
    border: '1px solid var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, color: 'var(--accent)', flexShrink: 0,
  },
  ariaName: { fontSize: 15, fontWeight: 700 },
  ariaStatus: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: 'var(--accent)',
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  msgAvatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--accent-glow)',
    border: '1px solid var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: 'var(--accent)', flexShrink: 0,
  },
  bubble: {
    maxWidth: '72%',
    padding: '12px 16px',
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleUser: {
    background: 'var(--accent)',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  bubbleAria: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderBottomLeftRadius: 4,
  },
  crisisBox: {
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 12,
    padding: 16,
  },
  crisisTitle: { fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 8 },
  crisisText: { fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  inputArea: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  inputRow: { display: 'flex', gap: 10, alignItems: 'flex-end' },
  textarea: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    maxHeight: 120,
    overflowY: 'auto',
  },
  inputHint: { fontSize: 11, color: 'var(--text-dim)', marginTop: 8 },
  moodDiff: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: '16px 0',
  },
  moodDiffItem: { textAlign: 'center' },
  moodDiffLabel: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 },
  moodDiffValue: { fontSize: 28, fontWeight: 700, color: 'var(--accent)' },
  moodDiffArrow: { fontSize: 20, color: 'var(--text-dim)' },
  summaryLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: {
    padding: '4px 10px',
    borderRadius: 20,
    background: 'var(--accent-glow)',
    border: '1px solid rgba(124,106,247,0.3)',
    color: 'var(--accent)',
    fontSize: 12,
    fontWeight: 600,
  },
  reflectionBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
  },
  reflectionText: { fontSize: 14, color: 'var(--text)', lineHeight: 1.7, fontStyle: 'italic' },
};
