import { randomUUID } from "node:crypto";

export interface Session {
  /** Opaque, unguessable id stored in an httpOnly cookie. */
  id: string;
  draftId: string;
  /** Epoch ms after which the session is idle-expired. */
  expiresAt: number;
  /** Set when the session ends (timeout or sign-out). The record is kept briefly so the
   *  session-ended page can still show the quote reference. */
  endedAt: number | null;
}

export interface SessionStore {
  readonly idleMs: number;
  create(draftId: string): Promise<Session>;
  /** Returns the session if it exists, marking it ended if it has idle-expired. */
  get(id: string): Promise<Session | null>;
  /** Records activity: pushes the expiry out by the idle period. No-op on ended sessions. */
  touch(id: string): Promise<Session | null>;
  end(id: string): Promise<void>;
}

export function isActive(session: Session | null): session is Session {
  return session !== null && session.endedAt === null;
}

export function createMemorySessionStore(options: { idleMs: number; now?: () => number }): SessionStore {
  const now = options.now ?? Date.now;
  const sessions = new Map<string, Session>();

  const expireIfIdle = (session: Session) => {
    if (session.endedAt === null && now() >= session.expiresAt) session.endedAt = session.expiresAt;
    return session;
  };

  return {
    idleMs: options.idleMs,
    async create(draftId) {
      const session: Session = { id: randomUUID(), draftId, expiresAt: now() + options.idleMs, endedAt: null };
      sessions.set(session.id, session);
      return { ...session };
    },
    async get(id) {
      const session = sessions.get(id);
      return session ? { ...expireIfIdle(session) } : null;
    },
    async touch(id) {
      const session = sessions.get(id);
      if (!session) return null;
      expireIfIdle(session);
      if (session.endedAt === null) session.expiresAt = now() + options.idleMs;
      return { ...session };
    },
    async end(id) {
      const session = sessions.get(id);
      if (session && session.endedAt === null) session.endedAt = now();
    },
  };
}
