import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { publicHealthPayload } from '../lib/public-health.mjs';
import { getHomeArticleCards } from '../lib/articles.ts';

const repoFile = (relativePath) => new URL(`../${relativePath}`, import.meta.url);

test('featured home story links to its localized article page', async () => {
  const source = await readFile(repoFile('app/HomeClient.tsx'), 'utf8');

  assert.match(source, /href:\s*'\/articles\/open-learning-ai'/);
  assert.match(source, /href:\s*'\/en\/articles\/open-learning-ai'/);
  assert.match(source, /href=\{featured\.href\}/);
  assert.doesNotMatch(source, /href="#articles"/);
});

test('student portal has route-specific noindex metadata', async () => {
  const source = await readFile(repoFile('app/student/layout.tsx'), 'utf8').catch(() => '');

  assert.match(source, /title:\s*['"]学员档案/);
  assert.match(source, /canonical:\s*['"]\/student['"]/);
  assert.match(source, /index:\s*false/);
  assert.match(source, /follow:\s*false/);
});

test('public health response exposes only the overall status', () => {
  assert.deepEqual(publicHealthPayload(true), { ok: true });
  assert.deepEqual(publicHealthPayload(false), { ok: false });
  assert.equal('hasServiceRoleKey' in publicHealthPayload(true), false);
  assert.equal('tableReadable' in publicHealthPayload(true), false);
});

test('home article cards always link to publishable article pages', async () => {
  const cards = await getHomeArticleCards();

  assert.equal(cards.zh.length, 3);
  assert.equal(cards.en.length, 3);
  const zhHref = /^(\/articles\/[^/]+|https:\/\/blog\.goodminton\.fi\/blog\/[^?#]+\/?)$/;
  const enHref = /^(\/en\/articles\/[^/]+|https:\/\/blog\.goodminton\.fi\/blog\/[^?#]+\/?)$/;
  for (const card of cards.zh) assert.match(card.href || '', zhHref);
  for (const card of cards.en) assert.match(card.href || '', enHref);
});
