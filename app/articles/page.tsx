import type { Metadata } from 'next';
import ArticleIndex from '../components/ArticleIndex';
import { getPublishedArticles } from '../../lib/articles.ts';
import { articleIndexPath, localizedMetadata } from '../../lib/article-routes.ts';

export const metadata: Metadata = localizedMetadata({
  lang: 'zh',
  title: '训练栏目',
  description: '羽毛球技术、战术、课后反馈和比赛复盘的短文章，由 Goodminton Academy 教练撰写。',
  zhPath: articleIndexPath('zh'),
  enPath: articleIndexPath('en'),
});

export default async function ArticlesPage() {
  return <ArticleIndex articles={await getPublishedArticles()} lang="zh" />;
}
