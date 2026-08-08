// 文章页与文章列表页共用的外框（服务端组件，不带任何客户端状态）。
//
// 刻意不复用首页那个 header：首页的导航条挂着移动端抽屉、学员登录框和语言
// 切换的 localStorage 逻辑，全套是客户端的。文章页要的是能被抓取的静态 HTML，
// 把那套拖进来只会让整棵树重新变成 client component。
//
// 语言切换在这里是一个真链接（/articles/x ↔ /en/articles/x），不是本地开关——
// 这正是这次改造的重点：英文得有自己的地址。

import Link from 'next/link';
import ContactFooter from './ContactFooter';
import type { Lang } from '../../lib/articles.ts';
import { homePath } from '../../lib/article-routes.ts';

const copy = {
  zh: {
    home: '回首页',
    articles: '训练栏目',
    switch: 'EN',
    switchLabel: 'Read in English',
  },
  en: {
    home: 'Home',
    articles: 'Training notes',
    switch: '中文',
    switchLabel: '切换到中文',
  },
} as const;

export default function ArticleChrome({
  lang,
  counterpartHref,
  children,
}: {
  lang: Lang;
  /** 另一种语言下的同一个页面。 */
  counterpartHref: string;
  children: React.ReactNode;
}) {
  const t = copy[lang];

  return (
    // lang 挂在这一层：根 layout 的 <html lang> 对全站是写死的中文，而这棵子树
    // 在 /en 下是英文。屏幕阅读器按最近的 lang 取，读音才是对的。
    <div
      lang={lang === 'en' ? 'en' : 'zh-CN'}
      className={`min-h-screen overflow-x-hidden bg-[#fbfaf6] text-[#21242c] ${lang === 'zh' ? 'goodminton-zh' : ''}`}
    >
      <header className="border-b border-[#e6e1d4] bg-white/70">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-4 px-5 py-4">
          <Link href={homePath(lang)} className="text-[15px] font-semibold tracking-[-0.01em] text-[#101820]">
            Goodminton Academy
          </Link>
          <nav className="flex items-center gap-4 text-[14px] font-semibold">
            <Link href={homePath(lang)} className="text-[#52636b] hover:text-[#16845f]">
              {t.home}
            </Link>
            <Link href={`${lang === 'en' ? '/en' : ''}/articles`} className="text-[#52636b] hover:text-[#16845f]">
              {t.articles}
            </Link>
            <Link
              href={counterpartHref}
              hrefLang={lang === 'en' ? 'zh-CN' : 'en'}
              aria-label={t.switchLabel}
              className="rounded-[6px] border border-[#cfe8d9] px-2.5 py-1 text-[13px] text-[#1f4a38] hover:border-[#14bf96]"
            >
              {t.switch}
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <ContactFooter lang={lang} />
    </div>
  );
}
