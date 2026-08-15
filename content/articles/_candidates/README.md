---
owner: Growth
status: active
publishes_directly: false
---

# 文章候选池（Growth）

本目录由**增长部**管理，用于收集、筛选和推进文章选题。这里的文件是候选线索或草稿，网站不会读取本目录，也不得直接视为公开成稿。

## 责任边界

增长部负责：

- 维护外部趋势、用户问题、课程素材和论坛主题形成的候选；
- 合并重复选题，标注目标读者、传播价值与时效；
- 将值得推进的候选整理成可审阅草稿；
- 提交发布建议，但不绕过内容审核直接上线。

教学判断、技术结论和学员案例的公开边界，仍由相应责任人审核。工程部负责测试、构建和部署，不替增长部决定选题价值。

## 状态

新生成候选使用：

```yaml
candidateOwner: Growth
candidateStatus: inbox
```

建议状态流：

```text
inbox → shortlisted → drafting → review → promoted / archived
```

- `inbox`：新抓取，未判断
- `shortlisted`：增长部决定值得推进
- `drafting`：正在改写为 Goodminton 自有内容
- `review`：等待事实、教学或隐私审核
- `promoted`：已形成正式文章
- `archived`：暂不采用

## 发布规则

正式发布时不要直接搬运候选文件。应当：

1. 核对来源与事实；
2. 写成完整的 Goodminton 原创文章；
3. 去掉 `autoHotArticle: true` 和候选状态字段；
4. 将成稿保存到上一级 `content/articles/`；
5. 运行测试和生产构建；
6. 经批准后提交并部署。

只有上一级目录中的完整成稿，才可能进入文章页和首页自动轮换。
