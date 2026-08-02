import type { PeerFeedCategory, PeerFeedItem } from './peer-feed-types';

type ArchiveRow = {
  external_id: string;
  created_at?: string | null;
  happened_at: string | null;
  student_id: string;
  record_type: 'lesson_summary' | 'match_review' | 'lesson_record';
  title: string | null;
  payload: unknown;
  coach_feedback?: string | null;
};

type ArchiveExcerpt = PeerFeedItem['excerpt'];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactForumArchiveNames(value: unknown, names: readonly string[]) {
  let result = text(value);
  for (const rawName of [...names].sort((a, b) => b.length - a.length)) {
    const name = text(rawName);
    if (name.length < 2) continue;
    const latin = /^[a-z\s_-]+$/i.test(name);
    const pattern = latin ? `\\b${escapeRegExp(name)}\\b` : escapeRegExp(name);
    result = result.replace(new RegExp(pattern, latin ? 'giu' : 'gu'), '某位学员');
  }
  return result
    .replace(/\b[abc][1-3]\b/giu, '')
    .replace(/\b[abc]\s*组/giu, '分组')
    .replace(/女双|男双/gu, '双打')
    .replace(/成人|青少年/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

const PRIVATE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['年龄', /(?:^|\D)\d{1,2}\s*岁/u],
  ['家庭身份', /家长|父亲|母亲|爸爸|妈妈|丈夫|妻子|女儿|儿子/u],
  ['伤病健康', /伤病|受伤|疼痛|痛感|肘部|(?:^|[\s，。；：—])肘(?:[\s，。；：—]|$)|膝盖|医生|康复|怀孕|不舒服/u],
  ['个人背景', /博士|职业|工作单位|学校|住址|电话|微信/u],
];

export function forumArchivePrivacyFlags(value: unknown) {
  const normalized = text(value);
  return PRIVATE_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
}

export function sanitizeForumArchiveFeedback(value: unknown, names: readonly string[]) {
  const paragraphs = String(value || '').split(/\n\s*\n/gu).map((paragraph) => redactForumArchiveNames(paragraph, names));
  const safe = paragraphs.filter((paragraph) => paragraph && forumArchivePrivacyFlags(paragraph).length === 0);
  return {
    feedback: safe.join('\n\n'),
    omittedParagraphs: paragraphs.length - safe.length,
  };
}

function lessonExcerpt(payload: unknown): ArchiveExcerpt {
  if (!isObject(payload)) return {};
  const summary = isObject(payload.lessonSummary) ? payload.lessonSummary : payload;
  const submission = isObject(payload.submission) && isObject(payload.submission.lessonSummary)
    ? payload.submission.lessonSummary
    : null;
  const source = submission || summary;
  return {
    title: text(source.title),
    reflection: text(source.studentReflection),
    question: text(source.question),
  };
}

function matchExcerpt(payload: unknown): ArchiveExcerpt {
  if (!isObject(payload)) return {};
  const review = isObject(payload.matchReview) ? payload.matchReview : payload;
  const submission = isObject(payload.submission) && isObject(payload.submission.matchReview)
    ? payload.submission.matchReview
    : null;
  const source = submission || review;
  return {
    match: text(source.match),
    whatWorked: text(source.whatWorked),
    nextAdjustment: text(source.nextAdjustment),
    experience: text(source.experience),
  };
}

export function forumArchiveDedupeKey(row: ArchiveRow) {
  return [row.student_id, row.record_type, row.happened_at || '', text(row.title).toLowerCase()].join('|');
}

export function forumArchiveContentKey(row: ArchiveRow) {
  const excerpt = row.record_type === 'match_review' ? matchExcerpt(row.payload) : lessonExcerpt(row.payload);
  return [row.student_id, row.record_type, ...Object.values(excerpt).map((value) => text(value).toLowerCase())].join('|');
}

export function prepareForumArchiveCandidate(row: ArchiveRow, names: readonly string[]) {
  if (row.student_id === 'demo') return { skip: '示例账号' as const };
  if (!['lesson_summary', 'match_review'].includes(row.record_type)) return { skip: '非总结/复盘' as const };
  if (/^(首次建档|initial profile setup)$/iu.test(text(row.title))) return { skip: '生成占位内容' as const };

  const rawExcerpt = row.record_type === 'match_review' ? matchExcerpt(row.payload) : lessonExcerpt(row.payload);
  const excerpt = Object.fromEntries(
    Object.entries(rawExcerpt)
      .map(([key, value]) => [key, redactForumArchiveNames(value, names)])
      .filter(([, value]) => Boolean(value)),
  ) as ArchiveExcerpt;
  const excerptText = Object.values(excerpt).join(' ');
  if (!excerptText) return { skip: '没有可展示正文' as const };

  const privacyFlags = forumArchivePrivacyFlags(excerptText);
  if (privacyFlags.length) return { skip: `正文含${privacyFlags.join('、')}` as const };

  const feedback = redactForumArchiveNames(row.coach_feedback, names);
  const feedbackFlags = forumArchivePrivacyFlags(feedback);
  const publicFeedback = feedbackFlags.length ? '' : feedback;

  let category: PeerFeedCategory = row.record_type === 'match_review' ? 'correction' : 'honest_stuck';
  if (excerpt.question) category = 'good_question';
  else if (/终于|想通|明白|进步|更稳|成功|改善/u.test(excerptText)) category = 'breakthrough';

  const typeLabel = row.record_type === 'match_review' ? '比赛复盘' : '课后总结';
  return {
    candidate: {
      externalId: row.external_id,
      featuredAt: row.happened_at ? `${row.happened_at}T12:00:00.000Z` : row.created_at || new Date(0).toISOString(),
      angle: `历史${typeLabel}：保留当时最有训练价值的观察，已隐去身份信息。`,
      category,
      excerpt,
      feedback: publicFeedback || null,
      feedbackOmitted: Boolean(feedback && feedbackFlags.length),
    },
  };
}
