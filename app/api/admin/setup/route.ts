import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkRequestRateLimit } from '@/lib/request-rate-limit';
import { writeAdminAudit } from '@/lib/admin-auth';

const HEADERS = { 'cache-control': 'no-store, max-age=0' };

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function setupAvailable() {
  const client = createSupabaseAdminClient();
  if (!client) return { available: false, error: '认证服务未配置。' };
  const { data, error } = await client
    .from('system_admins')
    .select('user_id')
    .eq('singleton', true)
    .maybeSingle();
  if (error) return { available: false, error: '管理员数据尚未就绪。' };
  return { available: !data, error: '' };
}

export async function GET() {
  const state = await setupAvailable();
  return NextResponse.json(
    { setupAvailable: state.available, ...(state.error ? { error: state.error } : {}) },
    { status: state.error ? 503 : 200, headers: HEADERS },
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    setupToken?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const password = body?.password || '';
  const setupToken = body?.setupToken?.trim() || '';

  const rateLimit = checkRequestRateLimit(req, 'admin-bootstrap', email || 'unknown', {
    windowMs: 15 * 60 * 1000,
    maxPerIp: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '尝试次数过多，请稍后再试。' },
      { status: 429, headers: { ...HEADERS, 'retry-after': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const state = await setupAvailable();
  if (state.error) return NextResponse.json({ error: state.error }, { status: 503, headers: HEADERS });
  if (!state.available) {
    return NextResponse.json({ error: '管理员已经创建，首次设置入口已关闭。' }, { status: 409, headers: HEADERS });
  }

  const expectedToken = process.env.GOODMINTON_COACH_ACTION_TOKEN?.trim() || '';
  if (!expectedToken || !setupToken || !sameSecret(expectedToken, setupToken)) {
    return NextResponse.json({ error: '一次性验证令牌不正确。' }, { status: 401, headers: HEADERS });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: '请输入有效邮箱。' }, { status: 400, headers: HEADERS });
  }
  if (password.length < 14) {
    return NextResponse.json({ error: '密码至少需要 14 个字符。' }, { status: 400, headers: HEADERS });
  }

  const client = createSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: '认证服务未配置。' }, { status: 503, headers: HEADERS });

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'super_admin' },
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message?.toLowerCase().includes('registered') ? '这个邮箱已经注册。' : '管理员账号创建失败。' },
      { status: 409, headers: HEADERS },
    );
  }

  const { error: bindingError } = await client.from('system_admins').insert({
    singleton: true,
    user_id: created.user.id,
  });
  if (bindingError) {
    await client.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    return NextResponse.json({ error: '管理员绑定失败，未保留账号。' }, { status: 409, headers: HEADERS });
  }

  await writeAdminAudit(created.user.id, 'admin.setup.complete');
  return NextResponse.json({ ok: true, email }, { headers: HEADERS });
}
