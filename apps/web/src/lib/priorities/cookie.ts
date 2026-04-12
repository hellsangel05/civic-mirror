import "server-only";
import { cookies } from "next/headers";
import { TOPIC_SLUGS, type TopicSlug } from "../topics";

// User priorities live in a single cookie. We're not writing to the
// `voter_sessions` table yet — that's a Phase 3 thing once we have ballot
// share URLs. For now: cookie in, cookie out, no DB hop, no auth surface.
//
// Shape: { housing: 0.8, climate: 1.0, ... }. All values are 0..1. Topics
// the user hasn't weighted are absent (treated as 0 by the scorer).

const COOKIE_NAME = "cm_priorities";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type Priorities = Partial<Record<TopicSlug, number>>;

const TOPIC_SET = new Set<string>(TOPIC_SLUGS);

function sanitize(input: unknown): Priorities {
  if (!input || typeof input !== "object") return {};
  const out: Priorities = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!TOPIC_SET.has(k)) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    // Keep zeros — they mean "not important" which is different from "never set".
    out[k as TopicSlug] = Math.max(0, Math.min(1, n));
  }
  return out;
}

export async function readPriorities(): Promise<Priorities> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return {};
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function writePriorities(priorities: Priorities): Promise<void> {
  const store = await cookies();
  const cleaned = sanitize(priorities);
  store.set(COOKIE_NAME, JSON.stringify(cleaned), {
    httpOnly: false, // The voter should be able to read/clear this if they want.
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearPriorities(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True if the user has taken the quiz (cookie has any topic keys, even zeros). */
export function hasTakenQuiz(p: Priorities): boolean {
  return Object.keys(p).length > 0;
}

/** True if the user has at least one nonzero priority weight. */
export function hasAnyPriorities(p: Priorities): boolean {
  for (const v of Object.values(p)) if ((v ?? 0) > 0) return true;
  return false;
}
