<<<<<<< HEAD
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemoryModel, type IMemory, type IMemoryProfile } from '../models/Memory.model';
import { SessionModel, type IMessage, type ISession } from '../models/Session.model';
import { UserModel, type IUser } from '../models/User.model';
import { withTimeout } from '../utils/withTimeout';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const MEMORY_UPDATE_MODEL = 'gemini-2.0-flash';
const MEMORY_UPDATE_TIMEOUT_MS = 12000;
const RECENT_MESSAGE_COUNT = 12;
const VALID_EFFECTIVENESS = new Set(['low', 'medium', 'high']);

interface MemoryPerson {
  name: string;
  relationship: string;
  dynamic: string;
}

interface MemoryCopingStrategy {
  strategy: string;
  effectiveness: 'low' | 'medium' | 'high';
}

interface MemoryUpdatePayload {
  recurringThemes: string[];
  keyPeople: MemoryPerson[];
  triggers: string[];
  copingStrategies: MemoryCopingStrategy[];
  progressNotes: string[];
  moodTrend: string;
  followUpTopics: string[];
}

const EMPTY_MEMORY_PROFILE: IMemoryProfile = {
  recurringThemes: [],
  keyPeople: [],
  triggers: [],
  copingStrategies: [],
  progressNotes: [],
  moodTrend: '',
  followUpTopics: [],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) {
      continue;
    }

    const key = normalizeKey(cleaned);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function sanitizeKeyPeople(value: unknown): MemoryPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const peopleByKey = new Map<string, MemoryPerson>();

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const name = cleanText(raw.name);
    const relationship = cleanText(raw.relationship);
    const dynamic = cleanText(raw.dynamic);

    if (!name || !relationship) {
      continue;
    }

    const key = `${normalizeKey(name)}::${normalizeKey(relationship)}`;
    const existing = peopleByKey.get(key);

    if (!existing || dynamic.length > existing.dynamic.length) {
      peopleByKey.set(key, { name, relationship, dynamic });
    }
  }

  return Array.from(peopleByKey.values());
}

function sanitizeCopingStrategies(value: unknown): MemoryCopingStrategy[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const strategiesByKey = new Map<string, MemoryCopingStrategy>();

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const strategy = cleanText(raw.strategy);
    const effectivenessValue = normalizeKey(cleanText(raw.effectiveness));

    if (!strategy) {
      continue;
    }

    const effectiveness = VALID_EFFECTIVENESS.has(effectivenessValue)
      ? (effectivenessValue as MemoryCopingStrategy['effectiveness'])
      : 'medium';

    const key = normalizeKey(strategy);
    const existing = strategiesByKey.get(key);

    if (!existing || effectivenessRank(effectiveness) >= effectivenessRank(existing.effectiveness)) {
      strategiesByKey.set(key, { strategy, effectiveness });
    }
  }

  return Array.from(strategiesByKey.values());
}

function effectivenessRank(value: MemoryCopingStrategy['effectiveness']): number {
  if (value === 'high') {
    return 3;
  }

  if (value === 'medium') {
    return 2;
  }

  return 1;
}

