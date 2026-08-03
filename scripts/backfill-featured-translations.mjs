// 给已经上墙的精选内容补英文版。
//
// 翻译是在「加精」那一刻做的，所以这次改动之前上墙的记录都没有 featured_en。
// 这个脚本把它们补齐一次；之后新加精的记录会自动带上译文，不需要再跑。
//
//   node scripts/backfill-featured-translations.mjs --dry-run   看要翻哪些
//   node scripts/backfill-featured-translations.mjs             真的写库
//   node scripts/backfill-featured-translations.mjs --force     连已翻过的也重翻
//
// 需要 .env.local 里的 SUPABASE_SERVICE_ROLE_KEY 和 DEEPSEEK_API_KEY。

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, '');
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // 没有 .env.local 就靠进程环境变量。
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。');
  process.exit(1);
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('缺少 DEEPSEEK_API_KEY。');
  process.exit(1);
}

const { buildFeaturedTranslation } = await import('../lib/featured-translation.ts');
const { resolveExcerpt } = await import('../lib/peer-feed-excerpt.ts');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('student_history_records')
  .select('external_id, record_type, payload, featured_excerpt, featured_title, featured_angle, featured_feedback, coach_feedback, featured_en')
  .eq('featured', true)
  .order('featured_at', { ascending: false });

if (error) {
  console.error('读取失败：', error.message);
  process.exit(1);
}

const rows = data || [];
const todo = rows.filter((row) => force || !row.featured_en);

console.log(`已上墙 ${rows.length} 条，需要翻译 ${todo.length} 条${dryRun ? '（dry-run，不写库）' : ''}。`);

let done = 0;
let skipped = 0;

for (const row of todo) {
  const source = {
    title: (row.featured_title || '').trim(),
    angle: (row.featured_angle || '').trim(),
    coachFeedback: (row.featured_feedback || row.coach_feedback || '').trim(),
    excerpt: resolveExcerpt(row.record_type, row.featured_excerpt, row.payload),
  };

  let translation = null;
  try {
    translation = await buildFeaturedTranslation(source);
  } catch (reason) {
    console.error(`  ✗ ${row.external_id}：翻译失败 —`, reason instanceof Error ? reason.message : reason);
    continue;
  }

  if (!translation) {
    skipped += 1;
    console.log(`  – ${row.external_id}：没有需要翻译的中文字段，跳过。`);
    continue;
  }

  if (dryRun) {
    console.log(`  · ${row.external_id}`);
    console.log(`      title: ${translation.title || '(未翻)'}`);
    console.log(`      angle: ${translation.angle || '(未翻)'}`);
    done += 1;
    continue;
  }

  const { error: writeError } = await supabase
    .from('student_history_records')
    .update({ featured_en: translation })
    .eq('external_id', row.external_id);

  if (writeError) {
    console.error(`  ✗ ${row.external_id}：写库失败 —`, writeError.message);
    continue;
  }

  done += 1;
  console.log(`  ✓ ${row.external_id}：${translation.title || translation.angle || ''}`);
}

console.log(`\n完成 ${done} 条，跳过 ${skipped} 条。`);
