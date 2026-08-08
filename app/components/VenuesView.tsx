// 首都区羽毛球场馆名录页。
//
// 和 Reddit 那篇是同一份事实、两种气口：那边是一个球友在分享，这边是署名的
// 参考页。这里可以署名——署名不是自我推广，是作者身份，一份没有署名、没有
// 核实日期的清单反而更可疑。AI 引用时找的正是「谁核实的、什么时候核实的」。

import ContactFooter from './ContactFooter';
import type { Lang } from '../../lib/articles.ts';
import { VENUES_VERIFIED, venuesByTier, type Bilingual, type Venue } from '../../lib/venues.ts';

const copy = {
  zh: {
    title: '首都区羽毛球场馆',
    lead: '赫尔辛基、埃斯波、万塔一共 25 处能打羽毛球的地方：场地数、价格、怎么订，以及哪些其实进不去。',
    modelsTitle: '先分清三种模式',
    models: [
      {
        h: '市政馆',
        p: '散客 3,50 €/人不限时，或按小时订场：成人 8 €/h，20 岁以下与 64 岁以上 5,50 €/h。全区最便宜，代价是只能捡俱乐部没占的时段。',
      },
      {
        h: '私营馆',
        p: '按小时租下指定场地，8,50–41 €，谁都能订，付了就一定有场。',
      },
      {
        h: '会员制',
        p: 'UniSport 与 Forever，要先是学生或会员，不对外单租。它们常出现在搜索结果里，然后你会发现自己用不了。',
      },
    ],
    priceTitle: '决定价格的是时段，不是场馆',
    priceBody:
      '全区最便宜的一小时是 Smash Center 周一至四 22–23 点的 8,50 €，最贵的是 Esport 周一至四 16–21 点的 38 €——同一座城市、同一项运动，差 4.5 倍。能在下午 4 点前打的话，Rajakylä 的 11 € 是白天最划算的；学生看 Esport 的 15 €，周末同样有效。',
    kidsTitle: '带孩子：Talihalli 的两条政策',
    kids: [
      '**学生价 3 €/人（7–16 岁）**：单次付费、空场随便打、不能也不需要预订、每天 16 点前有效、羽毛球壁球乒乓都算，**需要的话含借拍和球**。',
      '**家庭价 13 €/小时**：1–2 名成人加至少 1 名 15 岁以下同家庭儿童，周一至五 8–16 点，**只能电话预订**，同时只能订一片。',
    ],
    kidsTail: '这两条都不出现在网上预订系统里，这大概就是为什么几乎没人知道。',
    calendarTitle: '怎么查市政场地空不空',
    calendarBody:
      '用市政公共日历 liikuntakauppa.hel.fi：Laji 选 Sulkapallo（选完之后全市只剩三处有羽毛球），再选 Paikka 和 Resurssi，切到周视图。两个坑：Paikka 和 Resurssi 都是必填，没选完之前日历是空的，看起来像"全都有空"；另外羽毛球场上挡着的预订经常是别的运动，Ruskeasuo 晚上就是手球，同一块地板。',
    tiers: {
      city: '市政馆',
      private: '私营馆',
      members: '会员制（不对外单租）',
    },
    courts: '场地',
    price: '价格',
    booking: '预订',
    unknown: '未核实',
    coachHere: '我在这里授课',
    starsNote: '星级只标在我实际打过的场馆，没去过的不打分。',
    footer: `本页由 Goodminton Academy 的芒果教练整理，最后核实 ${VENUES_VERIFIED}。场地数、价格与预订方式来自各馆官网、芬兰羽协名录与赫尔辛基市政预订系统；星级与上手评价只写实际打过的馆。发现有出入请告诉我，我改。`,
  },
  en: {
    title: 'Badminton venues in the Helsinki capital region',
    lead: '25 places to play badminton across Helsinki, Espoo and Vantaa — courts, prices, how to book, and which ones you cannot actually get into.',
    modelsTitle: 'Three models, and they are priced worlds apart',
    models: [
      {
        h: 'City halls',
        p: 'Walk in for €3.50 per person with no time limit, or book a court by the hour: €8/h for adults, €5.50/h for under-20s and over-64s. Cheapest by a wide margin — the catch is you get whatever the clubs have not taken.',
      },
      {
        h: 'Private halls',
        p: 'Book a specific court for a specific hour, €8.50–41. Anyone can book and you always get what you paid for.',
      },
      {
        h: 'Members only',
        p: 'UniSport and Forever. You have to be a student or a member; there is no walk-in court rental. They surface in search results and then turn out to be closed to you.',
      },
    ],
    priceTitle: 'The time of day matters more than the venue',
    priceBody:
      'The cheapest hour in the region is €8.50 at Smash Center, Mon–Thu 22:00–23:00. The most expensive is €38 at Esport, Mon–Thu 16:00–21:00. Same sport, same city, 4.5x apart. If you can play before 4pm, Rajakylä at €11 is the best daytime deal; students should look at Esport’s €15 rate, which applies at weekends too.',
    kidsTitle: 'Playing with kids: two schemes at Talihalli',
    kids: [
      '**Schoolkids, €3 per person (ages 7–16)**: pay once at the desk and play on any free court. No booking — you cannot book it. Valid any day before 16:00, for badminton, squash and table tennis, and **a loan racket and shuttle are included if you need them**.',
      '**Family rate, €13/hour**: 1–2 adults plus at least one child under 15 from the same family, Mon–Fri 8:00–16:00. **Phone booking only**, one family court at a time.',
    ],
    kidsTail:
      'Neither appears in the online booking system, which is presumably why almost nobody knows about them.',
    calendarTitle: 'How to check whether a city court is free',
    calendarBody:
      'Use the city’s public calendar at liikuntakauppa.hel.fi: set Laji to Sulkapallo — once you do, only three venues in the whole city remain — then pick Paikka and Resurssi and switch to the week view. Two traps: Paikka and Resurssi are both mandatory, so until you have picked a court the calendar sits empty and looks exactly like “everything is free”; and the blocks you see on a badminton court are often other sports. Ruskeasuo evenings are handball, on the same floor.',
    tiers: {
      city: 'City halls',
      private: 'Private halls',
      members: 'Members only',
    },
    courts: 'Courts',
    price: 'Price',
    booking: 'Booking',
    unknown: 'not verified',
    coachHere: 'I coach here',
    starsNote: 'Stars appear only for venues I have actually played at. Anything unvisited is left unrated.',
    footer: `Compiled by Coach Mango of Goodminton Academy. Last verified ${VENUES_VERIFIED}. Court counts, prices and booking details come from the venues’ own sites, the Finnish Badminton Association hall directory and the City of Helsinki booking system; stars and hands-on notes cover only venues I have played at. Tell me if something is wrong and I will fix it.`,
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

function VenueCard({ venue, lang, t }: { venue: Venue; lang: Lang; t: typeof copy.zh | typeof copy.en }) {
  const address = [venue.streetAddress, venue.postalCode, venue.city].filter(Boolean).join(', ');
  const courtsNote = pick(venue.courtsNote, lang);
  const price = pick(venue.price, lang);
  const note = pick(venue.note, lang);

  return (
    <article className="border-t border-[#d8d0bf] py-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="cjk-wrap text-[20px] font-semibold leading-tight text-[#101820]">{venue.name}</h3>
        {venue.stars ? <Stars value={venue.stars} /> : null}
        {venue.coachHere ? (
          <span className="rounded-[4px] border border-[#cfe8d9] px-1.5 py-0.5 text-[11px] font-semibold text-[#1f4a38]">
            {t.coachHere}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[14px] text-[#64737a]">{address}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[15px] leading-7 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-[#3d4f57]">{t.courts}</dt>
        <dd className="cjk-wrap text-[#52636b]">
          {/* 数不确定但知道它按什么方式提供时，直接说那件事——写「未核实（按面积租）」
              等于把一条确定的信息包在一条不确定里。 */}
          {venue.courts !== null ? (
            <>
              {venue.courts}
              {courtsNote ? (
                <span className="text-[#64737a]">{lang === 'zh' ? `（${courtsNote}）` : ` (${courtsNote})`}</span>
              ) : null}
            </>
          ) : (
            courtsNote || t.unknown
          )}
        </dd>

        {price ? (
          <>
            <dt className="font-semibold text-[#3d4f57]">{t.price}</dt>
            <dd className="cjk-wrap text-[#52636b]">{price}</dd>
          </>
        ) : null}

        {venue.booking ? (
          <>
            <dt className="font-semibold text-[#3d4f57]">{t.booking}</dt>
            <dd className="cjk-wrap text-[#52636b]">{venue.booking}</dd>
          </>
        ) : null}
      </dl>

      {note ? <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#52636b]">{note}</p> : null}
    </article>
  );
}

export default function VenuesView({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const tiers = ['city', 'private', 'members'] as const;

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 py-12">
      <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.015em] text-[#101820] sm:text-[42px]">
        {t.title}
      </h1>
      <p className="cjk-wrap mt-4 max-w-[640px] text-[17px] leading-8 text-[#52636b]">{t.lead}</p>

      <section className="mt-10">
        <h2 className="text-[24px] font-semibold leading-tight text-[#101820]">{t.modelsTitle}</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {t.models.map((model) => (
            <div key={model.h} className="rounded-[8px] border border-[#e6e1d4] bg-white/60 p-4">
              <h3 className="text-[16px] font-semibold text-[#1f4a38]">{model.h}</h3>
              <p className="cjk-wrap mt-2 text-[14px] leading-6 text-[#52636b]">{model.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border-l-2 border-[#cfe8d9] pl-4">
        <h2 className="text-[20px] font-semibold text-[#101820]">{t.priceTitle}</h2>
        <p className="cjk-wrap mt-2 text-[16px] leading-8 text-[#52636b]">{t.priceBody}</p>
      </section>

      <section className="mt-10 rounded-[8px] bg-[#f4f7f1] p-5">
        <h2 className="text-[20px] font-semibold text-[#101820]">{t.kidsTitle}</h2>
        <ul className="mt-3 space-y-3">
          {t.kids.map((item) => (
            <li key={item} className="cjk-wrap text-[16px] leading-8 text-[#52636b]">
              {bold(item)}
            </li>
          ))}
        </ul>
        <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#64737a]">{t.kidsTail}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-semibold text-[#101820]">{t.calendarTitle}</h2>
        <p className="cjk-wrap mt-2 text-[16px] leading-8 text-[#52636b]">{t.calendarBody}</p>
      </section>

      <p className="mt-12 text-[14px] leading-6 text-[#64737a]">{t.starsNote}</p>

      {tiers.map((tier) => (
        <section key={tier} className="mt-8">
          <h2 className="text-[26px] font-semibold leading-tight text-[#101820]">{t.tiers[tier]}</h2>
          <div className="mt-4">
            {venuesByTier(tier).map((venue) => (
              <VenueCard key={venue.id} venue={venue} lang={lang} t={t} />
            ))}
          </div>
        </section>
      ))}

      <p className="cjk-wrap mt-12 border-t border-[#e6e1d4] pt-6 text-[14px] leading-7 text-[#64737a]">
        {t.footer}
      </p>

      <div className="mt-12">
        <ContactFooter lang={lang} />
      </div>
    </main>
  );
}
