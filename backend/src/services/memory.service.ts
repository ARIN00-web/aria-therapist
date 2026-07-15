import { Types } from 'mongoose';
import { MemoryModel, type IMemoryProfile } from '../models/Memory.model';
import type { ISession } from '../models/Session.model';
import { callGeminiText } from './llm.client';

export async function ensureMemory(userId: string) {
  const objectUserId = new Types.ObjectId(userId);
  const existing = await MemoryModel.findOne({ userId: objectUserId });
  if (existing) return existing;

  return MemoryModel.create({
    userId: objectUserId,
    profile: emptyProfile(),
    lastUpdated: new Date()
  });
}

export async function updateLongTermMemory(userId: string, session: ISession): Promise<void> {
  const memory = await ensureMemory(userId);
  const transcript = session.messages.map((message) => `${message.role}: ${message.content}`).join('\n');

  const generated = await callGeminiText({
    system: `Extract a JSON memory profile update for an emotional-support app.
Return only JSON with keys: recurringThemes, keyPeople, triggers, copingStrategies, progressNotes, moodTrend, followUpTopics.
Do not diagnose or include medications.`,
    messages: [{
      role: 'user',
      content: `Existing profile:\n${JSON.stringify(memory.profile)}\n\nSession summary:\n${session.rollingSummary || ''}\n\nRecent transcript:\n${transcript}`
    }],
    maxTokens: 700,
    timeoutMs: 10_000,
    utility: true
  });

  const parsed = parseProfile(generated);
  if (parsed) {
    memory.profile = mergeProfiles(memory.profile, parsed);
  } else {
    memory.profile.progressNotes = dedupe([
      ...memory.profile.progressNotes,
      session.summaryCard?.reflection || session.rollingSummary || 'Completed a support session.'
    ]).slice(-20);
  }

  memory.lastUpdated = new Date();
  await memory.save();
}

export async function createSessionSummaryCard(session: ISession) {
  const transcript = session.messages.map((message) => `${message.role}: ${message.content}`).join('\n');
  const generated = await callGeminiText({
    system: `Create an end-of-session card as JSON with themes, reflection, and nextTopic.
themes must be an array of at most 3 short strings. Do not diagnose.`,
    messages: [{ role: 'user', content: `${session.rollingSummary || ''}\n${transcript}` }],
    maxTokens: 300,
    timeoutMs: 8_000,
    utility: true
  });

  const parsed = parseSummaryCard(generated);
  return parsed || {
    themes: ['self-awareness'],
    reflection: 'Notice what felt a little lighter or clearer during this session.',
    nextTopic: 'Pick up with what feels most present next time.'
  };
}

function parseProfile(text: string | null): Partial<IMemoryProfile> | null {
  if (!text) return null;
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned) as Partial<IMemoryProfile>;
  } catch {
    return null;
  }
}

function parseSummaryCard(text: string | null) {
  if (!text) return null;
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { themes: string[]; reflection: string; nextTopic: string };
    if (!Array.isArray(parsed.themes) || !parsed.reflection || !parsed.nextTopic) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeProfiles(current: IMemoryProfile, update: Partial<IMemoryProfile>): IMemoryProfile {
  return {
    recurringThemes: dedupe([...current.recurringThemes, ...(update.recurringThemes || [])]).slice(-20),
    keyPeople: dedupeObjects([...current.keyPeople, ...(update.keyPeople || [])], 'name').slice(-20),
    triggers: dedupe([...current.triggers, ...(update.triggers || [])]).slice(-20),
    copingStrategies: dedupeObjects([...current.copingStrategies, ...(update.copingStrategies || [])], 'strategy').slice(-20),
    progressNotes: dedupe([...current.progressNotes, ...(update.progressNotes || [])]).slice(-30),
    moodTrend: update.moodTrend || current.moodTrend,
    followUpTopics: dedupe([...current.followUpTopics, ...(update.followUpTopics || [])]).slice(-20)
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeObjects<T extends Record<string, string>>(values: T[], key: keyof T): T[] {
  const map = new Map<string, T>();
  for (const value of values) {
    const mapKey = value[key]?.toLowerCase();
    if (mapKey) map.set(mapKey, value);
  }
  return [...map.values()];
}

function emptyProfile(): IMemoryProfile {
  return {
    recurringThemes: [],
    keyPeople: [],
    triggers: [],
    copingStrategies: [],
    progressNotes: [],
    moodTrend: '',
    followUpTopics: []
  };
}
