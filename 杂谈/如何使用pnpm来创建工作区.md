[原文](https://dev.to/vinomanick/create-a-monorepo-using-pnpm-workspace-1ebn)

## 前置工作

1 安装 git / node / pnpm 工具

2 项目初始化
``` sh
  mkdir pnpm-monorepo
  cd pnpm-monorepo
  pnpm init
  git init
  echo -e "node_modules" > .gitignore
  npm pkg set engines.node=">=18.16.1" // 设置node版本
  npm pkg set type="module"
  echo "#PNPM monorepo" > README.md
```

3 代码规范 -- 整合 eslint / Prettier


4 设置vscode
  - 创建 .vscode/settings.json
  - 创建 .vscode/extensions.json
  - 其他

5 配置 pre-commit 钩子 -- 代码提交前校验

6 工作区配置
  - 创建 pnpm-workspace.yaml
  - 创建 根据上述配置 创建相应的目录
  - 创建 项目(库 或 应用)
  - 配置 vite 文件