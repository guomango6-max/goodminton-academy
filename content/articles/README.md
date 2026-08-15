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
