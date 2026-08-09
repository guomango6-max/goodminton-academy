import type { Metadata } from 'next';
import LessonsLanding from '../../components/LessonsLanding';
import { localizedMetadata } from '../../../lib/article-routes.ts';

export const metadata: Metadata = localizedMetadata({
  lang: 'en',
  title: 'Badminton lessons in Helsinki, Espoo & Vantaa',
  description:
    'Badminton coaching for adults and juniors: €40 for a 60-minute one-to-one, €25 for a 90-minute small group. Taught in English or Chinese, 20+ years of coaching, written feedback every lesson. Available daily 10:00–20:00.',
  zhPath: '/lessons',
  enPath: '/en/lessons',
});

export default function EnLessonsPage() {
  return <LessonsLanding lang="en" />;
}
