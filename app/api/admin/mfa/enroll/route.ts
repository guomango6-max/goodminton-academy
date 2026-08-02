import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE,
  createSupabaseSessionClient,
  readCookie,
  verifiedTotpFactor,
  verifySingleAdmin,
} from '@/lib/admin-auth';

const HEADERS = { 'cache-control': 'no-store, max-age=0' };

export async function POST(req: Request) {
  const accessToken = readCookie(req, ADMIN_ACCESS_COOKIE);
  const admin = await verifySingleAdmin(accessToken, false);
  if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: HEADERS });
  if (verifiedTotpFactor(admin.user)) {
    return NextResponse.json({ error: 'MFA 已经启用。' }, { status: 409, headers: HEADERS });
  }

  const client = createSupabaseSessionClient(accessToken);
  if (!client) return NextResponse.json({ error: '认证服务未配置。' }, { status: 503, headers: HEADERS });
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Goodminton 管理员',
    issuer: 'Goodminton',
  });
  if (error) return NextResponse.json({ error: '无法创建验证器，请稍后重试。' }, { status: 502, headers: HEADERS });
  return NextResponse.json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }, { headers: HEADERS });
}
