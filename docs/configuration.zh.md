---
title: 配置
order: 20
---

# 配置

Vited 的配置文件是项目根目录下的 `vited.config.ts`。从 `@vited/core` 导入
`defineConfig` 来定义配置：

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  base: '/docs/',
  build: {
    outDir: 'site-dist',
  },
  docs: {
    title: 'My Project',
    description: 'Project documentation',
    keywords: ['project', 'documentation'],
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
```

`defineConfig` 接受标准的 Vite 配置，并添加 Vited 的文档和 MDX 插件。Vited
专属选项放在 `docs` 中；`base`、`build`、`server` 等其他选项仍是标准的 Vite
配置。详情请参阅 [Vite 配置指南](https://vite.dev/config/)。

## Vited 配置项

| 配置项             | 说明                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `title`            | 站点标题。默认使用 `package.json` 中的 `name`；如果没有包名，则使用 `Vited documentation`。                              |
| `description`      | HTML 描述元数据。默认使用 `package.json` 中的 `description`。                                                            |
| `keywords`         | HTML 关键词字符串数组。默认使用 `package.json` 中的 `keywords`。                                                         |
| `supportedLocales` | 要从文件名后缀中识别的语言代码，例如 `guide.zh.md`。第一个语言代码为默认语言，使用无前缀路由；省略时会根据文档推断语言。 |
| `theme`            | 用于渲染站点的主题包。默认为 `@vited/theme-mantine`。                                                                    |
| `menu`             | 侧边栏菜单项。省略时会根据文档页面自动生成菜单。                                                                         |

### 自定义菜单

菜单项可以链接到文档路由或外部网址，也可以嵌套：

```ts
docs: {
  menu: [
    { text: '指南', path: '/guide' },
    { text: 'API 参考', link: 'https://example.com/api' },
    {
      text: '更多',
      children: [{ text: '配置', path: '/configuration' }],
    },
  ],
}
```

菜单项支持以下属性：

| 属性       | 说明                                                   |
| ---------- | ------------------------------------------------------ |
| `text`     | 菜单标签。                                             |
| `path`     | 文档内部路由，例如 `/guide`。                          |
| `file`     | 文档源文件（`.md`、`.mdx`、`.jsx` 或 `.tsx`）。        |
| `link`     | 外部网址。                                             |
| `divider`  | 设为 `true` 可显示分隔线；该菜单项的其他属性会被忽略。 |
| `flag`     | 可选标记：`experimental`、`new` 或 `deprecated`。      |
| `children` | 嵌套菜单项。                                           |

## 文档排序

侧边栏根据文档页面自动生成时，可以在 Markdown 或 MDX frontmatter 中设置数字
`order`，手动调整页面顺序。数值越小越靠前；未设置 `order` 的页面排在已设置
的页面之后。同一排序值的页面以及未设置排序值的页面会按路由排序。

```md
---
title: Installation
order: 10
---
```

## Vite 配置项

Vited 支持 Vite 的标准配置。例如，在部署到路径前缀下时，可以设置
[Vite 的 `base`](https://vite.dev/config/shared-options.html#base)。生产构建默认
输出到 `docs_dist`；如需使用其他目录，请设置
[Vite 的 `build.outDir`](https://vite.dev/config/build-options.html#build-outdir)。
