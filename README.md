# Goodminton Academy

Goodminton 的官网、学员训练档案与小型学员社区。生产站点为
[goodminton.fi](https://goodminton.fi)，论坛入口为
[bbs.goodminton.fi](https://bbs.goodminton.fi)（307 跳转到主域 `/forum`）。

## 当前功能

- 官网、教练介绍、文章与 AI 羽毛球问答
- 学员短码登录、训练重点、课后总结、比赛复盘与历史记录
- 一个论坛时间流，以课后总结、比赛复盘、交流讨论、球友约球四种属性筛选
- 教练点评、匿名精选、审核后评论、学员实名发帖与作者撤回
- 教练控制台、精选管理、评论审核和教练 ↔ 学员站内消息
- Obsidian 学员档案同步及训练资料采集脚本

## 技术栈

- Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4
- Supabase Postgres；浏览器不直接访问业务表，服务端 Route Handler 使用 service role
- Vercel 部署和 DNS

## 本地开发

```powershell
npm install
npm run dev
```

本机若遇到 Turbopack 异常，使用已提供的 Webpack 启动脚本：

```powershell
scripts\start-local-dev.cmd
```

提交前至少运行：

```powershell
npm test
npm run lint
npm run build
npm run students:check-logins
```

`students:check-logins` 会检查 manifest、登录注册表和学员 JSON 是否一致。

## 主要目录

- `app/`：页面和服务端 API
- `lib/`：登录目录、请求限流、Supabase 服务端客户端和共享类型
- `data/`：学员 manifest、登录映射和本地演示数据
- `supabase/migrations/`：数据库权威迁移
- `supabase/APPLY-PENDING.sql`：论坛首次启用时可在 SQL Editor 一次执行的合并副本
- `scripts/`：Obsidian 同步、历史回填、精选填充和内容采集

## 环境变量

核心生产变量：

- `DEEPSEEK_API_KEY`：AI 问答
- `SUPABASE_URL`（或 `NEXT_PUBLIC_SUPABASE_URL`）：Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`：仅服务端使用，禁止加 `NEXT_PUBLIC_` 前缀
- `GOODMINTON_COACH_ACTION_TOKEN`：保护 `/coach` 发起的写操作

学员数据还可以按部署方式使用 Google Sheet、Drive 或压缩环境变量；具体变量名以
`app/api/student-data/route.ts` 为准。不要把任何 `.env*`、令牌或 service role key 提交到 Git。

## 数据与安全边界

- 所有公开 schema 业务表均启用 RLS；应用通过服务端 service role 访问，并撤销新论坛表的
  `anon` / `authenticated` 权限。
- 学员身份目前仍是短登录码，不等同于高强度账户系统。接口有最低限度的进程内限流，
  但站内消息仍只适合普通训练沟通，不应承载伤病、家庭或其他敏感信息。
- 论坛发帖署名由服务端学员目录生成，客户端不能自定义冒用他人姓名。
- `/student`、`/forum`、`/coach` 和 `/api/` 均不进入搜索引擎索引；robots 规则不是访问控制。

## 论坛首次启用

按顺序执行：

1. 在 Supabase SQL Editor 审核并执行 `supabase/APPLY-PENDING.sql`。
2. 确认公开接口的 `schemaReady` 从 `false` 变为 `true`。
3. 在 Vercel 配置 `GOODMINTON_COACH_ACTION_TOKEN`，然后重新部署。
4. 登录 `/coach` 验证评论审核、精选和私信。
5. 使用 `node scripts/feature-peer-wall.mjs` 填充经确认的真实精选。

迁移前页面会优雅降级为空状态；迁移执行后论坛写入立即生效，因此应先完成代码安全检查和
学员通知。

## 发布原则

生产部署前确认本地分支已推送到 GitHub，避免 Vercel CLI 直部署版本与 `origin/main` 分叉。
部署后核对首页、`/student`、`/forum`、`/coach`、公开 API 和 `bbs` 子域跳转。
