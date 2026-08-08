import type { Metadata } from 'next';
import ArticleChrome from '../components/ArticleChrome';
import VenuesView from '../components/VenuesView';
import { localizedMetadata } from '../../lib/article-routes.ts';
import { buildVenuesJsonLd } from '../../lib/venues.ts';
import { siteProfile } from '../../lib/site-profile';

export const metadata: Metadata = localizedMetadata({
  lang: 'zh',
  title: '首都区羽毛球场馆完全指南',
  description:
    '赫尔辛基、埃斯波、万塔 25 处羽毛球场馆：场地数、价格、预订方式。市政馆散客 3,50 €不限时，私营馆 8,50–41 €／小时，另有会员制场馆一览。',
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
