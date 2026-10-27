---
title: 快速开始
---

# 快速开始

创建 `docs` 目录并添加 Markdown 文件。使用 `README.md` 作为目录首页；
子目录名称会成为路由路径。

例如，`docs/guide/README.md` 对应 `/guide`。

## 多语言

在 `vited.config.ts` 中设置 `supportedLocales`，然后为翻译后的文档添加语言后缀：

```ts
docs: {
  root: './docs',
  supportedLocales: ['en', 'zh'],
}
```

`README.zh.md` 是首页的中文翻译，`guide/README.zh.md` 是本指南的中文翻译。
英文页面使用默认路由，中文页面使用 `/zh/` 前缀，例如 `/zh/guide`。
