// Shared types for the Peer Wall (其他学员墙) — coach-curated featured submissions.
//
// The visibility contract: a row in student_history_records is on the public feed
// if and only if `featured = true`. Coach controls the flag via the feature API;
// students can request un-feature on their own rows.

export type PeerFeedCategory =
  | 'correction'    // 纠错点 — student wrote out an error they noticed
  | 'drill_seed'    // 好 drill 种子
  | 'honest_stuck'  // 诚实的卡住点
  | 'good_question' // 好问题

export const PEER_FEED_CATEGORIES: readonly PeerFeedCategory[] = [
  'correction',
  'drill_seed',
  'honest_stuck',
  'good_question',
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
