# Goodminton Articles

正式文章位于本目录；增长部维护的候选池位于 `_candidates/`。

## 正式文章

网站通过 `lib/articles.ts` 读取本目录顶层的 `*.md` 文件：

- 完整成稿拥有 `/articles/[slug]` 和 `/en/articles/[slug]` 页面；
- 首页排除 `placement: hero` 后，按 `date` 倒序显示最新三篇；
- `_candidates/` 子目录不会被网站读取；
- 自动热点线索不得直接放在本目录顶层。

正式文章至少需要以下 frontmatter：

```md
---
slug: my-article-slug
status: published
sourceType: original
date: 2026-08-15
image: /article-free.svg
zhTitle: 中文标题
enTitle: English title
zhDate: 2026年8月15日
enDate: Aug 15, 2026
zhCategory: 分类
enCategory: Category
zhExcerpt: 中文摘要
enExcerpt: English excerpt
---

中文正文。

<!-- goodminton:en -->

English body.
```

- `status: published` 是公开页面的硬门槛；缺失或写成其他状态的文件不会进入首页、文章列表或 sitemap。
- `sourceType` 使用 `original` 或 `external+original`，并在正文末尾说明外部来源与 Goodminton 原创判断的边界。
- 所有正式文章必须用 `<!-- goodminton:en -->` 分隔独立的中英文正文；英文页不再回退显示中文正文。

## 增长部候选池

路径：

```text
content/articles/_candidates/
```

自动抓取命令默认只写候选池：

```bash
npm run articles:hot
```

候选池的职责、状态流和晋升规则见 `_candidates/README.md`。自动生成文件只是选题线索，不会自动公开，也不会触发 Vercel 部署。
