import { NextResponse } from 'next/server';
import { validateForumNickname } from '@/lib/forum-nickname';
import { checkRequestRateLimit } from '@/lib/request-rate-limit';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = { 'cache-control': 'no-store, max-age=0' };

function isMissingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /forum_profiles/i.test(error.message || '')));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    credential?: unknown;
    nickname?: unknown;
  } | null;

  const rateLimit = checkRequestRateLimit(req, 'student-credential', body?.credential, {
    windowMs: 10 * 60 * 1000,
    maxPerIp: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '尝试次数过多，请稍后再试。' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'retry-after': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { studentId } = resolveStudentLogin(body?.credential);
  if (!studentId) {
    return NextResponse.json({ error: '请先在学员页登录。' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ nickname: '', schemaReady: false }, { headers: NO_STORE_HEADERS });
  }

  if (body && Object.hasOwn(body, 'nickname')) {
    const { nickname, error: validationError } = validateForumNickname(body.nickname);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const { error } = await supabase.from('forum_profiles').upsert(
      { student_id: studentId, nickname, updated_at: new Date().toISOString() },
      { onConflict: 'student_id' },
    );
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ nickname: '', schemaReady: false }, { headers: NO_STORE_HEADERS });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: '这个昵称已经有人用了。' }, { status: 409, headers: NO_STORE_HEADERS });
      }
      console.error('[forum-profile-write-error]', error);
      return NextResponse.json({ error: '昵称保存失败。' }, { status: 502, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json({ nickname, schemaReady: true }, { headers: NO_STORE_HEADERS });
  }

  const { data, error } = await supabase
    .from('forum_profiles')
    .select('nickname')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ nickname: '', schemaReady: false }, { headers: NO_STORE_HEADERS });
    }
    console.error('[forum-profile-read-error]', error);
    return NextResponse.json({ error: '昵称读取失败。' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ nickname: data?.nickname || '', schemaReady: true }, { headers: NO_STORE_HEADERS });
}
