---
title: 安装
order: 10
---

# 安装

## 快速开始

使用交互式设置创建 Vited 站点，或将 Vited 添加到现有项目：

```bash
npm create @vited
```

在目标项目目录下运行此命令，或在提示中选择其他目录。然后按照提示选择
主题，以及是否安装依赖。设置过程会按需创建 `vited.config.ts`、`docs` 目录，
以及 `docs:dev` / `docs:build` 脚本。

## 手动设置

另外，也可以在现有项目中手动配置 Vited：安装 CLI、Core 集成、默认的 Mantine
主题和 Vite：

```bash
npm install --save-dev @vited/cli @vited/core @vited/theme-mantine vite
npm install react react-dom
```

在 `package.json` 中添加以下脚本，同时保留已有脚本：

```json
{
  "scripts": {
    "docs:dev": "vited dev",
    "docs:build": "vited build"
  }
}
```

在项目根目录创建 `vited.config.ts`：

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  docs: {
    title: 'My Project',
    theme: '@vited/theme-mantine',
  },
});
```

创建 `docs` 目录，并添加 `docs/README.md` 作为首页。

## 运行和构建

交互式设置和手动设置都会配置 `docs:dev` 和 `docs:build` 脚本。使用以下命令
即可分别启动开发服务器和创建生产构建。

### 开发服务器

使用以下命令启动本地开发服务器：

```bash
npm run docs:dev
```

### 生产构建

使用以下命令创建生产构建：

```bash
npm run docs:build
```

默认情况下，生产构建输出到 `docs_dist`。请将 `docs_dist` 添加到
`.gitignore`；如果要使用其他输出目录，请设置 Vite 的 `build.outDir`。
