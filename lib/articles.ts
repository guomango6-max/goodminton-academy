// content/articles 的唯一读取入口。
//
// 为什么要有这个文件：这批 md 之前只被 app/api/articles 读，而首页把三条文章
// 写死成常量当 fallback，再用 useEffect 去 API 换掉。结果是服务端 HTML 里永远
// 是那份写死的旧副本——爬虫和 AI 抓取器看到的首页内容停在五月。sitemap 又完全
// 不知道这批文件存在。三个地方各有各的真相，只有浏览器里那份是对的。
//
// 现在 API、首页、文章页、sitemap 都从这里读。
//
// ⚠️ 「哪些文章配拥有自己的 URL」是这里最重要的一条判断，见 isPublishable。

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type Lang = 'zh' | 'en';

/** 首页/列表用的卡片形状。跟 /api/articles 的历史输出保持一致。 */
export type ArticleCard = {
  title: string;
  date: string;
  category: string;
  excerpt: string;
  image: string;
  href?: string;
};

export type ArticleRecord = {
  slug: string;
  date: string;
  image: string;
  href: string;
  placement?: string;
  status?: string;
  sourceType?: string;
  /** 由 fetch-hot-articles.mjs 自动生成的「热点线索」，不是成稿。 */
  isAuto: boolean;
  zhTitle: string;
  enTitle: string;
  zhDate: string;
  enDate: string;
  zhCategory: string;
  enCategory: string;
  zhExcerpt: string;
  enExcerpt: string;
  zhBody: string;
  enBody: string;
};

export const ENGLISH_BODY_SEPARATOR = '<!-- goodminton:en -->';

export function splitLocalizedBody(body: string) {
  const separatorIndex = body.indexOf(ENGLISH_BODY_SEPARATOR);
  if (separatorIndex === -1) return { zh: body.trim(), en: '' };

  return {
    zh: body.slice(0, separatorIndex).trim(),
    en: body.slice(separatorIndex + ENGLISH_BODY_SEPARATOR.length).trim(),
  };
}

const articlesDirectory = path.join(process.cwd(), 'content', 'articles');

const REQUIRED_KEYS = [
  'slug',
  'date',
  'image',
  'zhTitle',
  'enTitle',
  'zhDate',
  'enDate',
  'zhCategory',
  'enCategory',
  'zhExcerpt',
  'enExcerpt',
] as const;

function parseFrontmatter(fileContent: string) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: {} as Record<string, string>, body: '' };

  const frontmatter = match[1].split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return acc;

    const key = line.slice(0, separatorIndex).trim();
    acc[key] = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    return acc;
  }, {});

  return { frontmatter, body: fileContent.slice(match[0].length).trim() };
}

function toRecord(frontmatter: Record<string, string>, body: string): ArticleRecord | null {
  if (!REQUIRED_KEYS.every((key) => Boolean(frontmatter[key]))) return null;

  const localizedBody = splitLocalizedBody(body);

  return {
    slug: frontmatter.slug,
    date: frontmatter.date,
    image: frontmatter.image,
    href: frontmatter.href || '#student-portal',
    placement: frontmatter.placement,
    status: frontmatter.status,
    sourceType: frontmatter.sourceType,
    isAuto: frontmatter.autoHotArticle === 'true',
    zhTitle: frontmatter.zhTitle,
    enTitle: frontmatter.enTitle,
    zhDate: frontmatter.zhDate,
    enDate: frontmatter.enDate,
    zhCategory: frontmatter.zhCategory,
    enCategory: frontmatter.enCategory,
    zhExcerpt: frontmatter.zhExcerpt,
    enExcerpt: frontmatter.enExcerpt,
    zhBody: localizedBody.zh,
    // 自动线索卡没有详情页；旧手写文章在迁移期间保留中文兜底，测试会阻止新遗漏。
    enBody: localizedBody.en || localizedBody.zh,
  };
}

