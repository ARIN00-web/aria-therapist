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
    `User ID: ${user.id}`,
    "",
    "## Current Session",
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