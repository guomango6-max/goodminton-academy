import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleDetail from '../../../components/ArticleDetail';
import { getArticleBySlug, getPublishedArticles } from '../../../../lib/articles.ts';
import { articlePath, localizedMetadata } from '../../../../lib/article-routes.ts';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPublishedArticles()).map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  return localizedMetadata({
    lang: 'en',
    title: article.enTitle,
    description: article.enExcerpt,
    zhPath: articlePath(slug, 'zh'),
    enPath: articlePath(slug, 'en'),
    image: article.image,
    publishedTime: article.date,
  });
}

export default async function EnArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const related = (await getPublishedArticles()).filter((item) => item.slug !== slug).slice(0, 4);
  return <ArticleDetail article={article} lang="en" related={related} />;
}
