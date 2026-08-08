// 首都区羽毛球场馆名录的唯一事实来源。
//
// 为什么值得单独做一页：本地服务被检索到的入口是「城市 + 需求」，而「赫尔辛基
// 哪里能打羽毛球」这个问题至今没有一个像样的答案——芬兰羽协的合作馆名录里
// 一处市政馆都没有，于是最便宜的那一档在网上等于不存在。这一页补的是这个洞。
//
// 采集口径（2026-08）：
// - 场地数、价格、预订方式来自各馆官网、羽协名录、赫尔辛基市政预订日历
//   （liikuntakauppa.hel.fi）和市政官方价目表 liikuntapaikat_hinnasto2025
// - 星级和上手评价只写实际打过的馆，没去过的一律留空，不猜
//
// ⚠️ 羽协那份名录已经查出两处错（Targa Arena 地址、把 padel 馆列进来），
//    它只适合当「有哪些馆」的骨架，具体字段一律回官网核。

export type VenueTier = 'city' | 'private' | 'members';

export type Bilingual = { zh: string; en: string };

export type Venue = {
  id: string;
  name: string;
  tier: VenueTier;
  city: 'Helsinki' | 'Espoo' | 'Vantaa';
  streetAddress: string;
  postalCode: string;
  /** 羽毛球场地数。数不确定时留 null，不填猜测值。 */
  courts: number | null;
  courtsNote?: Bilingual;
  price?: Bilingual;
  booking?: string;
  note?: Bilingual;
  /** 1–5。只有实际打过的馆才给分。 */
  stars?: number;
  /** 教练在此授课，需在页面上标注以免被读成中立评价。 */
  coachHere?: boolean;
};

export const VENUES_VERIFIED = '2026-08';

