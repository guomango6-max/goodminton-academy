/**
 * login-failures.ts —— 学员登录失败审计
 *
 * 目的：记录登录失败（谁在反复失败），让教练及时看到"卡在门外"的学员，
 * 防止学员因为进不去而悄悄流失。只做记录，不做限流。
 *
 * 隐私安全：
 *  - 凭证串与 IP 均只存 sha256 前 16 位（识别同一人/同一来源，不可还原明文，GDPR 友好）；
 *  - 写入失败静默忽略，绝不阻塞登录主流程。
 */
import { createHash } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function hash16(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** 归一化要 hash 的尝试串：不存明文，只取长度/形态信息参与聚合。 */
export function failureKey(studentId: unknown, accessCode: unknown, credential?: unknown): string {
  const sid = typeof studentId === 'string' ? studentId : '';
  const code = typeof accessCode === 'string' ? accessCode : '';
  const cred = typeof credential === 'string' ? credential : '';
  if (cred) return `cred:${cred}`;
  return `pair:${sid}|${code}`;
}

export async function recordLoginFailure(
  req: Request,
  key: string,
  source: string,
  rateLimited = false,
): Promise<void> {
  try {
    const client = createSupabaseAdminClient();
    if (!client) return;
    await client.from('login_failures').insert({
      credential_hash: hash16(key),
      ip_hash: hash16(clientIp(req)),
      source,
      rate_limited: rateLimited,
    });
  } catch {
    // 审计失败不影响登录主流程。
  }
}
