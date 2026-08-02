#!/usr/bin/env node
// 把学员提交精选到学员墙。
//
//   node --env-file=.env.local scripts/feature-peer-wall.mjs --dry-run
//   node --env-file=.env.local scripts/feature-peer-wall.mjs
//
// 直接走 Supabase 而不是 /api/student-submission/feature：精选本质就是对
// student_history_records 的一次 UPDATE，各接口内部走的也是同一个 service
// role key。这样不需要把教练令牌传来传去。
//
// 每条提交一张卡，不合并。导读是教练视角的一句话，说明这条为什么值得别人看；
// 学员原文由 /api/peer-feed 脱敏后展示，这里不复制原文。
//
// 2026-08-02 批次：全量上墙有内容的提交。无正文的（金岩的建档记录、
// 张翠其的两条空白、测试数据）不在此列——墙上放空壳只会稀释可信度。

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const PICKS = [
  {
    recordId: 'yang-jingnan-2026-07-19T18:32:17.061Z',
    pinned: true,
    category: 'correction',
    tier: 'A2',
    angle:
      '她把一个反复出现的球路追到了根因："对手抽到右边后场，我总是给斜线，容易被反转——原因是步伐，我的脚尖应该在球后方。" 更难得的是同一段里承认"我自己本身的变化太少，非常依赖搭档的网前变化"。',
  },
  {
    recordId: 'yang-jingnan-2026-07-20T07:25:11.017Z',
    pinned: true,
    category: 'drill_seed',
    tier: 'A2',
    angle:
      '一个假期 15 节课，整理成六段：后场被动处理、接发切球、防守重心、反手高远、网前勾对角、推挑。这份密度已经接近教练笔记，很多条可以直接拿去练。',
  },
  {
    recordId: 'sheng-xinyi-2026-06-04T06:05:31.933Z',
    pinned: true,
    category: 'breakthrough',
    tier: 'C2',
    angle:
      '"击球后顺着轨迹下来，和杀球的刹住车不一样"——她自己分辨出了高远与杀球在收拍上的本质差别。同一篇里还写着"反手比以前有力了不少，甚至能顶高球"，前后对照就在文字里。',
  },
  {
    recordId: 'sheng-xinyi-2026-07-03T16:04:11.465Z',
    category: 'drill_seed',
    tier: 'C2',
    angle:
      '她把经验写成了带数字的规则："80% 直线、20% 斜线"，"反手过渡 70% 正面击打、30% 切，不要切多了"。带比例的规则场上用得上，"多注意一点"用不上。',
  },
  {
    recordId: 'zi-xuan-2026-07-06T08:12:12.826Z',
    category: 'honest_stuck',
    tier: 'C1',
    angle:
      '"想杀的时候压不下，压多了会下网，所以比赛的时候会避免使用这个方式。" 承认自己在回避某一拍，比闷头练一百个杀球更有价值——教练才知道该从哪儿下手。',
  },
  {
    recordId: 'mori-2026-07-17T20:14:28.922Z',
    category: 'honest_stuck',
    tier: 'C1',
    angle:
      '三个卡点全部具体，而且其中一条是"放网后没有意识到马上往后退步"——**发现自己少做了一个动作**，比发现动作做得不好更难。',
  },
  {
    recordId: 'mori-2026-07-20T17:27:55.233Z',
    category: 'honest_stuck',
    tier: 'C1',
    angle: '"卡在还未熟练，还要坚持多练。" 诚实的总结有时候就是这么短——没有把不熟练包装成别的原因。',
  },
  {
    recordId: 'mori-2026-07-26T20:03:24.881Z',
    category: 'drill_seed',
    tier: 'C1',
    angle:
      '"放网用膝盖弯曲带动腰快速放网"——把网前从手上的活改成腿上的活，方向是对的。而且这条是隔了两天补回来的。',
  },
];

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。用 node --env-file=.env.local 运行。');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}精选 ${PICKS.length} 条\n`);

  let ok = 0;
  let pinnedUnsupported = false;
  for (const pick of PICKS) {
    const { data: row, error: lookupError } = await supabase
      .from('student_history_records')
      .select('external_id, student_id, record_type, featured')
      .eq('external_id', pick.recordId)
      .maybeSingle();

    if (lookupError) {
      console.error(`❌ ${pick.recordId} 查询失败：${lookupError.message}`);
      continue;
    }
    if (!row) {
      console.error(`❌ ${pick.recordId} 不存在`);
      continue;
    }

    const label = `${row.student_id} ${row.record_type === 'match_review' ? '比赛' : '课后'}`;
    if (DRY_RUN) {
      console.log(`[dry-run] ${pick.pinned ? '★' : ' '} ${pick.category.padEnd(13)} ${pick.tier.padEnd(3)} ${label}${row.featured ? '（已在墙上，将覆盖导读）' : ''}`);
      console.log(`          ${pick.angle}\n`);
      ok += 1;
      continue;
    }

    const base = {
      featured: true,
      featured_at: new Date().toISOString(),
      featured_angle: pick.angle,
      featured_category: pick.category,
      featured_tier: pick.tier,
    };

    // 置顶列是后加的。库里还没跑 2026-08-02_featured_pinned 时退回不带它，
    // 内容照样上墙，等 ALTER 跑完重跑本脚本即可补上置顶。
    let { error } = await supabase
      .from('student_history_records')
      .update({ ...base, featured_pinned: Boolean(pick.pinned) })
      .eq('external_id', pick.recordId);

    if (error && /featured_pinned/i.test(error.message || '')) {
      pinnedUnsupported = true;
      ({ error } = await supabase
        .from('student_history_records')
        .update(base)
        .eq('external_id', pick.recordId));
    }

    if (error) {
      console.error(`❌ ${label} — ${error.message}`);
      continue;
    }
    console.log(`✅ ${pick.pinned ? '★' : ' '} ${pick.category.padEnd(13)} ${pick.tier.padEnd(3)} ${label}`);
    ok += 1;
  }

  console.log(`\n${DRY_RUN ? '预演' : '完成'} ${ok}/${PICKS.length}。`);
  if (pinnedUnsupported) {
    console.log('');
    console.log('⚠️  置顶未生效：库里没有 featured_pinned 列。');
    console.log('    跑 supabase/migrations/2026-08-02_featured_pinned.sql 后重跑本脚本即可补上。');
  }
  if (!DRY_RUN && ok) console.log('刷新 https://goodminton.fi/forum 查看。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
