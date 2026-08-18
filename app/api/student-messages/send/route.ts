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
import { staffAuthorization, writeAdminAudit } from '@/lib/admin-auth';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

const MAX_BODY_LENGTH = 4000;

// 每个会话回给教练台的消息条数上限。够看清来龙去脉，又不会让某一个长会话
// 把整个收件箱的响应撑大。
const MAX_THREAD_MESSAGES = 30;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    studentId?: string;
    body?: string;
    sourceExternalId?: string;
  } | null;

  const authorization = await staffAuthorization(req, body?.token);
  if (!authorization) {
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

  if (authorization.kind === 'super_admin') {
    await writeAdminAudit(authorization.userId, 'student.message.send', {
      targetType: 'student', targetId: studentId,
    });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

// Coach inbox: most recent message per student, newest thread first.
export async function GET(req: Request) {
  if (!(await staffAuthorization(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ threads: [] }, { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('student_messages')
    .select('id, student_id, direction, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[student-messages-inbox-error]', error);
    return NextResponse.json({ error: 'Failed to load threads.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  type Row = {
    id: string;
    student_id: string;
    direction: 'coach_to_student' | 'student_to_coach';
    body: string;
    created_at: string;
    read_at: string | null;
  };

  type Message = { id: string; from: 'coach' | 'student'; body: string; createdAt: string };

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
      messages: Message[];
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
        messages: [],
      });
    }

    // 整段对话跟着列表一起回去。这 500 行本来就已经取出来了，之前只留每人
    // 最新一条就全扔了——教练回信时因此只能看见一句截断的预览。带上它们不多
    // 一次查询、不用把 studentId 塞进 URL、点开会话也不用再等一个请求。
    // 每个会话封顶 MAX_THREAD_MESSAGES 条，免得一个话痨把响应撑爆。
    const thread = threads.get(row.student_id);
    if (thread && thread.messages.length < MAX_THREAD_MESSAGES) {
      thread.messages.push({
        id: row.id,
        from: row.direction === 'coach_to_student' ? 'coach' : 'student',
        body: row.body,
        createdAt: row.created_at,
      });
    }
  }

  // 上面是按新→旧堆进去的，翻过来给前端，按时间正序读。
  for (const thread of threads.values()) thread.messages.reverse();

  return NextResponse.json({ threads: [...threads.values()] }, { headers: NO_STORE_HEADERS });
}
