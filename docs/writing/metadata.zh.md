---
title: 元数据
order: 32
---

# 元数据

在文档开头写一段 YAML frontmatter：

```md
---
title: 安装
order: 10
description: 在现有项目中安装 Vited。
keywords: [安装, 配置]
---
```

Vited 在扫描文档时读取这些元数据，用于侧边栏条目、页面标题和生产构建的 HTML head；
主题会以 `page.frontmatter` 拿到完整的对象。

## 字段

- `title`：页面标题。用于侧边栏条目，并作为生产构建的 HTML 标题。没有 `title` 的文档
  使用第一个一级标题。
- `order`：数字，用于自动生成的侧边栏排序。数值小的在前，没有 `order` 的页面排在设置了
  `order` 的页面之后。
- `description`：生产构建的 HTML description meta 标签。
- `keywords`：生产构建的 HTML keywords meta 标签，字符串数组。

侧边栏按路由分组，因此目录索引页（`README.md`）的 `order` 应小于它的子页面，
这样整个分组才能保持在预期位置。

## 自定义字段

其他字段会保留在 `page.frontmatter` 中，主题和组件可以读取项目自定义的值：

```md
---
title: 更新日志
draft: true
---
```
