import type { ISession } from '../models/Session.model';
import { SessionModel } from '../models/Session.model';
import { createSessionSummaryCard, updateLongTermMemory } from './memory.service';

export const SESSION_MAX_DURATION_MS = 5 * 60 * 60 * 1_000;
const EXPIRY_SWEEP_INTERVAL_MS = 60_000;

export function sessionEndsAt(session: Pick<ISession, 'startedAt'>): Date {
  return new Date(session.startedAt.getTime() + SESSION_MAX_DURATION_MS);
}

export function hasSessionExpired(session: Pick<ISession, 'startedAt'>, now = new Date()): boolean {
  return now >= sessionEndsAt(session);
}

export async function expireSessionIfNeeded(session: ISession): Promise<boolean> {
  if (session.status !== 'active' || !hasSessionExpired(session)) return false;

  session.status = 'ended';
  session.endedAt = sessionEndsAt(session);
  await session.save();

  try {
    session.summaryCard = await createSessionSummaryCard(session);
    await session.save();
    await updateLongTermMemory(String(session.userId), session);
  } catch (error) {
    console.error('[session:auto_end_follow_up_failed]', {
      sessionId: String(session._id),
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return true;
}

/** Used only by long-running server deployments; Vercel uses request-time expiry. */
export async function expireActiveSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - SESSION_MAX_DURATION_MS);
  const expiredSessions = await SessionModel.find({
    status: 'active',
    startedAt: { $lte: cutoff }
  }).limit(100);

  await Promise.all(expiredSessions.map((session) => expireSessionIfNeeded(session)));
}

export function startSessionExpirySweep(): void {
  void expireActiveSessions().catch(logSweepFailure);
  const timer = setInterval(() => {
    void expireActiveSessions().catch(logSweepFailure);
  }, EXPIRY_SWEEP_INTERVAL_MS);
  timer.unref();
}

function logSweepFailure(error: unknown): void {
  console.error('[session:auto_end_sweep_failed]', {
    error: error instanceof Error ? error.message : String(error)
  });
}
