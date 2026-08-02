import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

// Fetch student-authored lesson_summary / match_review records from Supabase
// into the Obsidian inbox for the feedback-flow extraction pipeline.
// Direction: Supabase -> vault. The reverse (vault -> Supabase) is
// backfill-student-history-to-supabase.mjs; rows it created carry
// source 'data/students' and are excluded here to avoid a loop.

const root = process.cwd();
loadEnv({ path: path.join(root, '.env.vercel.local') });
loadEnv({ path: path.join(root, '.env.local'), override: true });
loadEnv({ path: path.join(root, '.env') });

const DEFAULT_INBOX_DIR = 'D:\\ob\\inbox';
const DEFAULT_STATE_FILE = 'D:\\ob\\.obsidian\\_ops\\supabase-fetch-state.json';

const dryRun = process.argv.includes('--dry-run');
const inboxDir = process.env.GOODMINTON_OBSIDIAN_INBOX_DIR || DEFAULT_INBOX_DIR;
const stateFile = process.env.GOODMINTON_FETCH_STATE_FILE || DEFAULT_STATE_FILE;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isVaultOrigin(row) {
  const payloadSource = row.payload && typeof row.payload === 'object' ? row.payload.source : '';
  return (
    row.source === 'data/students' ||
    payloadSource === 'data/students' ||
    String(row.external_id || '').startsWith('student-json:')
  );
}

function contentHash(row) {
  const material = JSON.stringify({ payload: row.payload ?? null, title: row.title ?? '', happened_at: row.happened_at ?? '' });
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 16);
}

