-- 精选内容的英文版。
--
-- 站点界面是双语的，内容不是：学员写的总结、教练导读和点评全是中文，
-- 切到英文版之后原样露出来。这些内容没有人工英文版，也在持续新增。
--
-- 翻译放在加精那一刻做，不放在读取时做。理由是这条路上本来就有一道人工
-- 闸门——教练决定哪条上墙——把机翻挂在这道闸门上，译文在公开之前有人能
-- 看一眼、能改；读取时翻则是把未经审核的机翻直接送上公开页面。
--
-- 存成一个 jsonb 而不是十个 text 列：要翻的字段是 excerpt 里那一组，形状
-- 随 record_type 变（lesson 三个字段，match 五个），拆成列会拆出一堆常年
-- 为空的格子。

alter table public.student_history_records
  add column if not exists featured_en jsonb;

comment on column public.student_history_records.featured_en is
  'English translation of the publicly visible featured fields: {title, angle, coachFeedback, excerpt{...}}. Written at feature time, editable by the coach. Null means "not translated yet" — the reader falls back to the Chinese original.';
