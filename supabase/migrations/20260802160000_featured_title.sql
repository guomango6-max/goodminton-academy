-- 列表标题：论坛默认收起后，一行只有标题可看，标题必须自己撑起区分度。
--
-- 不能用课次标题（"回归基线复查" 三条、"封网闭合…" 两条，列出来分不清），
-- 也不能用教练导读（那是段落，不是标题）。所以单独存一个短标题。

alter table public.student_history_records
  add column if not exists featured_title text;

comment on column public.student_history_records.featured_title is
  'Short headline for the collapsed forum list. Keep it distinct — repeated titles defeat the list.';
