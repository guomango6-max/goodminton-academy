// 广告落地页。和首页是两种东西，不要合并。
//
// 首页要回答「这是谁、这站有什么」，所以信息多、出口多。落地页只回答一个
// 问题：「我要不要联系他」。多一个出口就多一条逃跑路线，所以这里没有导航栏、
// 没有文章入口、没有论坛入口，整页只有一个动作。
//
// 措辞受 Meta 广告政策约束（见 work/08-outreach/meta-playbook.md）：
// 广告审核同时审广告和落地页，两边对不上会被拒；而 Personal Attributes 政策
// 禁止「断言或暗示受众的个人属性」。所以这一页通篇只描述服务本身，
// 不写「你打得不好吗」「反应慢吗」这类指认读者的句式——那正是被拒的模板。

import type { Lang } from '../../lib/articles.ts';
import { siteProfile } from '../../lib/site-profile';

const copy = {
  zh: {
    kicker: '赫尔辛基 · 埃斯波 · 万塔',
    title: '羽毛球训练课',
    lead: '面向成人与青少年的一对一和小组课。中文或英文授课，20 年以上执教经验。',
    cta: '用 WhatsApp 联系教练',
    ctaNote: '说一句你现在的水平和想练的东西就行，不用准备。',
    priceTitle: '价格',
    prices: [
      { h: '私教课', v: '40 €', d: '60 分钟' },
      { h: '小班课', v: '25 €', d: '90 分钟' },
    ],
    whatTitle: '课上会发生什么',
    what: [
      {
        h: '先测，再教',
        p: '首课把动作、步法、判断分开测一遍，找出真正卡住你的那一环——多数人练错的地方和自己以为的不是同一个。',
      },
      {
        h: '每节课有书面反馈',
        p: '课后你会拿到这节课的重点、要改的动作和下次的目标，不是听完就散。',
      },
      {
        h: '比赛录像复盘',
        p: '把你的实战录像拆成可练的东西：哪一拍选错了、下一次该怎么站。',
      },
    ],
    whereTitle: '在哪里上课',
    whereNote: '两处场馆，均可停车。具体时段按你的时间安排。',
    coachTitle: '教练',
    coachBody:
      '芒果教练，执教 20 年以上，长期带成人与青少年。中文和英文都能教学，不需要你先会芬兰语。',
    hoursLabel: '可约时间',
    hours: '每天 10:00–20:00',
    contactLabel: '直接联系',
    backToSite: '了解更多 → goodminton.fi',
  },
  en: {
    kicker: 'Helsinki · Espoo · Vantaa',
    title: 'Badminton lessons',
    lead: 'One-to-one and small-group coaching for adults and juniors. Taught in English or Chinese, by a coach with 20+ years on court.',
    cta: 'Message the coach on WhatsApp',
    ctaNote: 'Just say roughly where you are and what you want to work on. No preparation needed.',
    priceTitle: 'Rates',
    prices: [
      { h: 'One-to-one', v: '€40', d: '60 minutes' },
      { h: 'Small group', v: '€25', d: '90 minutes' },
    ],
    whatTitle: 'What a lesson looks like',
    what: [
      {
        h: 'Assess first, then teach',
        p: 'The first lesson tests strokes, footwork and decisions separately, to find the one thing actually holding the game back — usually not the thing people expect.',
      },
      {
        h: 'Written feedback every lesson',
        p: 'After each session you get the focus of that lesson, what to change, and the target for next time. Nothing evaporates on the way home.',
      },
      {
        h: 'Match video review',
        p: 'Your match footage turned into something practisable: which shot was the wrong choice, and where to stand next time.',
      },
    ],
    whereTitle: 'Where lessons happen',
    whereNote: 'Two halls, parking at both. Times are arranged around your schedule.',
    coachTitle: 'The coach',
    coachBody:
      'Coach Mango, 20+ years coaching, working mostly with adults and juniors. Lessons run in English or Chinese — no Finnish needed.',
    hoursLabel: 'Available',
    hours: 'Every day 10:00–20:00',
    contactLabel: 'Direct contact',
    backToSite: 'More about the academy → goodminton.fi',
  },
} as const;