function sanitizeMemoryUpdatePayload(value: unknown): MemoryUpdatePayload {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

  return {
    recurringThemes: dedupeStrings(Array.isArray(raw.recurringThemes) ? raw.recurringThemes as string[] : []),
    keyPeople: sanitizeKeyPeople(raw.keyPeople),
    triggers: dedupeStrings(Array.isArray(raw.triggers) ? raw.triggers as string[] : []),
    copingStrategies: sanitizeCopingStrategies(raw.copingStrategies),
    progressNotes: dedupeStrings(Array.isArray(raw.progressNotes) ? raw.progressNotes as string[] : []),
    moodTrend: cleanText(raw.moodTrend),
    followUpTopics: dedupeStrings(Array.isArray(raw.followUpTopics) ? raw.followUpTopics as string[] : []),
  };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseMemoryUpdateResponse(responseText: string): MemoryUpdatePayload {
  const normalized = stripCodeFences(responseText);
  const parsed = JSON.parse(normalized) as unknown;
  return sanitizeMemoryUpdatePayload(parsed);
}

function formatMessages(messages: IMessage[]): string {
  if (messages.length === 0) {
    return 'No recent verbatim messages available.';
  }

  return messages
    .map(({ role, content, ts }) => `[${new Date(ts).toISOString()}] ${role}: ${content}`)
    .join('\n');
}

function buildMemoryUpdatePrompt(session: ISession, user: IUser, existingProfile: IMemoryProfile): string {
  const recentMessages = session.messages.slice(-RECENT_MESSAGE_COUNT);
  const currentProfile = JSON.stringify(existingProfile, null, 2);

  return [
    'You are updating long-term memory for Aria, an AI emotional support companion.',
    'This memory is for internal use only across future sessions.',
    'Extract durable, cross-session information only.',
    'Do not include one-off small talk, temporary phrasing, or speculative facts.',
    'Do not invent details that are not supported by the source material.',
    'Prefer concise, reusable memory items over narrative prose.',
    'Return valid JSON only. No markdown, no explanation.',
    '',
    'Return exactly this shape:',
    '{',
    '  "recurringThemes": string[],',
    '  "keyPeople": [{ "name": string, "relationship": string, "dynamic": string }],',
    '  "triggers": string[],',
    '  "copingStrategies": [{ "strategy": string, "effectiveness": "low" | "medium" | "high" }],',
    '  "progressNotes": string[],',
    '  "moodTrend": string,',
    '  "followUpTopics": string[]',
    '}',
    '',
    'User context:',
    `Name: ${user.name}`,
    `Preferred modality: ${user.preferredModality}`,
    user.timezone ? `Timezone: ${user.timezone}` : '',
    session.moodBefore ? `Mood before session: ${session.moodBefore}/10` : '',
    session.moodAfter ? `Mood after session: ${session.moodAfter}/10` : '',
    '',
    'Existing long-term memory profile:',
    currentProfile,
    '',
    'Tier 2 rolling session summary:',
    session.rollingSummary?.trim() || 'No rolling summary available.',
    '',
    'Tier 1 recent verbatim messages:',
    formatMessages(recentMessages),
  ]
    .filter(Boolean)
    .join('\n');
}

function mergeKeyPeople(existing: IMemoryProfile['keyPeople'], incoming: MemoryPerson[]): IMemoryProfile['keyPeople'] {
  const merged = new Map<string, MemoryPerson>();

  for (const person of existing) {
    const name = cleanText(person.name);
    const relationship = cleanText(person.relationship);
    const dynamic = cleanText(person.dynamic);

    if (!name || !relationship) {
      continue;
    }

    const key = `${normalizeKey(name)}::${normalizeKey(relationship)}`;
    merged.set(key, { name, relationship, dynamic });
  }

  for (const person of incoming) {
    const key = `${normalizeKey(person.name)}::${normalizeKey(person.relationship)}`;
    const existingPerson = merged.get(key);

    if (!existingPerson || person.dynamic.length > existingPerson.dynamic.length) {
      merged.set(key, person);
    }
  }

  return Array.from(merged.values());
}

function mergeCopingStrategies(
  existing: IMemoryProfile['copingStrategies'],
  incoming: MemoryCopingStrategy[]
): IMemoryProfile['copingStrategies'] {
  const merged = new Map<string, MemoryCopingStrategy>();

  for (const strategy of existing) {
    const cleanedStrategy = cleanText(strategy.strategy);
    const effectiveness = normalizeKey(cleanText(strategy.effectiveness));

    if (!cleanedStrategy) {
      continue;
    }

    merged.set(normalizeKey(cleanedStrategy), {
      strategy: cleanedStrategy,
      effectiveness: VALID_EFFECTIVENESS.has(effectiveness)
        ? (effectiveness as MemoryCopingStrategy['effectiveness'])
        : 'medium',
    });
  }

  for (const strategy of incoming) {
    const key = normalizeKey(strategy.strategy);
    const existingStrategy = merged.get(key);

    if (!existingStrategy || effectivenessRank(strategy.effectiveness) >= effectivenessRank(existingStrategy.effectiveness)) {
      merged.set(key, strategy);
    }
  }

  return Array.from(merged.values());
}

function mergeMemoryProfile(existing: IMemoryProfile, incoming: MemoryUpdatePayload): IMemoryProfile {
  return {
    recurringThemes: dedupeStrings([...existing.recurringThemes, ...incoming.recurringThemes]),
    keyPeople: mergeKeyPeople(existing.keyPeople, incoming.keyPeople),
    triggers: dedupeStrings([...existing.triggers, ...incoming.triggers]),
    copingStrategies: mergeCopingStrategies(existing.copingStrategies, incoming.copingStrategies),
    progressNotes: dedupeStrings([...existing.progressNotes, ...incoming.progressNotes]),
    moodTrend: incoming.moodTrend || existing.moodTrend || '',
    followUpTopics: dedupeStrings([...existing.followUpTopics, ...incoming.followUpTopics]),
  };
}

async function fetchMemoryUpdateFromGemini(
  session: ISession,
  user: IUser,
  existingProfile: IMemoryProfile
): Promise<MemoryUpdatePayload> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = genai.getGenerativeModel({ model: MEMORY_UPDATE_MODEL });
  const prompt = buildMemoryUpdatePrompt(session, user, existingProfile);
  const result = await withTimeout(
    model.generateContent(prompt),
    MEMORY_UPDATE_TIMEOUT_MS,
    'Long-term memory update'
  );

  const responseText = result.response.text().trim();
  if (!responseText) {
    throw new Error('Gemini returned an empty long-term memory update');
  }

  return parseMemoryUpdateResponse(responseText);
}

