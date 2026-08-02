// Coach moderation queue for 学员精华墙 comments.
//
// Without this route nothing could ever leave 'pending', so an approved
// comment was unreachable and the comment feature was write-only.
//
// Token-auth, same contract as the other coach routes: header
// `x-goodminton-coach-token` (or `token` in the body) must match
// GOODMINTON_COACH_ACTION_TOKEN. With that env var unset every request is
// rejected.

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { staffAuthorization, writeAdminAudit } from '@/lib/admin-auth';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

export const dynamic = 'force-dynamic';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

// The pending queue. Includes student_id so the coach knows who wrote what —
// this is the one place that mapping is exposed, and it is token-gated.
export async function GET(req: Request) {
  if (!(await staffAuthorization(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ pending: [] }, { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('forum_comments')
    .select('id, post_id, display_name, body, student_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[forum-comment-queue-error]', error);
    return NextResponse.json({ error: 'Failed to load queue.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ pending: data || [] }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    id?: string;
    action?: string;
  } | null;

  const authorization = await staffAuthorization(req, body?.token);
  if (!authorization) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const id = cleanText(body?.id);
  const action = cleanText(body?.action);

  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const { error } = await supabase
    .from('forum_comments')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      moderated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[forum-comment-moderate-error]', error);
    return NextResponse.json({ error: 'Failed to update comment.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  if (authorization.kind === 'super_admin') {
    await writeAdminAudit(authorization.userId, 'forum.comment.moderate', {
      targetType: 'forum_comment', targetId: id, metadata: { status: action },
    });
  }

  return NextResponse.json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected' }, { headers: NO_STORE_HEADERS });
}
