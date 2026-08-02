import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const ADMIN_ACCESS_COOKIE = 'gm_admin_access';
export const ADMIN_REFRESH_COOKIE = 'gm_admin_refresh';

const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 14;

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function createSupabaseSessionClient(accessToken?: string) {
  const current = config();
  if (!current) return null;
  return createClient(current.url, current.key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
}

export function readCookie(req: Request, name: string) {
  const value = req.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : '';
}

type CookieResponse = {
  cookies: {
    set(name: string, value: string, options: Record<string, unknown>): void;
  };
};

export function setAdminSessionCookies(
  response: CookieResponse,
  session: { access_token: string; refresh_token: string; expires_in?: number },
) {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  };
  response.cookies.set(ADMIN_ACCESS_COOKIE, session.access_token, {
    ...common,
    path: '/',
    maxAge: Math.max(60, session.expires_in || ACCESS_MAX_AGE),
  });
  response.cookies.set(ADMIN_REFRESH_COOKIE, session.refresh_token, {
    ...common,
    path: '/api/admin/session',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearAdminSessionCookies(response: CookieResponse) {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 0,
  };
  response.cookies.set(ADMIN_ACCESS_COOKIE, '', { ...common, path: '/' });
  response.cookies.set(ADMIN_REFRESH_COOKIE, '', { ...common, path: '/api/admin/session' });
}

export async function verifySingleAdmin(accessToken: string, requireAal2 = false) {
  if (!accessToken) return null;
  const sessionClient = createSupabaseSessionClient(accessToken);
  const adminClient = createSupabaseAdminClient();
  if (!sessionClient || !adminClient) return null;

  const [{ data: userData, error: userError }, { data: aalData, error: aalError }] = await Promise.all([
    sessionClient.auth.getUser(accessToken),
    sessionClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken),
  ]);
  const user = userData.user;
  if (userError || aalError || !user || user.app_metadata?.role !== 'super_admin') return null;

  const { data: binding, error: bindingError } = await adminClient
    .from('system_admins')
    .select('user_id')
    .eq('singleton', true)
    .maybeSingle();
  if (bindingError || binding?.user_id !== user.id) return null;
  if (requireAal2 && aalData.currentLevel !== 'aal2') return null;

  return { user, aal: aalData.currentLevel, nextAal: aalData.nextLevel };
}

export async function staffAuthorization(req: Request, bodyToken?: unknown) {
  const expected = process.env.GOODMINTON_COACH_ACTION_TOKEN?.trim();
  const headerToken = req.headers.get('x-goodminton-coach-token')?.trim();
  const supplied = headerToken || (typeof bodyToken === 'string' ? bodyToken.trim() : '');
  if (expected && supplied === expected) return { kind: 'coach_token' as const, userId: null };

  const admin = await verifySingleAdmin(readCookie(req, ADMIN_ACCESS_COOKIE), false);
  return admin ? { kind: 'super_admin' as const, userId: admin.user.id } : null;
}

export async function writeAdminAudit(
  actorUserId: string,
  action: string,
  details?: { targetType?: string; targetId?: string; metadata?: Record<string, unknown> },
) {
  const client = createSupabaseAdminClient();
  if (!client) return;
  const { error } = await client.from('admin_audit_log').insert({
    actor_user_id: actorUserId,
    action,
    target_type: details?.targetType || null,
    target_id: details?.targetId || null,
    metadata: details?.metadata || {},
  });
  if (error) console.error('[admin-audit-write-error]', error);
}
