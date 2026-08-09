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
// ⚠️ 羽协那份名录已经查出三处错（Targa Arena 地址、把 padel 馆列进来、
//    把 UniSport Otahalli 当羽毛球馆——UniSport 自己的价目表里羽毛球只有
//    Kumpula）。它只适合当「有哪些馆」的骨架，具体字段一律回官网核。
//
// 2026-08-09 三处收口：
// 1. 删掉「会员制」这一档。它原本的定义是「不对外单租」，而这是错的：
//    Forever 两馆对所有人开价 18 €／27 €，会员拿的是折扣不是准入；UniSport
//    Kumpula 的价目表直接列了 normal price。既然谁都能订，它们就是私营馆的
//    一种计价方式，不是第三种模式。
// 2. 删掉数据不足且不影响决策的五家：Katajanokka（按面积整租，两三个人用不
//    上）、Merihaka / Mandatum / Talin Tenniskeskus（查不到价格）、
//    Ruoholahti（去过，无可无不可）。
// 3. 价格里凡是带条件的（每人／整块／生效日期），条件必须贴着数字写在同一个
//    字段里。读者会照着这个数字算钱，把条件挪进 note 就是在制造误读。

export type VenueTier = 'city' | 'private';

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
    id: 'kisahalli',
    name: 'Töölön Kisahalli',
    tier: 'city',
    city: 'Helsinki',
    streetAddress: 'Paavo Nurmen kuja 1 D',
    postalCode: '',
    courts: null,
    courtsNote: { zh: '排期而定，市政价目表里没有羽毛球条目', en: 'Depends on the schedule; no badminton line in the city price list' },
    note: {
      zh: '和 Liikuntamylly 一样是共用场馆，羽毛球得和其他运动协调排期。能不能打取决于那周怎么排的。',
      en: 'A shared hall like Liikuntamylly — badminton has to be scheduled around the other sports. Whether you can play depends on how that week was allocated.',
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
    // 常规季价（10.8.2026–15.6.2027）。夏季价目到 9.8.2026 为止，两套不一样，
    // 所以生效日期直接写进价格字段——VENUES_VERIFIED 的月份粒度盖不住这个。
    price: {
      zh: '（8/10 起常规季）16 点前 17 €（固定时段 16 €、折扣组 13 €）；16–21 点 30 €；21–22 点 28 €。租拍 4 €、球 1 €',
      en: '(regular season from 10 Aug) €17 before 16:00 (€16 standing slot, €13 discount groups); €30 at 16:00–21:00; €28 at 21:00–22:00. Racket €4, shuttle €1',
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

  {
    id: 'unisport-kumpula',
    name: 'UniSport Kumpula',
    tier: 'private',
    city: 'Helsinki',
    streetAddress: 'Väinö Auerinkatu 11',
    postalCode: '00560',
    courts: 15,
    // 订到手的是三分之一个场馆（约 5 片），不是一片。价格必须带着这个单位，
    // 否则 17 € 会被读成「一片场 17 €」，两个人去打完全不是这个数。
    courtsNote: { zh: '整馆 15 片，按 1/3 场馆为单位预订', en: '15 courts in the hall, booked in thirds' },
    price: {
      zh: '每 1/3 场馆：平日 7–16 与每天 21–23 点 17 €；周五 16–21 与周六 22 €；周日至周四 16–21 点 28 €。在校学生 10 / 12 / 23 €，教职工 11 / 13 / 24 €',
      en: 'Per third of the hall: €17 Sun–Fri 7:00–16:00 and daily 21:00–23:00; €22 Fri 16:00–21:00 and Sat; €28 Sun–Thu 16:00–21:00. Students €10 / 12 / 23, staff €11 / 13 / 24',
    },
    booking: 'unisport.fi',
    note: {
      zh: '非会员照样能订，价目表里直接列了对外价——不需要是学生。全区第二大的馆，学生 10 €/h 的白天场是学生的最优解。UniSport 的羽毛球只有 Kumpula 这一处，Otaniemi 没有。',
      en: 'Open to non-members: the price list has a public rate, you do not need to be a student. Second largest hall in the region, and the €10 student daytime rate is the best deal any student will find. Kumpula is UniSport’s only badminton location — Otaniemi has none.',
    },
  },
  {
    id: 'forever-matinkyla',
    name: 'Forever Matinkylä',
    tier: 'private',
    city: 'Espoo',
    streetAddress: 'Matinkartanontie 1',
    postalCode: '02230',
    courts: 12,
    price: {
      zh: '平日 6–16 点 18 €（学生与退休 15 €）；平日 16–23 点及周末全天 27 €',
      en: '€18 weekdays 6:00–16:00 (students and pensioners €15); €27 weekdays 16:00–23:00 and all weekend',
    },
    booking: 'foreverclub.goactivebooking.com',
    coachHere: true,
    note: {
      zh: '非会员同价，会员拿的是折扣不是准入：平日 9–15 点免费、其余时段五折。',
      en: 'Non-members pay the same rate — membership is a discount, not a gate: free on weekdays 9:00–15:00 and half price otherwise.',
    },
  },
  {
    id: 'forever-hiekkaharju',
    name: 'Forever Hiekkaharju',
    tier: 'private',
    city: 'Vantaa',
    streetAddress: 'Tennistie 3',
    postalCode: '01370',
    courts: 5,
    courtsNote: { zh: '4 片双打线 + 1 片单打线', en: '4 with doubles lines, 1 with singles lines' },
    price: {
      zh: '平日 6–16 点 18 €（学生与退休 15 €）；平日 16–23 点及周末全天 27 €',
      en: '€18 weekdays 6:00–16:00 (students and pensioners €15); €27 weekdays 16:00–23:00 and all weekend',
    },
    booking: 'foreverclub.goactivebooking.com',
    coachHere: true,
    note: { zh: '和 Matinkylä 同价同政策。每日 5–23 点，免费停车。', en: 'Same rates and policy as Matinkylä. Open 05:00–23:00 daily, free parking.' },
  },
];

export function venuesByTier(tier: VenueTier) {
  return venues.filter((venue) => venue.tier === tier);
}

/**
 * 极简层：每家一句，大纲粒度。
 *
 * 上面每家的 `note` 是查证时留下的**全细节版**——为什么这家值得去、哪个时段
 * 是坑、政策怎么写的。那一层不删，以后写文章、答疑、做对比页都要用。
 * 这里是它的**极简版**，只留一句会改变「去不去」的话，页面表格渲染这一层。
 *
 * 两层分开而不是把 note 改短：改短就等于把查证结果扔了，而查证是这一页唯一
 * 的护城河。没有摘要的场馆自动回落到 note——短到不需要压缩的就别硬造一层。
 */
const summaries: Record<string, Bilingual> = {
  ruskeasuo: { zh: '白天大片空着，傍晚被手球俱乐部占满', en: 'Wide open in the daytime, handball clubs take the evenings' },
  liikuntamylly: { zh: '只有周一、周四晚有羽毛球时段', en: 'Badminton slots on Monday and Thursday evenings only' },
  kisahalli: { zh: '共用场馆，能不能打取决于那周排期', en: 'Shared hall — depends on how the week was allocated' },
  esport: { zh: '场地最多；晚间全区最贵且无学生价', en: 'Most courts; priciest evenings in the region, no student rate' },
  talihalli: { zh: '带孩子首选，见下方学生价与家庭价', en: 'Best with kids — see the schoolkid and family rates below' },
  rajakyla: { zh: '白天最便宜；2026 年现场不能订也不能付', en: 'Cheapest daytime; through 2026 you cannot book or pay on site' },
  meilahti: { zh: '羽协合作馆，多支俱乐部在此训练；不需要 UniSport 会员', en: 'Association partner hall, several clubs train here; no UniSport membership needed' },
  'smash-center': { zh: '22 点后 8,50 € 是全区最便宜的一小时；有发球机', en: 'The €8.50 late hour is the cheapest around; has a shuttle machine' },
  targa: { zh: '16 点前家庭时段含拍含球', en: 'Family slots before 16:00 include rackets and shuttles' },
  lltk: { zh: '6 月 29 日至 7 月 26 日整段关闭', en: 'Closed entirely 29 Jun – 26 Jul' },
  'unisport-kumpula': { zh: '非会员照样能订；全区第二大', en: 'Open to non-members; second largest hall in the region' },
  'forever-matinkyla': { zh: '非会员同价，会员是折扣不是门槛', en: 'Non-members pay the same; membership is a discount, not a gate' },
  'forever-hiekkaharju': { zh: '和 Matinkylä 同价同政策', en: 'Same rates and policy as Matinkylä' },
};

/** 表格用极简层；没写摘要的回落到全细节 note。 */
export function venueSummary(venue: Venue): Bilingual | undefined {
  return summaries[venue.id] ?? venue.note;
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
