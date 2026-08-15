import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const articlesDir = path.join(root, 'content', 'articles');
const candidatesDir = path.join(articlesDir, '_candidates');

test('growth owns an isolated article candidate pool', async () => {
  const readme = await readFile(path.join(candidatesDir, 'README.md'), 'utf8').catch(() => '');
  const rootFiles = await readdir(articlesDir);
  const candidateFiles = await readdir(candidatesDir).catch(() => []);

  assert.match(readme, /owner:\s*Growth/i);
  assert.match(readme, /增长部/);
  assert.deepEqual(rootFiles.filter((file) => /^hot-.*\.md$/.test(file)), []);
  assert.ok(candidateFiles.filter((file) => /^hot-.*\.md$/.test(file)).length > 0);
});

test('hot-article automation writes to the candidate pool by default', async () => {
  const fetchScript = await readFile(path.join(root, 'scripts', 'fetch-hot-articles.mjs'), 'utf8');
  const installer = await readFile(path.join(root, 'scripts', 'install-hot-articles-task.ps1'), 'utf8');

  assert.match(fetchScript, /content['"],\s*['"]articles['"],\s*['"]_candidates/);
  assert.match(fetchScript, /candidateOwner:\s*Growth/);
  assert.match(installer, /content\\articles\\_candidates/);
});
