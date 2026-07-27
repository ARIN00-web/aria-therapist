'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { wellnessApi, type WellnessActivity, type WellnessSummary } from '@/lib/api';
import { Button, Card, EmptyState, MoodSlider, Skeleton } from '@/components/ui';
import { useChartTheme } from '@/lib/chartTheme';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

type Tab = 'overview' | 'journal' | 'goals' | 'tools';

export default function WellnessPage() {
  return (
    <Suspense fallback={<AppShell><div style={styles.page} /></AppShell>}>
      <WellnessPageInner />
    </Suspense>
  );
}

function WellnessPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const initialTool = searchParams.get('tool');
  const [tab, setTab] = useState<Tab>(
    ['overview', 'journal', 'goals', 'tools'].includes(initialTab) ? initialTab : 'overview'
  );
  const [summary, setSummary] = useState<WellnessSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    wellnessApi.summary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <AppShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Wellness</h1>
        </div>

        <div style={styles.tabs}>
          {(['overview', 'journal', 'goals', 'tools'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab summary={summary} loading={loading} onMoodLogged={reload} />
        )}
        {tab === 'journal' && <JournalTab onSaved={reload} />}
        {tab === 'goals' && <GoalsTab onSaved={reload} />}
        {tab === 'tools' && <ToolsTab resources={summary?.resources || []} initialTool={initialTool} />}
      </div>
    </AppShell>
  );
}

