import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkRequestRateLimit,
  clearRequestRateLimitsForTests,
} from '../lib/request-rate-limit.ts';

function requestFrom(ip) {
  return new Request('https://goodminton.fi/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

test.beforeEach(() => {
  clearRequestRateLimitsForTests();
});

test('limits repeated attempts from one IP even when subjects change', () => {
  const options = { windowMs: 60_000, maxPerIp: 2, maxPerSubject: 10 };

  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.1'), 'login', 'a', options).allowed, true);
  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.1'), 'login', 'b', options).allowed, true);
  const blocked = checkRequestRateLimit(requestFrom('203.0.113.1'), 'login', 'c', options);

  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('limits one credential across different IP addresses', () => {
  const options = { windowMs: 60_000, maxPerIp: 10, maxPerSubject: 1 };

  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.1'), 'login', 'xmj44', options).allowed, true);
  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.2'), 'login', 'xmj44', options).allowed, false);
});

test('keeps scopes independent', () => {
  const options = { windowMs: 60_000, maxPerIp: 1, maxPerSubject: 1 };
  const request = requestFrom('203.0.113.1');

  assert.equal(checkRequestRateLimit(request, 'student-login', 'same', options).allowed, true);
  assert.equal(checkRequestRateLimit(request, 'forum-write', 'same', options).allowed, true);
});
