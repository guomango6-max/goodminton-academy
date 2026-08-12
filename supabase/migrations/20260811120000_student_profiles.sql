-- 学员档案迁入 Supabase（过渡期：与 Google Sheet 并存）
--
-- 语句幂等，重复跑安全。
-- 不要用 `supabase db push`：本地有两个译文迁移在远端没有登记，push 会连带
-- 重跑它们的 update 语句，覆盖现有 featured_en。应单独执行本文件，再把
-- 20260811120000 登记为 applied。
--
-- 背景：学员档案此前只在 Google Sheet 上。data/students/*.json 被 gitignore
-- （里面有 accessCode 和个人信息），所以生产上没有本地文件，每次登录都要走
-- 一趟 Apps Script，缓存 TTL 只有 60 秒——冷启动或缓存过期时就是一次外部
-- 调用，慢一点或失败一次，学员看到的就是"登不进"。
--
-- Sheet 没有做任何数据建模，它就是按 studentId 存整份 JSON 的键值存储，
-- 所以这里同构照搬：一列主键 + 一列 jsonb。学员 JSON 的结构没有 schema
-- 约束，原样存进 jsonb 能保持前后兼容。

create table if not exists public.student_profiles (
  student_id  text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.student_profiles is
  '学员档案。payload 是 data/students/<id>.json 的原样副本，由 scripts/upload-students-to-supabase.mjs 从本地 Obsidian 同步产物上传。真正的源头是 Obsidian 库 work/05-students/*.md。';

comment on column public.student_profiles.payload is
  '整份学员 JSON。**含 accessCode**——读取方必须在返回浏览器前剥掉（见 app/api/student-data/route.ts 的 stripPrivateFields）。';

-- ⚠️ 安全要点：这张表只能由 service role 访问。
--
-- payload 里带 accessCode，也就是学员的登录码。anon key 一旦能读这张表，
-- 等于把全部学员的登录码放在一个匿名可查的接口后面——比现在（Sheet 至少
-- 有 token 挡着）更差。
--
-- 开启 RLS 且**不建任何 policy**：service role 绕过 RLS，anon / authenticated
-- 一条都读不到。这是本次迁移唯一不能出错的地方。
alter table public.student_profiles enable row level security;

-- 2026-04-28 起 Supabase 正在逐步取消 public 新表的自动 Data API grants。
-- 服务端通过 supabase-js + service role 访问，所以必须显式给 service_role 最小所需权限。
grant select, insert, update, delete on public.student_profiles to service_role;

-- 显式撤权，双保险：即使将来有人误建了宽松 policy，没有表级权限也读不到。
revoke all on public.student_profiles from anon, authenticated;

create index if not exists student_profiles_updated_at_idx
  on public.student_profiles (updated_at desc);
