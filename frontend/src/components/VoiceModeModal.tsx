'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  streaming: boolean;
  transcript: string;
  lastAriaMessage: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export default function VoiceModeModal({
  isOpen,
  onClose,
  isListening,
  isSpeaking,
  streaming,
  transcript,
  lastAriaMessage,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  voiceEnabled,
  onToggleVoice,
}: VoiceModeModalProps) {
  const [dots, setDots] = useState('');

  // Subtle breathing dots for thinking state
  useEffect(() => {
    if (!streaming) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [streaming]);

  if (!isOpen) return null;

  const getStatusText = () => {
    if (streaming) return `Aria is reflecting${dots}`;
    if (isSpeaking) return 'Aria is speaking…';
    if (isListening) return 'Listening to you…';
    return 'Tap the microphone to speak';
  };

  return (
    <div style={styles.overlay} className="animate-fade-in">
      {/* Header bar */}
      <div style={styles.topBar}>
        <div style={styles.branding}>
          <span style={styles.starIcon}>✦</span>
          <span style={styles.title}>Aria Voice Mode</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={onToggleVoice}
            style={styles.iconBtn}
            title={voiceEnabled ? 'Mute Aria' : 'Unmute Aria'}
            aria-label="Toggle voice readout"
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          <Button variant="soft" onClick={onClose} style={{ padding: '6px 14px', fontSize: 13 }}>
            Exit Voice
          </Button>
        </div>
      </div>

      {/* Center glowing orb */}
      <div style={styles.centerContainer}>
        <div
          style={{
            ...styles.orbWrapper,
            ...(isSpeaking
              ? styles.orbSpeaking
              : isListening
              ? styles.orbListening
              : streaming
              ? styles.orbThinking
              : styles.orbIdle),
          }}
        >
          <div style={styles.orbCore} />
          {isSpeaking && <div style={styles.pulseRing1} />}
          {isListening && <div style={styles.pulseRing2} />}
        </div>

        <p style={styles.statusLabel}>{getStatusText()}</p>

        {/* Live subtitles / transcript preview */}
        <div style={styles.subtitleBox}>
          {isListening && transcript && (
            <p style={styles.userTranscript}>“{transcript}”</p>
          )}
          {!isListening && lastAriaMessage && (
            <p style={styles.ariaTranscript}>
              {lastAriaMessage.length > 220
                ? lastAriaMessage.slice(0, 220) + '…'
                : lastAriaMessage}
            </p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={styles.bottomBar}>
        {isSpeaking ? (
          <Button
            variant="soft"
            onClick={onStopSpeaking}
            style={{ borderRadius: 30, padding: '12px 24px' }}
          >
            Pause Aria ⏹
          </Button>
        ) : (
          <button
            onClick={isListening ? onStopListening : onStartListening}
            style={{
              ...styles.micBtn,
              ...(isListening ? styles.micBtnActive : {}),
            }}
            title={isListening ? 'Stop listening' : 'Start speaking'}
          >
            <span style={{ fontSize: 24 }}>{isListening ? '⏹' : '🎙️'}</span>
          </button>
        )}
        <p style={styles.hint}>
          {isListening
            ? 'Speak freely. Pausing will automatically share with Aria.'
            : 'Tap mic or speak anytime.'}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'var(--bg)',
    backgroundImage: 'radial-gradient(circle at 50% 40%, var(--accent-glow) 0%, transparent 70%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '24px 20px 36px',
    backdropFilter: 'blur(20px)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 760,
    width: '100%',
    margin: '0 auto',
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  starIcon: {
    color: 'var(--accent)',
    fontSize: 18,
  },
  title: {
    fontWeight: 600,
    fontSize: 16,
    color: 'var(--text)',
  },
  iconBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '50%',
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--text)',
  },
  centerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '20px 0',
  },
  orbWrapper: {
    width: 160,
    height: 160,
    borderRadius: '50%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  orbCore: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #a78bfa 0%, #6d54d6 50%, #12a594 100%)',
    boxShadow: '0 0 50px rgba(109, 84, 214, 0.45)',
    filter: 'blur(2px)',
  },
  orbSpeaking: {
    transform: 'scale(1.15)',
    boxShadow: '0 0 80px rgba(109, 84, 214, 0.65)',
  },
  orbListening: {
    transform: 'scale(1.22)',
    boxShadow: '0 0 90px rgba(18, 165, 148, 0.6)',
  },
  orbThinking: {
    transform: 'scale(1.05)',
    filter: 'brightness(1.1)',
  },
  orbIdle: {
    transform: 'scale(1)',
    opacity: 0.85,
  },
  pulseRing1: {
    position: 'absolute',
    inset: -16,
    borderRadius: '50%',
    border: '2px solid rgba(109, 84, 214, 0.4)',
    animation: 'pulse-dot 1.8s infinite ease-out',
  },
  pulseRing2: {
    position: 'absolute',
    inset: -16,
    borderRadius: '50%',
    border: '2px solid rgba(18, 165, 148, 0.45)',
    animation: 'pulse-dot 1.5s infinite ease-out',
  },
  statusLabel: {
    marginTop: 36,
    fontSize: 16,
    fontWeight: 500,
    color: 'var(--text-muted)',
    letterSpacing: '0.2px',
  },
  subtitleBox: {
    marginTop: 20,
    maxWidth: 520,
    minHeight: 64,
    padding: '12px 18px',
    textAlign: 'center',
  },
  userTranscript: {
    fontSize: 16,
    fontStyle: 'italic',
    color: 'var(--text)',
    lineHeight: 1.5,
  },
  ariaTranscript: {
    fontSize: 15,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  bottomBar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  micBtn: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(109, 84, 214, 0.35)',
    transition: 'transform 0.15s, background 0.2s, box-shadow 0.2s',
  },
  micBtnActive: {
    background: 'var(--red)',
    boxShadow: '0 0 30px rgba(220, 106, 106, 0.6)',
    transform: 'scale(1.08)',
  },
  hint: {
    fontSize: 13,
    color: 'var(--text-dim)',
  },
};
