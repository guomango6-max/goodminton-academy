import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type StudentManifestEntry = {
  studentId?: string;
  alias?: string;
  loginId?: string;
};

const LEGACY_STUDENT_LOGIN_CREDENTIALS: Record<string, string> = {
  demo: 'demo',
  sami09: 'sami',
  gyw11: 'guo-yiwei',
  gyw1: 'guo-yiwei',
  gyw1122: 'guo-yiwei',
  guoyiwei11: 'guo-yiwei',
  guoyiwei1122: 'guo-yiwei',
  郭一苇11: 'guo-yiwei',
  郭一苇1122: 'guo-yiwei',
  lcr22: 'li-chenrun',
  lcr2: 'li-chenrun',
  lcr2233: 'li-chenrun',
  lichenrun22: 'li-chenrun',
  lichenrun2233: 'li-chenrun',
  李晨润22: 'li-chenrun',
  李晨润2233: 'li-chenrun',
  sxy33: 'sheng-xinyi',
  sxy3: 'sheng-xinyi',
  sxy3344: 'sheng-xinyi',
  shengxinyi33: 'sheng-xinyi',
  shengxinyi3344: 'sheng-xinyi',
  盛心怡33: 'sheng-xinyi',
  盛心怡3344: 'sheng-xinyi',
  盛欣怡33: 'sheng-xinyi',
  盛欣怡3344: 'sheng-xinyi',
  xmj44: 'xue-meijiao',
  xmj4: 'xue-meijiao',
  xmj4455: 'xue-meijiao',
  xuemeijiao44: 'xue-meijiao',
  xuemeijiao4455: 'xue-meijiao',
  薛美姣44: 'xue-meijiao',
  薛美姣4455: 'xue-meijiao',
  yjn48: 'yang-jingnan',
  yjn8: 'yang-jingnan',
  yjn4837: 'yang-jingnan',
  yangjingnan48: 'yang-jingnan',
  yangjingnan4837: 'yang-jingnan',
  杨静南48: 'yang-jingnan',
  杨静南4837: 'yang-jingnan',
  grh46: 'guo-renhua',
  cyh33: 'cui-yunhao',
  wm45: 'wang-meng',
  zbq48: 'zhang-biqiong',
  zcq40: 'zhang-cuiqi',
  zx40: 'zhao-xin',
  abih30: 'abih',
  abiw30: 'abih-wife',
  jy47: 'jin-yan',
  lsq40: 'lu-shiqiong',
  rishi40: 'rishi',
  xkl13: 'xiaokonglong',
};

let loginCredentialsCache: Record<string, string> | null = null;

export function normalizeLoginCredential(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function addCredential(credentials: Record<string, string>, rawCredential: unknown, studentId: unknown) {
  if (typeof studentId !== 'string' || !studentId) return;
  const credential = normalizeLoginCredential(rawCredential);
  if (!credential) return;
  credentials[credential] = studentId;
}

function addManifestCredentials(credentials: Record<string, string>) {
  const manifest = readJsonFile<StudentManifestEntry[]>(join(process.cwd(), 'data', 'student-manifest.json'));
  if (!Array.isArray(manifest)) return;

  for (const student of manifest) {
    if (!student.studentId) continue;
    // Only the issued loginId (e.g. `xmj44`) is a credential.
    //
    // studentId (`xue-meijiao`) and alias (`xmj`) used to be registered here
    // too, which meant the romanized name was the password — anyone who knew a
    // student's name could open their page. Removed 2026-08-01.
    //
    // Every manifest entry currently carries a loginId, and the `demo` account
    // is granted separately in data/student-login-credentials.json, so nothing
    // loses access. Keep it that way: a new student without a loginId cannot
    // log in at all.
    addCredential(credentials, student.loginId, student.studentId);
  }
}

function addGeneratedCredentials(credentials: Record<string, string>) {
  const generated = readJsonFile<Record<string, string>>(join(process.cwd(), 'data', 'student-login-credentials.json'));
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) return;

  for (const [rawCredential, studentId] of Object.entries(generated)) {
    addCredential(credentials, rawCredential, studentId);
  }
}

export function getStudentLoginCredentials() {
  if (loginCredentialsCache) return loginCredentialsCache;

  const credentials: Record<string, string> = {};

  for (const [rawCredential, studentId] of Object.entries(LEGACY_STUDENT_LOGIN_CREDENTIALS)) {
    addCredential(credentials, rawCredential, studentId);
  }

  addGeneratedCredentials(credentials);
  addManifestCredentials(credentials);

  loginCredentialsCache = credentials;
  return loginCredentialsCache;
}

export function resolveStudentLogin(rawStudentId: unknown, rawAccessCode: unknown = '') {
  const credential = normalizeLoginCredential(`${typeof rawStudentId === 'string' ? rawStudentId : ''}${typeof rawAccessCode === 'string' ? rawAccessCode : ''}`);
  const studentId = getStudentLoginCredentials()[credential] || '';
  return { credential, studentId };
}
