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
  maxPerSubject?: number;
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
  subject: unknown,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const ipResult = consume(
    `${scope}:ip:${fingerprint(clientAddress(req))}`,
    options.maxPerIp,
    options.windowMs,
    now,
  );
  if (!ipResult.allowed) return ipResult;

  const normalizedSubject = typeof subject === 'string' ? subject.trim().toLowerCase() : '';
  if (!normalizedSubject || !options.maxPerSubject) return ipResult;

  return consume(
    `${scope}:subject:${fingerprint(normalizedSubject)}`,
    options.maxPerSubject,
    options.windowMs,
    now,
  );
}

export function clearRequestRateLimitsForTests() {
  store.clear();
}
