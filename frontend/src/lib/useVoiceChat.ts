'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseVoiceChatOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAutoSend?: (text: string) => void;
  voiceMode?: boolean;
}

export function useVoiceChat({
  onTranscript,
  onAutoSend,
  voiceMode = false,
}: UseVoiceChatOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const isSpeakingRef = useRef<boolean>(false);
  const queueRef = useRef<string[]>([]);
  const isPlayingQueueRef = useRef<boolean>(false);

  // Check support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasSTT = Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    const hasTTS = 'speechSynthesis' in window;

    setSttSupported(hasSTT);
    setTtsSupported(hasTTS);

    const storedVoiceEnabled = localStorage.getItem('aria-voice-enabled');
    if (storedVoiceEnabled !== null) {
      setVoiceEnabled(storedVoiceEnabled === 'true');
    }

    if (hasTTS) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);

        // Pick a soothing, gentle voice for Aria (prioritizing high quality female/natural voices)
        const bestVoice =
          voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google UK English Female') || v.name.includes('Samantha') || v.name.includes('Serena') || v.name.includes('Victoria'))) ||
          voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Zira'))) ||
          voices.find(v => v.lang.startsWith('en')) ||
          voices[0] ||
          null;

        setSelectedVoice(bestVoice);
      };

      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  // Clean markdown and formatting from text for natural speech synthesis
  const cleanTextForSpeech = useCallback((text: string): string => {
    return text
      .replace(/[*#_~`>]/g, '') // remove markdown symbols
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link text only
      .replace(/https?:\/\/\S+/g, '') // strip raw URLs
      .replace(/(\r\n|\n|\r)/gm, ' ') // newlines to spaces
      .replace(/\s+/g, ' ') // normalize spaces
      .trim();
  }, []);

  // Stop currently playing speech
  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  // Speak a piece of text with natural empathetic pacing
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !voiceEnabled) {
        onEnd?.();
        return;
      }

      stopSpeaking();

      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) {
        onEnd?.();
        return;
      }

      // Split into sentences for zero timeout issues and natural pauses
      const sentences = cleaned
        .split(/(?<=[.?!])\s+/)
        .filter(s => s.trim().length > 0);

      if (sentences.length === 0) {
        onEnd?.();
        return;
      }

      queueRef.current = sentences;
      isPlayingQueueRef.current = true;
      setIsSpeaking(true);
      isSpeakingRef.current = true;

      const playNext = () => {
        if (!isPlayingQueueRef.current || queueRef.current.length === 0) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          isPlayingQueueRef.current = false;
          onEnd?.();
          return;
        }

        const nextSentence = queueRef.current.shift()!;
        const utterance = new SpeechSynthesisUtterance(nextSentence);

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        // Empathetic, calm therapist pacing
        utterance.rate = 0.94;
        utterance.pitch = 1.02;

        utterance.onend = () => {
          playNext();
        };

        utterance.onerror = (e) => {
          if (e.error !== 'canceled') {
            console.warn('[speech:error]', e);
          }
          playNext();
        };

        window.speechSynthesis.speak(utterance);
      };

      playNext();
    },
    [voiceEnabled, selectedVoice, cleanTextForSpeech, stopSpeaking]
  );

  // Initialize and start Speech Recognition
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Interrupt any active Aria speaking when user speaks
    stopSpeaking();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      latestTranscriptRef.current = '';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }

        const combined = (final || interim).trim();
        if (combined) {
          latestTranscriptRef.current = combined;
          onTranscript?.(combined, Boolean(final));

          // If in Voice Mode, detect speech pauses for hands-free auto-send
          if (voiceMode && onAutoSend) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              const toSend = latestTranscriptRef.current.trim();
              if (toSend.length > 1) {
                stopListening();
                onAutoSend(toSend);
              }
            }, 1400); // 1.4s silence triggers auto-send in voice mode
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[speech-recognition:error]', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[speech-recognition:start_failed]', err);
      setIsListening(false);
    }
  }, [voiceMode, onTranscript, onAutoSend, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const toggleVoiceEnabled = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('aria-voice-enabled', String(next));
      if (!next) {
        stopSpeaking();
      }
      return next;
    });
  }, [stopSpeaking]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    voiceEnabled,
    sttSupported,
    ttsSupported,
    availableVoices,
    selectedVoice,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleVoiceEnabled,
    setSelectedVoice,
  };
}
