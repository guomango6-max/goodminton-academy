import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type StudentManifestEntry = {
  studentId?: string;
  alias?: string;
  loginId?: string;
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

// 2026-08-11：别名不再用于登录，一人一码。
//
// 此前每个学员有多种写法都能登：首字母+数字、全拼+数字、中文名+数字，甚至
// 错别字变体（盛欣怡/盛心怡）。29 人对应 132 个有效凭据。
//
// 去掉的理由不是省事，是这些别名本身就是从姓名推导出来的——知道名字的人
// 等于知道了字母部分，只剩两位数字要猜。别名越多，猜中的路径越多，而登录
// 码本来就被定性为半公开。方向和 2026-08-01 移除 studentId/alias 一致，
// 这次收完最后一段。
//
// 代价说清楚：15 名学员的 52 个别名当场失效，他们存在浏览器里的登录态也会
// 因为凭据不再有效而被清掉，需要用 manifest 里的唯一 loginId 重新登录。
// data/student-login-credentials.json 是例外通道：给还没写进 manifest loginId
// 的学员临时发码用，平时应为空 {}。注意这里没有过滤——文件里写什么都会变成
// 一个有效凭据，所以别往里放注释键。
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
