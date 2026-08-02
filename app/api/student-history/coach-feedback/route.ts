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
    coachFeedback?: string;
    coachLiked?: boolean;
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

  const { error } = await supabase
    .from('student_history_records')
    .update({
      coach_feedback: cleanText(body?.coachFeedback) || null,
      coach_liked: Boolean(body?.coachLiked),
      coach_feedback_updated_at: new Date().toISOString(),
    })
    .eq('external_id', recordId);

  if (error) {
    console.error('[student-history-coach-feedback-error]', error);
    return NextResponse.json({ error: 'Failed to update coach feedback.' }, { status: 502 });
  }

  if (authorization.kind === 'super_admin') {
    await writeAdminAudit(authorization.userId, 'student.feedback.update', {
      targetType: 'student_history_record', targetId: recordId,
      metadata: { liked: Boolean(body?.coachLiked) },
    });
  }

  return NextResponse.json({ ok: true });
}