/**
 * 能不能拥有一个自己的、可被索引的 URL。
 *
 * 只有手写成稿可以。那 33 篇 autoHotArticle 是抓取脚本产出的线索卡：正文是
 * 一串外链加一句「中文写作方向：……」，是写给我自己看的选题提示。把它们做成
 * 33 个页面推给搜索引擎，等于给自己的域名批量添薄内容和导出链接——那是在
 * 主动伤害排名，不是增加内容。它们继续以卡片形式出现在首页，不给独立页面。
 */
export function isPublishable(article: Pick<ArticleRecord, 'isAuto' | 'status'>) {
  return !article.isAuto && article.status === 'published';
}

async function readAll(): Promise<ArticleRecord[]> {
  let files: string[];
  try {
    files = await readdir(articlesDirectory);
  } catch {
    return [];
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const { frontmatter, body } = parseFrontmatter(
          await readFile(path.join(articlesDirectory, file), 'utf8'),
        );
        return toRecord(frontmatter, body);
      }),
  );

  return records
    .filter((record): record is ArticleRecord => record !== null)
    .sort((first, second) => Date.parse(second.date) - Date.parse(first.date));
}

/** 全部（含自动线索卡），按日期倒序。 */
export async function getAllArticles() {
  return readAll();
}

/** 有独立页面的成稿，按日期倒序。 */
export async function getPublishedArticles() {
  return (await readAll()).filter(isPublishable);
}

export async function getArticleBySlug(slug: string) {
  return (await readAll()).find((article) => article.slug === slug && isPublishable(article)) || null;
}

export function articleHref(article: ArticleRecord, lang: Lang) {
  if (!isPublishable(article)) return article.href;
  return lang === 'en' ? `/en/articles/${article.slug}` : `/articles/${article.slug}`;
}

export function toCard(article: ArticleRecord, lang: Lang): ArticleCard {
  return {
    title: lang === 'en' ? article.enTitle : article.zhTitle,
    date: lang === 'en' ? article.enDate : article.zhDate,
    category: lang === 'en' ? article.enCategory : article.zhCategory,
    excerpt: lang === 'en' ? article.enExcerpt : article.zhExcerpt,
    image: article.image,
    href: articleHref(article, lang),
  };
}

/** 首页那三张卡。placement: hero 的另有用处，排除。 */
export async function getHomeArticleCards(): Promise<Record<Lang, ArticleCard[]>> {
  const articles = (await readAll())
    .filter((article) => article.placement !== 'hero' && isPublishable(article))
    .slice(0, 3);
  return {
    zh: articles.map((article) => toCard(article, 'zh')),
    en: articles.map((article) => toCard(article, 'en')),
  };
}

// ---- 正文渲染 ----------------------------------------------------------
//
// 这批 md 的正文只用到两种结构：段落和 `- ` 列表，行内只有链接。为这点语法引一个
// markdown 运行时不划算，所以在这里解析成结构化块，由页面组件渲染成 React 元素。
// 刻意不生成 HTML 字符串——不碰 dangerouslySetInnerHTML，就没有转义问题。

export type InlineNode = { text: string } | { text: string; href: string };

export type ArticleBlock =
  | { type: 'paragraph'; nodes: InlineNode[] }
  | { type: 'list'; items: InlineNode[][] };

/** 抓来的标题里带着 `&#8211;` 这类已编码实体，原样显示会很难看。 */
function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push({ text: decodeEntities(line.slice(lastIndex, match.index)) });
    nodes.push({ text: decodeEntities(match[1]), href: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) nodes.push({ text: decodeEntities(line.slice(lastIndex)) });
  return nodes.length > 0 ? nodes : [{ text: '' }];
}

export function parseArticleBody(body: string): ArticleBlock[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): ArticleBlock => {
      const lines = chunk.split(/\r?\n/).map((line) => line.trim());
      if (lines.every((line) => line.startsWith('- '))) {
        return { type: 'list', items: lines.map((line) => parseInline(line.slice(2))) };
      }
      return { type: 'paragraph', nodes: parseInline(lines.join(' ')) };
    });
}
