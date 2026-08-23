-- 登录失败审计表：记录学员登录失败（及时发现卡在门外/流失风险的学员）
-- 2026-08-23 创建。隐私安全：只存哈希（凭证 sha256 前 16 位、IP sha256 前 16 位），
-- 不存明文凭证/IP（GDPR）。仅 service role 可读写（仿 student_profiles，无 anon policy）。

create table if not exists public.login_failures (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  credential_hash text not null,             -- 尝试串 sha256 前 16 位（识别同一学员反复失败）
  ip_hash text not null default '',          -- IP sha256 前 16 位
  source text not null default 'student-data',  -- 来源接口
  rate_limited boolean not null default false   -- 预留：未来若恢复限流，标记是否触顶
);

create index if not exists login_failures_occurred_at_idx
  on public.login_failures (occurred_at desc);
create index if not exists login_failures_credential_hash_idx
  on public.login_failures (credential_hash, occurred_at desc);

alter table public.login_failures enable row level security;
-- 无任何 policy：anon/public 均不可见，仅 service role（RLS 旁路）可读写。
