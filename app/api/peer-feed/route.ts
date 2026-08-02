// Public read of the peer wall (其他学员墙).
// Returns sanitized featured submissions — no studentId, no real names.

import { NextResponse } from 'next/server';
import {
  isPeerFeedCategory,
  type PeerFeedItem,
  type PeerFeedSubmissionType,
} from '@/lib/peer-feed-types';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

type HistoryRow = {
  external_id: string;
  happened_at: string | null;
  record_type: 'lesson_record' | 'lesson_summary' | 'match_review';
  title: string | null;
  payload: unknown;
  featured: boolean | null;
  featured_at: string | null;
  featured_angle: string | null;
  featured_category: string | null;
  featured_tier: string | null;
  featured_pinned?: boolean | null;
  coach_feedback: string | null;
  featured_excerpt: unknown;
  featured_feedback: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractLessonExcerpt(payload: unknown) {
  if (!isObject(payload)) return {};
  const summary = isObject(payload.lessonSummary) ? payload.lessonSummary : payload;
  const submission = isObject(payload.submission) && isObject(payload.submission.lessonSummary)
    ? payload.submission.lessonSummary
    : null;
  const source = submission || summary;
  return {
    title: str(source.title),
    reflection: str(source.studentReflection),
    question: str(source.question),
  };
}

function extractMatchExcerpt(payload: unknown) {
  if (!isObject(payload)) return {};
  const review = isObject(payload.matchReview) ? payload.matchReview : payload;
  const submission = isObject(payload.submission) && isObject(payload.submission.matchReview)
    ? payload.submission.matchReview
    : null;
  const source = submission || review;
  return {
    match: str(source.match),
    score: str(source.score),
    whatWorked: str(source.whatWorked),
    nextAdjustment: str(source.nextAdjustment),
    experience: str(source.experience),
  };
}

function rowToFeedItem(row: HistoryRow): PeerFeedItem | null {
  if (!row.featured) return null;
  const category = row.featured_category;
  if (!isPeerFeedCategory(category)) return null;
  const angle = str(row.featured_angle);
  if (!angle) return null;

  let submissionType: PeerFeedSubmissionType;
  let excerpt: PeerFeedItem['excerpt'];
  if (row.record_type === 'match_review') {
    submissionType = 'match';
    excerpt = isObject(row.featured_excerpt) ? row.featured_excerpt : extractMatchExcerpt(row.payload);
  } else if (row.record_type === 'lesson_summary' || row.record_type === 'lesson_record') {
    submissionType = 'lesson';
    excerpt = isObject(row.featured_excerpt) ? row.featured_excerpt : extractLessonExcerpt(row.payload);
  } else {
    return null;
  }

  // 点评 is a public channel by design (2026-08-01): the coach writes it
  // knowing the whole roster reads it. Anything meant for one person goes to
  // the private thread in /api/student-messages instead.
  const coachFeedback = str(row.featured_feedback) || str(row.coach_feedback);

  return {
    id: row.external_id,
    featuredAt: row.featured_at || new Date().toISOString(),
    category,
    angle,
    tier: str(row.featured_tier),
    ...(row.featured_pinned ? { pinned: true } : {}),
    submissionType,
    happenedAt: row.happened_at,
    excerpt,
    ...(coachFeedback ? { coachFeedback } : {}),
  };
}

function isMissingFeaturedColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // 42703 = undefined_column. PostgREST surfaces the column name in the message.
  return error.code === '42703' || /featured/i.test(error.message || '');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ items: [] }, { headers: NO_STORE_HEADERS });
  }

  const BASE_COLUMNS =
    'external_id, happened_at, record_type, title, payload, featured, featured_at, featured_angle, featured_category, featured_tier, coach_feedback, featured_excerpt, featured_feedback';

  // 置顶是后加的列。先带着它查；如果这个库还没跑 2026-08-02_featured_pinned，
  // 退回不带置顶的查询——宁可暂时没有置顶，也不能让整面墙变空。
  const db = supabase;
  async function fetchFeed(withPinned: boolean) {
    let query = db
      .from('student_history_records')
      .select((withPinned ? `${BASE_COLUMNS}, featured_pinned` : BASE_COLUMNS) as '*')
      .eq('featured', true);
    if (withPinned) query = query.order('featured_pinned', { ascending: false, nullsFirst: false });
    return query.order('featured_at', { ascending: false, nullsFirst: false }).limit(limit);
  }

  let { data, error } = await fetchFeed(true);
  if (error && /featured_pinned/i.test(error.message || '')) {
    ({ data, error } = await fetchFeed(false));
  }

  if (error) {
    if (isMissingFeaturedColumn(error)) {
      // Migration hasn't been run yet — return empty list so UI renders the empty state.
      return NextResponse.json({ items: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
    }
    console.error('[peer-feed-read-error]', error);
    return NextResponse.json({ error: 'Failed to load peer feed.' }, { status: 502 });
  }

  const items = ((data || []) as HistoryRow[])
    .map(rowToFeedItem)
    .filter((item): item is PeerFeedItem => Boolean(item));

  return NextResponse.json({ items, schemaReady: true }, { headers: NO_STORE_HEADERS });
}
