import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE,
  createSupabaseSessionClient,
  readCookie,
  setAdminSessionCookies,
  verifySingleAdmin,
  writeAdminAudit,
} from '@/lib/admin-auth';

const HEADERS = { 'cache-control': 'no-store, max-age=0' };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { factorId?: string; code?: string } | null;
  const factorId = body?.factorId?.trim();
  const code = body?.code?.replace(/\s/g, '');
  if (!factorId || !/^\d{6}$/.test(code || '')) {
    return NextResponse.json({ error: '请输入 6 位验证码。' }, { status: 400, headers: HEADERS });
  }

  const accessToken = readCookie(req, ADMIN_ACCESS_COOKIE);
  const admin = await verifySingleAdmin(accessToken, false);
  if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: HEADERS });
  const client = createSupabaseSessionClient(accessToken);
  if (!client) return NextResponse.json({ error: '认证服务未配置。' }, { status: 503, headers: HEADERS });

  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code! });
  if (error) return NextResponse.json({ error: '验证码不正确或已过期。' }, { status: 401, headers: HEADERS });
  const elevated = await verifySingleAdmin(data.access_token, true);
  if (!elevated) return NextResponse.json({ error: '二次验证未生效。' }, { status: 403, headers: HEADERS });

  const response = NextResponse.json({ authenticated: true, role: 'super_admin' }, { headers: HEADERS });
  setAdminSessionCookies(response, data);
  await writeAdminAudit(admin.user.id, 'admin.login.mfa');
  return response;
}
