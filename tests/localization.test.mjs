import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ENGLISH_BODY_SEPARATOR, splitLocalizedBody } from '../lib/articles.ts';

const articlesDirectory = path.join(process.cwd(), 'content', 'articles');

test('published articles include a separate English body without Chinese text', async () => {
  const files = (await readdir(articlesDirectory)).filter((file) => /^2026-.*\.md$/.test(file));
  assert.ok(files.length > 0);

  for (const file of files) {
    const source = await readFile(path.join(articlesDirectory, file), 'utf8');
    assert.ok(source.includes(ENGLISH_BODY_SEPARATOR), `${file} is missing an English body`);

    const body = source.slice(source.indexOf('\n---', 4) + 4).trim();
    const localized = splitLocalizedBody(body);
    assert.ok(localized.zh.length > 0, `${file} has an empty Chinese body`);
    assert.ok(localized.en.length > 0, `${file} has an empty English body`);
    assert.equal(/[\u3400-\u9fff]/.test(localized.en), false, `${file} English body still contains Chinese text`);
  }
});
