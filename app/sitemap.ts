import type { MetadataRoute } from "next";
import { siteProfile } from "../lib/site-profile";
import { getPublishedArticles } from "../lib/articles.ts";
import { articleIndexPath, articlePath, homePath } from "../lib/article-routes.ts";

const siteUrl = siteProfile.url;

// 这里刻意**不**收 /forum 和 /student。
//
// 它们不是被漏掉的，是 robots.ts 明确 disallow 的，理由写在那个文件里：
// 学员总结虽然匿名，但在这么小的圈子里，「等级 + 一个具体的卡点」经常足够
// 让同学认出是谁；学员写这些的时候预期的读者是同学，不是搜索引擎。
//
// sitemap 和 robots 必须一致。把 disallow 的页面塞进 sitemap 只会制造矛盾
// 信号，而且是在推翻一个有理由的隐私决定——那是产品决策，不是 SEO 决策。
//
// 若哪天决定公开论坛，正确顺序是：先拿到学员的明确同意 → 改 robots →
// 再回来加进这里。
//
// 也**不**收 33 篇 autoHotArticle。它们是抓取脚本产出的选题线索（一串外链加
// 一句写作方向），根本没有独立页面，判断依据见 lib/articles 的 isPublishable。

/** 中英两条同内容的 URL 互相声明 hreflang，让搜索引擎知道它们是同一页的两个语言版本。 */
function localizedEntry(zhPath: string, enPath: string, lastModified: Date, priority: number) {
  const absolute = (path: string) => new URL(path, siteUrl).toString();
  const languages = { "zh-CN": absolute(zhPath), en: absolute(enPath) };

  return [
    {
      url: absolute(zhPath),
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages },
    },
    {
      url: absolute(enPath),
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages },
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const articles = await getPublishedArticles();
  const newestArticle = articles[0] ? new Date(articles[0].date) : now;

  return [
    ...localizedEntry(homePath("zh"), homePath("en"), now, 1),
    ...localizedEntry(articleIndexPath("zh"), articleIndexPath("en"), newestArticle, 0.8),
    // 场馆名录：本站唯一一页别人有理由主动引用的内容，优先级仅次于首页。
    ...localizedEntry("/venues", "/en/venues", now, 0.9),
    ...articles.flatMap((article) =>
      localizedEntry(
        articlePath(article.slug, "zh"),
        articlePath(article.slug, "en"),
        new Date(article.date),
        0.6,
      ),
    ),
    {
      url: new URL("/friend", siteUrl).toString(),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
