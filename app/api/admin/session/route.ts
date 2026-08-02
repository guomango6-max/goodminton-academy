import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminSessionCookies,
  createSupabaseSessionClient,
  readCookie,
  setAdminSessionCookies,
  verifiedTotpFactor,
  verifySingleAdmin,
  writeAdminAudit,
} from '@/lib/admin-auth';

const HEADERS = { 'cache-control': 'no-store, max-age=0' };

function state(user: NonNullable<Awaited<ReturnType<typeof verifySingleAdmin>>>['user'], aal: string | null) {
  const factor = verifiedTotpFactor(user);
  return {
    authenticated: aal === 'aal2',
    needsMfa: aal !== 'aal2',
    needsEnrollment: !factor,
    factorId: factor?.id || null,
    email: user.email || '',
    role: 'super_admin',
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim();
  const password = body?.password;
  if (!email || !password) {
    return NextResponse.json({ error: '请输入邮箱和密码。' }, { status: 400, headers: HEADERS });
  }

  const client = createSupabaseSessionClient();
  if (!client) return NextResponse.json({ error: '认证服务未配置。' }, { status: 503, headers: HEADERS });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: '邮箱或密码不正确。' }, { status: 401, headers: HEADERS });
  }

  const admin = await verifySingleAdmin(data.session.access_token, false);
  if (!admin) {
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return NextResponse.json({ error: '这个账号不是系统管理员。' }, { status: 403, headers: HEADERS });
  }

  const response = NextResponse.json(state(admin.user, admin.aal), { headers: HEADERS });
  setAdminSessionCookies(response, data.session);
  await writeAdminAudit(admin.user.id, 'admin.login.password');
  return response;
}

export async function GET(req: Request) {
  let accessToken = readCookie(req, ADMIN_ACCESS_COOKIE);
  const refreshToken = readCookie(req, ADMIN_REFRESH_COOKIE);
  let admin = await verifySingleAdmin(accessToken, false);
  let refreshedSession: { access_token: string; refresh_token: string; expires_in?: number } | null = null;

  if (!admin && refreshToken) {
    const client = createSupabaseSessionClient();
    const result = client ? await client.auth.refreshSession({ refresh_token: refreshToken }) : null;
    if (result?.data.session) {
      refreshedSession = result.data.session;
      accessToken = result.data.session.access_token;
      admin = await verifySingleAdmin(accessToken, false);
    }
  }

  if (!admin) {
    const response = NextResponse.json({ authenticated: false }, { status: 401, headers: HEADERS });
    clearAdminSessionCookies(response);
    return response;
  }

  const response = NextResponse.json(state(admin.user, admin.aal), { headers: HEADERS });
  if (refreshedSession) setAdminSessionCookies(response, refreshedSession);
  return response;
}

export async function DELETE(req: Request) {
  const accessToken = readCookie(req, ADMIN_ACCESS_COOKIE);
  const admin = await verifySingleAdmin(accessToken, false);
  const client = createSupabaseSessionClient(accessToken);
  if (client && accessToken) await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  if (admin) await writeAdminAudit(admin.user.id, 'admin.logout');
  const response = NextResponse.json({ ok: true }, { headers: HEADERS });
  clearAdminSessionCookies(response);
  return response;
}
