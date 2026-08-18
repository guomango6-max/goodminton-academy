// Feature / un-feature a student submission for the peer wall.
//
// POST    — coach marks a submission as featured (requires coach token).
// DELETE  — either coach un-features, OR the student themselves takes their own
//           submission down (requires the credential matching the record's
//           student_id; no coach approval needed — psychological safety floor).

import { NextResponse } from 'next/server';
import { isPeerFeedCategory } from '@/lib/peer-feed-types';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { staffAuthorization, writeAdminAudit } from '@/lib/admin-auth';
import { buildFeaturedTranslation } from '@/lib/featured-translation';
import { resolveExcerpt } from '@/lib/peer-feed-excerpt';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

type SupabaseAdmin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

// 加精之后立刻生成英文版并写回 featured_en。
//
// 需要重新读一次这条记录：翻译要覆盖 excerpt 和点评，而这两样都不在加精
// 的请求体里——请求体只带导读、分类、等级。
async function translateFeaturedRecord(supabase: SupabaseAdmin, recordId: string, angle: string) {
  const { data, error } = await supabase
    .from('student_history_records')
    .select('record_type, payload, featured_excerpt, featured_title, featured_feedback, coach_feedback')
    .eq('external_id', recordId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    record_type: string;
    payload: unknown;
    featured_excerpt: unknown;
    featured_title: string | null;
    featured_feedback: string | null;
    coach_feedback: string | null;
  };

  const translation = await buildFeaturedTranslation({
    title: cleanText(row.featured_title),
    angle,
    coachFeedback: cleanText(row.featured_feedback) || cleanText(row.coach_feedback),
    excerpt: resolveExcerpt(row.record_type, row.featured_excerpt, row.payload),
  });

  if (!translation) return null;

  const { error: writeError } = await supabase
    .from('student_history_records')
    .update({ featured_en: translation })
    .eq('external_id', recordId);

  // 列还没建（迁移没跑）时静默跳过：加精本身已经成功了。
  if (writeError) {
    if (!/featured_en/i.test(writeError.message || '')) {
      console.error('[peer-wall-translate-write-error]', writeError);
    }
    return null;
  }

  return translation;
}

type FeaturePayload = {
  token?: string;
  recordId?: string;
  angle?: string;
  category?: string;
  tier?: string;
  // 加精置顶。少用——全置顶等于没置顶。
  pinned?: boolean;
};

