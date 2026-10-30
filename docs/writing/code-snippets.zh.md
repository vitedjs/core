---
title: 代码片段
order: 33
---

# 代码片段

用围栏代码块包裹代码，并在开头的反引号后写上语言：

````md
```ts
export function add(a: number, b: number): number {
  return a + b;
}
```
````

默认的 Mantine 主题会用 Shiki 高亮这些代码块，并提供复制按钮，跟随浅色和深色配色。
常用的 `ts`、`tsx`、`js`、`jsx`、`json`、`bash`、`yaml`、`diff`、`md`
等语言开箱即用。

不写语言时按纯文本渲染：

```text
不做高亮的纯文本
```

## 行内代码

名称、路径和短表达式用单个反引号包裹，例如 `npm run docs:dev` 或
`vited.config.ts`。

## 实时组件

MDX 文档可以在代码块旁边渲染 React 组件，因此同一页面里既能放代码片段，也能放可运行的示例。
请参阅[在 MDX 中使用 React 组件](./react-components.zh.mdx)。
