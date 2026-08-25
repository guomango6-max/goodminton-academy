import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBadmintonBlogFeed } from '../lib/badminton-blog.ts';

test('homepage blog feed accepts only published tagged Goodminton blog posts', () => {
  const valid = {
    title: '打羽毛球总慢半拍，真的是反应慢吗？',
    description: '判断训练与注意力。',
    pubDate: '2026-08-24T00:00:00.000Z',
    published: true,
    tags: ['羽毛球', '判断训练'],
    lang: 'zh',
    href: 'https://blog.goodminton.fi/blog/reaction-reading/',
  };
  const articles = parseBadmintonBlogFeed({
    articles: [
      valid,
      { ...valid, title: '未发布', published: false },
      { ...valid, title: '非羽毛球', tags: ['随笔'] },
      { ...valid, title: '外部链接', href: 'https://example.com/post' },
    ],
  });

  assert.deepEqual(articles, [valid]);
});

test('homepage blog feed sorts newest posts first', () => {
  const base = {
    description: '羽毛球训练文章。',
    published: true,
    tags: ['badminton'],
    lang: 'zh',
  };
  const articles = parseBadmintonBlogFeed({
    articles: [
      { ...base, title: '旧', pubDate: '2026-08-20', href: 'https://blog.goodminton.fi/blog/old/' },
      { ...base, title: '新', pubDate: '2026-08-25', href: 'https://blog.goodminton.fi/blog/new/' },
    ],
  });

  assert.deepEqual(articles.map((article) => article.title), ['新', '旧']);
});
