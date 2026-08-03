// 从原始提交 payload 里挖出墙上要显示的那几段文字。
//
// 原本长在 app/api/peer-feed/route.ts 里。加精时要翻译、回填脚本也要翻译，
// 三处都得按同一套规则取同一批字段——取得不一样就会翻了一批、显示另一批。

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function extractLessonExcerpt(payload: unknown) {
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

export function extractMatchExcerpt(payload: unknown) {
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

/** 按 record_type 选对应的取法；featured_excerpt 存在时优先用它。 */
export function resolveExcerpt(
  recordType: string,
  featuredExcerpt: unknown,
  payload: unknown,
): Record<string, string> {
  if (isObject(featuredExcerpt)) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(featuredExcerpt)) {
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  }
  if (recordType === 'match_review') return extractMatchExcerpt(payload) as Record<string, string>;
  return extractLessonExcerpt(payload) as Record<string, string>;
}
