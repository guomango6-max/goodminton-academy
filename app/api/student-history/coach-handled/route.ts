// 标记已处理 / 撤回。
//
//   handled=true   → coach_handled_at = now()，离开待处理队列
//   handled=false  → coach_handled_at = null，回到待处理队列
//
// coach_feedback 一个字都不动：撤回处理状态不等于撤回给学生的回复。学员那边
// 看到的点评在撤回后仍然在，要改点评走 /api/student-history/coach-feedback。

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { staffAuthorization, writeAdminAudit } from '@/lib/admin-auth';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    recordId?: string;
    handled?: boolean;
  } | null;

  const authorization = await staffAuthorization(req, body?.token);
  if (!authorization) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const recordId = cleanText(body?.recordId);
  if (!recordId) {
    return NextResponse.json({ error: 'Missing recordId.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  // 只有显式 false 才是撤回，其余一律当标记已处理。
  const handled = body?.handled !== false;

  const { error } = await supabase
    .from('student_history_records')
    .update({ coach_handled_at: handled ? new Date().toISOString() : null })
    .eq('external_id', recordId);

  if (error) {
    // 迁移还没跑时说清楚是哪一步没做，别丢一个看不懂的 502 给教练台。
    if (/coach_handled_at/i.test(error.message || '')) {
      return NextResponse.json(
        { error: '库里还没有 coach_handled_at 列，先跑 supabase/migrations/20260813120000_coach_handled.sql。' },
        { status: 503 },
      );
    }
    console.error('[student-history-coach-handled-error]', error);
    return NextResponse.json({ error: 'Failed to update handled state.' }, { status: 502 });
  }

  if (authorization.kind === 'super_admin') {
    await writeAdminAudit(authorization.userId, 'student.handled.update', {
      targetType: 'student_history_record',
      targetId: recordId,
      metadata: { handled },
    });
  }

  return NextResponse.json({ ok: true, handled });
}
