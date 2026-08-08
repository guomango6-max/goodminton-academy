// 英文首页。
//
// 这是这次改造的核心一页：在此之前，英文只是首页上一个 localStorage 开关，
// 服务端对 /?lang=en 返回的仍是中文 HTML，英文要等 hydration 才出现。也就是说
// layout 里那批 badminton coach Helsinki / sulkapallovalmennus 关键词，唯一能
// 落地的页面是一个中文页面。现在英文有自己的 URL、自己的 canonical、自己的
// 服务端 HTML，并和中文页互指 hreflang。

import type { Metadata } from 'next';
import HomeClient from '../HomeClient';
import { getHomeArticleCards } from '../../lib/articles.ts';
import { localizedMetadata } from '../../lib/article-routes.ts';
import { siteProfile } from '../../lib/site-profile';

export const metadata: Metadata = localizedMetadata({
  lang: 'en',
  title: 'Badminton Coaching in Helsinki, Espoo & Vantaa',
  description: siteProfile.foundingDescription.en,
  zhPath: '/',
  enPath: '/en',
});

export default async function EnHomePage() {
  return <HomeClient articles={await getHomeArticleCards()} forcedLang="en" />;
}
