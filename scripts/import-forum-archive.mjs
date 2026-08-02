#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import {
  forumArchiveContentKey,
  forumArchiveDedupeKey,
  prepareForumArchiveCandidate,
  sanitizeForumArchiveFeedback,
} from '../lib/forum-archive.ts';

const root = process.cwd();
loadEnv({ path: path.join(root, '.env.vercel.local') });
loadEnv({ path: path.join(root, '.env.local'), override: true });
loadEnv({ path: path.join(root, '.env') });

const apply = process.argv.includes('--apply');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase URL or service role key.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'student-manifest.json'), 'utf8'));
const names = manifest.flatMap((student) => [student.name, student.alias]).filter(Boolean);
const reviewsDir = process.env.GOODMINTON_OBSIDIAN_REVIEWS_DIR || 'D:\\ob\\work\\07-reviews\\student';

function sentFeedbackByExternalId() {
  const result = new Map();
  if (!fs.existsSync(reviewsDir)) return result;
  for (const filename of fs.readdirSync(reviewsDir).filter((name) => name.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(reviewsDir, filename), 'utf8');
    const frontmatter = raw.match(/^---\s*\n([\s\S]*?)\n---/u)?.[1] || '';
    const metadata = new Map(frontmatter.split(/\r?\n/gu).map((line) => {
      const colon = line.indexOf(':');
      return colon < 0 ? [line.trim(), ''] : [line.slice(0, colon).trim(), line.slice(colon + 1).trim().replace(/^["']|["']$/gu, '')];
    }));
    const status = metadata.get('status') || '';
    if (!status.includes('coach_feedback-已发送')) continue;
    const externalId = metadata.get('external_id');
    if (!externalId) continue;
    const sectionStart = raw.search(/^## coach_feedback[^\n]*$/mu);
    if (sectionStart < 0) continue;
    const afterHeading = raw.indexOf('\n', sectionStart) + 1;
    const remainder = raw.slice(afterHeading);
    const nextHeading = remainder.search(/^## /mu);
    const section = nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
    const quoted = section
      .split(/\r?\n/gu)
      .filter((line) => line.startsWith('>') || line.trim() === '')
      .map((line) => line.replace(/^>\s?/u, ''))
      .join('\n')
      .trim();
    if (quoted) result.set(externalId, quoted);
  }
  return result;
}

const sentFeedback = sentFeedbackByExternalId();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from('student_history_records')
  .select('external_id, created_at, happened_at, student_id, record_type, title, payload, coach_feedback')
  .in('record_type', ['lesson_summary', 'match_review'])
  .order('created_at', { ascending: true });
if (error) throw new Error(error.message);

// A student can edit and resubmit the same dated record, producing a new
// external_id. Keep the newest version for a student/type/date/title tuple.
const newestByKey = new Map();
for (const row of data || []) newestByKey.set(forumArchiveDedupeKey(row), row);
const newestByContent = new Map();
for (const row of newestByKey.values()) newestByContent.set(forumArchiveContentKey(row), row);

const candidates = [];
const skipped = new Map();
let omittedFeedback = 0;
let includedFeedback = 0;
for (const row of newestByContent.values()) {
  const result = prepareForumArchiveCandidate(row, names);
  if (!result.candidate) {
    skipped.set(result.skip, (skipped.get(result.skip) || 0) + 1);
    continue;
  }
  candidates.push(result.candidate);
  const vaultFeedback = sentFeedback.get(result.candidate.externalId);
  if (vaultFeedback) {
    const sanitized = sanitizeForumArchiveFeedback(vaultFeedback, names);
    result.candidate.feedback = sanitized.feedback || null;
    result.candidate.feedbackOmitted ||= sanitized.omittedParagraphs > 0;
  }
  if (result.candidate.feedbackOmitted) omittedFeedback += 1;
  if (result.candidate.feedback) includedFeedback += 1;
}

candidates.sort((a, b) => a.featuredAt.localeCompare(b.featuredAt));
console.log(`Supabase 原始记录：${data?.length || 0}`);
console.log(`日期/标题去重后：${newestByKey.size}`);
console.log(`正文指纹去重后：${newestByContent.size}`);
console.log(`可匿名导入论坛：${candidates.length}`);
console.log(`包含公开点评：${includedFeedback}`);
console.log(`Obsidian 已发送点评来源：${sentFeedback.size}`);
console.log(`因隐私省略点评：${omittedFeedback}`);
for (const [reason, count] of skipped) console.log(`跳过 ${count}：${reason}`);
console.log('');

for (const item of candidates) {
  const anonymousId = crypto.createHash('sha256').update(item.externalId).digest('hex').slice(0, 8);
  const title = item.excerpt.title || item.excerpt.match || '(无标题)';
  console.log(`${item.featuredAt.slice(0, 10)}  匿名-${anonymousId}  ${item.category.padEnd(13)} ${title}`);
}

if (!apply) {
  console.log('\n预览完成，未写数据库。确认后使用 --apply。');
  process.exit(0);
}

let updated = 0;
for (const item of candidates) {
  const { error: updateError } = await supabase
    .from('student_history_records')
    .update({
      featured: true,
      featured_at: item.featuredAt,
      featured_angle: item.angle,
      featured_category: item.category,
      featured_tier: '',
      featured_excerpt: item.excerpt,
      featured_feedback: item.feedback,
    })
    .eq('external_id', item.externalId);
  if (updateError) throw new Error(`${item.externalId}: ${updateError.message}`);
  updated += 1;
}

console.log(`\n已幂等更新 ${updated} 条论坛匿名历史内容。`);
