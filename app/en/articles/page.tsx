import type { Metadata } from 'next';
import ArticleIndex from '../../components/ArticleIndex';
import { getPublishedArticles } from '../../../lib/articles.ts';
import { articleIndexPath, localizedMetadata } from '../../../lib/article-routes.ts';

export const metadata: Metadata = localizedMetadata({
  lang: 'en',
  title: 'Training notes',
  description:
    'Short badminton notes on technique, tactics, post-lesson feedback and match review, written by Goodminton Academy coaches in Finland.',
  zhPath: articleIndexPath('zh'),
  enPath: articleIndexPath('en'),
});

export default async function EnArticlesPage() {
  return <ArticleIndex articles={await getPublishedArticles()} lang="en" />;
}
