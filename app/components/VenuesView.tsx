// 首都区羽毛球场馆名录页。
//
// 和 Reddit 那篇是同一份事实、两种气口：那边是一个球友在分享，这边是署名的
// 参考页。这里可以署名——署名不是自我推广，是作者身份，一份没有署名、没有
// 核实日期的清单反而更可疑。AI 引用时找的正是「谁核实的、什么时候核实的」。

import ContactFooter from './ContactFooter';
import type { Lang } from '../../lib/articles.ts';
import { VENUES_VERIFIED, venueSummary, venuesByTier, type Bilingual } from '../../lib/venues.ts';

const copy = {
  zh: {
    title: '首都区羽毛球场馆',
    lead: '赫尔辛基、埃斯波、万塔 19 处，最后核实 2026 年 8 月。',
    // 原来这里有「先分清两种模式」一整块，和两张表各自的开场白说的是同一件事。
    // 删掉了：同一件事说两遍，第二遍就是噪音。
    //
    // 原来还有一段讲时段价差的散文。它的价值全在那几个数字上，散文形制反而
    // 让人得读完才拿到——所以压成四个数，一眼就看完。
    keyTitle: '先看这四个数',
    keyNumbers: [
      { k: '最便宜', v: '8,50 €', d: 'Smash Center 周一至四 22–23 点' },
      { k: '最贵', v: '38 €', d: 'Esport 周一至四 16–21 点' },
      { k: '白天', v: '3,50 €/人', d: 'Ruskeasuo，不限时' },
      { k: '在校学生', v: '10 €', d: 'UniSport Kumpula 白天' },
    ],
    kidsTitle: '带孩子：Talihalli 的三条政策',
    kids: [
      '**学生价 3 €/人（7–16 岁）**：空场随便打，不能也不需要预订，每天 16 点前，**含借拍和球**。',
      '**家庭价 13 €/小时**：1–2 名成人 + 至少 1 名 15 岁以下同家庭儿童，周一至五 8–16 点，**只能电话预订**。周末也收，但按折扣组价。',
      '**成人学生折扣 −4 €**：需登记学生证，只减白天，提前预订每天限 1 小时。',
    ],
    kidsTail: '前两条都不出现在网上预订系统里，所以几乎没人知道。',
    calendarTitle: '怎么查市政场地空不空',
    calendarBody:
      '在 liikuntakauppa.hel.fi 把 Laji 选成 Sulkapallo，再选 Paikka 和 Resurssi。两个坑：这两项都是必填，没选完之前日历是空的，看起来像"全都有空"；另外羽毛球场上挡着的预订经常是别的运动，Ruskeasuo 晚上就是手球，同一块地板。',
    tiers: {
      city: '市政馆',
      private: '私营馆',
    },
    cityLead:
      '同一种模式：多功能馆，羽毛球和其他运动共用，只能捡俱乐部没排走的时段。三家同价同入口——散客 3,50 €/人不限时，或订场 8 €/h，全走 liikuntakauppa.hel.fi。差别只在信息：只有 Ruskeasuo 查得到也订得到。',
    privateLead: '按小时租指定场地，谁都能订。UniSport 和 Forever 也在这档，会员资格是折扣不是门槛。',
    venue: '场馆',
    cityCol: '城市',
    courts: '场地',
    noteCol: '去之前要知道',
    price: '价格',
    booking: '预订',
    unknown: '未核实',
    coachHere: '我在这里授课',
    footer: `本页由 Goodminton Academy 的芒果教练整理，最后核实 ${VENUES_VERIFIED}。场地数、价格与预订方式来自各馆官网、芬兰羽协名录与赫尔辛基市政预订系统；查不到的字段一律留空，不填猜测值。发现有出入请告诉我，我改。`,
  },
  en: {
    title: 'Badminton venues in the Helsinki capital region',
    lead: '19 places across Helsinki, Espoo and Vantaa. Last verified August 2026.',
    keyTitle: 'Four numbers first',
    keyNumbers: [
      { k: 'Cheapest', v: '€8.50', d: 'Smash Center, Mon–Thu 22:00–23:00' },
      { k: 'Priciest', v: '€38', d: 'Esport, Mon–Thu 16:00–21:00' },
      { k: 'Daytime', v: '€3.50/person', d: 'Ruskeasuo, no time limit' },
      { k: 'Students', v: '€10', d: 'UniSport Kumpula, daytime' },
    ],
    kidsTitle: 'Playing with kids: three schemes at Talihalli',
    kids: [
      '**Schoolkids, €3 per person (ages 7–16)**: any free court, no booking possible or needed, any day before 16:00. **Loan racket and shuttle included**.',
      '**Family rate, €13/hour**: 1–2 adults plus at least one child under 15 from the same family, Mon–Fri 8:00–16:00, **phone booking only**. Weekends too, but at discount-group rates.',
      '**Adult student discount, −€4**: register a student card first. Daytime only, advance booking capped at one hour a day.',
    ],
    kidsTail: 'The first two never appear in the online booking system, which is why almost nobody knows about them.',
    calendarTitle: 'How to check whether a city court is free',
    calendarBody:
      'At liikuntakauppa.hel.fi set Laji to Sulkapallo, then pick Paikka and Resurssi. Two traps: both are mandatory, so until you pick a court the calendar sits empty and looks exactly like “everything is free”; and the blocks you see on a badminton court are often other sports. Ruskeasuo evenings are handball, on the same floor.',
    tiers: {
      city: 'City halls',
      private: 'Private halls',
    },
    cityLead:
      'Same model in all three: multi-purpose halls where badminton shares the floor with other sports and you get whatever the clubs have not taken. Identical price and entry point — €3.50 per person with no time limit, or €8/h for a court, all via liikuntakauppa.hel.fi. The only difference is information: only Ruskeasuo is visible and bookable in the city system.',
    privateLead:
      'Book a specific court by the hour, open to anyone. UniSport and Forever sit here too — their membership is a discount, not a gate.',
    venue: 'Venue',
    cityCol: 'City',
    courts: 'Courts',
    noteCol: 'Worth knowing',
    price: 'Price',
    booking: 'Booking',
    unknown: 'not verified',
    coachHere: 'I coach here',
    footer: `Compiled by Coach Mango of Goodminton Academy. Last verified ${VENUES_VERIFIED}. Court counts, prices and booking details come from the venues’ own sites, the Finnish Badminton Association hall directory and the City of Helsinki booking system; anything I could not verify is left blank rather than guessed. Tell me if something is wrong and I will fix it.`,
  },
} as const;

