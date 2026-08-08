// 首页的服务端外壳。文章在这里读，随 HTML 一起发出去。
//
// 页面主体仍是 HomeClient（登录框、抽屉、展开卡片都要客户端状态），但「首页上
// 有哪三篇文章」这件事不该等到 hydration 之后才成立——爬虫和 AI 抓取器只看
// 第一份 HTML。

import HomeClient from './HomeClient';
import { getHomeArticleCards } from '../lib/articles.ts';

export default async function Page() {
  return <HomeClient articles={await getHomeArticleCards()} />;
}
