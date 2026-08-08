import type { Metadata } from 'next';
import ArticleChrome from '../../components/ArticleChrome';
import VenuesView from '../../components/VenuesView';
import { localizedMetadata } from '../../../lib/article-routes.ts';
import { buildVenuesJsonLd } from '../../../lib/venues.ts';
import { siteProfile } from '../../../lib/site-profile';

export const metadata: Metadata = localizedMetadata({
  lang: 'en',
  title: 'Badminton venues in Helsinki, Espoo & Vantaa',
  description:
    'All 25 badminton venues in the Helsinki capital region: courts, prices and booking. City halls from €3.50 per person, private halls €8.50–41 per hour, plus which ones are members-only.',
  zhPath: '/venues',
  enPath: '/en/venues',
});

export default function EnVenuesPage() {
  return (
    <ArticleChrome lang="en" counterpartHref="/venues">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildVenuesJsonLd(siteProfile.url, '/en/venues')) }}
      />
      <VenuesView lang="en" />
    </ArticleChrome>
  );
}
