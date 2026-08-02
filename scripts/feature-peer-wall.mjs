#!/usr/bin/env node
// Seed the peer wall (学员精华墙) with a curated set of real submissions,
// replacing the hardcoded DEMO_ITEMS the /forum page falls back to.
//
// Usage:
//   node scripts/feature-peer-wall.mjs --dry-run
//   GOODMINTON_COACH_ACTION_TOKEN=... node scripts/feature-peer-wall.mjs
//   ... --base-url https://goodminton.fi
//
// Requires: the peer_wall migration applied (supabase/APPLY-PENDING.sql) and
// the coach token set. Without either, the API rejects every call and this
// script reports it rather than half-finishing.
//
// The picks below were chosen from work/07-reviews/_raw in the Obsidian vault
// on 2026-08-02. Selection rules used:
//   - one per category, so the wall shows four different kinds of usefulness
//   - technique and training content only — nothing naming an injury, a body,
//     or a personal circumstance. Those belong in the private thread.
//   - the student's own words have to carry the post; the 导读 only frames it.

const BASE_URL =
  process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : 'http://localhost:3000';

const DRY_RUN = process.argv.includes('--dry-run');
const TOKEN = process.env.GOODMINTON_COACH_ACTION_TOKEN || '';

const PICKS = [
  {
    // 紫萱 2026-07-06 比赛复盘
    recordId: 'zi-xuan-2026-07-06T08:01:50.883Z',
    category: 'correction',
    tier: 'C1',
    angle:
      '她赛后自己列出了三条站位规则——发完球留意前场两边角、后场接球后立刻回中保持平行。比赛里能想到这一层，比记住某一个动作重要得多。',
    note: '学员自述里有一条因果归因（"回球力度不够导致来不及归位"），墙上只展示她列的规则，不展示归因。',
  },
  {
    // 盛心怡 2026-05-07 课后总结
    recordId: 'sheng-xinyi-2026-06-04T06:05:31.933Z',
    category: 'drill_seed',
    tier: 'C2',
    angle:
      '"腿脚先找点，记住自己常用的击球点，在头顶一两点钟方向"——把抽象的击球点变成一个可以自己复述、自己检查的位置，这就是能直接拿去练的东西。',
  },
  {
    // 紫萱 2026-05-30 课后总结
    recordId: 'zi-xuan-2026-07-06T08:12:12.826Z',
    category: 'honest_stuck',
    tier: 'C1',
    angle:
      '"想杀的时候压不下，压多了会下网，所以比赛的时候会避免使用这个方式。" 承认自己在回避某一拍，比硬练一百个杀球更有价值——教练才知道该从哪儿下手。',
  },
  {
    // 王涵 2026-07-02 首课
    recordId: 'wang-han-2026-07-02T20:54:11.205Z',
    category: 'good_question',
    tier: 'C1',
    angle:
      '"如何接过顶球，或者说——如何避免让对方打出这种球。" 他把问题问成了两半，而后一半才是真正值钱的那半：与其练怎么救，不如先想怎么少挨。',
  },
];

async function main() {
  console.log(`目标: ${BASE_URL}`);
  console.log(`精选 ${PICKS.length} 条\n`);

  if (DRY_RUN) {
    for (const pick of PICKS) {
      console.log(`[dry-run] ${pick.category.padEnd(14)} ${pick.tier.padEnd(3)} ${pick.recordId}`);
      console.log(`          导读: ${pick.angle}`);
      if (pick.note) console.log(`          备注: ${pick.note}`);
      console.log();
    }
    console.log('未发送任何请求。去掉 --dry-run 并设置 GOODMINTON_COACH_ACTION_TOKEN 后执行。');
    return;
  }

  if (!TOKEN) {
    console.error('缺少 GOODMINTON_COACH_ACTION_TOKEN，接口会一律返回 401。已中止。');
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  for (const pick of PICKS) {
    const response = await fetch(`${BASE_URL}/api/student-submission/feature`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goodminton-coach-token': TOKEN,
      },
      body: JSON.stringify({
        recordId: pick.recordId,
        angle: pick.angle,
        category: pick.category,
        tier: pick.tier,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      ok += 1;
      console.log(`✅ ${pick.category.padEnd(14)} ${pick.recordId}`);
    } else {
      console.error(`❌ ${pick.category.padEnd(14)} ${pick.recordId} — ${response.status} ${payload?.error || ''}`);
      if (response.status === 401) {
        console.error('   令牌不对或服务端未配置 GOODMINTON_COACH_ACTION_TOKEN。');
      }
      if (response.status === 404) {
        console.error('   这条 external_id 在 student_history_records 里不存在。');
      }
      if (response.status === 502) {
        console.error('   多半是 peer_wall migration 没跑（featured 列不存在）。见 supabase/APPLY-PENDING.sql。');
      }
    }
  }

  console.log(`\n完成 ${ok}/${PICKS.length}。`);
  if (ok > 0) console.log('刷新 /forum，示例数据会被真实内容替换。');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
