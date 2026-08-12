// 中英两套 URL 的路径与 metadata 生成。
//
// 之前语言只是客户端的一个 localStorage 开关：`/` 和 `/?lang=en` 服务端返回的
// 是同一份中文 HTML，英文只在 hydration 之后才出现。对搜索引擎来说英文版
// 等于不存在——而 layout 里那批 badminton coach Helsinki / sulkapallovalmennus
// 关键词唯一能落地的页面，恰恰是一个中文页面。
//
// 所以英文有了自己的路径前缀 /en。两侧互相用 hreflang 指认，canonical 各指自己。
// x-default 给中文：主力客群是在芬兰的华人。

import type { Metadata } from 'next';
import type { Lang } from './articles.ts';

export const LANG_PREFIX: Record<Lang, string> = { zh: '', en: '/en' };

export function homePath(lang: Lang) {
  return lang === 'en' ? '/en' : '/';
}

export function articleIndexPath(lang: Lang) {
  return `${LANG_PREFIX[lang]}/articles`;
}

export function articlePath(slug: string, lang: Lang) {
  return `${LANG_PREFIX[lang]}/articles/${slug}`;
}

/**
 * 一组中英对照路径的 alternates。
 *
 * canonical 指向当前语言自己的 URL——两个语言版本是各自独立的页面，不是副本，
 * 互指 canonical 会让其中一个被折叠掉。
 */
export function localizedAlternates(lang: Lang, zhPath: string, enPath: string) {
  return {
    canonical: lang === 'en' ? enPath : zhPath,
    languages: {
      'zh-CN': zhPath,
      en: enPath,
      'x-default': zhPath,
    },
  };
}

export function localizedMetadata(options: {
  lang: Lang;
  title: string;
  description: string;
  zhPath: string;
  enPath: string;
  image?: string;
  publishedTime?: string;
}): Metadata {
  const { lang, title, description, zhPath, enPath, image, publishedTime } = options;
  const path = lang === 'en' ? enPath : zhPath;

  return {
    title,
    description,
    alternates: localizedAlternates(lang, zhPath, enPath),
    openGraph: {
      type: publishedTime ? 'article' : 'website',
      title,
      description,
      url: path,
      siteName: 'Goodminton Academy',
      locale: lang === 'en' ? 'en_US' : 'zh_CN',
      publishedTime,
      // 不传 image 时必须回退到站点主图，不能给 undefined：
      // Next.js 里页面的 openGraph 会**整体替换**父级的，写了 openGraph 却不写
      // images，等于把 layout 里的 hero 图抹掉。结果是 /lessons（广告落地页）、
      // /venues、/en 和所有没配图的文章分享出去都是无图卡片。
      images: [{ url: image || '/badminton-hero.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
