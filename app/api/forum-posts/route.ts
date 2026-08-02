// 交流 + 约球：学员自发帖。
//
// 读取公开（/forum 本身是公开页），发帖需要登录凭据——服务端解析出
// student_id，不接受客户端传入，所以没人能冒名发帖。
//
// 事后审核：发出即可见，教练可隐藏（DELETE 带 token），作者可删自己的
// （DELETE 带凭据）。理由见 migration 注释：约球有时效，等审核等于废帖。

import { NextResponse } from 'next/server';
import { getStudentEntry } from '@/lib/student-directory';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const NO_STORE_HEADERS = { 'cache-control': 'no-store, max-age=0' };

export const dynamic = 'force-dynamic';

type PostKind = 'discussion' | 'meetup';

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isKind(value: unknown): value is PostKind {
  return value === 'discussion' || value === 'meetup';
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01' || /forum_posts/i.test(error.message || '');
}

function coachTokenOk(req: Request, bodyToken: unknown) {
  const expected = process.env.GOODMINTON_COACH_ACTION_TOKEN;
  const provided = cleanText(req.headers.get('x-goodminton-coach-token'), 200) || cleanText(bodyToken, 200);
  return Boolean(expected) && provided === expected;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ posts: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
  }

  let query = supabase
    .from('forum_posts')
    .select('id, kind, student_id, display_name, title, body, play_at, location, players_needed, created_at')
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (isKind(kind)) query = query.eq('kind', kind);

  const { data, error } = await query;

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ posts: [], schemaReady: false }, { headers: NO_STORE_HEADERS });
    }
    console.error('[forum-posts-read-error]', error);
    return NextResponse.json({ error: 'Failed to load posts.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  // 过期约球不再展示。上周六的"三缺一"挂在页面上只会让论坛显得没人管。
  // 宽限 3 小时，让当天正在进行的局还留着。
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  const posts = (data || []).filter((post) => {
    if (post.kind !== 'meetup' || !post.play_at) return true;
    return new Date(post.play_at).getTime() >= cutoff;
  });

  return NextResponse.json({ posts, schemaReady: true }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // 身份只从凭据来，不看客户端传的 studentId / 名字。
  const { studentId } = body?.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body?.studentId, body?.accessCode);

  if (!studentId) {
    return NextResponse.json({ error: '请先在学员页登录后再发帖。' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const kind = body?.kind;
  if (!isKind(kind)) {
    return NextResponse.json({ error: "kind must be 'discussion' or 'meetup'." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const text = cleanText(body?.body, 2000);
  if (!text) {
    return NextResponse.json({ error: '内容不能为空。' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const entry = getStudentEntry(studentId);
  // 家长持有的账号发帖时署家长身份，避免让一个 8 岁孩子的名字出现在
  // 一个公开的约球贴上。
  const fallbackName =
    entry?.accountHolder === 'parent' ? `${entry.name} 的家长` : entry?.name || studentId;
  const displayName = cleanText(body?.displayName, 30) || fallbackName;

  const playAtRaw = cleanText(body?.playAt, 40);
  const playAt = playAtRaw ? new Date(playAtRaw) : null;
  if (kind === 'meetup' && (!playAt || Number.isNaN(playAt.getTime()))) {
    return NextResponse.json({ error: '约球需要填开打时间。' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const playersNeeded = Number(body?.playersNeeded);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const { error } = await supabase.from('forum_posts').insert({
    kind,
    student_id: studentId,
    display_name: displayName,
    title: cleanText(body?.title, 80) || null,
    body: text,
    play_at: kind === 'meetup' && playAt ? playAt.toISOString() : null,
    location: kind === 'meetup' ? cleanText(body?.location, 80) || null : null,
    players_needed:
      kind === 'meetup' && Number.isFinite(playersNeeded) && playersNeeded >= 1 && playersNeeded <= 20
        ? Math.floor(playersNeeded)
        : null,
  });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: '论坛发帖还没开放。' }, { status: 503, headers: NO_STORE_HEADERS });
    }
    console.error('[forum-posts-write-error]', error);
    return NextResponse.json({ error: '发布失败。' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

// 教练隐藏任意帖（token），或作者删自己的（凭据）。
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = cleanText(body?.id, 64);
  if (!id) {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  if (coachTokenOk(req, body?.token)) {
    const { error } = await supabase.from('forum_posts').update({ hidden: true }).eq('id', id);
    if (error) {
      console.error('[forum-posts-hide-error]', error);
      return NextResponse.json({ error: 'Failed to hide post.' }, { status: 502, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ ok: true, by: 'coach' }, { headers: NO_STORE_HEADERS });
  }

  const { studentId } = body?.credential
    ? resolveStudentLogin(body.credential)
    : { studentId: '' };

  if (!studentId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  // 作者只能删自己的：student_id 取自凭据，不是传进来的。
  const { error } = await supabase
    .from('forum_posts')
    .update({ hidden: true })
    .eq('id', id)
    .eq('student_id', studentId);

  if (error) {
    console.error('[forum-posts-delete-error]', error);
    return NextResponse.json({ error: 'Failed to delete post.' }, { status: 502, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true, by: 'student' }, { headers: NO_STORE_HEADERS });
}
