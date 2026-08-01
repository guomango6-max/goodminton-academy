// Coach side of the coach ↔ student message thread (站内私信).
//
// Token-auth, same contract as /api/student-history/coach-feedback:
// header `x-goodminton-coach-token` (or `token` in the body) must match
// GOODMINTON_COACH_ACTION_TOKEN. Without that env var set, every request is
// rejected — there is no unauthenticated write path.
//
// GET (also token-gated) lists recent threads so the coach can see who has
// unanswered messages.

import { NextResponse } from 'next/server';
import { getStudentEntry } from '@/lib/student-directory';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

const MAX_BODY_LENGTH = 4000;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAuthorized(req: Request, bodyToken: unknown) {
  const expectedToken = process.env.GOODMINTON_COACH_ACTION_TOKEN;
  const providedToken = cleanText(req.headers.get('x-goodminton-coach-token')) || cleanText(bodyToken);
  return Boolean(expectedToken) && providedToken === expectedToken;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    studentId?: string;
    body?: string;
    sourceExternalId?: string;
  } | null;

  if (!isAuthorized(req, body?.token)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const studentId = cleanText(body?.studentId);
  const message = cleanText(body?.body).slice(0, MAX_BODY_LENGTH);

  if (!studentId) {
    return NextResponse.json({ error: 'Missing studentId.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!message) {
    return NextResponse.json({ error: 'Missing body.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const { error } = await supabase.from('student_messages').insert({
    student_id: studentId,
    direction: 'coach_to_student',
    body: message,
    source_external_id: cleanText(body?.sourceExternalId) || null,
  });

  if (error) {
    console.error('[student-messages-send-error]', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

// Coach inbox: most recent message per student, newest thread first.
export async function GET(req: Request) {
  if (!isAuthorized(req, null)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ threads: [] }, { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('student_messages')
    .select('student_id, direction, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[student-messages-inbox-error]', error);
    return NextResponse.json({ error: 'Failed to load threads.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  type Row = {
    student_id: string;
    direction: 'coach_to_student' | 'student_to_coach';
    body: string;
    created_at: string;
    read_at: string | null;
  };

  const threads = new Map<
    string,
    {
      studentId: string;
      name: string;
      // 'parent' means the person reading this thread is the guardian and the
      // student is the subject — write accordingly.
      accountHolder: 'parent' | 'student';
      lastMessage: string;
      lastFrom: 'coach' | 'student';
      lastAt: string;
      awaitingCoachReply: boolean;
    }
  >();

  for (const row of (data || []) as Row[]) {
    if (!threads.has(row.student_id)) {
      const entry = getStudentEntry(row.student_id);
      threads.set(row.student_id, {
        studentId: row.student_id,
        name: entry?.name || row.student_id,
        accountHolder: entry?.accountHolder || 'student',
        lastMessage: row.body,
        lastFrom: row.direction === 'coach_to_student' ? 'coach' : 'student',
        lastAt: row.created_at,
        // Rows are newest-first, so the first row per student is the latest one.
        awaitingCoachReply: row.direction === 'student_to_coach',
      });
    }
  }

  return NextResponse.json({ threads: [...threads.values()] }, { headers: NO_STORE_HEADERS });
}
