'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  completeOnboarding,
  completeOnboardingOauth,
  createSession,
  endSession,
  getSessionDetails,
  getSessions,
  getWellnessSummary,
  loginUser,
  logoutUser,
  refreshAccessToken,
  saveGoal,
  saveJournalEntry,
  saveMessageNote,
  saveMood,
  streamMessage,
  trackToolUse,
  updateGoal,
  updateSettings,
  type WellnessActivity,
  type WellnessResource,
  type SessionDetails,
  type SessionHistoryItem
} from '@/lib/api';
import { authClient } from '@/lib/auth-client';

type Step = 'consent' | 'auth_choice' | 'signin' | 'onboarding' | 'mood' | 'session' | 'dashboard';
type Message = { role: 'user' | 'assistant'; content: string };
type ActivePanel = 'Home' | 'Sessions' | 'Journal' | 'Goals' | 'Tools' | 'Resources' | 'Messages' | 'Profile' | 'Settings';

const questions = [
  { key: 'name', label: "What's your name?", type: 'input' },
  { key: 'reason', label: 'What brings you here today?', type: 'textarea' },
  { key: 'support', label: 'What kind of support are you looking for?', type: 'choice', choices: ['Practical tools', 'Just want to be heard', 'Understand myself better'] },
  { key: 'therapyBefore', label: 'Have you spoken to a therapist before?', type: 'choice', choices: ['Yes', 'No', 'A little'] },
  { key: 'safety', label: 'Are you currently having thoughts of harming yourself?', type: 'choice', choices: ['No', 'Yes'] }
];

const modalities = ['Auto', 'CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'];
const starterMessage = "I'm here with you. We can take this slowly, one thing at a time.";

const navItems = [
  { label: 'Home', icon: 'home' },
  { label: 'Sessions', icon: 'calendar' },
  { label: 'Journal', icon: 'journal' },
  { label: 'Goals', icon: 'flag' },
  { label: 'Tools', icon: 'heart' },
  { label: 'Resources', icon: 'book' },
  { label: 'Messages', icon: 'chat' },
  { label: 'Profile', icon: 'profile' },
  { label: 'Settings', icon: 'settings' }
];

const moodOptions = [
  { label: 'Great', color: '#9fd8b6', face: 'smile' },
  { label: 'Okay', color: '#ffd66e', face: 'flat' },
  { label: 'Meh', color: '#ffb06f', face: 'meh' },
  { label: 'Anxious', color: '#f59aa7', face: 'worried' },
  { label: 'Sad', color: '#9fc4ed', face: 'sad' }
];

const journeyCards = [
  { title: 'Journal', text: 'Write freely. This is your space.', tone: 'sun', art: 'journal' },
  { title: 'Goals', text: 'Track gentle wins and next steps.', tone: 'mint', art: 'mountain' },
  { title: 'Therapy History', text: 'View sessions, themes, and notes.', tone: 'sky', art: 'chat' },
  { title: 'Resources', text: 'Helpful exercises for right now.', tone: 'leaf', art: 'books' }
];

const quickTools = [
  { label: 'Breathing', art: 'cloud' },
  { label: 'Grounding', art: 'leaf' },
  { label: 'Meditation', art: 'lotus' },
  { label: 'Affirmations', art: 'heart' },
  { label: 'Mood Tracker', art: 'sun' },
  { label: 'Sleep Stories', art: 'moon' }
];

