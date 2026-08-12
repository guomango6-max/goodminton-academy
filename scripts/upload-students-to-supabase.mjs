#!/usr/bin/env node
// 把本地学员档案上传到 Supabase public.student_profiles。
//
//   node scripts/upload-students-to-supabase.mjs --dry-run   # 只比对，不写
//   node scripts/upload-students-to-supabase.mjs             # upsert
//
// 对应 scripts/upload-students-to-google-sheet.mjs——过渡期两边都要跑，等
// Supabase 稳定后再停用 Sheet 那条。
//
// 数据源仍是 Obsidian 库：
//   work/05-students/*.md → sync-students-from-obsidian.mjs → data/students/*.json → 本脚本
//
// demo 不上传：它是仓库里的 fixture，走本地文件那条路，生产上也读得到
// （data/students/demo.json 是 .gitignore 的唯一例外）。

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

const root = process.cwd();
loadEnv({ path: join(root, '.env.vercel.local') });
loadEnv({ path: join(root, '.env.local'), override: true });
loadEnv({ path: join(root, '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const manifest = JSON.parse(await readFile(join(root, 'data', 'student-manifest.json'), 'utf8'));
const students = manifest.filter((s) => s.studentId && s.studentId !== 'demo');

const rows = [];
const missing = [];

for (const item of students) {
  let raw;
  try {
    raw = await readFile(join(root, 'data', 'students', item.file), 'utf8');
  } catch {
    missing.push(item.studentId);
    continue;
  }
  const payload = JSON.parse(raw);
  if (payload.studentId !== item.studentId) {
    console.error(`✗ ${item.file} 里的 studentId (${payload.studentId}) 与 manifest (${item.studentId}) 不一致，跳过`);
    continue;
  }
  rows.push({ student_id: item.studentId, payload, updated_at: new Date().toISOString() });
}

console.log(`manifest 学员 ${students.length} 人（不含 demo），读到档案 ${rows.length} 份`);
if (missing.length) {
  console.log(`⚠ 本地缺少档案文件，未上传：${missing.join(', ')}`);
  console.log('  这些学员在 Supabase 上会取不到，登录时会回退到 Sheet。');
}

// 和线上现有数据比对，说清楚这次会改什么
const { data: existing, error: readError } = await supabase
  .from('student_profiles')
  .select('student_id, updated_at');
if (readError) {
  console.error('读取现有数据失败：', readError.message);
  if (/relation .* does not exist/i.test(readError.message)) {
    console.error('→ 表还没建。先在 Supabase SQL Editor 里执行 supabase/migrations/20260811120000_student_profiles.sql');
  }
  process.exit(1);
}
const existingIds = new Set((existing || []).map((r) => r.student_id));
const toInsert = rows.filter((r) => !existingIds.has(r.student_id)).map((r) => r.student_id);
const toUpdate = rows.filter((r) => existingIds.has(r.student_id)).map((r) => r.student_id);
const orphan = [...existingIds].filter((id) => !rows.some((r) => r.student_id === id));

console.log(`  新增 ${toInsert.length}${toInsert.length ? '：' + toInsert.join(', ') : ''}`);
console.log(`  覆盖 ${toUpdate.length}`);
if (orphan.length) console.log(`  ⚠ 线上有、本地没有（不会自动删）：${orphan.join(', ')}`);

if (DRY_RUN) {
  console.log('\n--dry-run：未写入任何数据。');
  process.exit(0);
}

const { error: writeError } = await supabase
  .from('student_profiles')
  .upsert(rows, { onConflict: 'student_id' });

if (writeError) {
  console.error('写入失败：', writeError.message);
  process.exit(1);
}

console.log(`\n已上传 ${rows.length} 份档案。`);