// Coach-wide list of recent submissions with their featured state, so the
// coach page can pick what to put on the wall. Token-gated: this is the one
// view that pairs a student_id with their submission text.
export async function GET(req: Request) {
  if (!(await staffAuthorization(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ submissions: [] });
  }

  // payload / featured_excerpt 必须带上：教练台要显示学员写的原文，
  // 只给标题的话没法判断这条值不值得精选，也没法照着写点评。
  //
  // source 是给教练台「待处理」区用的：只有 source='website' 才是学员自己
  // 写的提交，'data/students' 是从 Obsidian 库回填的课次记录，没有学员正文，
  // 混进待处理队列会把 7 条淹在 50 条里。
  const columns =
    'external_id, student_id, record_type, title, happened_at, created_at, source, featured, featured_angle, featured_category, featured_tier, coach_feedback, payload, featured_excerpt';

  // coach_handled_at（20260813120000）和 featured_pinned（2026-08-02）都是后加的列，
  // 不同环境跑到哪一步不一定。逐级降级，缺哪个丢哪个，教练台照旧能开：
  // 待处理判定回落到旧规则（见 page.tsx 的 isPending），置顶状态则显示不出来。
  //
  // 顺序有讲究：第二档保留 featured_pinned。写成一档降级的话，只要 coach_handled_at
  // 缺席就会把 featured_pinned 一起丢掉——而线上正是这个状态，教练台因此永远看不到
  // 哪条置顶了（2026-08-18 上报「加精的帖子没有置顶」）。
  const attempts = [
    `${columns}, coach_handled_at, featured_pinned`,
    `${columns}, featured_pinned`,
    columns,
  ];

  let result = await supabase
    .from('student_history_records')
    .select(attempts[0])
    .order('created_at', { ascending: false })
    .limit(100);

  for (const selection of attempts.slice(1)) {
    if (!result.error) break;
    if (!/coach_handled_at|featured_pinned/i.test(result.error.message || '')) break;
    result = await supabase
      .from('student_history_records')
      .select(selection)
      .order('created_at', { ascending: false })
      .limit(100);
  }

  if (result.error) {
    console.error('[peer-wall-list-error]', result.error);
    return NextResponse.json({ error: 'Failed to load submissions.' }, { status: 502 });
  }

  return NextResponse.json({ submissions: result.data || [] });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as FeaturePayload | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const authorization = await staffAuthorization(req, body.token);
  if (!authorization) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const recordId = cleanText(body.recordId);
  if (!recordId) {
    return NextResponse.json({ error: 'Missing recordId.' }, { status: 400 });
  }

  const angle = cleanText(body.angle);
  if (!angle) {
    return NextResponse.json({ error: 'Coach angle (导读) is required.' }, { status: 400 });
  }
  if (angle.length > 280) {
    return NextResponse.json({ error: 'Coach angle is too long (max 280 chars).' }, { status: 400 });
  }

  const category = cleanText(body.category);
  if (!isPeerFeedCategory(category)) {
    return NextResponse.json(
      { error: 'category must be one of correction | drill_seed | honest_stuck | good_question | breakthrough.' },
      { status: 400 },
    );
  }

  const tier = cleanText(body.tier).slice(0, 8); // 'C2', 'B1', 'A2', etc — short.

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const featureFields = {
    featured: true,
    featured_at: new Date().toISOString(),
    featured_angle: angle,
    featured_category: category,
    featured_tier: tier || null,
  };

  // featured_pinned 是后加的列。库里还没跑 2026-08-02_featured_pinned 时，
  // 退回不带置顶的写入——宁可这次没置顶，也不能让精选整个失败。
  let { error, data } = await supabase
    .from('student_history_records')
    .update({ ...featureFields, featured_pinned: body.pinned === true })
    .eq('external_id', recordId)
    .select('external_id')
    .maybeSingle();

  if (error && /featured_pinned/i.test(error.message || '')) {
    ({ error, data } = await supabase
      .from('student_history_records')
      .update(featureFields)
      .eq('external_id', recordId)
      .select('external_id')
      .maybeSingle());
  }

  if (error) {
    console.error('[peer-wall-feature-error]', error);
    return NextResponse.json({ error: 'Failed to feature submission.' }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  }

  // “确认上墙”就是公开发布；发布成功后也应离开待处理队列。
  // coach_handled_at 是后加列，旧库没有时忽略，不能反过来影响上墙成功。
  const { error: handledError } = await supabase
    .from('student_history_records')
    .update({ coach_handled_at: new Date().toISOString() })
    .eq('external_id', recordId);
  if (handledError && !/coach_handled_at/i.test(handledError.message || '')) {
    console.error('[peer-wall-feature-handled-error]', handledError);
  }

  // 英文版用的译文，在加精这一刻生成一次。
  //
  // 翻译失败不影响加精：featured_en 为空时，英文版读到的就是中文原文——
  // 和这次改动之前一模一样。反过来让一次 DeepSeek 超时把整个加精操作打掉，
  // 才是真的坏。
  const translation = await translateFeaturedRecord(supabase, recordId, angle).catch((reason) => {
    console.error('[peer-wall-translate-error]', reason);
    return null;
  });

  if (authorization.kind === 'super_admin') {
    await writeAdminAudit(authorization.userId, 'submission.feature', {
      targetType: 'student_history_record', targetId: recordId,
      metadata: { category, tier: tier || null },
    });
  }

  return NextResponse.json({ ok: true, recordId: data.external_id, translated: Boolean(translation) });
}

type UnfeaturePayload = {
  token?: string;
  recordId?: string;
  credential?: string;   // student self-unfeature path
  studentId?: string;
  accessCode?: string;
};

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as UnfeaturePayload | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const recordId = cleanText(body.recordId);
  if (!recordId) {
    return NextResponse.json({ error: 'Missing recordId.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  // Path A: coach token → allowed to un-feature any record.
  const authorization = await staffAuthorization(req, body.token);
  if (authorization) {
    const { error } = await supabase
      .from('student_history_records')
      .update({ featured: false })
      .eq('external_id', recordId);

    if (error) {
      console.error('[peer-wall-unfeature-coach-error]', error);
      return NextResponse.json({ error: 'Failed to un-feature submission.' }, { status: 502 });
    }
    if (authorization.kind === 'super_admin') {
      await writeAdminAudit(authorization.userId, 'submission.unfeature', {
        targetType: 'student_history_record', targetId: recordId,
      });
    }
    return NextResponse.json({ ok: true, by: 'coach' });
  }

  // Path B: student credential → allowed only on their own record.
  // 2026-08-11 移除限流：按 IP 计数会误伤同网学员，见 forum-profile 同注。
  const { studentId } = body.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body.studentId, body.accessCode);

  if (!studentId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Verify ownership before mutating — defense in depth.
  const { data: row, error: lookupError } = await supabase
    .from('student_history_records')
    .select('external_id, student_id')
    .eq('external_id', recordId)
    .maybeSingle();

  if (lookupError) {
    console.error('[peer-wall-unfeature-lookup-error]', lookupError);
    return NextResponse.json({ error: 'Failed to verify submission.' }, { status: 502 });
  }
  if (!row || row.student_id !== studentId) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('student_history_records')
    .update({ featured: false })
    .eq('external_id', recordId);

  if (error) {
    console.error('[peer-wall-unfeature-student-error]', error);
    return NextResponse.json({ error: 'Failed to un-feature submission.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, by: 'student' });
}
