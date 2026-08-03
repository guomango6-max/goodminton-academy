import assert from 'node:assert/strict';
import test from 'node:test';

import { hasCjk } from '../lib/translate.ts';
import { buildFeaturedTranslation, parseFeaturedTranslation } from '../lib/featured-translation.ts';
import { resolveExcerpt } from '../lib/peer-feed-excerpt.ts';

// 这些是纯函数，不打网络。真正调 DeepSeek 的那一段（translateBatch）需要
// DEEPSEEK_API_KEY，只在 Vercel 上有，本地测不了。

test('hasCjk 只对需要翻译的串返回 true', () => {
  assert.equal(hasCjk('放网之后，我忘了退'), true);
  assert.equal(hasCjk('C1 Student'), false);
  assert.equal(hasCjk('21-18 / 17-21'), false);
  assert.equal(hasCjk('2026-05-07'), false);
  // 中文标点单独出现也要认出来——顿号跑进英文串里正是修过的一个 bug。
  assert.equal(hasCjk('Badminton Insight、BadmintonSkills'), true);
  assert.equal(hasCjk(''), false);
});

test('没有中文字段时不发起翻译，返回 null', async () => {
  const result = await buildFeaturedTranslation({
    title: 'Clear and drop',
    angle: '',
    coachFeedback: '',
    excerpt: { score: '21-18', match: 'Sunday doubles' },
  });
  assert.equal(result, null);
});

test('parseFeaturedTranslation 收紧库里读出来的任意值', () => {
  assert.equal(parseFeaturedTranslation(null), null);
  assert.equal(parseFeaturedTranslation('not an object'), null);
  assert.equal(parseFeaturedTranslation({}), null);
  assert.equal(parseFeaturedTranslation({ title: '   ' }), null);

  assert.deepEqual(
    parseFeaturedTranslation({ title: ' Net shot ', angle: 'Good catch', bogus: 1, excerpt: { reflection: 'x', bad: 2 } }),
    { title: 'Net shot', angle: 'Good catch', excerpt: { reflection: 'x' } },
  );
});

test('resolveExcerpt 按 record_type 取对字段，featured_excerpt 优先', () => {
  const lessonPayload = {
    lessonSummary: { title: '后场发力', studentReflection: '手臂不发力', question: '怎么练' },
  };
  assert.deepEqual(resolveExcerpt('lesson_summary', null, lessonPayload), {
    title: '后场发力',
    reflection: '手臂不发力',
    question: '怎么练',
  });

  const matchPayload = { matchReview: { match: '双打练习赛', score: '21-18', whatWorked: '拉吊不错' } };
  const match = resolveExcerpt('match_review', null, matchPayload);
  assert.equal(match.match, '双打练习赛');
  assert.equal(match.score, '21-18');

  // 教练存过 featured_excerpt 就以它为准，不再从 payload 里挖。
  assert.deepEqual(resolveExcerpt('lesson_summary', { title: '教练改过的标题' }, lessonPayload), {
    title: '教练改过的标题',
  });
});
