'use client';

import { FormEvent, useMemo, useState } from 'react';
import { completeOnboarding, createSession, endSession, streamMessage } from '@/lib/api';

type Step = 'consent' | 'onboarding' | 'mood' | 'session';
type Message = { role: 'user' | 'assistant'; content: string };

const questions = [
  { key: 'name', label: "What's your name?", type: 'input' },
  { key: 'reason', label: 'What brings you here today?', type: 'textarea' },
  { key: 'support', label: 'What kind of support are you looking for?', type: 'choice', choices: ['Practical tools', 'Just want to be heard', 'Understand myself better'] },
  { key: 'therapyBefore', label: 'Have you spoken to a therapist before?', type: 'choice', choices: ['Yes', 'No', 'A little'] },
  { key: 'safety', label: 'Are you currently having thoughts of harming yourself?', type: 'choice', choices: ['No', 'Yes'] }
];

const modalities = ['CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'];

export function AriaApp() {
  const [step, setStep] = useState<Step>('consent');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [modality, setModality] = useState('CBT');
  const [accessToken, setAccessToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "I'm here with you. We can take this slowly, one thing at a time." }
  ]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showBreathing, setShowBreathing] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const currentQuestion = questions[questionIndex];
  const safetyAnsweredYes = answers.safety === 'Yes';

  const canContinue = useMemo(() => {
    if (step === 'consent') return true;
    const value = answers[currentQuestion?.key || ''];
    return Boolean(value?.trim());
  }, [answers, currentQuestion, step]);

  async function continueOnboarding() {
    setError('');
    if (safetyAnsweredYes) {
      setMessages([{ role: 'assistant', content: 'Please reach out right now: iCall (India): 9152987821, Vandrevala Foundation: 1860-2662-345, NIMHANS: 080-46110007.' }]);
      setStep('session');
      return;
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1);
      return;
    }

    if (!email.trim()) {
      setError('Email is required so your sessions can be private to you.');
      return;
    }

    try {
      const token = await completeOnboarding({
        name: answers.name,
        email,
        preferredModality: modality,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingAnswers: answers,
        consentAccepted: true
      });
      setAccessToken(token);
      setStep('mood');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not complete onboarding.');
    }
  }

  async function startSession() {
    setError('');
    try {
      const id = await createSession(accessToken, moodBefore);
      setSessionId(id);
      setStep('session');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start session.');
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending || !sessionId) return;

    setDraft('');
    setIsSending(true);
    setError('');
    setMessages((current) => [...current, { role: 'user', content }, { role: 'assistant', content: '' }]);

    try {
      await streamMessage({
        accessToken,
        sessionId,
        message: content,
        onToken: (token) => appendAssistantText(token),
        onCrisis: (crisisContent) => {
          setMessages((current) => current.slice(0, -1).concat({ role: 'assistant', content: crisisContent }));
        }
      });
    } catch (requestError) {
      appendAssistantText("I'm having trouble connecting right now. Your words matter, and you can try again in a moment.");
      setError(requestError instanceof Error ? requestError.message : 'Message failed.');
    } finally {
      setIsSending(false);
    }
  }

  async function finishSession() {
    if (!sessionId) return;
    try {
      await endSession(accessToken, sessionId, moodAfter);
      setSessionEnded(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not end session.');
    }
  }

  function appendAssistantText(token: string) {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (last?.role === 'assistant') last.content += token;
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <CrisisRail onBreathing={() => setShowBreathing(true)} />
      {step === 'consent' && (
        <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Aria</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">A quieter place to talk through what you are carrying.</h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">Aria is an AI emotional support companion, not a licensed therapist. It is not a substitute for professional mental health care.</p>
          <div className="mt-8 rounded-lg border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="leading-7">In a crisis, please call iCall: 9152987821 or Vandrevala Foundation: 1860-2662-345 (24/7).</p>
          </div>
          <button className="mt-8 w-fit rounded-md bg-[var(--accent)] px-6 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]" onClick={() => setStep('onboarding')}>
            I understand
          </button>
        </section>
      )}

      {step === 'onboarding' && (
        <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-[var(--soft)]">
            <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <h2 className="text-3xl font-semibold leading-tight">{currentQuestion.label}</h2>
          <OnboardingInput question={currentQuestion} value={answers[currentQuestion.key] || ''} onChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.key]: value }))} />
          {questionIndex === questions.length - 1 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">Email<input className="field" value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
              <label className="grid gap-2 text-sm font-medium">Preferred approach<select className="field" value={modality} onChange={(event) => setModality(event.target.value)}>{modalities.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>}
          <button disabled={!canContinue} className="mt-8 w-fit rounded-md bg-[var(--accent)] px-6 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50" onClick={continueOnboarding}>Continue</button>
        </section>
      )}

      {step === 'mood' && (
        <section className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
          <h2 className="text-3xl font-semibold">Before we begin, where is your mood today?</h2>
          <MoodSlider value={moodBefore} onChange={setMoodBefore} />
          {error && <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>}
          <button className="mt-8 w-fit rounded-md bg-[var(--accent)] px-6 py-3 font-medium text-white" onClick={startSession}>Start session</button>
        </section>
      )}

      {step === 'session' && (
        <section className="mx-auto grid min-h-screen max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
          <div className="flex min-h-[calc(100vh-3rem)] flex-col rounded-lg border border-[var(--border)] bg-white">
            <header className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-sm text-[var(--muted)]">Session with Aria</p>
              <h2 className="text-xl font-semibold">Take your time.</h2>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
              {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
              {isSending && <p className="text-sm text-[var(--muted)]">Aria is thinking...</p>}
            </div>
            <form className="border-t border-[var(--border)] p-4" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="message">Message Aria</label>
              <textarea id="message" className="field min-h-24 resize-none" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write what feels true right now..." disabled={sessionEnded || safetyAnsweredYes} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="quiet-button" onClick={() => setShowBreathing(true)}>Breathing</button>
                <button className="rounded-md bg-[var(--accent)] px-5 py-2.5 font-medium text-white disabled:opacity-50" disabled={isSending || !draft.trim() || sessionEnded || safetyAnsweredYes}>Send</button>
              </div>
              {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
            </form>
          </div>
          <aside className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-white p-4">
              <h3 className="font-semibold">Session timer</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Designed around a 50-minute therapy-style rhythm.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white p-4">
              <h3 className="font-semibold">End session</h3>
              <MoodSlider value={moodAfter} onChange={setMoodAfter} compact />
              <button className="mt-4 w-full rounded-md border border-[var(--border)] px-4 py-2 font-medium" onClick={finishSession} disabled={sessionEnded || !sessionId}>Close gently</button>
              {sessionEnded && <p className="mt-3 text-sm text-[var(--muted)]">Session saved and memory updated.</p>}
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white p-4">
              <h3 className="font-semibold">Privacy</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Messages and long-term memory are encrypted at rest. Account export and deletion are available through the backend privacy API.</p>
            </div>
          </aside>
        </section>
      )}

      {showBreathing && <BreathingModal onClose={() => setShowBreathing(false)} />}
    </main>
  );
}

