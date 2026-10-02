import { randomInt, randomUUID } from "node:crypto";
import type { Answers, EntryContext } from "@qf/journey-engine";

export type DraftStatus = "in_progress" | "quoted" | "payment_pending" | "purchased" | "payment_failed";

export interface Draft {
  id: string;
  journeyId: string;
  /** Customer-facing quote reference. Issued after the first answered step, not on Start. */
  reference: string | null;
  status: DraftStatus;
  entry: EntryContext;
  answers: Answers;
  /** Content version shown per step id, kept as evidence of what the customer saw. */
  contentSeen: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface DraftPatch {
  answers?: Answers;
  status?: DraftStatus;
  contentSeen?: Record<string, string>;
}

export class DraftLockedError extends Error {
  override name = "DraftLockedError";
}

/** Persistence for quote drafts. The demo keeps them in memory; production would use a database. */
export interface DraftStore {
  create(input: { journeyId: string; entry: EntryContext }): Promise<Draft>;
  get(id: string): Promise<Draft | null>;
  /** Saves a patch. Throws DraftLockedError once payment has started. */
  save(id: string, patch: DraftPatch): Promise<Draft>;
  /** Issues a reference if the draft does not have one yet. Idempotent. */
  ensureReference(id: string): Promise<string>;
  findByReference(reference: string): Promise<Draft | null>;
}

const LOCKED: ReadonlySet<DraftStatus> = new Set(["payment_pending", "purchased"]);
// Crockford-style alphabet without I, L, O, U, 0 or 1, so references read aloud without confusion.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateReference(prefix = "MQ"): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function createMemoryDraftStore(options: { now?: () => number; referencePrefix?: string } = {}): DraftStore {
  const now = options.now ?? Date.now;
  const drafts = new Map<string, Draft>();
  const byReference = new Map<string, string>();
  const clone = (d: Draft): Draft => structuredClone(d);

  const mustGet = (id: string): Draft => {
    const draft = drafts.get(id);
    if (!draft) throw new Error(`Draft ${id} not found`);
    return draft;
  };

  return {
    async create({ journeyId, entry }) {
      const t = now();
      const draft: Draft = { id: randomUUID(), journeyId, reference: null, status: "in_progress", entry, answers: {}, contentSeen: {}, createdAt: t, updatedAt: t };
      drafts.set(draft.id, draft);
      return clone(draft);
    },
    async get(id) {
      const draft = drafts.get(id);
      return draft ? clone(draft) : null;
    },
    async save(id, patch) {
      const draft = mustGet(id);
      if (LOCKED.has(draft.status)) throw new DraftLockedError(`Draft ${id} is ${draft.status} and cannot change`);
      if (patch.answers) draft.answers = structuredClone(patch.answers);
      if (patch.status) draft.status = patch.status;
      if (patch.contentSeen) draft.contentSeen = { ...draft.contentSeen, ...patch.contentSeen };
      draft.updatedAt = now();
      return clone(draft);
    },
    async ensureReference(id) {
      const draft = mustGet(id);
      if (draft.reference) return draft.reference;
      let reference: string;
      do reference = generateReference(options.referencePrefix);
      while (byReference.has(reference));
      draft.reference = reference;
      byReference.set(reference, id);
      return reference;
    },
    async findByReference(reference) {
      const id = byReference.get(reference.trim().toUpperCase());
      return id ? clone(mustGet(id)) : null;
    },
  };
}
