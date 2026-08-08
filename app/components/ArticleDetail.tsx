// 单篇文章的正文页。服务端渲染，全文进 HTML——这批文章此前唯一的露出是首页
// 上一张卡片和一句摘要，没有任何 URL 承载正文。

import Link from 'next/link';
import ArticleChrome from './ArticleChrome';
import { parseArticleBody, type ArticleBlock, type ArticleRecord, type InlineNode, type Lang } from '../../lib/articles.ts';
import { articleIndexPath, articlePath } from '../../lib/article-routes.ts';

const copy = {
  zh: { back: '训练栏目', more: '更多文章' },
  en: { back: 'Training notes', more: 'More notes' },
} as const;

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) =>
        'href' in node ? (
          // 抓来的来源链接一律 nofollow：这些是别人的内容，本站只是在标注出处，
          // 不为它们背书，也不想把权重导出去。
          <a
            key={index}
            href={node.href}
            rel="nofollow noopener noreferrer"
            target="_blank"
            className="text-[#16845f] underline decoration-[#bfe3d2] underline-offset-4 hover:decoration-[#16845f]"
          >
            {node.text}
          </a>
        ) : (
          <span key={index}>{node.text}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  if (block.type === 'list') {
    return (
      <ul className="mt-5 list-disc space-y-2 pl-5 text-[16px] leading-8 text-[#52636b] marker:text-[#a9bcb2]">
        {block.items.map((item, index) => (
          <li key={index} className="cjk-wrap">
            <Inline nodes={item} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="cjk-wrap mt-5 text-[16px] leading-8 text-[#52636b]">
      <Inline nodes={block.nodes} />
    </p>
  );
}

export default function ArticleDetail({
  article,
  lang,
  related,
}: {
  article: ArticleRecord;
  lang: Lang;
  related: ArticleRecord[];
}) {
  const t = copy[lang];
  const isEn = lang === 'en';
  const blocks = parseArticleBody(article.body);

  return (
    <ArticleChrome lang={lang} counterpartHref={articlePath(article.slug, isEn ? 'zh' : 'en')}>
      <main className="mx-auto w-full max-w-[860px] px-5 py-12">
        <Link
          href={articleIndexPath(lang)}
          className="link-arrow inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#16845f] hover:text-[#0e5a40]"
        >
          <span aria-hidden="true">←</span>
          {t.back}
        </Link>

        <article className="mt-7">
          <p className="text-[13px] font-semibold text-[#16845f]">{isEn ? article.enCategory : article.zhCategory}</p>
          <h1 className="cjk-wrap mt-3 text-[34px] font-semibold leading-tight tracking-[-0.015em] text-[#101820] sm:text-[40px]">
            {isEn ? article.enTitle : article.zhTitle}
          </h1>
          <time dateTime={article.date} className="mt-4 block text-[14px] font-semibold text-[#64737a]">
            {isEn ? article.enDate : article.zhDate}
          </time>
          <p className="cjk-wrap mt-6 border-l-2 border-[#cfe8d9] pl-4 text-[17px] leading-8 text-[#3d4f57]">
            {isEn ? article.enExcerpt : article.zhExcerpt}
          </p>

          <div className="mt-8">
            {blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        </article>

        {related.length ? (
          <section className="mt-14 border-t border-[#e6e1d4] pt-8">
            <h2 className="text-[20px] font-semibold text-[#101820]">{t.more}</h2>
            <ul className="mt-5 space-y-4">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={articlePath(item.slug, lang)}
                    className="cjk-wrap text-[17px] font-semibold leading-snug text-[#1f4a38] hover:text-[#16845f]"
                  >
                    {isEn ? item.enTitle : item.zhTitle}
                  </Link>
                  <p className="mt-1 text-[13px] font-semibold text-[#64737a]">
                    {isEn ? item.enDate : item.zhDate}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </ArticleChrome>
  );
}
