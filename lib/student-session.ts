// 学员登录态的唯一读写入口。
//
// 此前凭据散在三个页面里各自 sessionStorage.getItem/setItem，共十六处。
// 那意味着任何一次策略调整都要在三处改对——这次要改的正是策略本身，
// 所以先收口。
//
// 存 localStorage 而不是 sessionStorage：学员训练完在手机上看，关掉标签页
// 就要重输 ID 是没必要的摩擦。
//
// 但带过期时间，不是永久：这个凭据是一个五位短码，教练自己定性为半公开，
// 而手机可能借人、可能是共用平板。90 天足够覆盖正常使用节奏，又给共用
// 设备留了一个边界。「退出」按钮仍然立即清除。

const CREDENTIAL_KEY = 'goodminton-student-credential';
const STUDENT_KEY = 'goodminton-student-current';
const EXPIRY_KEY = 'goodminton-student-session-expires';

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function expired() {
  try {
    const raw = window.localStorage.getItem(EXPIRY_KEY);
    if (!raw) return false; // 旧数据没有过期戳，当作有效，下次写入时补上
    return Date.now() > Number(raw);
  } catch {
    return false;
  }
}

function readKey(key: string) {
  try {
    if (expired()) {
      clearStudentSession();
      return '';
    }
    // 先读 session 再读 local：同一浏览器里如果有人刚在本标签登录了别的
    // 账号，本标签的会话应该压过持久化的那个。
    return window.sessionStorage.getItem(key) || window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function readStudentCredential() {
  return readKey(CREDENTIAL_KEY);
}

export function readStudentSnapshot() {
  return readKey(STUDENT_KEY);
}

export function saveStudentSession(credential: string, studentJson?: string) {
  try {
    window.localStorage.setItem(CREDENTIAL_KEY, credential);
    window.localStorage.setItem(EXPIRY_KEY, String(Date.now() + MAX_AGE_MS));
    if (studentJson) window.localStorage.setItem(STUDENT_KEY, studentJson);
    // 同时写 session，让本标签内的读取不依赖过期判断。
    window.sessionStorage.setItem(CREDENTIAL_KEY, credential);
    if (studentJson) window.sessionStorage.setItem(STUDENT_KEY, studentJson);
  } catch {
    // 隐私模式下写入会抛异常——这次不记住，不影响本次使用。
  }
}

// 把 90 天从「最后一次登录」改成「最后一次打开」。
//
// 固定 90 天的问题是：一个每周都来的学员，第 91 天照样被踢出去重输 ID——
// 而他恰恰是最不该被打扰的人。滑动续期让活跃的人一直保持登录，同时对
// 共用设备的边界没有放松：真正不再来的人，90 天后照样过期。
export function touchStudentSession() {
  try {
    if (!window.localStorage.getItem(CREDENTIAL_KEY) || expired()) return;
    window.localStorage.setItem(EXPIRY_KEY, String(Date.now() + MAX_AGE_MS));
  } catch {
    // 隐私模式下写不了，本次会话照常用，只是不续期。
  }
}

export function clearStudentSession() {
  try {
    for (const key of [CREDENTIAL_KEY, STUDENT_KEY, EXPIRY_KEY]) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
    // 论坛身份由凭据换来，退出时一并清掉，否则会留下一个没有凭据支撑的
    // 「学员」身份。
    window.localStorage.removeItem('goodminton-forum-identity');
    window.sessionStorage.removeItem('goodminton-forum-identity');
  } catch {
    // 同上。
  }
}
