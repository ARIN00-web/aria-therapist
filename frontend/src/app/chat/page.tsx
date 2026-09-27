'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { sessionsApi, type Session, type Message } from '@/lib/api';
import { streamMessage } from '@/lib/stream';
import { Button, MoodSlider } from '@/components/ui';
import { useVoiceChat } from '@/lib/useVoiceChat';
import VoiceModeModal from '@/components/VoiceModeModal';

type Phase = 'loading' | 'mood-in' | 'chat' | 'mood-out' | 'summary';

export default function ChatPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
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
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveSession() {
      setLoading(true);
      try {
        const { session: activeSession } = await sessionsApi.active();
        if (cancelled) return;

        if (activeSession?.status === 'active') {
          setSession(activeSession);
          setMessages(activeSession.messages || []);
          if (activeSession.moodBefore) setMoodBefore(activeSession.moodBefore);
          setPhase('chat');
          setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          setPhase('mood-in');
        }
      } catch {
        if (!cancelled) setPhase('mood-in');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadActiveSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || phase !== 'chat') return;

    const remainingMs = new Date(session.startedAt).getTime() + (5 * 60 * 60 * 1_000) - Date.now();
    const timeout = window.setTimeout(() => {
      setError('This session has ended after its five-hour limit.');
      setStreaming(false);
      setPhase('mood-in');
      setSession(null);
    }, Math.max(0, remainingMs));

    return () => window.clearTimeout(timeout);
  }, [session, phase]);

  async function startSession() {
    setLoading(true);
    setError('');
    try {
      const { session: s } = await sessionsApi.create(moodBefore);
      setSession(s);
      setMessages(s.messages || []);
      if (s.moodBefore) setMoodBefore(s.moodBefore);
      setPhase('chat');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start session');
    } finally {
      setLoading(false);
    }
  }

  const {
    isListening,
    isSpeaking,
    voiceEnabled,
    sttSupported,
    ttsSupported,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleVoiceEnabled,
  } = useVoiceChat({
    voiceMode: voiceModalOpen,
    onTranscript: (transcript) => {
      setInput(transcript);
    },
    onAutoSend: (text) => {
      if (text && !streaming) {
        sendMessage(text);
      }
    },
  });

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!session || !text || streaming) return;

    stopSpeaking();
    setCurrentlySpeakingIndex(null);

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
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.content, ts: new Date().toISOString() },
        ]);
        setStreamingText('');
        setStreaming(false);
        if (voiceEnabled) {
          speak(data.content);
        }
      },
      onDone: () => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: accumulated, ts: new Date().toISOString() },
        ]);
        setStreamingText('');
        setStreaming(false);

        if (voiceEnabled && accumulated) {
          speak(accumulated, () => {
            if (voiceModalOpen) {
              startListening();
            }
          });
        }
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      onError: (msg) => {
        setError(msg);
        setStreamingText('');
        setStreaming(false);
      },
    });
  }, [session, input, streaming, voiceEnabled, voiceModalOpen, speak, stopSpeaking, startListening]);

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
        {phase === 'loading' && (
          <div style={styles.centeredCard} className="glass animate-fade-in">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>✦</span>
              <h1 style={styles.cardTitle}>Opening your session...</h1>
              <p style={styles.cardSub}>Restoring your latest conversation with Aria.</p>
            </div>
          </div>
        )}

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
                  {isSpeaking ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                      <span>Speaking</span>
                      <span className="typing-dot" />
                    </span>
                  ) : streaming ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : isListening ? (
                    <span style={{ color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />
                      Listening…
                    </span>
                  ) : 'Here with you'}
                </div>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Voice Mode Button */}
                <button
                  type="button"
                  onClick={() => {
                    setVoiceModalOpen(true);
                    startListening();
                  }}
                  style={styles.voiceModeBtn}
                  title="Open hands-free Voice Mode"
                >
                  <span style={{ fontSize: 13 }}>🎙️</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Voice Mode</span>
                </button>

                {/* Auto-readout mute/unmute toggle */}
                <button
                  type="button"
                  onClick={toggleVoiceEnabled}
                  style={styles.headerIconBtn}
                  title={voiceEnabled ? 'Voice readout is ON (Click to mute)' : 'Voice readout is MUTED (Click to unmute)'}
                  aria-label="Toggle voice readout"
                >
                  {voiceEnabled ? '🔊' : '🔇'}
                </button>

                <Button
                  variant="soft"
                  style={{ fontSize: 13, padding: '7px 14px' }}
                  onClick={() => setPhase('mood-out')}
                >
                  End session
                </Button>
              </div>
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
                    <div>{msg.content}</div>
                    {msg.role === 'assistant' && (
                      <div style={styles.bubbleActions}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeaking && currentlySpeakingIndex === i) {
                              stopSpeaking();
                              setCurrentlySpeakingIndex(null);
                            } else {
                              setCurrentlySpeakingIndex(i);
                              speak(msg.content, () => setCurrentlySpeakingIndex(null));
                            }
                          }}
                          style={styles.readAloudBtn}
                          title={isSpeaking && currentlySpeakingIndex === i ? 'Stop reading' : 'Read aloud'}
                          aria-label="Read message aloud"
                        >
                          {isSpeaking && currentlySpeakingIndex === i ? '⏹ Stop' : '🔊 Listen'}
                        </button>
                      </div>
                    )}
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
                  placeholder={
                    isListening
                      ? 'Listening to you… speak now'
                      : "Share what's on your mind… (Enter to send)"
                  }
                  disabled={streaming}
                  rows={1}
                  style={{
                    ...styles.textarea,
                    ...(isListening
                      ? {
                          borderColor: 'var(--red)',
                          boxShadow: '0 0 0 2px rgba(220,106,106,0.2)',
                        }
                      : {}),
                  }}
                />

                {/* Microphone Speech-to-Text Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={streaming}
                  style={{
                    ...styles.micInputBtn,
                    ...(isListening ? styles.micInputBtnActive : {}),
                  }}
                  title={isListening ? 'Stop listening' : 'Speak with microphone'}
                  aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? '⏹' : '🎙️'}
                </button>

                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || streaming}
                  style={{ flexShrink: 0, padding: '10px 16px' }}
                >
                  ↑
                </Button>
              </div>
              <p style={styles.inputHint}>
                {isListening
                  ? 'Speaking into microphone… click stop or pause to send'
                  : "Tap 🎙️ to talk · Shift+Enter for new line · End session when you're ready"}
              </p>
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
        <VoiceModeModal
          isOpen={voiceModalOpen}
          onClose={() => {
            setVoiceModalOpen(false);
            stopListening();
            stopSpeaking();
          }}
          isListening={isListening}
          isSpeaking={isSpeaking}
          streaming={streaming}
          transcript={input}
          lastAriaMessage={
            streamingText ||
            messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content ||
            ''
          }
          onStartListening={startListening}
          onStopListening={stopListening}
          onStopSpeaking={stopSpeaking}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoiceEnabled}
        />
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
  voiceModeBtn: {
    background: 'var(--accent-glow)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--accent)',
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s ease',
  },
  headerIconBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  micInputBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  micInputBtnActive: {
    background: 'var(--red)',
    borderColor: 'var(--red)',
    color: '#ffffff',
    boxShadow: '0 0 15px rgba(220, 106, 106, 0.5)',
  },
  bubbleActions: {
    marginTop: 6,
    display: 'flex',
    justifyContent: 'flex-start',
  },
  readAloudBtn: {
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s ease',
  },
};
