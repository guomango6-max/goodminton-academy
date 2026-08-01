// Comments on the 学员精华 wall.
//
// Moderation contract: a comment is stored as `pending` and only `approved`
// ones are ever returned. Nothing a student types reaches another student's
// screen unreviewed. Approval happens in /api/forum-comment/moderate.
//
// Storage is Supabase `forum_comments` (migration 2026-08-01_forum_comments).
// Before that migration is applied both handlers degrade quietly rather than
// erroring, so the wall still renders.

import { NextResponse } from 'next/server';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

export const dynamic = 'force-dynamic';

type CommentRow = {
  id: string;
  post_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // 42P01 = undefined_table.
  return error.code === '42P01' || /forum_comments/i.test(error.message || '');
}

// Public read: approved comments only, grouped by post.
export async function GET() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ comments: {} }, { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('forum_comments')
    .select('id, post_id, display_name, body, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ comments: {}, schemaReady: false }, { headers: NO_STORE_HEADERS });
    }
    console.error('[forum-comment-read-error]', error);
    return NextResponse.json({ error: 'Failed to load comments.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  // Shape matches what the previous in-memory store returned, including the
  // redundant postId on each item, so /forum needs no change.
  const grouped: Record<string, { id: string; postId: string; name: string; body: string; createdAt: string }[]> = {};
  for (const row of (data || []) as CommentRow[]) {
    (grouped[row.post_id] ||= []).push({
      id: row.id,
      postId: row.post_id,
      name: row.display_name,
      body: row.body,
      createdAt: row.created_at,
    });
  }

  return NextResponse.json({ comments: grouped, schemaReady: true }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { postId, name, body, website, credential } = (payload || {}) as Record<string, unknown>;

  // Honeypot filled → almost certainly a bot. Pretend success, store nothing.
  if (typeof website === 'string' && website.trim()) {
    return NextResponse.json({ ok: true, status: 'pending' }, { headers: NO_STORE_HEADERS });
  }

  const trimmedPostId = typeof postId === 'string' ? postId.trim() : '';
  const trimmedName = typeof name === 'string' ? name.trim().slice(0, 30) : '';
  const trimmedBody = typeof body === 'string' ? body.trim().slice(0, 500) : '';

  if (!trimmedPostId || !trimmedName || !trimmedBody) {
    return NextResponse.json(
      { error: 'postId, name, and body are required.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  // Optional: when the comment comes from a logged-in student page session we
  // record who wrote it, so the coach moderating the queue is not guessing.
  // Readers never see this — only display_name is returned by GET.
  const { studentId } = credential ? resolveStudentLogin(credential) : { studentId: '' };

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const { error } = await supabase.from('forum_comments').insert({
    post_id: trimmedPostId,
    display_name: trimmedName,
    body: trimmedBody,
    student_id: studentId || null,
  });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'Comments are not available yet.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    console.error('[forum-comment-write-error]', error);
    return NextResponse.json({ error: 'Failed to save comment.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true, status: 'pending' }, { headers: NO_STORE_HEADERS });
}
