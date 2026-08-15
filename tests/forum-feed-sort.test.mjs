import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getForumPublishedDateLabel,
  sortForumFeedEntries,
} from '../lib/forum-feed-sort.mjs';

test('sorts the combined forum feed by the date shown on each card, newest first', () => {
  const entries = [
    { id: 'curated-old', sortAt: '2026-05-07', pinned: true },
    { id: 'post-new', sortAt: '2026-08-12T10:00:00Z', pinned: false },
    { id: 'curated-middle', sortAt: '2026-08-04', pinned: false },
  ];

  const sorted = sortForumFeedEntries(entries);

  assert.deepEqual(sorted.map((entry) => entry.id), [
    'post-new',
    'curated-middle',
    'curated-old',
  ]);
  assert.deepEqual(entries.map((entry) => entry.id), [
    'curated-old',
    'post-new',
    'curated-middle',
  ]);
});

test('shows the curated publication date rather than the lesson date', () => {
  assert.equal(
    getForumPublishedDateLabel({
      featuredAt: '2026-08-07T14:40:07.568962+00:00',
      happenedAt: '2026-05-07',
    }),
    '2026-08-07',
  );
});