function loadState() {
  if (!fs.existsSync(stateFile)) return { records: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.records ? parsed : { records: {} };
  } catch {
    throw new Error(`State file ${stateFile} is not valid JSON. Fix or delete it before running.`);
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function pickSubmission(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const submission = payload.submission && typeof payload.submission === 'object' ? payload.submission : payload;
  const lessonSummary = submission.lessonSummary && typeof submission.lessonSummary === 'object' ? submission.lessonSummary : {};
  const matchReview = submission.matchReview && typeof submission.matchReview === 'object' ? submission.matchReview : {};
  return { submission, lessonSummary, matchReview };
}

function recordDate(row) {
  const happened = cleanText(row.happened_at);
  if (/^\d{4}-\d{2}-\d{2}/.test(happened)) return happened.slice(0, 10);
  const { submission, lessonSummary } = pickSubmission(row);
  const summaryDate = cleanText(lessonSummary.date);
  if (/^\d{4}-\d{2}-\d{2}/.test(summaryDate)) return summaryDate.slice(0, 10);
  const submitted = cleanText(submission.submittedAt) || cleanText(row.created_at);
  if (/^\d{4}-\d{2}-\d{2}/.test(submitted)) return submitted.slice(0, 10);
  return 'undated';
}

function quoteBlock(text) {
  return cleanText(text)
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function renderBody(row) {
  const { lessonSummary, matchReview } = pickSubmission(row);
  const lines = [];

  if (row.record_type === 'lesson_summary') {
    lines.push('## 学员原话（引用态，不改写）', '');
    if (cleanText(lessonSummary.studentReflection)) {
      lines.push('### 课后感受', '', quoteBlock(lessonSummary.studentReflection), '');
    }
    if (cleanText(lessonSummary.question)) {
      lines.push('### 学员提问 / 想学', '', quoteBlock(lessonSummary.question), '');
    }
    const confidence = Number(lessonSummary.confidence);
    if (Number.isFinite(confidence) && confidence > 0) {
      lines.push(`### 掌握度自评\n\n${confidence} / 5（体验数据：只作纵向参考，不作绝对水位）`, '');
    }
    const homework = Array.isArray(lessonSummary.completedHomework)
      ? lessonSummary.completedHomework.map(cleanText).filter(Boolean)
      : [];
    if (homework.length) {
      lines.push('### 已完成作业（自报）', '', ...homework.map((item) => `- ${item}`), '');
    }
  } else {
    lines.push('## 学员原话（引用态，不改写）', '');
    const fields = [
      ['比赛', matchReview.match],
      ['比分', matchReview.score],
      ['打得好的', matchReview.whatWorked],
      ['下次调整', matchReview.nextAdjustment],
      ['整体感受', matchReview.experience],
    ];
    for (const [label, value] of fields) {
      if (cleanText(value)) {
        lines.push(`### ${label}`, '', quoteBlock(value), '');
      }
    }
  }

  if (cleanText(row.coach_feedback)) {
    lines.push('## 已有教练点评（Supabase）', '', quoteBlock(row.coach_feedback), '');
  }

  lines.push(
    '## 原始 payload（兜底，防字段遗漏）',
    '',
    '```json',
    JSON.stringify(row.payload ?? {}, null, 2),
    '```',
    '',
    '---',
    '处理指引：按 [[feedback-flow]] 生成 wiki 提炼稿（三栏拆解 + 体验/论断分级 + 下次课验证 + coach_feedback 草稿）。',
  );

  return lines.join('\n');
}

function renderFile(row, changed) {
  const typeLabel = row.record_type === 'lesson_summary' ? '课后总结' : '比赛复盘';
  const frontmatter = [
    '---',
    'block_type: source',
    'source_type: supabase-student-history',
    `external_id: "${row.external_id}"`,
    `student_id: ${row.student_id}`,
    `student_name: ${cleanText(row.student_name) || row.student_id}`,
    `record_type: ${row.record_type}`,
    `happened_at: ${recordDate(row)}`,
    `submitted_at: "${cleanText(pickSubmission(row).submission.submittedAt) || cleanText(row.created_at) || ''}"`,
    `fetched_at: ${new Date().toISOString().slice(0, 10)}`,
    `status: ${changed ? 'raw-updated-by-student' : 'raw'}`,
    '---',
  ];
  const heading = `# ${typeLabel}原始提交｜${cleanText(row.student_name) || row.student_id}｜${recordDate(row)}`;
  const note = changed ? '\n> ⚠️ 学生修改过的提交：库内可能已有基于旧版的提炼稿，处理时先对照。\n' : '';
  return `${frontmatter.join('\n')}\n\n${heading}\n${note}\n${renderBody(row)}\n`;
}

function targetFilename(row) {
  const type = row.record_type === 'lesson_summary' ? 'lesson-summary' : 'match-review';
  const base = `supabase-${type}-${row.student_id}-${recordDate(row)}`;
  let name = `${base}.md`;
  let i = 2;
  while (fs.existsSync(path.join(inboxDir, name))) {
    name = `${base}-${i}.md`;
    i += 1;
  }
  return name;
}

async function fetchRows() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Pull or set server env first.');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from('student_history_records')
    .select('*')
    .in('record_type', ['lesson_summary', 'match_review'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function main() {
  const rows = await fetchRows();
  const state = loadState();
  const report = { vaultOrigin: [], seen: [], fresh: [], changed: [] };

  for (const row of rows) {
    if (row.student_id === 'demo') continue; // 测试账号，不进训练判断
    if (isVaultOrigin(row)) {
      report.vaultOrigin.push(row);
      continue;
    }
    const hash = contentHash(row);
    const known = state.records[row.external_id];
    if (known && known.hash === hash) {
      report.seen.push(row);
      continue;
    }
    (known ? report.changed : report.fresh).push(row);
  }

  const line = (row) =>
    `  ${row.record_type === 'lesson_summary' ? '课后' : '比赛'} | ${row.student_id} | ${recordDate(row)} | ${cleanText(row.title) || '(无标题)'} | ${row.external_id}`;

  console.log(`Supabase 共 ${rows.length} 条 lesson_summary/match_review 记录`);
  console.log(`\n[跳过] 库回填来源（source=data/students），不参与抓取：${report.vaultOrigin.length} 条`);
  report.vaultOrigin.forEach((row) => console.log(line(row)));
  console.log(`\n[跳过] 已抓取且未变化：${report.seen.length} 条`);
  report.seen.forEach((row) => console.log(line(row)));
  console.log(`\n[新增] 待落 inbox：${report.fresh.length} 条`);
  report.fresh.forEach((row) => console.log(line(row)));
  console.log(`\n[学生已修改] 待重新落 inbox：${report.changed.length} 条`);
  report.changed.forEach((row) => console.log(line(row)));

  if (dryRun) {
    console.log('\n--dry-run：未写任何文件。');
    return;
  }

  if (!fs.existsSync(inboxDir)) {
    throw new Error(`Inbox dir not found: ${inboxDir}`);
  }

  let written = 0;
  for (const { rowsToWrite, changed } of [
    { rowsToWrite: report.fresh, changed: false },
    { rowsToWrite: report.changed, changed: true },
  ]) {
    for (const row of rowsToWrite) {
      const filename = targetFilename(row);
      fs.writeFileSync(path.join(inboxDir, filename), renderFile(row, changed), 'utf8');
      state.records[row.external_id] = { hash: contentHash(row), file: filename, fetchedAt: new Date().toISOString() };
      written += 1;
      console.log(`写入 ${path.join(inboxDir, filename)}`);
    }
  }

  saveState(state);
  console.log(`\n完成：写入 ${written} 个文件，水位已更新（${stateFile}）。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
