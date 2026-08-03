import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkRequestRateLimit,
  clearRequestRateLimitsForTests,
} from '../lib/request-rate-limit.ts';
import { normalizeForumNickname, validateForumNickname } from '../lib/forum-nickname.ts';
import { forumArchivePrivacyFlags, prepareForumArchiveCandidate, redactForumArchiveNames, sanitizeForumArchiveFeedback } from '../lib/forum-archive.ts';

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

// 这条断言原本是反过来的：同一凭据跨 IP 也要被拦。那个行为在
// 「移除按凭据的全局限流」里删掉了，理由见 lib/request-rate-limit.ts 的注释——
// 按凭据计数拦不住猜码的人（每次输的字符串都不同），只拦得住输对码的本人。
// 测试当时漏改，于是它一直在断言一个已经被判定为 bug 的行为。
test('does not lock one credential out across different IP addresses', () => {
  const options = { windowMs: 60_000, maxPerIp: 10 };

  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.1'), 'login', 'xmj44', options).allowed, true);
  assert.equal(checkRequestRateLimit(requestFrom('203.0.113.2'), 'login', 'xmj44', options).allowed, true);
});

test('keeps scopes independent', () => {
  const options = { windowMs: 60_000, maxPerIp: 1, maxPerSubject: 1 };
  const request = requestFrom('203.0.113.1');

  assert.equal(checkRequestRateLimit(request, 'student-login', 'same', options).allowed, true);
  assert.equal(checkRequestRateLimit(request, 'forum-write', 'same', options).allowed, true);
});

test('normalizes nickname spacing and rejects reserved identities', () => {
  assert.equal(normalizeForumNickname('  羽球   小白  '), '羽球 小白');
  assert.equal(validateForumNickname('Mango Coach').error.length > 0, true);
  assert.equal(validateForumNickname('Badminton小白').error, '');
  assert.equal(validateForumNickname('北场小白').error, '');
});

test('forum archive redacts names and blocks identifying private details', () => {
  assert.equal(redactForumArchiveNames('杨静南和 Eric 一起练球', ['杨静南', 'Eric']), '某位学员和 某位学员 一起练球');
  assert.equal(redactForumArchiveNames('C1 成人女双能力初评', []), '双打能力初评');
  assert.equal(redactForumArchiveNames('女双 A 组比赛复盘', []), '双打 分组比赛复盘');
  assert.deepEqual(forumArchivePrivacyFlags('学员肘部仍有痛感'), ['伤病健康']);

  const result = prepareForumArchiveCandidate({
    external_id: 'one',
    created_at: '2026-08-01T00:00:00.000Z',
    happened_at: '2026-07-01',
    student_id: 'student-one',
    record_type: 'lesson_summary',
    title: '网前练习',
    payload: { lessonSummary: { title: '网前练习', studentReflection: '杨静南今天肘部有痛感。' } },
    coach_feedback: '',
  }, ['杨静南']);
  assert.match(result.skip, /伤病健康/);

  const feedback = sanitizeForumArchiveFeedback('第一段是技术点评。\n\n肘——有任何不舒服要说。', []);
  assert.equal(feedback.feedback, '第一段是技术点评。');
  assert.equal(feedback.omittedParagraphs, 1);
});