function OnboardingInput({ question, value, onChange }: { question: typeof questions[number]; value: string; onChange: (value: string) => void }) {
  if (question.type === 'choice') {
    return <div className="mt-8 grid gap-3">{question.choices?.map((choice) => <button className={`choice ${value === choice ? 'choice-active' : ''}`} key={choice} onClick={() => onChange(choice)}>{choice}</button>)}</div>;
  }

  if (question.type === 'textarea') {
    return <textarea className="field mt-8 min-h-40 resize-none text-lg" value={value} onChange={(event) => onChange(event.target.value)} autoFocus />;
  }

  return <input className="field mt-8 text-lg" value={value} onChange={(event) => onChange(event.target.value)} autoFocus />;
}

function MoodSlider({ value, onChange, compact }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return (
    <div className={compact ? 'mt-4' : 'mt-10'}>
      <div className="flex items-center justify-between text-sm text-[var(--muted)]"><span>Heavy</span><strong className="text-2xl text-[var(--foreground)]">{value}</strong><span>Steady</span></div>
      <input className="mt-4 w-full accent-[var(--accent)]" min="1" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} type="range" />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return <div className={`max-w-[82%] rounded-lg px-4 py-3 leading-7 ${message.role === 'user' ? 'ml-auto bg-[var(--accent)] text-white' : 'bg-[var(--soft)] text-[var(--foreground)]'}`}>{message.content}</div>;
}

function CrisisRail({ onBreathing }: { onBreathing: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm">
      <span className="font-medium">Crisis support</span>
      <a className="text-[var(--accent)] underline-offset-4 hover:underline" href="tel:9152987821">iCall</a>
      <a className="text-[var(--accent)] underline-offset-4 hover:underline" href="tel:18602662345">Vandrevala</a>
      <button className="text-[var(--accent)] underline-offset-4 hover:underline" onClick={onBreathing}>Breathe</button>
    </div>
  );
}

function BreathingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold">4-7-8 breathing</h2>
        <div className="mx-auto my-8 grid h-44 w-44 place-items-center rounded-full border border-[var(--border)] bg-[var(--soft)] breathing-circle">
          <span className="font-medium text-[var(--accent)]">Breathe</span>
        </div>
        <p className="leading-7 text-[var(--muted)]">Inhale for 4, hold for 7, exhale for 8. Let the next breath be slightly easier.</p>
        <button className="mt-6 w-full rounded-md bg-[var(--accent)] px-4 py-3 font-medium text-white" onClick={onClose}>Return</button>
      </div>
    </div>
  );
}
