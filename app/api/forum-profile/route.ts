import { NextResponse } from 'next/server';
import { validateForumNickname } from '@/lib/forum-nickname';
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

  // 2026-08-11 移除限流：按 IP 计数会把同一场馆 WiFi / 运营商 CGNAT 后面的
  // 学员算成同一个人，正常使用就被挡在门外。防扫号另行处理。
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
