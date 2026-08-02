#!/usr/bin/env node
// 给学员墙上的每一条写标题，并补上占位导读。
//
//   node --env-file=.env.local scripts/wall-titles.mjs --dry-run
//   node --env-file=.env.local scripts/wall-titles.mjs
//
// 为什么需要单独的标题：论坛默认收起之后，一行只有标题可看。课次标题会重复
// （"回归基线复查" 三条、"封网闭合…" 两条），导读又是段落而非标题。所以
// featured_title 单独存一句 8–16 字的关键词式短句，要求彼此不雷同。
//
// 同时修掉一个更严重的问题：19 条里有 11 条的 featured_angle 是同一句占位
// 文案（"历史比赛复盘：保留当时最有训练价值的观察，已隐去身份信息。"），
// 一字不差重复 11 次——展开之后内容也雷同。下面按各自实际内容重写。

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

// angle 为 null 表示保留现有导读，只补标题。
const ITEMS = [
  { id: 'sheng-xinyi-2026-06-04T06:05:31.933Z', title: '高远收拍，和杀球刹车不一样', angle: null },
  { id: 'yang-jingnan-2026-07-20T07:25:11.017Z', title: '一个假期 15 节课，全在这了', angle: null },
  { id: 'yang-jingnan-2026-07-19T18:32:17.061Z', title: '总给斜线被反转？问题在脚尖', angle: null },
  { id: 'mori-2026-07-26T20:03:24.881Z', title: '放网别用手，用膝盖带腰', angle: null },
  { id: 'mori-2026-07-20T17:27:55.233Z', title: '就是不熟，还得多练', angle: null },
  { id: 'mori-2026-07-17T20:14:28.922Z', title: '放网之后，我忘了退', angle: null },
  { id: 'zi-xuan-2026-07-06T08:12:12.826Z', title: '压不下的杀球，比赛里我躲着用', angle: null },
  { id: 'sheng-xinyi-2026-07-03T16:04:11.465Z', title: '80% 直线 20% 斜线', angle: null },

  // 以下为占位导读，按实际内容重写
  {
    id: 'zi-xuan-2026-07-06T08:01:50.883Z',
    title: '回球不够深，位就永远归不及',
    angle:
      '她赛后自己列了三条站位规则：发完球留意前场两边角、后场接球后立刻回中保持平行。比赛里能想到这一层，比记住某个动作更重要。',
  },
  {
    id: 'sheng-xinyi-2026-07-05T14:12:51.303Z',
    title: '先试探，再变化，最后保持耐心',
    angle:
      '一场打得顺的双打，她记下来的却是"先上两分试探对面后场实力"和"有点危险的球就回更安全的"。赢球的时候还能说清为什么赢，比输球复盘更少见。',
  },
  {
    id: 'sheng-xinyi-2026-07-05T14:45:36.874Z',
    title: '我要歇一下，队友想保持手感',
    angle:
      '混双里最难的一条不是技术：她每分之间需要停一下才能集中，队友却想保持热手感。把搭档之间的节奏差异写出来，才有可能商量。',
  },
  {
    id: 'wang-han-2026-07-02T20:54:11.205Z',
    title: '过顶球：怎么接，怎么少挨',
    angle: '他把问题问成了两半——"如何接"和"如何避免让对方打出这种球"。后一半才是真正值钱的那半。',
  },
  {
    id: 'zi-xuan-2026-07-10T17:05:33.298Z',
    title: '挑球总甩过头，封网靠默数',
    angle:
      '她把自己的毛病量化了："挑球结束后应该在身体中高度停下，多次甩到了头部高度。" 能说出错到什么程度，才知道要改到什么程度。',
  },
  {
    id: 'yang-jingnan-2026-05-28T19:45:26.552Z',
    title: '双打不是只有快和杀',
    angle:
      '"被动球先稳住质量，网前动作要小，吊球要加速压低。" 从一味追求速度，转向分清哪一拍该稳、哪一拍该压——这是双打进阶的分水岭。',
  },
  {
    id: 'yang-jingnan-2026-07-21T06:34:52.418Z',
    title: '接杀别往前够，往后站一点',
    angle:
      '一份可以照着摆场地的练法清单：用物件标记封网落点、按杀球角度调整重心高低、接杀改成往后一点接而不是抢在身前。',
  },
  {
    id: 'student-json:sheng-xinyi:match-review:2026-05-09',
    title: '动作变小了，稳定性还没跟上',
    angle:
      '一句"动作变小"背后是长期纠错的结果；同一篇里她也记下高速来球下挡球和吊球还不稳。进步和欠账同时写清楚，才是有用的复盘。',
  },
  {
    id: 'sheng-xinyi-2026-06-29T08:36:50.966Z',
    title: '不转体，才是打头顶最快的时候',
    angle:
      '她把几堂课并成一篇：头顶区利用不转体抢时间、热身从网前小球往大动作递进、推球靠重心回抽那一瞬。密度很高，值得慢慢读。',
  },
  {
    id: 'xue-meijiao-2026-07-31T19:13:31.447Z',
    title: '手臂不发力，身体是流动的',
    angle:
      '"推球用身体带动手臂，有一种流动的状态，手臂不发力。" 能把发力感受描述成这样，说明动力链的体感是真的建立起来了。',
  },
  {
    id: 'xue-meijiao-2026-07-06T19:19:59.942Z',
    title: '正手为什么不如反手顺',
    angle:
      '挑球、抽球、杀球，正手都不如反手顺畅——她自己指定了训练方向。同一篇里还附了一份写得很细的高远球发力笔记。',
  },
];

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。用 node --env-file=.env.local 运行。');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// 标题雷同就失去了收起列表的意义，先自查一遍。
const seen = new Set();
for (const item of ITEMS) {
  if (seen.has(item.title)) {
    console.error(`❌ 标题重复：${item.title}`);
    process.exit(1);
  }
  seen.add(item.title);
}
console.log(`${ITEMS.length} 条标题互不重复 ✓\n`);

let ok = 0;
for (const item of ITEMS) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${item.title}${item.angle ? '  （并重写导读）' : ''}`);
    ok += 1;
    continue;
  }
  const patch = { featured_title: item.title };
  if (item.angle) patch.featured_angle = item.angle;

  const { error } = await supabase
    .from('student_history_records')
    .update(patch)
    .eq('external_id', item.id);

  if (error) {
    console.error(`❌ ${item.title} — ${error.message}`);
    continue;
  }
  console.log(`✅ ${item.title}${item.angle ? '  （导读已重写）' : ''}`);
  ok += 1;
}

console.log(`\n${DRY_RUN ? '预演' : '完成'} ${ok}/${ITEMS.length}。`);
