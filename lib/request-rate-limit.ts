import { createHash } from 'node:crypto';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, Bucket>;

declare global {
  var __goodmintonRateLimitStore: RateLimitStore | undefined;
}

const store = globalThis.__goodmintonRateLimitStore || new Map<string, Bucket>();
globalThis.__goodmintonRateLimitStore = store;

type RateLimitOptions = {
  windowMs: number;
  maxPerIp: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function clientAddress(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function consume(key: string, max: number, windowMs: number, now: number): RateLimitResult {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkRequestRateLimit(
  req: Request,
  scope: string,
  _subject: unknown,
  options: RateLimitOptions,
): RateLimitResult {
  // 只按 IP 限流。
  //
  // 这里曾经还有一个按 subject（凭据字符串）的全局桶，2026-08-02 移除，因为
  // 它做不到想做的事，却做成了想避免的事：
  //   猜错的人每次输的是不同字符串，各自落进各自的桶，永远不会触顶；
  //   真正被计数打满的只有输对码的那个人——也就是学员本人。
  // 实际后果是一名学员被挡在门外，而任何知道某人登录码的人发满 12 次就能
  // 复现这个效果。按 IP 限流才是防扫号的那一层。
  return consume(
    `${scope}:ip:${fingerprint(clientAddress(req))}`,
    options.maxPerIp,
    options.windowMs,
    Date.now(),
  );
}

export function clearRequestRateLimitsForTests() {
  store.clear();
}
