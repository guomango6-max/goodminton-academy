import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function normalizeLoginCredential(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function addCredential(credentials, rawCredential, studentId) {
  const credential = normalizeLoginCredential(rawCredential);
  if (!credential || !studentId) return;
  credentials[credential] = studentId;
}

const manifest = readJson('data/student-manifest.json');
const generatedCredentials = readJson('data/student-login-credentials.json');
const credentials = {};

for (const [rawCredential, studentId] of Object.entries(generatedCredentials)) {
  addCredential(credentials, rawCredential, studentId);
}

// 只认 loginId，和 lib/student-login.ts 保持一致。
// 以前这里还把 studentId 和 alias 也算成凭据，但生产代码 2026-08-01 就不认了，
// 校验脚本一直在验一个比线上更宽的集合——那样它验的是别的东西。
for (const student of manifest) {
  addCredential(credentials, student.loginId, student.studentId);
}

const errors = [];
const seenLoginIds = new Map();

for (const student of manifest) {
  if (!student.studentId) {
    errors.push('Manifest entry is missing studentId.');
    continue;
  }

  if (!student.loginId) {
    errors.push(`${student.studentId}: missing loginId.`);
  }

  if (!student.file) {
    errors.push(`${student.studentId}: missing file.`);
  } else if (!existsSync(join(root, 'data', 'students', student.file))) {
    errors.push(`${student.studentId}: data/students/${student.file} does not exist.`);
  }

  const loginCredential = normalizeLoginCredential(student.loginId);
  const resolvedStudentId = credentials[loginCredential];
  if (student.loginId && resolvedStudentId !== student.studentId) {
    errors.push(`${student.studentId}: loginId ${student.loginId} resolves to ${resolvedStudentId || 'nothing'}.`);
  }

  if (loginCredential) {
    const existing = seenLoginIds.get(loginCredential);
    if (existing && existing !== student.studentId) {
      errors.push(`${student.studentId}: loginId ${student.loginId} duplicates ${existing}.`);
    }
    seenLoginIds.set(loginCredential, student.studentId);
  }
}

if (errors.length) {
  console.error(`Student login registry check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Student login registry ok: ${manifest.length} students, ${Object.keys(credentials).length} credentials.`);
