---
title: 编写文档
order: 30
---

# 编写文档

在 `docs` 目录中添加文档。Vited 会把 Markdown（`.md`）和 MDX（`.mdx`）文件作为页面。
其他文件不是页面，因此 `.jsx` 和 `.tsx` 组件可以放在项目中的任意位置，由文档引入使用。

目录名会成为路由片段，`README.md` 是所在目录的索引页。在扩展名前添加受支持的语言后缀
即可翻译页面，例如 `guide.zh.md`。

## 元数据

在文档开头写一段 YAML frontmatter。这些元数据决定侧边栏条目、页面标题以及生产构建的
HTML head。

```md
---
title: 安装
order: 10
description: 在现有项目中安装 Vited。
keywords: [安装, 配置]
---
```

没有元数据的文档会使用第一个一级标题作为标题。

## React 组件

MDX 文档可以导入并渲染 React 组件。示例请参阅
[在 MDX 中使用 React 组件](./guide/mdx-components.zh.mdx)。

## 字段

- `title`：页面标题。用于侧边栏条目，并作为生产构建的 HTML 标题。
- `order`：数字，用于自动生成的侧边栏排序。数值小的在前，没有 `order` 的页面排在设置了
  `order` 的页面之后。
- `description`：生产构建的 HTML description meta 标签。
- `keywords`：生产构建的 HTML keywords meta 标签，字符串数组。

主题会以 `page.frontmatter` 拿到完整的元数据对象，因此可以自定义其他字段。