export async function updateLongTermMemoryFromSession(userId: string, sessionId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new Error('Invalid userId or sessionId');
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const sessionObjectId = new mongoose.Types.ObjectId(sessionId);

  console.log(`[MemoryService] Updating long-term memory for user ${userId} from session ${sessionId}`);

  const [session, memory, user] = await Promise.all([
    SessionModel.findById(sessionObjectId),
    MemoryModel.findOne({ userId: userObjectId } as never),
    UserModel.findById(userObjectId),
  ]);

  if (!session) {
    throw new Error('Session not found');
  }

  if (!user) {
    throw new Error('User not found');
  }

  if (session.userId.toString() !== userObjectId.toHexString()) {
    throw new Error('Session does not belong to user');
  }

  if (!session.endedAt) {
    throw new Error('Session must be ended before updating long-term memory');
  }

  const existingProfile = memory?.profile ?? EMPTY_MEMORY_PROFILE;
  const memoryUpdate = await fetchMemoryUpdateFromGemini(session, user, existingProfile);
  const mergedProfile = mergeMemoryProfile(existingProfile, memoryUpdate);

  if (memory) {
    memory.profile = mergedProfile;
    memory.lastUpdated = new Date();
    await memory.save();
    console.log(`[MemoryService] Updated existing memory profile for user ${userId}`);
    return;
  }

  await MemoryModel.create({
    userId: userObjectId,
    profile: mergedProfile,
    lastUpdated: new Date(),
  } as never);

  console.log(`[MemoryService] Created new memory profile for user ${userId}`);
}
=======
import { Types } from 'mongoose';
import { MemoryModel, type IMemoryProfile } from '../models/Memory.model';
import type { ISession } from '../models/Session.model';
import { callAnthropicText } from './llm.client';

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

  const generated = await callAnthropicText({
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
  const generated = await callAnthropicText({
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
    return JSON.parse(text) as Partial<IMemoryProfile>;
  } catch {
    return null;
  }
}

function parseSummaryCard(text: string | null) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { themes: string[]; reflection: string; nextTopic: string };
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
>>>>>>> b406221 (feat: add user export route and memory management services)
