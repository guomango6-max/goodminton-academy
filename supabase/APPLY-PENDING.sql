-- ============================================================
-- 论坛 + 私信落地：一次性执行
--
-- 在 Supabase SQL Editor 里整段粘贴运行。全部语句幂等
-- （if not exists / add column if not exists），重复跑安全。
--
-- 这是为了少切几次文件的合并副本；权威版本是 migrations/ 下的
-- 四个文件，改动请改那边：
--   2026-06-07_peer_wall.sql
--   2026-08-01_student_messages.sql
--   2026-08-01_forum_comments.sql
--   2026-08-02_forum_posts.sql
--
-- 2026-08-02 探测确认：以下四块在生产库里都还不存在。
-- ============================================================


-- ---------- 1. 精选墙（其他学员墙）----------
-- 给现有的 student_history_records 加 5 列 + 1 个部分索引。
-- 全部有默认值，旧数据不受影响。

alter table public.student_history_records
  add column if not exists featured boolean not null default false,
  add column if not exists featured_at timestamptz,
  add column if not exists featured_angle text,           -- 教练导读（一行）
  add column if not exists featured_category text,        -- correction | drill_seed | honest_stuck | good_question
  add column if not exists featured_tier text;            -- 匿名等级档，如 'C2' / 'B1'

create index if not exists student_history_records_featured_idx
  on public.student_history_records (featured_at desc)
  where featured = true;


-- ---------- 2. 站内私信（专属）----------
-- 教练 ↔ 学生一对一。没有学生 ↔ 学生通道，因此不需要举报/屏蔽/审核。
-- 未成年人不持有账号——未成年学员的账号归家长，教练在这类线程里
-- 是写给监护人、谈论孩子。

create table if not exists public.student_messages (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  direction text not null check (direction in ('coach_to_student', 'student_to_coach')),
  body text not null check (length(btrim(body)) > 0),
  source_external_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists student_messages_thread_idx
  on public.student_messages (student_id, created_at desc);

create index if not exists student_messages_unread_idx
  on public.student_messages (student_id)
  where direction = 'coach_to_student' and read_at is null;

alter table public.student_messages enable row level security;
revoke all on public.student_messages from anon, authenticated;


-- ---------- 3. 精华墙评论 ----------
-- 审核制：写入即 pending，教练通过之前不返回给任何读者。

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  body text not null check (length(btrim(body)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  student_id text,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists forum_comments_approved_idx
  on public.forum_comments (post_id, created_at)
  where status = 'approved';

create index if not exists forum_comments_pending_idx
  on public.forum_comments (created_at)
  where status = 'pending';

alter table public.forum_comments enable row level security;
revoke all on public.forum_comments from anon, authenticated;


-- ---------- 4. 学员自发帖：交流 + 约球 ----------
-- 与精选墙相反：学员自己发布自己的话，因此实名；约球有时效，
-- 等审核等于废帖，所以改成事后审核（发出即可见，教练可隐藏）。

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('discussion', 'meetup')),
  student_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  title text check (title is null or length(btrim(title)) <= 80),
  body text not null check (length(btrim(body)) between 1 and 2000),
  play_at timestamptz,
  location text check (location is null or length(btrim(location)) <= 80),
  players_needed smallint check (players_needed is null or players_needed between 1 and 20),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists forum_posts_visible_idx
  on public.forum_posts (kind, created_at desc)
  where hidden = false;

create index if not exists forum_posts_meetup_idx
  on public.forum_posts (play_at)
  where kind = 'meetup' and hidden = false;

alter table public.forum_posts enable row level security;
revoke all on public.forum_posts from anon, authenticated;


-- ---------- 验收 ----------
-- 跑完后刷新学生页/论坛，三个接口的 schemaReady 应该都变成 true：
--   GET  /api/peer-feed
--   GET  /api/forum-comment
--   POST /api/student-messages   {"credential":"<某个 loginId>"}
--   GET  /api/forum-posts
