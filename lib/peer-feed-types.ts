// Shared types for the Peer Wall (其他学员墙) — coach-curated featured submissions.
//
// The visibility contract: a row in student_history_records is on the public feed
// if and only if `featured = true`. Coach controls the flag via the feature API;
// students can request un-feature on their own rows.

// Value types — what makes a post worth another student's time. Deliberately
// not topic types (net / footwork / doubles): the coach already assigns one of
// these when featuring, and a reader arrives wanting "something I can train"
// or "someone who was stuck like me", not "posts about the net".
export type PeerFeedCategory =
  | 'correction'    // 纠错点 — student wrote out an error they noticed
  | 'drill_seed'    // 好 drill 种子
  | 'honest_stuck'  // 诚实的卡住点
  | 'good_question' // 好问题
  | 'breakthrough'  // 想通了 — 卡了一段时间之后打通的，含前后对照

export const PEER_FEED_CATEGORIES: readonly PeerFeedCategory[] = [
  'correction',
  'drill_seed',
  'honest_stuck',
  'good_question',
  'breakthrough',
] as const;

export function isPeerFeedCategory(value: unknown): value is PeerFeedCategory {
  return typeof value === 'string' && (PEER_FEED_CATEGORIES as readonly string[]).includes(value);
}

export type PeerFeedSubmissionType = 'lesson' | 'match';

// Sanitized item rendered on the student-facing wall. No student_id, no name.
export type PeerFeedItem = {
  id: string;                                // external_id of the source row
  featuredAt: string;                        // ISO timestamp
  category: PeerFeedCategory;
  angle: string;                             // 教练导读 / coach framing (zh, free-form)
  tier: string;                              // 'C2' / 'B1' / 'A2' / ''
  submissionType: PeerFeedSubmissionType;
  happenedAt: string | null;                 // date of the lesson / match
  // The coach's written reply. 点评 is a PUBLIC channel by design
  // (2026-08-01): it is written knowing the whole roster reads it, and it
  // shows on the wall whenever the row is featured. Anything meant for one
  // person — injuries, doubts, anything about a specific body or life — goes
  // to the private thread in /api/student-messages instead.
  coachFeedback?: string;
  excerpt: {
    // For lesson summaries
    title?: string;
    reflection?: string;
    question?: string;
    // For match reviews
    match?: string;
    score?: string;
    whatWorked?: string;
    nextAdjustment?: string;
    experience?: string;
  };
};
