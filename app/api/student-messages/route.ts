// Student side of the coach ↔ student message thread (站内私信).
//
// GET-by-POST: the student credential is a secret, so it travels in the body,
// never in a query string. Same credential contract as /api/student-data.
//
// A student can only ever touch their own thread: the student_id used in every
// query is the one resolved from the credential, never one supplied by the
// caller.

import { NextResponse } from 'next/server';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
  pragma: 'no-cache',
};

const MAX_BODY_LENGTH = 2000;

type MessageRow = {
  id: string;
  direction: 'coach_to_student' | 'student_to_coach';
  body: string;
  created_at: string;
  read_at: string | null;
};

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // 42P01 = undefined_table. Lets the UI render an empty state before the
  // migration has been run, instead of surfacing a 502.
  return error.code === '42P01' || /student_messages/i.test(error.message || '');
}

async function readCredential(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { credential?: unknown; studentId?: unknown; accessCode?: unknown; body?: unknown; markRead?: unknown }
    | null;
  // Same convention as /api/student-history: a single `credential` string, or
  // the studentId + accessCode pair.
  const { studentId } = body?.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body?.studentId, body?.accessCode);
  return { studentId, payload: body };
}

// Fetch the thread. Optionally marks coach messages as read in the same call.
export async function POST(req: Request) {
  const { studentId, payload } = await readCredential(req);
  if (!studentId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ messages: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
  }

  const outgoing = typeof payload?.body === 'string' ? payload.body.trim().slice(0, MAX_BODY_LENGTH) : '';
  if (outgoing) {
    const { error: insertError } = await supabase.from('student_messages').insert({
      student_id: studentId,
      direction: 'student_to_coach',
      body: outgoing,
    });
    if (insertError) {
      if (isMissingTable(insertError)) {
        return NextResponse.json({ messages: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
      }
      console.error('[student-messages-insert-error]', insertError);
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 502, headers: NO_STORE_HEADERS });
    }
  }

  if (payload?.markRead) {
    const { error: readError } = await supabase
      .from('student_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('direction', 'coach_to_student')
      .is('read_at', null);
    if (readError && !isMissingTable(readError)) {
      // Non-fatal: the thread still renders if the read receipt fails.
      console.error('[student-messages-mark-read-error]', readError);
    }
  }

  const { data, error } = await supabase
    .from('student_messages')
    .select('id, direction, body, created_at, read_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ messages: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
    }
    console.error('[student-messages-read-error]', error);
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  const messages = ((data || []) as MessageRow[]).map((row) => ({
    id: row.id,
    from: row.direction === 'coach_to_student' ? ('coach' as const) : ('student' as const),
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));

  return NextResponse.json({ messages, schemaReady: true }, { headers: NO_STORE_HEADERS });
}