function OverviewTab({ summary, loading, onMoodLogged }: {
  summary: WellnessSummary | null;
  loading: boolean;
  onMoodLogged: () => void;
}) {
  const [mood, setMood] = useState(5);
  const [moodLabel, setMoodLabel] = useState('');
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const chart = useChartTheme();

  async function logMood() {
    setLogging(true);
    try {
      await wellnessApi.logMood(mood, moodLabel);
      setLogged(true);
      onMoodLogged();
      setTimeout(() => setLogged(false), 3000);
    } catch { /* ignore */ }
    finally { setLogging(false); }
  }

  const moodData = summary?.moods.map((m) => ({
    date: new Date(m.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    mood: m.mood,
  })) || [];

  return (
    <div style={styles.grid2}>
      <Card>
        <div style={styles.cardTitle}>Daily mood check-in</div>
        <MoodSlider value={mood} onChange={setMood} />
        <input
          style={{ ...styles.input, marginTop: 12 }}
          placeholder="Optional label (e.g. anxious, calm, tired)"
          value={moodLabel}
          onChange={(e) => setMoodLabel(e.target.value)}
        />
        <Button
          loading={logging}
          onClick={logMood}
          style={{ width: '100%', marginTop: 12 }}
        >
          {logged ? '✓ Logged!' : 'Log mood'}
        </Button>
      </Card>

      <Card>
        <div style={styles.cardTitle}>Mood trend (last 14 days)</div>
        {loading ? <Skeleton height={140} /> : moodData.length === 0 ? (
          <EmptyState icon="📈" title="No mood data yet" hint="Log your mood above to see trends." />
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={moodData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="moodG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chart.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chart.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: chart.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 10]} tick={{ fontSize: 10, fill: chart.muted }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: chart.accent }}
              />
              <Area type="monotone" dataKey="mood" stroke={chart.accent} strokeWidth={2} fill="url(#moodG)" dot={{ fill: chart.accent, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card style={{ gridColumn: 'span 2' }}>
        <div style={styles.cardTitle}>Recent journal entries</div>
        {loading ? <Skeleton height={80} /> : !summary?.journals.length ? (
          <EmptyState icon="✎" title="No journal entries yet" hint="Switch to the Journal tab to write your first entry." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {summary.journals.map((j) => (
              <div key={j._id} style={styles.journalRow}>
                <div style={styles.journalTitle}>{j.title}</div>
                <div style={styles.journalDate}>{new Date(j.createdAt).toLocaleDateString()}</div>
                {j.content && <div style={styles.journalContent}>{j.content.slice(0, 200)}{j.content.length > 200 ? '…' : ''}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function JournalTab({ onSaved }: { onSaved: () => void }) {
  const [entries, setEntries] = useState<WellnessActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wellnessApi.getJournal()
      .then((r) => setEntries(r.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await wellnessApi.addJournal(title || 'Journal entry', content);
      const r = await wellnessApi.getJournal();
      setEntries(r.entries);
      setTitle('');
      setContent('');
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={styles.cardTitle}>New entry</div>
        <input
          style={styles.input}
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          style={{ ...styles.input, minHeight: 120, resize: 'vertical', marginTop: 10 }}
          placeholder="What's on your mind today?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button loading={saving} onClick={save} style={{ marginTop: 12 }}>Save entry</Button>
      </Card>

      {loading ? <Skeleton height={100} /> : entries.length === 0 ? (
        <EmptyState icon="✎" title="No entries yet" hint="Write your first journal entry above." />
      ) : (
        entries.map((j) => (
          <Card key={j._id} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{j.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(j.createdAt).toLocaleDateString()}</div>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{j.content}</p>
          </Card>
        ))
      )}
    </div>
  );
}

function GoalsTab({ onSaved }: { onSaved: () => void }) {
  const [goals, setGoals] = useState<WellnessActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    wellnessApi.getGoals()
      .then((r) => setGoals(r.goals))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function addGoal() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await wellnessApi.addGoal(title);
      setTitle('');
      reload();
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function toggle(id: string, completed: boolean) {
    await wellnessApi.toggleGoal(id, !completed).catch(() => {});
    reload();
    onSaved();
  }

  const active = goals.filter((g) => !g.completed);
  const done = goals.filter((g) => g.completed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={styles.cardTitle}>Add a goal</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="e.g. Meditate for 5 minutes daily"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          />
          <Button loading={saving} onClick={addGoal}>Add</Button>
        </div>
      </Card>

      {loading ? <Skeleton height={100} /> : goals.length === 0 ? (
        <EmptyState icon="✓" title="No goals yet" hint="Set a small, achievable goal above." />
      ) : (
        <>
          {active.length > 0 && (
            <Card>
              <div style={styles.cardTitle}>Active ({active.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.map((g) => (
                  <GoalRow key={g._id} goal={g} onToggle={toggle} />
                ))}
              </div>
            </Card>
          )}
          {done.length > 0 && (
            <Card>
              <div style={styles.cardTitle}>Completed ({done.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {done.map((g) => (
                  <GoalRow key={g._id} goal={g} onToggle={toggle} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function GoalRow({ goal, onToggle }: { goal: WellnessActivity; onToggle: (id: string, completed: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(goal._id, goal.completed || false)}
      style={styles.goalRow}
    >
      <span style={{
        ...styles.goalCheck,
        background: goal.completed ? 'var(--green)' : 'transparent',
        borderColor: goal.completed ? 'var(--green)' : 'var(--border)',
      }}>
        {goal.completed && '✓'}
      </span>
      <span style={{
        fontSize: 14,
        color: goal.completed ? 'var(--text-muted)' : 'var(--text)',
        textDecoration: goal.completed ? 'line-through' : 'none',
        textAlign: 'left',
      }}>
        {goal.title}
      </span>
    </button>
  );
}

function ToolsTab({ resources, initialTool }: { resources: { title: string; category: string; description: string }[]; initialTool?: string | null }) {
  const [active, setActive] = useState<string | null>(null);
  const openedInitial = useRef(false);

  const openTool = useCallback(async (title: string) => {
    setActive(title);
    await wellnessApi.logTool(title).catch(() => {});
  }, []);

  // Auto-open a tool when arriving via ?tool=… (e.g. from the dashboard quick tools).
  useEffect(() => {
    if (openedInitial.current || !initialTool) return;
    const match = resources.find((r) => r.title === initialTool);
    if (match) {
      openedInitial.current = true;
      openTool(match.title);
    }
  }, [initialTool, resources, openTool]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={styles.resourcesGrid}>
        {resources.map((r) => (
          <Card
            key={r.title}
            style={{ cursor: 'pointer', border: active === r.title ? '1px solid var(--accent)' : undefined }}
            className="animate-fade-in"
          >
            <button onClick={() => openTool(r.title)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{r.category}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.description}</div>
            </button>
          </Card>
        ))}
      </div>

      {active === '4-7-8 Breathing' && <BreathingExercise onClose={() => setActive(null)} />}
      {active === '5-4-3-2-1 Grounding' && <GroundingExercise onClose={() => setActive(null)} />}
    </div>
  );
}

function BreathingExercise({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [count, setCount] = useState(4);

  useEffect(() => {
    const durations = { inhale: 4, hold: 7, exhale: 8 };
    const next = { inhale: 'hold', hold: 'exhale', exhale: 'inhale' } as const;
    let remaining = durations[phase];
    setCount(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      setCount(remaining);
      if (remaining <= 0) {
        setPhase(next[phase]);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const colors = { inhale: 'var(--accent)', hold: 'var(--amber)', exhale: 'var(--green)' };
  const labels = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out' };

  return (
    <Card style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>
        4-7-8 Breathing
      </div>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        border: `3px solid ${colors[phase]}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
        transition: 'border-color 0.5s',
        boxShadow: `0 0 30px ${colors[phase]}40`,
      }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: colors[phase] }}>{count}</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: colors[phase], marginBottom: 8, transition: 'color 0.5s' }}>
        {labels[phase]}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Inhale for 4 · Hold for 7 · Exhale for 8
      </p>
      <Button variant="soft" onClick={onClose}>Close</Button>
    </Card>
  );
}

function GroundingExercise({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: 5, sense: 'see', prompt: 'Name 5 things you can see right now.' },
    { n: 4, sense: 'feel', prompt: 'Name 4 things you can physically feel.' },
    { n: 3, sense: 'hear', prompt: 'Name 3 things you can hear.' },
    { n: 2, sense: 'smell', prompt: 'Name 2 things you can smell.' },
    { n: 1, sense: 'taste', prompt: 'Name 1 thing you can taste.' },
  ];
  const [step, setStep] = useState(0);

  return (
    <Card style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>
        5-4-3-2-1 Grounding
      </div>
      {step < steps.length ? (
        <>
          <div style={{ fontSize: 64, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>{steps[step].n}</div>
          <p style={{ fontSize: 16, color: 'var(--text)', marginBottom: 32 }}>{steps[step].prompt}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {step > 0 && <Button variant="soft" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🌿</div>
          <p style={{ fontSize: 16, color: 'var(--text)', marginBottom: 24 }}>
            Well done. Take a slow breath and notice how you feel now.
          </p>
          <Button onClick={onClose}>Finish</Button>
        </>
      )}
    </Card>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 28px', maxWidth: 900, margin: '0 auto' },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700 },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  tab: {
    padding: '8px 16px', background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: -1, transition: 'all 0.15s',
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)', fontWeight: 600 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  cardTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 },
  input: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
    outline: 'none', width: '100%', fontFamily: 'inherit',
  },
  journalRow: {
    padding: '12px 14px', background: 'var(--bg-elevated)',
    borderRadius: 10, border: '1px solid var(--border-subtle)',
  },
  journalTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  journalDate: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 },
  journalContent: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 },
  goalRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)',
    border: 'none', cursor: 'pointer', width: '100%', transition: 'background 0.15s',
  },
  goalCheck: {
    width: 20, height: 20, borderRadius: 6, border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: '#fff', flexShrink: 0, fontWeight: 700,
  },
  resourcesGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
};
