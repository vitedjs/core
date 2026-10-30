---
title: 文件格式
order: 31
---

# 文件格式

Vited 从项目根目录下的 `docs` 目录读取文档。只有 `.md` 和 `.mdx` 文件会成为页面，
其他文件都会被忽略，因此 React 组件（`.jsx`、`.tsx`）可以放在项目中的任意位置，
由文档引入使用。

```text
docs/
  README.md               → /
  installation.zh.md      → /zh/installation
  guide/
    README.md             → /guide
    start.mdx             → /guide/start
    Callout.tsx           → 不是页面，由 start.mdx 引入
```

## 路由

目录名会成为路由片段，文件名成为最后一段：`docs/guide/start.mdx` 对应
`/guide/start`。

`README.md` 是所在目录的索引页，例如 `docs/guide/README.md` 对应 `/guide`。

## 多语言

在 `vited.config.ts` 中设置 `supportedLocales`，然后在扩展名前添加语言后缀来翻译页面：

```ts
docs: {
  supportedLocales: ['en', 'zh'],
}
```

第一个语言使用不带前缀的路由，其他语言使用 `/<locale>/` 前缀，因此
`installation.zh.md` 对应 `/zh/installation`。
