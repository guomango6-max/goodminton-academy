// 文章列表页。首页只放三张卡，成稿再多也露不出来；这里是那批文章的入口，
// 也是 sitemap 里除首页之外唯一的枢纽页。

import Link from 'next/link';
import ArticleChrome from './ArticleChrome';
import type { ArticleRecord, Lang } from '../../lib/articles.ts';
import { articleIndexPath, articlePath } from '../../lib/article-routes.ts';

const copy = {
  zh: {
    title: '训练栏目',
    intro: '技术、战术、反馈和复盘的短文章。写给正在练的人，也写给下一次训练。',
    read: '继续阅读',
    empty: '还没有文章。',
  },
  en: {
    title: 'Training notes',
    intro:
      'Short notes on technique, tactics, feedback and match review — written for players mid-season, and for the next session on court.',
    read: 'Read more',
    empty: 'No notes yet.',
  },
} as const;

export default function ArticleIndex({ articles, lang }: { articles: ArticleRecord[]; lang: Lang }) {
  const t = copy[lang];
  const isEn = lang === 'en';

  return (
    <ArticleChrome lang={lang} counterpartHref={articleIndexPath(isEn ? 'zh' : 'en')}>
      <main className="mx-auto w-full max-w-[860px] px-5 py-12">
        <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.015em] text-[#101820]">{t.title}</h1>
        <p className="cjk-wrap mt-4 max-w-[620px] text-[16px] leading-8 text-[#52636b]">{t.intro}</p>

        {articles.length === 0 ? (
          <p className="mt-10 text-[16px] text-[#64737a]">{t.empty}</p>
        ) : (
          <div className="mt-10 space-y-9">
            {articles.map((article) => (
              <article key={article.slug} className="border-t border-[#d8d0bf] pt-6">
                <p className="text-[13px] font-semibold text-[#16845f]">
                  {isEn ? article.enCategory : article.zhCategory}
                </p>
                <h2 className="cjk-wrap mt-3 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-[#101820]">
                  <Link href={articlePath(article.slug, lang)} className="hover:text-[#16845f]">
                    {isEn ? article.enTitle : article.zhTitle}
                  </Link>
                </h2>
                <time dateTime={article.date} className="mt-3 block text-[13px] font-semibold text-[#64737a]">
                  {isEn ? article.enDate : article.zhDate}
                </time>
                <p className="cjk-wrap mt-4 text-[16px] leading-7 text-[#52636b]">
                  {isEn ? article.enExcerpt : article.zhExcerpt}
                </p>
                <Link
                  href={articlePath(article.slug, lang)}
                  className="link-arrow mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#16845f] hover:text-[#0e5a40]"
                >
                  {t.read}
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </ArticleChrome>
  );
}
