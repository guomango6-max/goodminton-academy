const RESERVED_NICKNAME_PARTS = ['教练', '管理员', 'coach', 'admin', 'goodminton'];

export function normalizeForumNickname(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').slice(0, 20)
    : '';
}

export function validateForumNickname(value: unknown) {
  const nickname = normalizeForumNickname(value);
  if (nickname.length < 2) return { nickname, error: '昵称至少需要 2 个字符。' };

  const comparison = nickname.toLowerCase().replace(/\s+/gu, '');
  if (RESERVED_NICKNAME_PARTS.some((part) => comparison === part || comparison.startsWith(part) || comparison.endsWith(part))) {
    return { nickname, error: '这个昵称包含保留身份，请换一个。' };
  }

  return { nickname, error: '' };
}
