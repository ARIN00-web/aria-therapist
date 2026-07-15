import { Types } from 'mongoose';
import { MemoryModel, type IMemoryProfile } from '../models/Memory.model';
import { SessionModel } from '../models/Session.model';
import { UserModel } from '../models/User.model';
import type { ChatMessage } from './llm.client';

export interface TherapyContext {
  systemPrompt: string;
  messages: ChatMessage[];
}

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
- Dialectical Behaviour Therapy (DBT)
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

  const preferredModality = user.preferredModality
    ? `Preferred modality: ${user.preferredModality}`
    : null;

  const longTermMemoryBlock = [
    "## Long-Term Memory Profile",
    profile.recurringThemes.length ? `Recurring themes: ${profile.recurringThemes.join(', ')}` : null,
    profile.keyPeople.length ? `Important people: ${profile.keyPeople.map((person) => `${person.name} (${person.relationship}: ${person.dynamic})`).join('; ')}` : null,
    profile.triggers.length ? `Known triggers: ${profile.triggers.join(', ')}` : null,
    profile.copingStrategies.length ? `Helpful coping strategies: ${profile.copingStrategies.map((item) => `${item.strategy} (${item.effectiveness})`).join('; ')}` : null,
    profile.progressNotes.length ? `Recent progress: ${profile.progressNotes.join('; ')}` : null,
    profile.moodTrend ? `Overall mood trend: ${profile.moodTrend}` : null,
    profile.followUpTopics.length ? `Suggested follow-up topics: ${profile.followUpTopics.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const clinicalContextBlock = clinicalContext.length
    ? `## Relevant Clinical reference Context:\n${clinicalContext.map((chunk, index) => `${index + 1}. ${chunk}`).join('\n')}`
    : '## Relevant Clinical reference Context:\nnone retrieved.';

  const systemPrompt = [
    AI_PERSONA,
    "## User Information",
    `Name: ${user.name}`,
    preferredModality,
    "",
    "## Current Session Summary (Tier 2)",
    session.moodBefore ? `Mood at session start: ${session.moodBefore}/10` : null,
    session.rollingSummary
      ? `Session summary so far: ${session.rollingSummary}`
      : "This is the beginning of the session. No summary yet.",
    "",
    longTermMemoryBlock,
    "",
    clinicalContextBlock,
    "",
    "Use this information only as background context.",
    "Do not repeat it verbatim.",
    "Naturally remember relevant details when they help the conversation.",
  ]
  .filter(Boolean)
  .join("\n");

  return {
    systemPrompt,
    messages
  };
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