export const venues: Venue[] = [
  // ---- 市政：单次 3,50 €/人不限时，或按小时订场 ----
  {
    id: 'ruskeasuo',
    name: 'Ruskeasuon liikuntapuisto',
    tier: 'city',
    city: 'Helsinki',
    streetAddress: 'Ratsastie 10',
    postalCode: '00280',
    courts: 10,
    courtsNote: {
      zh: '1 号馆 1–5 号场、2 号馆 6–10 号场，可单片预订',
      en: 'Hall 1 courts 1–5, hall 2 courts 6–10, bookable individually',
    },
    booking: 'liikuntakauppa.hel.fi',
    note: {
      zh: '全区性价比最高、也最少被提到的一处。有更衣室、淋浴、带锁储物柜和咖啡厅。工作日 16:30–21:00 基本被手球俱乐部占满，白天大片空着。',
      en: 'The best value in the region and the least known. Changing rooms, showers, lockable lockers, café. Weekday 16:30–21:00 is taken by handball clubs; daytime is wide open.',
    },
  },
  {
    id: 'liikuntamylly',
    name: 'Liikuntamylly',
    tier: 'city',
    city: 'Helsinki',
    streetAddress: 'Jauhokuja 3',
    postalCode: '00920',
    courts: 4,
    courtsNote: { zh: '两个区各分两块', en: 'Two hall sections split into four blocks' },
    booking: 'liikuntakauppa.hel.fi',
    note: {
      zh: '多功能地板，和地板球、篮球、排球共用。周一和周四晚上有可预订的羽毛球时段。',
      en: 'Shared multi-purpose floor with floorball, basketball and volleyball. Bookable badminton slots on Monday and Thursday evenings.',
    },
  },
  {
    id: 'katajanokka',
    name: 'Katajanokan liikuntahalli',
    tier: 'city',
    city: 'Helsinki',
    streetAddress: 'Katajanokka',
    postalCode: '',
    courts: null,
    courtsNote: { zh: '按场地面积租（大侧 500 m²、小厅 250 m²）', en: 'Rented by area (500 m² / 250 m²)' },
    booking: 'liikuntakauppa.hel.fi',
  },
  {
    id: 'kisahalli',
    name: 'Töölön Kisahalli',
    tier: 'city',
    city: 'Helsinki',
    streetAddress: 'Paavo Nurmen kuja 1 D',
    postalCode: '',
    courts: null,
    courtsNote: { zh: '不作为羽毛球场地开放预订', en: 'Not bookable as badminton' },
    note: {
      zh: '只能在排球场没被预订时散客进去打，市政价目表里也没有羽毛球条目。别按"能订到"来计划。',
      en: 'Drop-in only, on the volleyball courts when nobody has them reserved. It has no badminton line in the city price list either. Do not plan around it.',
    },
  },

  // ---- 私营：按小时租场，谁都能订 ----
  {
    id: 'esport',
    name: 'Liikuntakeskus Esport',
    tier: 'private',
    city: 'Espoo',
    streetAddress: 'Esport Center, Tapiolan urheilupuisto',
    postalCode: '02200',
    courts: 16,
    price: {
      zh: '工作日 15:30 前 20 €（学生 15 €）；周一至四 16–21 点 38 €；周末 24 €（学生 15 €）',
      en: '€20/h before 15:30 (student €15); €38/h Mon–Thu 16:00–21:00; €24/h weekends (student €15)',
    },
    booking: 'My Esport',
    note: {
      zh: '全区场地最多。晚间是全区最贵的时段，且不给学生价；学生价周末照样有效，是这一档里最划算的选择。',
      en: 'Most courts in the region. Its evening rate is the most expensive around and has no student discount — but the student rate does apply at weekends.',
    },
  },
  {
    id: 'talihalli',
    name: 'Talihalli',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Huopalahdentie 28',
    postalCode: '00350',
    courts: 12,
    courtsNote: { zh: '扩建部分 2026-08-10 起启用', en: 'An extension opened 10 Aug 2026' },
    price: {
      zh: '16 点前 17 €（固定时段 16 €、折扣组 13 €）；16–21 点 30 €；21–22 点 28 €。租拍 4 €、球 1 €',
      en: '€17 before 16:00 (€16 standing slot, €13 discount groups); €30 at 16:00–21:00; €28 at 21:00–22:00. Racket €4, shuttle €1',
    },
    booking: 'talihalli.cintoia.com',
    note: {
      zh: '带孩子首选，见下方学生价与家庭价。有淋浴和带锁储物柜；在场馆登记机上登记车牌可免费停车。',
      en: 'The best choice if you are bringing a child — see the schoolkid and family rates below. Showers and lockable lockers; parking is free if you register your car at the machine.',
    },
  },
  {
    id: 'rajakyla',
    name: 'Rajakylän Tenniskeskus',
    tier: 'private',
    city: 'Vantaa',
    streetAddress: 'Latukuja 4',
    postalCode: '01280',
    courts: 12,
    courtsNote: { zh: '弹性地板', en: 'Sprung floor' },
    price: { zh: '工作日 16 点前 11 €，其余 17 €', en: '€11/h weekdays before 16:00, €17/h otherwise' },
    booking: 'Timmi',
    note: {
      zh: '市政馆之外白天最便宜的场地。2026 年咖啡厅与前台正在交接：开放时间缩短、没有咖啡服务、现场不能订也不能付款。',
      en: 'The cheapest daytime court outside the city halls. Through 2026 the café and front desk are mid-handover: reduced hours, no café, and you cannot book or pay on site.',
    },
  },
  {
    id: 'meilahti',
    name: 'Meilahden Liikuntakeskus',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Zaidankatu 9',
    postalCode: '00250',
    courts: 10,
    courtsNote: { zh: '冬季', en: 'in winter' },
    price: { zh: '按时段 17–41 €，租拍 4 €', en: '€17–41 depending on the slot, racket €4' },
    booking: 'meilahdenliikuntakeskus.cintoia.com',
    note: {
      zh: '独立运营，对外开放预订。羽协把它列为合作馆，HBC、BadU、Stadin Sula 在此训练；有桑拿和穿线服务。入口走 Oksakoskenpolku。同一栋楼里的 UniSport Meilahti 是健身房，和这些球场无关，打球不需要 UniSport 会员。',
      en: 'Independently run and open to anyone. Listed by the Badminton Association as a partner hall; HBC, BadU and Stadin Sula train here. Sauna and a stringing shop. Entrance via Oksakoskenpolku. UniSport Meilahti shares the building but that is their gym — you do not need UniSport to play here.',
    },
  },
  {
    id: 'pasila',
    name: 'Pasilan Urheiluhalli',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Radiokatu 22',
    postalCode: '00240',
    courts: 10,
    price: {
      zh: '单次 14 €（工作日 16 点前）／20 €（16–21 点），租拍 2 €、球 2 €',
      en: '€14 per visit before 16:00, €20 at 16:00–21:00. Racket €2, shuttle €2',
    },
    booking: 'urheiluhallit.fi',
    note: { zh: '最多可提前 7 天预订。', en: 'Book up to 7 days ahead.' },
  },
  {
    id: 'smash-center',
    name: 'Smash Center',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Varikkotie 4',
    postalCode: '00900',
    courts: 9,
    courtsNote: {
      zh: '全部室内：7 片 Taraflex，2 片 Plexipave 加 6 mm 缓冲',
      en: 'All indoor: 7 Taraflex, 2 Plexipave with 6 mm cushioning',
    },
    price: {
      zh: '工作日 15:30 前 12,40 €；周一至四 16:30–21 点 27,30 €；22–23 点 8,50 €。租拍 3 €',
      en: '€12.40 before 15:30; €27.30 Mon–Thu 16:30–21:00; €8.50 at 22:00–23:00. Racket €3',
    },
    booking: 'smash.play.fi',
    note: {
      zh: '晚 10 点后 8,50 € 是全区最便宜的一小时。S3–S9 号场有羽毛球发球机（10,20 €/h），是本次扫下来全区唯一一台。学生与退休者工作日白天再减 10%。',
      en: 'The €8.50 late slot is the cheapest hour in the region. Courts S3–S9 have a shuttle machine (€10.20/h) — the only one I found anywhere here. Students and pensioners get another 10% off weekday daytime slots.',
    },
  },
  {
    id: 'mailapelikeskus',
    name: 'Helsingin Mailapelikeskus',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Tapulikaupungintie 4',
    postalCode: '00750',
    courts: 10,
    courtsNote: { zh: '8 片实木 + 2 片 Plexipave', en: '8 parquet + 2 Plexipave' },
    price: {
      zh: '工作日 16 点前 18 €（学生 17 €）；16–22 点 27 €；22 点后 13 €',
      en: '€18 before 16:00 (student €17); €27 at 16:00–22:00; €13 after 22:00',
    },
    booking: 'kauppa.mailapelikeskus.fi',
    note: { zh: '开赛前 12 小时可免费取消。', en: 'Free cancellation up to 12 hours before.' },
  },
  {
    id: 'merihaka',
    name: 'Merihaan Pallohalli',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Haapaniemenkatu 14 B',
    postalCode: '00530',
    courts: 6,
    courtsNote: { zh: 'Graboflex 塑胶', en: 'Graboflex mat' },
    booking: 'meripeli.cintoia.com',
    note: { zh: '夏季只在周一至周四 15–21 点开放，周五至周日关闭。', en: 'In summer open Mon–Thu 15:00–21:00 only, closed Fri–Sun.' },
  },
  {
    id: 'vuosaari',
    name: 'Vuosaaren Urheilutalo',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Vuosaarentie 5',
    postalCode: '',
    courts: 6,
    price: { zh: '同 Urheiluhallit：14 €／20 €', en: 'Urheiluhallit pricing: €14 / €20' },
    booking: 'urheiluhallit.fi',
  },
  {
    id: 'targa',
    name: 'Targa Arena',
    tier: 'private',
    city: 'Espoo',
    streetAddress: 'Ullanmäentie 21',
    postalCode: '02750',
    courts: 5,
    price: {
      zh: '工作日 7–16 点 12 €，16–23 点 18 €，周末 15 €',
      en: '€12 weekdays 7:00–16:00, €18 at 16:00–23:00, €15 weekends',
    },
    booking: 'targaarena.cintoia.com',
    note: {
      zh: '另有 2 片壁球、3 片 padel、8 张乒乓球台和 ProShop。16 点前的家庭时段含拍含球。',
      en: 'Also 2 squash courts, 3 padel courts, 8 table-tennis tables and a pro shop. Family slots before 16:00 include rackets and shuttles.',
    },
  },
  {
    id: 'kallio',
    name: 'Helsingin Urheilutalo (Kallio)',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Helsinginkatu 25',
    postalCode: '',
    courts: 4,
    price: { zh: '同 Urheiluhallit：14 €／20 €', en: 'Urheiluhallit pricing: €14 / €20' },
    booking: 'urheiluhallit.fi',
  },
  {
    id: 'mandatum',
    name: 'Mandatum Center',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Kulosaarentie 2',
    postalCode: '00570',
    courts: 4,
    booking: 'mandatumcenter.fi',
    note: { zh: '网球与羽毛球全年开放。', en: 'Tennis and badminton, year round.' },
  },
  {
    id: 'tali',
    name: 'Talin Tenniskeskus',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Kutomokuja 4',
    postalCode: '00380',
    courts: 4,
    booking: 'talitaivallahti.feel.cintoia.com',
    note: {
      zh: '压倒性地是个网球场馆：33 片网球（翻修后 26 片室内）对 4 片羽毛球，官网几乎不提羽毛球。每天 6:00–23:30。',
      en: 'Overwhelmingly a tennis venue: 33 tennis courts (26 indoor after the renovation) against 4 for badminton, and their own site barely mentions it. Open 6:00–23:30 daily.',
    },
  },
  {
    id: 'lltk',
    name: 'Laaksolahden Tenniskeskus (LLTK)',
    tier: 'private',
    city: 'Espoo',
    streetAddress: 'Lähdepurontie 1',
    postalCode: '02720',
    courts: 4,
    courtsNote: { zh: 'Regugym 地面', en: 'Regugym surface' },
    price: { zh: '夏季 14 €', en: '€14 in summer' },
    booking: 'kauppa.lltk.fi',
    note: { zh: '平时 8–23 点，但 6 月 29 日至 7 月 26 日整段关闭。', en: 'Open 8:00–23:00 most of the year but closed entirely 29 Jun – 26 Jul.' },
  },
  {
    id: 'makelanrinne',
    name: 'Mäkelänrinne',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: '',
    postalCode: '',
    courts: 3,
    price: { zh: '同 Urheiluhallit：14 €／20 €', en: 'Urheiluhallit pricing: €14 / €20' },
    booking: 'urheiluhallit.fi',
  },
  {
    id: 'ruoholahti',
    name: 'Ruoholahden Palloiluhalli',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Kellosaarenkatu 3',
    postalCode: '00180',
    courts: null,
    booking: 'palloiluhalli.com',
    stars: 2,
    note: {
      zh: '去过。没什么毛病，也没什么亮点——就在附近的话可以，专程跑一趟不值。',
      en: 'I have played here. Nothing wrong with it and nothing to recommend it either — fine if it is your neighbourhood, not worth crossing town for.',
    },
  },
  {
    id: 'toolo',
    name: 'Töölön Urheilutalo',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Topeliuksenkatu 41 A',
    postalCode: '00250',
    courts: null,
    price: { zh: '同 Urheiluhallit：14 €／20 €', en: 'Urheiluhallit pricing: €14 / €20' },
    booking: 'urheiluhallit.fi',
  },

  // ---- 会员制：先得是学生或会员，不对外单租 ----
  {
    id: 'unisport-kumpula',
    name: 'UniSport Kumpula',
    tier: 'members',
    city: 'Helsinki',
    streetAddress: 'Väinö Auerinkatu 11',
    postalCode: '00560',
    courts: null,
    note: { zh: '需要 UniSport 会员资格（在校学生与教职工）。', en: 'Requires UniSport membership (students and staff).' },
  },
  {
    id: 'unisport-otahalli',
    name: 'UniSport Otahalli',
    tier: 'members',
    city: 'Espoo',
    streetAddress: 'Otaranta 6',
    postalCode: '02150',
    courts: null,
    note: { zh: '同上。学生的话，这是全区性价比最高的选择。', en: 'Same. If you are a student, this is the best value in the region.' },
  },
  {
    id: 'forever-hiekkaharju',
    name: 'Forever Hiekkaharju',
    tier: 'members',
    city: 'Vantaa',
    streetAddress: 'Tennistie 3',
    postalCode: '01370',
    courts: null,
    booking: 'GoActive',
    coachHere: true,
    note: { zh: '健身房会员制，每日 5–23 点，免费停车。', en: 'Gym membership, open 05:00–23:00 daily, free parking.' },
  },
  {
    id: 'forever-matinkyla',
    name: 'Forever Matinkylä',
    tier: 'members',
    city: 'Espoo',
    streetAddress: 'Matinkartanontie 1',
    postalCode: '02230',
    courts: null,
    booking: 'GoActive',
    coachHere: true,
    note: { zh: '健身房会员制，人多时可以订下几片场。', en: 'Gym membership; several courts can be reserved for a larger group.' },
  },
];

export function venuesByTier(tier: VenueTier) {
  return venues.filter((venue) => venue.tier === tier);
}

/**
 * 名录的结构化数据。
 *
 * 用 ItemList 包一组 SportsActivityLocation：这是一份目录，不是在替这些场馆
 * 声明什么。只输出能核实的字段（名称、地址、所在城市），价格和评价不进结构化
 * 数据——那些会变，而错的结构化数据比没有更糟。
 */
export function buildVenuesJsonLd(siteUrl: string, pagePath: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${siteUrl}${pagePath}#venues`,
    name: 'Badminton venues in the Helsinki capital region',
    numberOfItems: venues.length,
    itemListElement: venues.map((venue, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SportsActivityLocation',
        name: venue.name,
        sport: 'Badminton',
        address: {
          '@type': 'PostalAddress',
          ...(venue.streetAddress ? { streetAddress: venue.streetAddress } : {}),
          addressLocality: venue.city,
          ...(venue.postalCode ? { postalCode: venue.postalCode } : {}),
          addressCountry: 'FI',
        },
      },
    })),
  };
}