export function AriaApp() {
  const [step, setStep] = useState<Step>('consent');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [modality, setModality] = useState('Auto');
  const [accessToken, setAccessToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: starterMessage }]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showBreathing, setShowBreathing] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionsHistory, setSessionsHistory] = useState<SessionHistoryItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [signinEmail, setSigninEmail] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<ActivePanel>('Home');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [journalDraft, setJournalDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [wellnessMoods, setWellnessMoods] = useState<WellnessActivity[]>([]);
  const [journalEntries, setJournalEntries] = useState<WellnessActivity[]>([]);
  const [goals, setGoals] = useState<WellnessActivity[]>([]);
  const [messageNotes, setMessageNotes] = useState<WellnessActivity[]>([]);
  const [toolHistory, setToolHistory] = useState<WellnessActivity[]>([]);
  const [resources, setResources] = useState<WellnessResource[]>([]);

  const currentQuestion = questions[questionIndex];
  const safetyAnsweredYes = answers.safety === 'Yes';
  const displayName = answers.name?.trim() || signinEmail.split('@')[0] || email.split('@')[0] || 'friend';

  const canContinue = useMemo(() => {
    if (step === 'consent') return true;
    const value = answers[currentQuestion?.key || ''];
    return Boolean(value?.trim());
  }, [answers, currentQuestion, step]);

  const weeklyMoodPoints = useMemo(() => {
    if (wellnessMoods.length === 0) return [4, 7, 8, 4, 5, 7, 8];
    return wellnessMoods.slice(-7).map((item) => item.mood || 5);
  }, [wellnessMoods]);

  const loadWellness = useCallback(async (token: string) => {
    if (!token) return;
    try {
      const summary = await getWellnessSummary(token);
      setWellnessMoods(summary.moods);
      setJournalEntries(summary.journals);
      setGoals(summary.goals);
      setMessageNotes(summary.messages);
      setToolHistory(summary.tools);
      setResources(summary.resources);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load wellness data.');
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const onboardingComplete = urlParams.get('onboarding') === 'complete';

        const sessionRes = await authClient.getSession();
        const session = sessionRes?.data;

        if (session) {
          setAccessToken('session_active');

          if (onboardingComplete) {
            const storedAnswers = sessionStorage.getItem('pending_onboarding_answers');
            const storedModality = sessionStorage.getItem('pending_preferred_modality');

            if (storedAnswers && storedModality) {
              const answersObj = JSON.parse(storedAnswers);
              await completeOnboardingOauth({
                preferredModality: storedModality,
                onboardingAnswers: answersObj
              });
              sessionStorage.removeItem('pending_onboarding_answers');
              sessionStorage.removeItem('pending_preferred_modality');
            }
            window.history.replaceState({}, document.title, window.location.pathname);
            setStep('mood');
          } else {
            const list = await getSessions('session_active');
            setSessionsHistory(list);
            await loadWellness('session_active');
            setStep('dashboard');
          }
        } else {
          setStep('consent');
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setStep('consent');
      } finally {
        setIsAuthLoading(false);
      }
    }
    initAuth();
  }, [loadWellness]);

  async function runAction(key: string, action: () => Promise<void>) {
    if (actionLoading[key]) return;
    setActionLoading((current) => ({ ...current, [key]: true }));
    setError('');
    setNotice('');
    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    } finally {
      setActionLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function handleSignInWithGoogle() {
    setError('');
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Google sign-in failed.');
    }
  }

  async function handleOnboardingGoogle() {
    setError('');
    if (safetyAnsweredYes) {
      setMessages([{ role: 'assistant', content: 'Please reach out right now: iCall (India): 9152987821, Vandrevala Foundation: 1860-2662-345, NIMHANS: 080-46110007.' }]);
      setStep('session');
      return;
    }
    sessionStorage.setItem('pending_onboarding_answers', JSON.stringify(answers));
    sessionStorage.setItem('pending_preferred_modality', modality);

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin + '?onboarding=complete'
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start Google sign-in.');
    }
  }

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setAccessToken('');
      setSessionsHistory([]);
      setSelectedSession(null);
      setWellnessMoods([]);
      setJournalEntries([]);
      setGoals([]);
      setMessageNotes([]);
      setToolHistory([]);
      setStep('consent');
    }
  }

  function handleNav(label: string) {
    setActivePanel(label as ActivePanel);
    setNotice('');
    if (label === 'Sessions') setSelectedSession(null);
  }

  function handleJourneyCard(title: string) {
    const panel = title === 'Therapy History' ? 'Sessions' : title;
    handleNav(panel);
  }

  async function handleMoodCheckIn(label: string, index: number) {
    const mood = [9, 7, 5, 3, 2][index] || 5;
    await runAction(`mood-${label}`, async () => {
      const saved = await saveMood(accessToken, mood, label);
      setWellnessMoods((current) => [...current.slice(-13), saved]);
      setNotice(`Mood check-in saved: ${label}.`);
    });
  }

  async function handleQuickTool(label: string) {
    await runAction(`tool-${label}`, async () => {
      const activity = await trackToolUse(accessToken, label);
      setToolHistory((current) => [activity, ...current].slice(0, 10));
      setNotice(`${label} opened and saved to your tools history.`);
      if (label === 'Breathing') setShowBreathing(true);
      if (label === 'Mood Tracker') setActivePanel('Home');
      if (label !== 'Breathing' && label !== 'Mood Tracker') setActivePanel('Tools');
    });
  }

  async function handleSaveJournal(event: FormEvent) {
    event.preventDefault();
    const content = journalDraft.trim();
    if (!content) {
      setError('Write a short journal note before saving.');
      return;
    }
    await runAction('journal-save', async () => {
      const entry = await saveJournalEntry(accessToken, content);
      setJournalEntries((current) => [entry, ...current].slice(0, 10));
      setJournalDraft('');
      setNotice('Journal entry saved.');
    });
  }

  async function handleSaveGoal(event: FormEvent) {
    event.preventDefault();
    const title = goalDraft.trim();
    if (!title) {
      setError('Add a goal before saving.');
      return;
    }
    await runAction('goal-save', async () => {
      const goal = await saveGoal(accessToken, title);
      setGoals((current) => [goal, ...current].slice(0, 10));
      setGoalDraft('');
      setNotice('Goal saved.');
    });
  }

  async function handleToggleGoal(goal: WellnessActivity) {
    await runAction(`goal-${goal._id}`, async () => {
      const updated = await updateGoal(accessToken, goal._id, !goal.completed);
      setGoals((current) => current.map((item) => item._id === updated._id ? updated : item));
      setNotice(updated.completed ? 'Goal marked complete.' : 'Goal reopened.');
    });
  }

  async function handleSaveMessageNote(event: FormEvent) {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content) {
      setError('Write a note before saving.');
      return;
    }
    await runAction('message-save', async () => {
      const message = await saveMessageNote(accessToken, content);
      setMessageNotes((current) => [message, ...current].slice(0, 10));
      setMessageDraft('');
      setNotice('Message note saved.');
    });
  }

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    await runAction('settings-save', async () => {
      await updateSettings(accessToken, modality);
      setNotice('Settings saved.');
    });
  }

  async function viewSessionDetails(id: string) {
    setIsLoadingHistory(true);
    setError('');
    try {
      const details = await getSessionDetails(accessToken, id);
      setSelectedSession(details);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load session details.');
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function resetSessionState() {
    setSessionEnded(false);
    setSessionId('');
    setMessages([{ role: 'assistant', content: starterMessage }]);
    setDraft('');
    setError('');
  }

  function handleReturnToDashboard() {
    setStep('dashboard');
    setSelectedSession(null);
    resetSessionState();
  }

  function continueOnboarding() {
    setError('');
    if (safetyAnsweredYes) {
      setMessages([{ role: 'assistant', content: 'Please reach out right now: iCall (India): 9152987821, Vandrevala Foundation: 1860-2662-345, NIMHANS: 080-46110007.' }]);
      setStep('session');
      return;
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1);
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
      const errMsg = requestError instanceof Error ? requestError.message : 'Message failed.';
      if (errMsg.toLowerCase().includes('not active') || errMsg.toLowerCase().includes('crisis')) {
        appendAssistantText("This session is paused for safety. To continue talking, please click 'Close gently' on the right sidebar and start a new session.");
      } else {
        appendAssistantText("I'm having trouble connecting right now. Your words matter, and you can try again in a moment.");
      }
      setError(errMsg);
    } finally {
      setIsSending(false);
    }
  }

  async function finishSession() {
    if (!sessionId) return;
    try {
      await endSession(accessToken, sessionId, moodAfter);
      const list = await getSessions(accessToken);
      setSessionsHistory(list);
      setSessionEnded(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not end session.');
    }
  }

  function appendAssistantText(token: string) {
    setMessages((current) => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      if (last?.role === 'assistant') {
        return [...current.slice(0, -1), { ...last, content: last.content + token }];
      }
      return current;
    });
  }

  if (isAuthLoading) {
    return (
      <main className="playful-page grid min-h-screen place-items-center px-6">
        <div className="soft-panel grid max-w-sm place-items-center gap-4 p-8 text-center">
          <Doodle name="cloud" className="h-16 w-16 text-[var(--accent)]" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Aria</p>
          <p className="text-sm text-[var(--muted)]">Loading your mindful space...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="playful-page min-h-screen text-[var(--foreground)]">
      <CrisisRail onBreathing={() => setShowBreathing(true)} />

      {step === 'consent' && (
        <WelcomeFrame>
          <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
            <div>
              <p className="eyebrow">Mindful Space</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">A soft place to talk through what you are carrying.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">Aria is an AI emotional support companion, not a licensed therapist. It can help you slow down, reflect, and find your next gentle step.</p>
              <div className="mt-7 soft-panel border-[var(--peach)] bg-[var(--peach-soft)] p-5">
                <p className="text-sm font-semibold">Crisis support stays visible.</p>
                <p className="mt-2 leading-7 text-[var(--muted)]">In a crisis, please call iCall: 9152987821 or Vandrevala Foundation: 1860-2662-345.</p>
              </div>
              <button className="primary-button mt-8" onClick={() => setStep('auth_choice')}>I understand</button>
            </div>
            <MascotPanel />
          </div>
        </WelcomeFrame>
      )}

      {step === 'auth_choice' && (
        <WelcomeFrame narrow>
          <p className="eyebrow">Welcome to Aria</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight">How would you like to begin?</h2>
          <div className="mt-8 grid gap-4">
            <button className="primary-button justify-center" onClick={() => setStep('onboarding')}>Start as a new user</button>
            <button className="quiet-button justify-center" onClick={() => setStep('signin')}>Sign in to my space</button>
          </div>
        </WelcomeFrame>
      )}

      {step === 'signin' && (
        <WelcomeFrame narrow>
          <p className="eyebrow">Your Space</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight">Sign in gently</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Sign in with your Google account to retrieve your session history and long-term memory.</p>
          <div className="mt-8 grid gap-4">
            {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
            <button className="primary-button w-full justify-center flex items-center gap-2" onClick={handleSignInWithGoogle}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button type="button" className="quiet-button justify-center mt-2" onClick={() => setStep('auth_choice')}>Back</button>
          </div>
        </WelcomeFrame>
      )}

      {step === 'onboarding' && (
        <WelcomeFrame>
          <div className="mb-8 h-3 overflow-hidden rounded-full bg-white shadow-inner">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <p className="eyebrow">Step {questionIndex + 1} of {questions.length}</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight">{currentQuestion.label}</h2>
          <OnboardingInput question={currentQuestion} value={answers[currentQuestion.key] || ''} onChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.key]: value }))} />
          {questionIndex === questions.length - 1 && (
            <div className="mt-6">
              <label className="grid gap-2 text-sm font-semibold max-w-sm">
                Preferred approach
                <select className="field" value={modality} onChange={(event) => setModality(event.target.value)}>
                  {modalities.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>}
          {questionIndex === questions.length - 1 ? (
            <button disabled={!canContinue} className="primary-button mt-8 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2" onClick={handleOnboardingGoogle}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          ) : (
            <button disabled={!canContinue} className="primary-button mt-8 disabled:cursor-not-allowed disabled:opacity-50" onClick={continueOnboarding}>Continue</button>
          )}
        </WelcomeFrame>
      )}

      {step === 'mood' && (
        <WelcomeFrame narrow>
          <p className="eyebrow">Daily check-in</p>
          <h2 className="mt-4 text-3xl font-bold">Before we begin, where is your mood today?</h2>
          <MoodSlider value={moodBefore} onChange={setMoodBefore} />
          {error && <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>}
          <button className="primary-button mt-8" onClick={startSession}>Start session</button>
        </WelcomeFrame>
      )}

      {step === 'dashboard' && (
        <section className="mindful-shell">
          <aside className="mindful-sidebar">
            <div className="brand-lockup">
              <Doodle name="sprout" className="h-12 w-12 text-[var(--accent)]" />
              <div>
                <p className="text-xl font-bold text-[var(--ink)]">Mindful Space</p>
                <p className="text-xs font-semibold text-[var(--lavender-strong)]">Therapy and well-being</p>
              </div>
            </div>
            <nav className="mt-8 grid gap-2">
              {navItems.map((item) => (
                <button key={item.label} className={`nav-pill ${activePanel === item.label ? 'nav-pill-active' : ''}`} onClick={() => handleNav(item.label)} disabled={Boolean(actionLoading[`nav-${item.label}`])}>
                  <Doodle name={item.icon} className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto hidden pt-8 lg:block">
              <MascotMini />
              <div className="soft-panel mt-6 bg-white/70 p-5 text-center">
                <p className="leading-7">You&apos;re doing better than you think you are.</p>
                <Doodle name="heart" className="mx-auto mt-3 h-6 w-6 text-[var(--lavender-strong)]" />
              </div>
            </div>
          </aside>

          <div className="mindful-content">
            <header className="dashboard-hero">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Good morning, {displayName}</h1>
                  <Doodle name="heart" className="h-9 w-9 text-[var(--lavender-strong)]" />
                </div>
                <p className="mt-4 text-lg leading-8 text-[var(--muted)]">You matter. You&apos;re enough. Let&apos;s take care of you today.</p>
              </div>
              <div className="hero-scene" aria-hidden="true">
                <Doodle name="sun" className="sun-doodle" />
                <Doodle name="chair" className="chair-doodle" />
                <Doodle name="plant" className="plant-doodle" />
              </div>
            </header>

            <div className="dashboard-grid">
              <section className="main-stack">
                {(notice || error) && (
                  <div className={`soft-panel p-4 text-sm font-semibold ${error ? 'bg-[var(--pink-soft)] text-[var(--danger)]' : 'bg-[var(--mint-soft)] text-[var(--accent-strong)]'}`} role="status">
                    {error || notice}
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="soft-panel bg-[var(--lavender-soft)] p-6">
                    <PanelTitle title="Upcoming Session" art="heart" />
                    <div className="mt-7 flex items-center gap-4">
                      <Avatar />
                      <div>
                        <p className="font-semibold">With Aria Companion</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Whenever you are ready</p>
                        <span className="mt-3 inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--lavender-strong)]">50 min - Online</span>
                      </div>
                    </div>
                    <button
                      className="primary-button mt-7"
                      onClick={() => {
                        setStep('mood');
                        resetSessionState();
                      }}
                    >
                      New session
                    </button>
                  </div>

                  <div className="soft-panel bg-[var(--peach-soft)] p-6">
                    <PanelTitle title="Daily check-in" art="heart" />
                    <p className="mt-2 text-sm text-[var(--muted)]">How are you feeling today?</p>
                    <div className="mt-7 grid grid-cols-5 gap-3">
                      {moodOptions.map((mood, index) => (
                        <button key={mood.label} className="mood-face" onClick={() => handleMoodCheckIn(mood.label, index)} disabled={Boolean(actionLoading[`mood-${mood.label}`])}>
                          <span style={{ backgroundColor: mood.color }}><Face mood={mood.face} /></span>
                          <small>{mood.label}</small>
                        </button>
                      ))}
                    </div>
                    <p className="mt-7 text-sm text-[var(--muted)]">It&apos;s okay to not be okay. We&apos;re here with you.</p>
                  </div>
                </div>

                <section className="soft-panel bg-white/70 p-6">
                  <h2 className="text-lg font-bold">Continue Your Journey</h2>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {journeyCards.map((card) => (
                      <button key={card.title} className={`journey-card journey-${card.tone}`} onClick={() => handleJourneyCard(card.title)}>
                        <Doodle name={card.art} className="h-16 w-16" />
                        <span className="mt-5 block text-left text-lg font-bold">{card.title}</span>
                        <span className="mt-2 block text-left text-sm leading-6 text-[var(--muted)]">{card.text}</span>
                        <span className="arrow-chip">›</span>
                      </button>
                    ))}
                  </div>
                </section>

                <DashboardPanel
                  activePanel={activePanel}
                  journalDraft={journalDraft}
                  goalDraft={goalDraft}
                  messageDraft={messageDraft}
                  modality={modality}
                  resources={resources}
                  journalEntries={journalEntries}
                  goals={goals}
                  messageNotes={messageNotes}
                  toolHistory={toolHistory}
                  actionLoading={actionLoading}
                  setJournalDraft={setJournalDraft}
                  setGoalDraft={setGoalDraft}
                  setMessageDraft={setMessageDraft}
                  setModality={setModality}
                  onSaveJournal={handleSaveJournal}
                  onSaveGoal={handleSaveGoal}
                  onToggleGoal={handleToggleGoal}
                  onSaveMessage={handleSaveMessageNote}
                  onSaveSettings={handleSaveSettings}
                  onStartSession={() => {
                    setStep('mood');
                    resetSessionState();
                  }}
                  onOpenTool={handleQuickTool}
                />

                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">Past Sessions</h2>
                    <button onClick={handleSignOut} className="quiet-button px-4 py-2 text-sm">Sign out</button>
                  </div>
                  {sessionsHistory.length === 0 ? (
                    <div className="soft-panel border-dashed bg-white/60 p-10 text-center">
                      <Doodle name="journal" className="mx-auto h-16 w-16 text-[var(--accent)]" />
                      <p className="mt-4 text-[var(--muted)]">No past sessions yet. Start a session when you feel ready.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {sessionsHistory.map((item) => (
                        <button
                          key={item._id}
                          onClick={() => viewSessionDetails(item._id)}
                          className={`session-card ${selectedSession?._id === item._id ? 'session-card-active' : ''}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm text-[var(--muted)]">
                              {new Date(item.startedAt).toLocaleDateString(undefined, {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">
                              Mood {item.moodBefore} to {item.moodAfter}
                            </span>
                          </div>
                          <span className="mt-3 block text-left text-lg font-bold">{item.summaryCard?.summary ? 'Session Summary' : 'Unnamed Session'}</span>
                          {item.summaryCard?.summary && <span className="mt-2 line-clamp-2 block text-left text-sm leading-6 text-[var(--muted)]">{item.summaryCard.summary}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <div className="soft-panel banner-panel p-7">
                  <p className="text-2xl font-bold leading-snug text-[var(--ink)]">Healing isn&apos;t linear, and that&apos;s okay.</p>
                  <Doodle name="landscape" className="h-24 w-48" />
                </div>
              </section>

              <aside className="right-stack">
                <div className="soft-panel bg-white/80 p-5">
                  <PanelTitle title="Your Journey" art="cloud" />
                  <p className="mt-5 text-sm font-semibold">Mood Trend</p>
                  <p className="text-xs font-bold text-[var(--accent)]">Good progress!</p>
                  <MiniChart points={weeklyMoodPoints} />
                </div>

                <div className="soft-panel bg-[var(--lavender-soft)] p-5">
                  <p className="text-3xl font-bold text-[var(--lavender-strong)]">&quot;</p>
                  <h2 className="text-lg font-bold">Today&apos;s Reflection</h2>
                  <p className="mt-4 text-sm leading-7">What you think, you become. What you feel, you attract. What you imagine, you create.</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--lavender-strong)]">Buddha</p>
                </div>

                <div className="soft-panel bg-white/80 p-5">
                  <h2 className="text-lg font-bold">Quick Tools</h2>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {quickTools.map((tool) => (
                      <button key={tool.label} className="quick-tool" onClick={() => handleQuickTool(tool.label)} disabled={Boolean(actionLoading[`tool-${tool.label}`])}>
                        <Doodle name={tool.art} className="h-10 w-10" />
                        <span>{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="soft-panel bg-[var(--pink-soft)] p-5">
                  <h2 className="text-lg font-bold">Need immediate support?</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">You are not alone. Help is always available.</p>
                  <button className="primary-button mt-5 w-fit" onClick={() => handleNav('Resources')}>Find resources</button>
                </div>

                <SessionDetailPanel selectedSession={selectedSession} isLoadingHistory={isLoadingHistory} />
              </aside>
            </div>
          </div>
        </section>
      )}

      {step === 'session' && (
        <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
          <div className="soft-panel flex min-h-[calc(100vh-3rem)] flex-col bg-white/80">
            <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <Doodle name="cloud" className="h-12 w-12 text-[var(--accent)]" />
                <div>
                  <p className="text-sm text-[var(--muted)]">Session with Aria</p>
                  <h2 className="text-xl font-bold">Take your time.</h2>
                </div>
              </div>
              <button onClick={handleReturnToDashboard} className="quiet-button px-4 py-2 text-sm">Dashboard</button>
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
                <button className="primary-button disabled:opacity-50" disabled={isSending || !draft.trim() || sessionEnded || safetyAnsweredYes}>Send</button>
              </div>
              {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
            </form>
          </div>
          <aside className="space-y-4">
            <div className="soft-panel bg-white/80 p-5">
              <h3 className="font-bold">Session rhythm</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Designed around a calm 50-minute therapy-style rhythm.</p>
            </div>
            <div className="soft-panel bg-[var(--peach-soft)] p-5">
              <h3 className="font-bold">End session</h3>
              <MoodSlider value={moodAfter} onChange={setMoodAfter} compact />
              {sessionEnded ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-[var(--muted)]">Session saved and memory updated.</p>
                  <button onClick={handleReturnToDashboard} className="primary-button w-full justify-center">Return to Dashboard</button>
                </div>
              ) : (
                <button className="quiet-button mt-4 w-full justify-center" onClick={finishSession} disabled={sessionEnded || !sessionId}>Close gently</button>
              )}
              {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
            </div>
            <div className="soft-panel bg-white/80 p-5">
              <h3 className="font-bold">Privacy</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Messages and long-term memory are encrypted at rest.</p>
            </div>
          </aside>
        </section>
      )}

      {showBreathing && <BreathingModal onClose={() => setShowBreathing(false)} />}
    </main>
  );
}

function WelcomeFrame({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <section className={`mx-auto flex min-h-screen flex-col justify-center px-6 py-12 ${narrow ? 'max-w-md' : 'max-w-5xl'}`}>
      <div className="soft-panel bg-white/72 p-7 sm:p-10">{children}</div>
    </section>
  );
}

function DashboardPanel({
  activePanel,
  journalDraft,
  goalDraft,
  messageDraft,
  modality,
  resources,
  journalEntries,
  goals,
  messageNotes,
  toolHistory,
  actionLoading,
  setJournalDraft,
  setGoalDraft,
  setMessageDraft,
  setModality,
  onSaveJournal,
  onSaveGoal,
  onToggleGoal,
  onSaveMessage,
  onSaveSettings,
  onStartSession,
  onOpenTool
}: {
  activePanel: ActivePanel;
  journalDraft: string;
  goalDraft: string;
  messageDraft: string;
  modality: string;
  resources: WellnessResource[];
  journalEntries: WellnessActivity[];
  goals: WellnessActivity[];
  messageNotes: WellnessActivity[];
  toolHistory: WellnessActivity[];
  actionLoading: Record<string, boolean>;
  setJournalDraft: (value: string) => void;
  setGoalDraft: (value: string) => void;
  setMessageDraft: (value: string) => void;
  setModality: (value: string) => void;
  onSaveJournal: (event: FormEvent) => void;
  onSaveGoal: (event: FormEvent) => void;
  onToggleGoal: (goal: WellnessActivity) => void;
  onSaveMessage: (event: FormEvent) => void;
  onSaveSettings: (event: FormEvent) => void;
  onStartSession: () => void;
  onOpenTool: (tool: string) => void;
}) {
  if (activePanel === 'Home') return null;

  if (activePanel === 'Journal') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Journal</h2>
        <form className="mt-4 grid gap-3" onSubmit={onSaveJournal}>
          <textarea className="field min-h-32 resize-none" value={journalDraft} onChange={(event) => setJournalDraft(event.target.value)} placeholder="Write one honest paragraph..." />
          <button className="primary-button w-fit" disabled={Boolean(actionLoading['journal-save'])}>{actionLoading['journal-save'] ? 'Saving...' : 'Save journal entry'}</button>
        </form>
        <ActivityList items={journalEntries} empty="No journal entries yet." />
      </section>
    );
  }

  if (activePanel === 'Goals') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Goals</h2>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={onSaveGoal}>
          <input className="field" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} placeholder="Add a tiny next step..." />
          <button className="primary-button shrink-0" disabled={Boolean(actionLoading['goal-save'])}>{actionLoading['goal-save'] ? 'Saving...' : 'Add goal'}</button>
        </form>
        <div className="mt-5 grid gap-3">
          {goals.length === 0 ? <p className="text-sm text-[var(--muted)]">No goals yet.</p> : goals.map((goal) => (
            <button key={goal._id} className="session-card flex items-center justify-between gap-3" onClick={() => onToggleGoal(goal)} disabled={Boolean(actionLoading[`goal-${goal._id}`])}>
              <span className={goal.completed ? 'line-through opacity-70' : ''}>{goal.title}</span>
              <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">{goal.completed ? 'Done' : 'Open'}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (activePanel === 'Tools') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {quickTools.map((tool) => (
            <button key={tool.label} className="quiet-button justify-center" onClick={() => onOpenTool(tool.label)} disabled={Boolean(actionLoading[`tool-${tool.label}`])}>
              <Doodle name={tool.art} className="h-5 w-5" />
              {tool.label}
            </button>
          ))}
        </div>
        <ActivityList items={toolHistory} empty="No tool activity yet." />
      </section>
    );
  }

  if (activePanel === 'Resources') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Resources</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {resources.map((resource) => (
            <article key={resource.title} className="rounded-lg border border-[var(--border)] bg-[var(--mint-soft)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-strong)]">{resource.category}</p>
              <h3 className="mt-2 font-bold">{resource.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{resource.description}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activePanel === 'Messages') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Messages</h2>
        <form className="mt-4 grid gap-3" onSubmit={onSaveMessage}>
          <textarea className="field min-h-24 resize-none" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Save a note you want Aria to remember..." />
          <button className="primary-button w-fit" disabled={Boolean(actionLoading['message-save'])}>{actionLoading['message-save'] ? 'Saving...' : 'Save note'}</button>
        </form>
        <ActivityList items={messageNotes} empty="No saved notes yet." />
      </section>
    );
  }

  if (activePanel === 'Profile') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Profile</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Your profile is connected to your signed-in email, encrypted sessions, and saved wellness activity.</p>
        <button className="primary-button mt-5" onClick={onStartSession}>Start a new session</button>
      </section>
    );
  }

  if (activePanel === 'Settings') {
    return (
      <section className="soft-panel bg-white/78 p-6">
        <h2 className="text-xl font-bold">Settings</h2>
        <form className="mt-4 grid gap-4 sm:max-w-md" onSubmit={onSaveSettings}>
          <label className="grid gap-2 text-sm font-semibold">
            Preferred approach
            <select className="field" value={modality} onChange={(event) => setModality(event.target.value)}>
              {modalities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="primary-button w-fit" disabled={Boolean(actionLoading['settings-save'])}>{actionLoading['settings-save'] ? 'Saving...' : 'Save settings'}</button>
        </form>
      </section>
    );
  }

  return null;
}

function ActivityList({ items, empty }: { items: WellnessActivity[]; empty: string }) {
  return (
    <div className="mt-5 grid gap-3">
      {items.length === 0 ? <p className="text-sm text-[var(--muted)]">{empty}</p> : items.slice(0, 5).map((item) => (
        <article key={item._id} className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{item.title || item.tool || item.moodLabel || item.type}</h3>
            <time className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleDateString()}</time>
          </div>
          {item.content && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.content}</p>}
        </article>
      ))}
    </div>
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
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>Heavy</span>
        <strong className="mood-number">{value}</strong>
        <span>Steady</span>
      </div>
      <input className="mt-4 w-full accent-[var(--accent)]" min="1" max="10" value={value} onChange={(event) => onChange(Number(event.target.value))} type="range" />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`message-bubble ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}>
      {message.content}
    </div>
  );
}

function CrisisRail({ onBreathing }: { onBreathing: () => void }) {
  return (
    <div className="crisis-rail">
      <span className="font-semibold">Crisis support</span>
      <a href="tel:9152987821">iCall</a>
      <a href="tel:18602662345">Vandrevala</a>
      <button onClick={onBreathing}>Breathe</button>
    </div>
  );
}

function BreathingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/30 px-4">
      <div className="soft-panel w-full max-w-md bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold">4-7-8 breathing</h2>
        <div className="breathing-circle mx-auto my-8 grid h-44 w-44 place-items-center rounded-full border border-[var(--border)] bg-[var(--mint-soft)]">
          <span className="font-bold text-[var(--accent)]">Breathe</span>
        </div>
        <p className="leading-7 text-[var(--muted)]">Inhale for 4, hold for 7, exhale for 8. Let the next breath be slightly easier.</p>
        <button className="primary-button mt-6 w-full justify-center" onClick={onClose}>Return</button>
      </div>
    </div>
  );
}

function PanelTitle({ title, art }: { title: string; art: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <Doodle name={art} className="h-9 w-9 text-[var(--lavender-strong)]" />
    </div>
  );
}

function SessionDetailPanel({ selectedSession, isLoadingHistory }: { selectedSession: SessionDetails | null; isLoadingHistory: boolean }) {
  return (
    <div className="soft-panel bg-white/80 p-5">
      {isLoadingHistory ? (
        <div className="grid min-h-48 place-items-center text-center">
          <div>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
            <p className="mt-3 text-sm text-[var(--muted)]">Loading session details...</p>
          </div>
        </div>
      ) : selectedSession ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold">Session Details</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {new Date(selectedSession.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--mint-soft)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Mood Progression</span>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div><span className="block text-2xl font-bold">{selectedSession.moodBefore}/10</span><span className="text-xs text-[var(--muted)]">Check-in</span></div>
              <div><span className="block text-2xl font-bold">{selectedSession.moodAfter}/10</span><span className="text-xs text-[var(--muted)]">Check-out</span></div>
            </div>
          </div>
          {selectedSession.summaryCard?.summary && <p className="text-sm leading-6 text-[var(--foreground)]">{selectedSession.summaryCard.summary}</p>}
          {selectedSession.summaryCard?.themes && selectedSession.summaryCard.themes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedSession.summaryCard.themes.map((theme) => <span key={theme} className="rounded-full bg-[var(--lavender-soft)] px-3 py-1 text-xs font-semibold text-[var(--lavender-strong)]">{theme}</span>)}
            </div>
          )}
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {selectedSession.messages.map((m, idx) => (
              <div key={idx} className={`rounded-lg p-3 text-sm leading-6 ${m.role === 'user' ? 'bg-[var(--peach-soft)]' : 'bg-[var(--mint-soft)]'}`}>
                <strong className="mb-1 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{m.role}</strong>
                {m.content}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center text-center">
          <p className="text-sm leading-6 text-[var(--muted)]">Select a past session to view themes and transcripts.</p>
        </div>
      )}
    </div>
  );
}

function MascotPanel() {
  return (
    <div className="hidden lg:block">
      <div className="mascot-panel">
        <MascotMini />
      </div>
    </div>
  );
}

function MascotMini() {
  return (
    <div className="mascot-mini" aria-hidden="true">
      <div className="mascot-body">
        <span className="eye left" />
        <span className="eye right" />
        <span className="smile" />
        <span className="mascot-heart" />
      </div>
      <span className="ground-line" />
    </div>
  );
}

function Avatar() {
  return (
    <div className="avatar" aria-hidden="true">
      <span className="avatar-hair" />
      <span className="avatar-face" />
      <span className="avatar-body" />
    </div>
  );
}

function Face({ mood }: { mood: string }) {
  return <i className={`face face-${mood}`} aria-hidden="true"><b /><b /><em /></i>;
}

function MiniChart({ points }: { points: number[] }) {
  const normalized = points.length > 0 ? points.slice(-7) : [4, 7, 8, 4, 5, 7, 8];
  const chartPoints = normalized.map((value, index) => {
    const x = 25 + index * (240 / Math.max(normalized.length - 1, 1));
    const y = 110 - Math.max(1, Math.min(10, value)) * 8;
    return { x, y };
  });
  const path = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');

  return (
    <svg className="mt-4 h-32 w-full" viewBox="0 0 280 130" role="img" aria-label="Weekly mood trend">
      <line x1="20" y1="110" x2="270" y2="110" stroke="#e8e0d6" />
      <line x1="20" y1="75" x2="270" y2="75" stroke="#eee6dc" strokeDasharray="5 5" />
      <line x1="20" y1="40" x2="270" y2="40" stroke="#eee6dc" strokeDasharray="5 5" />
      <path d={path} fill="none" stroke="#8d74d8" strokeWidth="3" />
      {chartPoints.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="5" fill="#8d74d8" />
      ))}
    </svg>
  );
}

function Doodle({ name, className = '' }: { name: string; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (name === 'home') return <svg className={className} viewBox="0 0 24 24"><path {...common} d="M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1z" /></svg>;
  if (name === 'calendar') return <svg className={className} viewBox="0 0 24 24"><rect {...common} x="4" y="5" width="16" height="15" rx="2" /><path {...common} d="M8 3v4M16 3v4M4 10h16M9 14h2M14 14h2" /></svg>;
  if (name === 'journal') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M18 10h28a4 4 0 0 1 4 4v40H18a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5z" /><path {...common} d="M22 18h18M22 26h16M22 34h12M18 54V10" /><path {...common} d="m43 39 7-7 4 4-7 7-6 2z" /></svg>;
  if (name === 'flag') return <svg className={className} viewBox="0 0 24 24"><path {...common} d="M6 21V4M6 5h11l-2 4 2 4H6" /></svg>;
  if (name === 'heart') return <svg className={className} viewBox="0 0 24 24"><path {...common} d="M12 20s-7-4.5-9-9a4.8 4.8 0 0 1 8-5 4.8 4.8 0 0 1 8 5c-2 4.5-9 9-9 9z" /></svg>;
  if (name === 'book') return <svg className={className} viewBox="0 0 24 24"><path {...common} d="M5 5a3 3 0 0 1 3-3h11v17H8a3 3 0 0 0-3 3zM5 5v17" /></svg>;
  if (name === 'chat') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M12 18a10 10 0 0 1 10-10h20a10 10 0 0 1 10 10v10a10 10 0 0 1-10 10H29l-12 9v-9a10 10 0 0 1-5-9z" /><path {...common} d="M22 23h1M32 23h1M42 23h1" /></svg>;
  if (name === 'profile') return <svg className={className} viewBox="0 0 24 24"><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === 'settings') return <svg className={className} viewBox="0 0 24 24"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z" /></svg>;
  if (name === 'sprout') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M32 52V24" /><path {...common} d="M31 25C18 24 14 14 17 9c11 0 16 7 14 16zM34 28c13 0 18-9 15-15-11 0-17 8-15 15z" /><circle cx="32" cy="41" r="16" fill="#d9c7ff" stroke="currentColor" strokeWidth="2" /><path {...common} d="M24 41h.1M40 41h.1M27 47c3 3 8 3 11 0" /></svg>;
  if (name === 'cloud') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M18 42h28a10 10 0 0 0 0-20 14 14 0 0 0-26-5A12 12 0 0 0 18 42z" /><path {...common} d="M26 31h.1M39 31h.1M29 36c3 2 7 2 10 0" /></svg>;
  if (name === 'leaf') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M13 51C18 22 39 10 51 12c2 17-12 34-38 39z" /><path {...common} d="M18 46c12-11 20-18 29-29" /></svg>;
  if (name === 'lotus') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M32 48C22 39 23 27 32 16c9 11 10 23 0 32z" /><path {...common} d="M29 49C16 47 10 38 12 27c11 2 18 9 17 22zM35 49c13-2 19-11 17-22-11 2-18 9-17 22z" /></svg>;
  if (name === 'sun') return <svg className={className} viewBox="0 0 64 64"><circle {...common} cx="32" cy="32" r="12" fill="#ffd66e" /><path {...common} d="M32 6v8M32 50v8M6 32h8M50 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6" /><path {...common} d="M27 31h.1M37 31h.1M28 37c3 2 5 2 8 0" /></svg>;
  if (name === 'moon') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M44 48A22 22 0 0 1 29 8 22 22 0 1 0 44 48z" /><path {...common} d="M44 16h.1M51 25h.1M41 28h.1" /></svg>;
  if (name === 'mountain') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="m8 50 17-25 12 17 7-9 12 17zM44 33V16l10 4-10 4" /></svg>;
  if (name === 'books') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M14 15h10v38H14zM28 11h10v42H28zM42 20h8l4 33h-8z" /><path {...common} d="M17 23h4M31 21h4M45 29h4" /></svg>;
  if (name === 'chair') return <svg className={className} viewBox="0 0 90 90"><path d="M25 35c0-13 9-22 22-22h6c13 0 22 9 22 22v22H25z" fill="#9fc58d" stroke="#20231f" strokeWidth="2" /><path {...common} d="M25 57h50M31 57v20M69 57v20M35 77h28" /><path {...common} d="M42 41c4 5 11 5 16 0" /></svg>;
  if (name === 'plant') return <svg className={className} viewBox="0 0 64 64"><path {...common} d="M32 54V18M32 25c-9-8-15-8-18-4 2 8 9 11 18 4zM33 34c10-9 16-8 18-3-4 8-10 10-18 3zM32 43c-9-8-16-7-18-2 3 8 10 10 18 2z" /><path {...common} d="M22 55h20l-2 7H24z" /></svg>;
  if (name === 'landscape') return <svg className={className} viewBox="0 0 160 80"><path d="M8 68c22-24 41-24 61 0 18-18 42-21 76 0" fill="#dceccf" stroke="#20231f" strokeWidth="2" /><path {...common} d="M112 50c3 5 9 5 12 0M118 64V42M118 43c-8-6-14-5-16-1 3 6 8 7 16 1zM120 49c8-6 13-5 15-1-3 6-8 7-15 1z" /></svg>;
  return <svg className={className} viewBox="0 0 24 24"><circle {...common} cx="12" cy="12" r="8" /></svg>;
}
