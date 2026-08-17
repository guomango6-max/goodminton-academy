import assert from 'node:assert/strict';
import test from 'node:test';

import { getPublishedArticles, isPublishable } from '../lib/articles.ts';

const targetSlugs = [
  'doubles-first-three-shots',
  'ai-feedback-badminton',
  'summer-training-plan-2026',
];

test('publication requires an explicit published status', () => {
  assert.equal(isPublishable({ isAuto: false, status: undefined }), false);
  assert.equal(isPublishable({ isAuto: false, status: 'draft' }), false);
  assert.equal(isPublishable({ isAuto: true, status: 'published' }), false);
  assert.equal(isPublishable({ isAuto: false, status: 'published' }), true);
});

test('replaced placeholder articles contain complete sourced bilingual copy', async () => {
  const published = await getPublishedArticles();

  for (const slug of targetSlugs) {
    const article = published.find((item) => item.slug === slug);
    assert.ok(article, `${slug} should be published`);
    assert.ok(article.zhBody.length >= 1200, `${slug} needs a complete Chinese body`);
    assert.ok(article.enBody.length >= 1200, `${slug} needs a complete English body`);
    assert.match(article.zhBody, /https:\/\//, `${slug} needs source links`);
    assert.doesNotMatch(article.zhBody, /写作方向|Writing direction/);
    assert.match(article.sourceType, /^(external\+original|original)$/);
  }
});
