<<<<<<< HEAD
import {ISession} from '../models/Session.model';
import {IMemory} from '../models/Memory.model';
import {IUser} from '../models/User.model';


const AI_PERSONA = `
You are Aria, an AI emotional support companion.

Your purpose is to help people explore their thoughts, emotions, and life challenges with warmth, empathy, curiosity, and respect.

## Identity

You are calm, patient, emotionally intelligent, non-judgmental, and genuine.

You never pretend to be human, but you also don't repeatedly remind users that you're an AI. Speak naturally and conversationally.

Your goal is not to solve every problem, but to help users feel heard, understood, emotionally grounded, and capable of taking one meaningful next step.

## Core Principles

- Listen before solving.
- Reflect before advising.
- Validate emotions without assuming facts.
- Be curious rather than certain.
- Match the user's emotional pace.
- Ask one thoughtful question at a time.
- Keep responses collaborative rather than directive.
- Respect the user's autonomy.

## Therapeutic Style

Draw naturally from:
- Person-Centred Therapy
- Cognitive Behavioural Therapy (CBT)
- Acceptance and Commitment Therapy (ACT)
- Mindfulness
- Motivational Interviewing

Use these approaches only when they fit the conversation. Sometimes simply listening is the most helpful response.

## Communication

Write naturally using everyday language.

Avoid sounding:
- robotic
- overly clinical
- scripted
- preachy

Keep responses concise unless the user wants a deeper discussion.

## Boundaries

Do not:
- diagnose mental health conditions
- claim certainty about someone's situation
- shame, lecture, or manipulate
- make promises or guarantees
- invent memories or facts about the user

When unsure, acknowledge uncertainty and explore with the user instead of guessing.

## Safety

If a conversation involves possible immediate danger or crisis, respond with warmth and empathy first. Encourage the user to seek appropriate real-world support or emergency assistance when necessary while remaining calm, compassionate, and respectful.

## Success

A successful response leaves the user feeling more understood, more emotionally aware, and better able to take one small next step.
`;

export const buildContext = async (session: ISession, memory: IMemory | null, user: IUser) => {
  const persona = AI_PERSONA;
  const preferredModality = user.preferredModality
    ? `Preferred modality: ${user.preferredModality}`
    : null;

  const longTermMemory = memory ? [
    "## Long-Term Memory",
    memory.profile.recurringThemes.length ? `Recurring themes: ${memory.profile.recurringThemes.join(', ')}` : null,
    memory.profile.keyPeople.length ? `Important people: ${memory.profile.keyPeople.map(({ name, relationship, dynamic }) => `${name} is the user's (${relationship}) and is generally ${dynamic}`).join(', ')}` : null,
    memory.profile.triggers.length ? `Known triggers: ${memory.profile.triggers.join(', ')}` : null,
    memory.profile.copingStrategies.length ? `Helpful coping strategies: ${memory.profile.copingStrategies.map(({ strategy, effectiveness }) => `${strategy} has been ${effectiveness}`).join(', ')}` : null,
    memory.profile.progressNotes.length ? `Recent progress: ${memory.profile.progressNotes.join(', ')}` : null,
    memory.profile.moodTrend ? `Overall mood trend: ${memory.profile.moodTrend}` : null,
    memory.profile.followUpTopics.length ? `Suggested follow-up topics: ${memory.profile.followUpTopics.join(', ')}` : null,
  ] : ["## Long-Term Memory", "This is a new user. No long-term memory exists yet."];

  const context = [
    persona,
    "## User Information",
    `Name: ${user.name}`,
    preferredModality,
    "",
    "## Tier 2: Current Session Summary",
    `Session started: ${session.startedAt.toLocaleDateString()}`,
    session.moodBefore ? `Mood at session start: ${session.moodBefore}` : null,
    session.rollingSummary
      ? `Session summary so far: ${session.rollingSummary}`
      : "This is the beginning of the session. No summary yet.",
    "",
    ...longTermMemory,
    "",
    "Use this information only as background context.",
    "Do not repeat it verbatim.",
    "Naturally remember relevant details when they help the conversation.",
  ]
  .filter(Boolean)
  .join("\n");

  return context;
};
=======
import { Types } from 'mongoose';
import { MemoryModel, type IMemoryProfile } from '../models/Memory.model';
import { SessionModel } from '../models/Session.model';
import { UserModel } from '../models/User.model';
import type { ChatMessage } from './llm.client';

export interface TherapyContext {
  systemPrompt: string;
  messages: ChatMessage[];
}

export async function buildTherapyContext(
  userId: string,
  sessionId: string,
  clinicalContext: string[]
): Promise<TherapyContext> {
  const [user, session, memory] = await Promise.all([
    UserModel.findById(userId),
    SessionModel.findOne({ _id: sessionId, userId: new Types.ObjectId(userId) }),
    MemoryModel.findOne({ userId: new Types.ObjectId(userId) })
  ]);

  if (!user || !session) {
    throw new Error('Session context not found');
  }

  const profile = memory?.profile || emptyProfile();
  const messages = session.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content
  }));

  return {
    systemPrompt: [
      personaBlock(user.name, user.preferredModality),
      profileBlock(user.name, profile),
      sessionBlock(session.rollingSummary || ''),
      clinicalContextBlock(clinicalContext)
    ].join('\n\n'),
    messages
  };
}

function personaBlock(name: string, modality: string): string {
  return `You are Aria, a warm AI emotional support companion for ${name}.
You are not a licensed therapist and must not diagnose, prescribe, or replace professional care.
Use ${modality} when helpful, with reflective listening, tentative emotion naming, and one question per response.
Match the user's response length. Never ask multiple questions at once. Encourage professional support when appropriate.`;
}

function profileBlock(name: string, profile: IMemoryProfile): string {
  return `What you know about ${name}:
Recurring themes: ${profile.recurringThemes.join(', ') || 'none yet'}
Key people: ${profile.keyPeople.map((person) => `${person.name} (${person.relationship}: ${person.dynamic})`).join('; ') || 'none yet'}
Triggers: ${profile.triggers.join(', ') || 'none yet'}
Coping strategies: ${profile.copingStrategies.map((item) => `${item.strategy} (${item.effectiveness})`).join('; ') || 'none yet'}
Progress notes: ${profile.progressNotes.join('; ') || 'none yet'}
Mood trend: ${profile.moodTrend || 'unknown'}
Follow up on: ${profile.followUpTopics.join(', ') || 'none yet'}`;
}

function sessionBlock(rollingSummary: string): string {
  return `This session summary so far: ${rollingSummary || 'No summary yet. Use the latest messages as the primary context.'}`;
}

function clinicalContextBlock(clinicalContext: string[]): string {
  if (!clinicalContext.length) return 'Relevant clinical context: none retrieved.';
  return `Relevant clinical context:\n${clinicalContext.map((chunk, index) => `${index + 1}. ${chunk}`).join('\n')}`;
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
