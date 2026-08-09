// 站点的「机器可读档案」——给搜索引擎和 AI 检索用的唯一事实来源。
//
// 为什么单独一个文件：这些字段会同时出现在 metadata、JSON-LD 和 sitemap 里。
// 散着写迟早会出现「元数据说赫尔辛基、结构化数据说别的城市」这种自相矛盾，
// 而自相矛盾的本地信息对检索的伤害比信息缺失更大。
//
// 定位背景：一个七年没维护的美团档案，至今仍在被 AI 读取并转化成真实咨询。
// 喂养那条链路的不是内容，是「平台上一份结构化的档案 + 真实评价」。这个文件
// 是本站这一侧的等价物。
//
// ⚠️ 未填的字段一律留空，不要塞占位值。
//    宁可缺信息，也不要给错信息——错的地址会被 AI 原样引用出去，
//    比没有地址糟糕得多。空字段会被自动从输出里剔除。

export type Venue = {
  streetAddress: string;
  city: string;
  postalCode: string;
  /** 场馆名。留空时回退成「机构名 — 城市」。 */
  name: string;
  latitude: string;
  longitude: string;
};

export const siteProfile = {
  name: "Goodminton Academy",
  url: "https://goodminton.fi",

  // 已核实：站点上公开使用的联系方式。
  telephone: "+358413134358",
  whatsapp: "https://wa.me/358413134358",

  // 服务范围是首都圈，不是单一城市：两个场馆分别在 Vantaa 和 Espoo，
  // 而找教练的人多半按「赫尔辛基」搜。三个都列出来才覆盖得住。
  city: "Helsinki",
  areaCities: ["Helsinki", "Espoo", "Vantaa"],
  country: "FI",
  countryName: "Finland",

  // 训练场馆。两个都列出来——AI 回答「XX 区哪里能学羽毛球」时是按地点匹配的，
  // 少列一个就等于在那一片不存在。
  venues: [
    {
      streetAddress: "Tennistie 3",
      city: "Vantaa",
      postalCode: "01370",
      name: "Forever Hiekkaharju",
      latitude: "",
      longitude: "",
    },
    {
      streetAddress: "Matinkartanontie 1",
      city: "Espoo",
      postalCode: "02230",
      name: "Forever Matinkylä",
      latitude: "",
      longitude: "",
    },
    // 标成 Venue[] 而不是让 as const 收窄成字面量：否则新增一个没填 name 的
    // 场馆时，TS 会认为 name 恒为真、回退分支是死代码。
  ] as Venue[],

  // ⬇️ 待填。没填的会被自动省略，不会输出空字段。
  // 2026-08-09 用户确认：每天 10:00–20:00。schema.org 的格式是「日期区间 时段」，
  // Mo-Su 表示每天。这一条同时是 Facebook 主页上的营业时间，两处要一致——
  // 商家信息在不同来源之间打架，对检索的伤害比信息缺失更大。
  openingHours: ["Mo-Su 10:00-20:00"] as string[],

  // sameAs 的作用是宣告「这个网站和这些账号是同一个实体」。不声明，Google 和
  // AI 就把它们当成互不相干的东西，主页攒的信号一点也传不到站点上。
  facebook: "https://www.facebook.com/profile.php?id=61592596510432",

  // Google Business Profile 建好之后把链接放这里，一并进 sameAs——
  // 这是让「评价」这项资产被 AI 读到的关键一环。
  // 2026-08-09 状态：视频验证的「授权证明」一步需要商业登记，暂时走不通，先空着。
  googleBusinessProfile: "",
  xiaohongshu: "",

  languages: ["zh-CN", "en"],
  sport: "Badminton",
  foundingDescription: {
    zh: "面向成人与青少年的羽毛球训练，提供可追踪的学员成长图谱、课后反馈与比赛复盘。",
    en: "Badminton coaching for adults and juniors, with a trackable student progress map, post-lesson feedback and match reviews.",
  },
} as const;

type JsonLdValue = string | number | boolean | JsonLd | JsonLdValue[];
type JsonLd = { [key: string]: JsonLdValue | undefined };

/** 递归剔除空字符串、空数组和 undefined，避免把空字段发出去。 */
function prune(value: JsonLdValue): JsonLdValue | undefined {
  if (Array.isArray(value)) {
    const cleaned = value.map(prune).filter((item): item is JsonLdValue => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (value && typeof value === "object") {
    const cleaned: JsonLd = {};
    for (const [key, item] of Object.entries(value)) {
      const next = item === undefined ? undefined : prune(item);
      if (next !== undefined) cleaned[key] = next;
    }
    // 只剩 @type 的对象等于没有内容，一并剔除。
    return Object.keys(cleaned).filter((k) => k !== "@type").length > 0 ? cleaned : undefined;
  }
  if (typeof value === "string") return value.trim() ? value : undefined;
  return value;
}

/**
 * 本地生意的结构化数据。
 *
 * 用 SportsOrganization 当主体、两个 SportsActivityLocation 当场地节点。
 * 不把机构和场地压成一个节点，是因为有两个场馆：压成一个就必须扔掉一个地址，
 * 而 AI 回答「Espoo 哪里能学羽毛球」时是按地点匹配的，少一个等于那一片不存在。
 */
export function buildLocalBusinessJsonLd() {
  const p = siteProfile;

  const locations = p.venues.map((venue, index) => ({
    "@type": "SportsActivityLocation",
    "@id": `${p.url}/#venue-${index + 1}`,
    name: venue.name || `${p.name} — ${venue.city}`,
    sport: p.sport,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.streetAddress,
      addressLocality: venue.city,
      postalCode: venue.postalCode,
      addressCountry: p.country,
    },
    geo:
      venue.latitude && venue.longitude
        ? { "@type": "GeoCoordinates", latitude: venue.latitude, longitude: venue.longitude }
        : undefined,
    openingHours: [...p.openingHours],
  }));

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${p.url}/#organization`,
    name: p.name,
    alternateName: "Goodminton 羽毛球学院",
    url: p.url,
    description: p.foundingDescription.en,
    telephone: p.telephone,
    sport: p.sport,
    availableLanguage: [...p.languages],
    knowsLanguage: [...p.languages],
    image: `${p.url}/badminton-hero.png`,
    location: locations as unknown as JsonLdValue,
    areaServed: p.areaCities.map((name) => ({
      "@type": "City",
      name,
      containedInPlace: { "@type": "Country", name: p.countryName },
    })),
    sameAs: [p.facebook, p.googleBusinessProfile, p.xiaohongshu, p.whatsapp],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Badminton coaching — adults",
          serviceType: "Badminton coaching",
          areaServed: [...p.areaCities],
          availableLanguage: [...p.languages],
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Badminton coaching — juniors",
          serviceType: "Badminton coaching",
          areaServed: [...p.areaCities],
          availableLanguage: [...p.languages],
        },
      },
    ],
  };

  return prune(jsonLd) as JsonLd;
}

/** 站点本身（用于 sitelinks 搜索框和「这是什么网站」类问答）。 */
export function buildWebSiteJsonLd() {
  const p = siteProfile;
  return prune({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${p.url}/#website`,
    url: p.url,
    name: p.name,
    description: p.foundingDescription.zh,
    inLanguage: [...p.languages],
    publisher: { "@id": `${p.url}/#organization` },
  }) as JsonLd;
}