function Cta({ t, block }: { t: typeof copy.zh | typeof copy.en; block?: boolean }) {
  return (
    <a
      href={siteProfile.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-[#176a4b] px-7 text-[16px] font-bold text-white transition-colors hover:bg-[#0e5a40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96] ${
        block ? 'w-full sm:w-auto' : ''
      }`}
    >
      {t.cta}
    </a>
  );
}

export default function LessonsLanding({ lang }: { lang: Lang }) {
  const t = copy[lang];

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-14">
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#1f4a38]">{t.kicker}</p>
      <h1 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-[#101820] sm:text-[52px]">
        {t.title}
      </h1>
      <p className="cjk-wrap mt-5 text-[18px] leading-8 text-[#52636b]">{t.lead}</p>

      <div className="mt-8">
        <Cta t={t} block />
        <p className="cjk-wrap mt-3 text-[14px] leading-6 text-[#64737a]">{t.ctaNote}</p>
      </div>

      {/* 价格紧跟第一个 CTA。落地页上价格出现得越晚，跳出率越高——不肯写价的页面
          会被读成「问了才知道，多半很贵」，而这两个数字本身是有竞争力的。 */}
      <section className="mt-10">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#3d4f57]">{t.priceTitle}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          {t.prices.map((price) => (
            <div key={price.h} className="rounded-[8px] border border-[#dfe7dc] bg-white/70 px-4 py-3">
              <dt className="text-[14px] text-[#52636b]">{price.h}</dt>
              <dd className="mt-1 text-[26px] font-semibold leading-none text-[#101820]">{price.v}</dd>
              <dd className="mt-1 text-[13px] text-[#64737a]">{price.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 border-t border-[#e6e1d4] pt-8">
        <h2 className="text-[22px] font-semibold text-[#101820]">{t.whatTitle}</h2>
        <div className="mt-5 space-y-6">
          {t.what.map((item) => (
            <div key={item.h}>
              <h3 className="text-[17px] font-semibold text-[#1f4a38]">{item.h}</h3>
              <p className="cjk-wrap mt-1.5 text-[16px] leading-7 text-[#52636b]">{item.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-[#e6e1d4] pt-8">
        <h2 className="text-[22px] font-semibold text-[#101820]">{t.whereTitle}</h2>
        <ul className="mt-4 space-y-3">
          {siteProfile.venues.map((venue) => (
            <li key={venue.streetAddress} className="text-[16px] leading-7">
              <span className="font-semibold text-[#101820]">{venue.name}</span>
              <span className="text-[#64737a]">
                {' — '}
                {venue.streetAddress}, {venue.city}
              </span>
            </li>
          ))}
        </ul>
        <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#64737a]">{t.whereNote}</p>
      </section>

      <section className="mt-12 border-t border-[#e6e1d4] pt-8">
        <h2 className="text-[22px] font-semibold text-[#101820]">{t.coachTitle}</h2>
        <p className="cjk-wrap mt-3 text-[16px] leading-7 text-[#52636b]">{t.coachBody}</p>
      </section>

      {/* 广告审核会查落地页有没有真实联系方式，这一段既是转化位也是合规位。 */}
      <section className="mt-12 rounded-[10px] bg-[#f4f7f1] p-6">
        <Cta t={t} block />
        <dl className="mt-6 grid gap-3 text-[15px] leading-6 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-[#64737a]">{t.hoursLabel}</dt>
            <dd className="font-semibold text-[#101820]">{t.hours}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-[#64737a]">{t.contactLabel}</dt>
            <dd className="font-semibold text-[#101820]">{siteProfile.telephone}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-10 text-[14px] text-[#64737a]">
        <a href={lang === 'en' ? '/en' : '/'} className="hover:text-[#16845f] hover:underline">
          {t.backToSite}
        </a>
      </p>
    </main>
  );
}