function bold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-[#101820]">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} / 5`} className="text-[13px] tracking-[0.1em] text-[#c79a2e]">
      {'★'.repeat(value)}
      <span className="text-[#d8d0bf]">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function pick(value: Bilingual | undefined, lang: Lang) {
  return value ? value[lang] : undefined;
}

/**
 * 一档场馆一张表。
 *
 * 卡片排版每家占一屏，看第三家的时候已经忘了第一家多少钱——而这一页存在的
 * 全部理由就是横向比较。表格把「场地数」「价格」对齐成列，扫一眼就能比，
 * 这是卡片给不了的。
 *
 * 市政那档不显示价格和预订列：三家同价同入口（3,50 €/人，liikuntakauppa），
 * 每行重复一遍是噪音，写在表头上方一次就够。
 */
function VenueTable({
  tier,
  lang,
  t,
  showPrice,
}: {
  tier: 'city' | 'private';
  lang: Lang;
  t: typeof copy.zh | typeof copy.en;
  showPrice: boolean;
}) {
  return (
    // 6 列在手机上必然放不下。整表横向滚动，而不是压字号或砍列——
    // 砍掉的那一列一定是某个人正好要看的那一列。
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-[#3d4f57] text-[13px] uppercase tracking-[0.06em] text-[#3d4f57]">
            <th scope="col" className="py-2 pr-4 font-semibold">{t.venue}</th>
            <th scope="col" className="py-2 pr-4 font-semibold">{t.cityCol}</th>
            <th scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">{t.courts}</th>
            {showPrice ? (
              <>
                <th scope="col" className="py-2 pr-4 font-semibold">{t.price}</th>
                <th scope="col" className="py-2 pr-4 font-semibold">{t.booking}</th>
              </>
            ) : null}
            <th scope="col" className="py-2 font-semibold">{t.noteCol}</th>
          </tr>
        </thead>
        <tbody>
          {venuesByTier(tier).map((venue) => {
            const courtsNote = pick(venue.courtsNote, lang);

            return (
              <tr key={venue.id} className="border-b border-[#e6e1d4] align-top">
                <th scope="row" className="cjk-wrap py-3 pr-4 font-semibold text-[#101820]">
                  {venue.name}
                  {venue.stars ? (
                    <span className="ml-2 inline-block">
                      <Stars value={venue.stars} />
                    </span>
                  ) : null}
                  {venue.coachHere ? (
                    <span className="ml-2 inline-block rounded-[4px] border border-[#cfe8d9] px-1.5 py-0.5 text-[11px] font-semibold text-[#1f4a38]">
                      {t.coachHere}
                    </span>
                  ) : null}
                </th>
                <td className="py-3 pr-4 whitespace-nowrap text-[#52636b]">{venue.city}</td>
                <td className="cjk-wrap py-3 pr-4 text-[#52636b]">
                  {/* 数不确定但知道它按什么方式提供时，直接说那件事——写「未核实（按面积租）」
                      等于把一条确定的信息包在一条不确定里。 */}
                  {venue.courts !== null ? (
                    <>
                      <span className="font-semibold text-[#101820]">{venue.courts}</span>
                      {courtsNote ? (
                        <span className="block text-[13px] leading-5 text-[#64737a]">{courtsNote}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[13px] leading-5 text-[#64737a]">{courtsNote || t.unknown}</span>
                  )}
                </td>
                {showPrice ? (
                  <>
                    <td className="cjk-wrap py-3 pr-4 text-[#52636b]">{pick(venue.price, lang) || '—'}</td>
                    <td className="cjk-wrap py-3 pr-4 text-[13px] leading-5 text-[#64737a]">
                      {venue.booking || '—'}
                    </td>
                  </>
                ) : null}
                {/* 极简层。全细节的 venue.note 留在数据里，这里只出一句。 */}
                <td className="cjk-wrap py-3 text-[14px] leading-6 text-[#52636b]">
                  {pick(venueSummary(venue), lang) || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function VenuesView({ lang }: { lang: Lang }) {
  const t = copy[lang];

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 py-12">
      <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.015em] text-[#101820] sm:text-[42px]">
        {t.title}
      </h1>
      <p className="cjk-wrap mt-4 max-w-[640px] text-[17px] leading-8 text-[#52636b]">{t.lead}</p>

      {/* 四个数顶在最前面。整页的结论就是这四行，剩下的是让人核对用的——
          所以它们在表之前，两段带孩子/查日历的细节挪到表之后。 */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.08em] text-[#3d4f57]">{t.keyTitle}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {t.keyNumbers.map((item) => (
            <div key={item.k}>
              <dt className="text-[13px] text-[#64737a]">{item.k}</dt>
              <dd className="mt-0.5 text-[22px] font-semibold leading-tight text-[#101820]">{item.v}</dd>
              <dd className="cjk-wrap mt-0.5 text-[13px] leading-5 text-[#64737a]">{item.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-[26px] font-semibold leading-tight text-[#101820]">{t.tiers.city}</h2>
        <p className="cjk-wrap mt-3 text-[16px] leading-8 text-[#52636b]">{t.cityLead}</p>
        <VenueTable tier="city" lang={lang} t={t} showPrice={false} />
      </section>

      <section className="mt-12">
        <h2 className="text-[26px] font-semibold leading-tight text-[#101820]">{t.tiers.private}</h2>
        <p className="cjk-wrap mt-3 text-[16px] leading-8 text-[#52636b]">{t.privateLead}</p>
        <VenueTable tier="private" lang={lang} t={t} showPrice />
      </section>

      <section className="mt-12 rounded-[8px] bg-[#f4f7f1] p-5">
        <h2 className="text-[20px] font-semibold text-[#101820]">{t.kidsTitle}</h2>
        <ul className="mt-3 space-y-2">
          {t.kids.map((item) => (
            <li key={item} className="cjk-wrap text-[15px] leading-7 text-[#52636b]">
              {bold(item)}
            </li>
          ))}
        </ul>
        <p className="cjk-wrap mt-3 text-[14px] leading-6 text-[#64737a]">{t.kidsTail}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-semibold text-[#101820]">{t.calendarTitle}</h2>
        <p className="cjk-wrap mt-2 text-[15px] leading-7 text-[#52636b]">{t.calendarBody}</p>
      </section>

      <p className="cjk-wrap mt-12 border-t border-[#e6e1d4] pt-6 text-[14px] leading-7 text-[#64737a]">
        {t.footer}
      </p>

      <div className="mt-12">
        <ContactFooter lang={lang} />
      </div>
    </main>
  );
}
