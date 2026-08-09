import type { Metadata } from 'next';
import ArticleChrome from '../components/ArticleChrome';
import VenuesView from '../components/VenuesView';
import { localizedMetadata } from '../../lib/article-routes.ts';
import { buildVenuesJsonLd } from '../../lib/venues.ts';
import { siteProfile } from '../../lib/site-profile';

export const metadata: Metadata = localizedMetadata({
  lang: 'zh',
  // 标题里用「赫尔辛基」而不是「首都区」——没有人搜「首都区」。
  // 埃斯波和万塔在描述里覆盖，标题的头部位置留给最大的那个搜索词。
  title: '赫尔辛基羽毛球场馆：19 家价格与预订',
  description:
    '赫尔辛基、埃斯波、万塔 19 处羽毛球场馆：场地数、价格、预订方式。市政馆散客 3,50 €／人不限时，私营馆 8,50–38 €／小时——UniSport 与 Forever 也在其中，非会员照样能订。',
  zhPath: '/venues',
  enPath: '/en/venues',
});

export default function VenuesPage() {
  return (
    <ArticleChrome lang="zh" counterpartHref="/en/venues">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildVenuesJsonLd(siteProfile.url, '/venues')) }}
      />
      <VenuesView lang="zh" />
    </ArticleChrome>
  );
}
