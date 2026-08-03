// Public read of the peer wall (其他学员墙).
// Returns sanitized featured submissions — no studentId, no real names.

import { NextResponse } from 'next/server';
import {
  isPeerFeedCategory,
  type PeerFeedItem,
  type PeerFeedSubmissionType,
} from '@/lib/peer-feed-types';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { resolveExcerpt } from '@/lib/peer-feed-excerpt';
import { parseFeaturedTranslation } from '@/lib/featured-translation';

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
  featured_title?: string | null;
  featured_pinned?: boolean | null;
  coach_feedback: string | null;
  featured_excerpt: unknown;
  featured_feedback: string | null;
  featured_en?: unknown;
};

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function rowToFeedItem(row: HistoryRow, lang: 'zh' | 'en'): PeerFeedItem | null {
  if (!row.featured) return null;
  const category = row.featured_category;
  if (!isPeerFeedCategory(category)) return null;
  const angle = str(row.featured_angle);
  if (!angle) return null;

  let submissionType: PeerFeedSubmissionType;
  if (row.record_type === 'match_review') {
    submissionType = 'match';
  } else if (row.record_type === 'lesson_summary' || row.record_type === 'lesson_record') {
    submissionType = 'lesson';
  } else {
    return null;
  }

  const excerpt = resolveExcerpt(row.record_type, row.featured_excerpt, row.payload);

  // 点评 is a public channel by design (2026-08-01): the coach writes it
  // knowing the whole roster reads it. Anything meant for one person goes to
  // the private thread in /api/student-messages instead.
  const coachFeedback = str(row.featured_feedback) || str(row.coach_feedback);
  const title = str(row.featured_title);

  // 英文版：有译文就用译文，逐字段回退。没翻到的字段仍然是中文——比整条
  // 空掉好，也比等所有字段都翻完才显示好。
  const en = lang === 'en' ? parseFeaturedTranslation(row.featured_en) : null;
  const pick = (value: string, translated?: string) => (en && translated ? translated : value);

  const localizedExcerpt: Record<string, string> = {};
  for (const [key, value] of Object.entries(excerpt)) {
    localizedExcerpt[key] = pick(value, en?.excerpt?.[key]);
  }

  const localizedTitle = pick(title, en?.title);
  const localizedFeedback = pick(coachFeedback, en?.coachFeedback);

  return {
    id: row.external_id,
    featuredAt: row.featured_at || new Date().toISOString(),
    category,
    angle: pick(angle, en?.angle),
    tier: str(row.featured_tier),
    ...(localizedTitle ? { title: localizedTitle } : {}),
    ...(row.featured_pinned ? { pinned: true } : {}),
    submissionType,
    happenedAt: row.happened_at,
    excerpt: localizedExcerpt,
    ...(localizedFeedback ? { coachFeedback: localizedFeedback } : {}),
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
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'zh';

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ items: [] }, { headers: NO_STORE_HEADERS });
  }

  const BASE_COLUMNS =
    'external_id, happened_at, record_type, title, payload, featured, featured_at, featured_angle, featured_category, featured_tier, featured_title, coach_feedback, featured_excerpt, featured_feedback';

  // 置顶和译文都是后加的列。先带着它们查，库里没有就逐个退回——宁可暂时
  // 没有置顶、没有英文版，也不能让整面墙变空。
  const db = supabase;
  async function fetchFeed(withPinned: boolean, withTranslation: boolean) {
    const columns = [BASE_COLUMNS];
    if (withPinned) columns.push('featured_pinned');
    if (withTranslation) columns.push('featured_en');
    let query = db
      .from('student_history_records')
      .select(columns.join(', ') as '*')
      .eq('featured', true);
    if (withPinned) query = query.order('featured_pinned', { ascending: false, nullsFirst: false });
    return query.order('featured_at', { ascending: false, nullsFirst: false }).limit(limit);
  }

  let { data, error } = await fetchFeed(true, true);
  if (error && /featured_en/i.test(error.message || '')) {
    ({ data, error } = await fetchFeed(true, false));
  }
  if (error && /featured_pinned/i.test(error.message || '')) {
    ({ data, error } = await fetchFeed(false, false));
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
    .map((row) => rowToFeedItem(row, lang))
    .filter((item): item is PeerFeedItem => Boolean(item));

  return NextResponse.json({ items, schemaReady: true }, { headers: NO_STORE_HEADERS });
}
