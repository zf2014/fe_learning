# ESLint 9 Flat Config 完全指南

> 本文档系统性地介绍 ESLint 9 采用的 Flat Config（扁平化配置）体系，包括旧系统的问题、新系统的优势，以及每个配置项的详细说明与示例。

---

## 目录

1. [旧配置系统（.eslintrc）的核心问题](#1-旧配置系统eslintrc的核心问题)
2. [Flat Config 带来的核心改进](#2-flat-config-带来的核心改进)
3. [新旧系统对比速查表](#3-新旧系统对比速查表)
4. [配置文件基本结构](#4-配置文件基本结构)
5. [配置项详解](#5-配置项详解)
   - [name](#51-name--配置对象标识)
   - [basePath](#52-basepath--目录作用域)
   - [files](#53-files--文件匹配模式)
   - [ignores](#54-ignores--文件排除模式)
   - [extends](#55-extends--配置继承)
   - [language](#56-language--语言选择)
   - [languageOptions](#57-languageoptions--语言配置)
   - [linterOptions](#58-linteroptions--linting-行为控制)
   - [processor](#59-processor--文件处理器)
   - [plugins](#510-plugins--插件注册)
   - [rules](#511-rules--规则配置)
   - [settings](#512-settings--共享数据)
6. [辅助函数](#6-辅助函数)
7. [完整配置示例](#7-完整配置示例)
8. [迁移速查表](#8-迁移速查表)

---

## 1. 旧配置系统（.eslintrc）的核心问题

ESLint 自 2013 年诞生以来，配置系统从简单设计逐步演变为 ESLint 团队自己描述的 "难以维护的烂摊子"。以下是核心问题：

### 1.1 基于目录的配置级联（Cascade）

旧系统在处理每个文件时，会从文件所在目录向上遍历目录树，逐层合并所有 `.eslintrc` 文件。这意味着用户可能受到自己根本不知道存在的上层目录配置的影响。虽然引入了 `root: true` 来阻止继续向上查找，但这只是一个补丁式的解决方案。

```
/project
  ├── .eslintrc.json        ← 会影响所有子目录
  ├── src/
  │   ├── .eslintrc.json    ← 与上层合并
  │   └── app/
  │       └── .eslintrc.json ← 与上两层合并
  └── tests/
      └── .eslintrc.json    ← 与顶层合并
```

### 1.2 自定义的模块加载机制

`extends` 和 `plugins` 字段使用字符串名称加载模块（如 `"eslint-plugin-react"`），ESLint 内部重新实现了一套 Node.js 模块解析逻辑。这是 Bug 的重要来源，尤其在插件和共享配置的解析方面。

### 1.3 配置文件格式混乱

ESLint 同时支持 `.eslintrc`、`.eslintrc.json`、`.eslintrc.yml`、`.eslintrc.yaml`、`.eslintrc.js` 以及 `package.json` 中的 `eslintConfig` 字段。JavaScript 格式允许使用 `RegExp` 等 JSON/YAML 无法表示的对象，导致格式间存在不兼容。

### 1.4 `env` 字段的语义混淆

`env` 键（如 `es6: true`、`browser: true`）将全局变量定义和解析器行为混在一起。设置 `es6: true` 会同时影响语法解析和全局变量注入，让人困惑到底在配置什么。

### 1.5 `extends` + `overrides` 的组合复杂度

在 `overrides` 中嵌套 `extends` 引入了令人困惑的合并逻辑，即使是 ESLint 团队自己也觉得难以理解。

### 1.6 共享配置的依赖地狱

npm v3 停止自动安装 peer dependencies，导致依赖 peer dependencies 进行插件解析的共享配置直接失效。

### 1.7 大量磁盘 I/O

每处理一个文件，ESLint 都要从文件位置向上逐级检查每个目录是否存在配置文件，造成大量磁盘访问开销。

---

## 2. Flat Config 带来的核心改进

### 2.1 设计目标

| 目标 | 说明 |
|------|------|
| 合理的默认值 | 反映现代 JavaScript 现实（ESM 为默认、`ecmaVersion: "latest"`） |
| 统一的配置方式 | 单一文件、单一格式 |
| 规则配置不变 | `rules` 语法保持一致 |
| 原生模块加载 | 直接使用 `import`/`require()`，不再用字符串名称 |
| 更清晰的结构 | 顶层按键分组为 `languageOptions`、`linterOptions` 等 |
| 向后兼容 | 通过 `FlatCompat` 工具支持旧有插件和配置 |

### 2.2 核心优势一览

| 特性 | eslintrc（旧） | Flat Config（新） |
|------|----------------|-------------------|
| **配置文件** | 多种 `.eslintrc.*` 格式 | 单一 `eslint.config.js`（或 `.mjs`/`.cjs`/`.ts`） |
| **配置合并** | 基于目录树的级联合并 | 数组索引顺序（后面的覆盖前面的） |
| **加载插件** | 字符串名称 `"eslint-plugin-foo"` | 直接 `import` 插件对象 |
| **extends** | 字符串形式的魔法解析 | 数组展开 / 直接导入 |
| **解析器** | 字符串名称 | 直接 `import` 对象引用 |
| **env** | 需要 `env` 字段 | 由 `globals` npm 包替代 |
| **默认 ecmaVersion** | ES5（后改为 ES2020） | `"latest"` |
| **默认 sourceType** | `"script"` | `.js`/`.mjs` → `"module"`，`.cjs` → `"commonjs"` |
| **忽略文件** | 单独的 `.eslintignore` | 配置内的 `ignores` 字段 |
| **条件配置** | `overrides` 字段（嵌套） | 每个配置对象都可以有 `files`/`ignores`（扁平） |
| **自定义规则** | `--rulesdir` CLI 参数 | 内联运行时插件 |
| **root** | 需要 `root: true` 阻止级联 | 不需要（单文件天然等效于 `root: true`） |

### 2.3 关键改进详解

**① 可预测的配置合并**

Flat Config 是一个配置对象数组，按索引顺序匹配——后面的配置覆盖前面的。不再有目录遍历、不再有隐藏的配置来源：

```js
export default [
  configA,  // 先匹配
  configB,  // 后匹配，覆盖 configA 中的冲突项
  configC,  // 最后匹配，拥有最高优先级
];
```

**② 原生 JavaScript 模块加载**

不再需要 ESLint 的自定义 `require()` 实现。一切通过标准的 `import` 加载：

```js
// 旧方式：字符串魔法
module.exports = {
  extends: ["eslint:recommended"],
  plugins: ["react"],
  parser: "@typescript-eslint/parser"
};

// 新方式：原生 import
import js from "@eslint/js";
import react from "eslint-plugin-react";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    plugins: { react },
    languageOptions: { parser: tsParser }
  }
];
```

**③ 扁平化的条件配置**

不再需要嵌套的 `overrides`。每个配置对象本身就是一条独立的规则集：

```js
// 旧方式：嵌套 overrides
module.exports = {
  rules: { semi: "error" },
  overrides: [
    { files: ["*.ts"], rules: { "no-any": "error" } }
  ]
};

// 新方式：扁平数组
export default [
  { rules: { semi: "error" } },
  { files: ["**/*.ts"], rules: { "no-any": "error" } }
];
```

---

## 3. 新旧系统对比速查表

| eslintrc | Flat Config |
|----------|-------------|
| `extends: ["eslint:recommended"]` | `import js from "@eslint/js";` → `js.configs.recommended` |
| `extends: ["some-config"]` | `import someConfig from "eslint-config-some";` → 直接放入数组 |
| `plugins: ["react"]` | `import react from "eslint-plugin-react";` → `plugins: { react }` |
| `parser: "@typescript-eslint/parser"` | `import tsParser from "@typescript-eslint/parser";` → `languageOptions: { parser: tsParser }` |
| `env: { browser: true, node: true }` | `import globals from "globals";` → `languageOptions: { globals: { ...globals.browser, ...globals.node } }` |
| `parserOptions: { ecmaVersion: 2022 }` | `languageOptions: { ecmaVersion: 2022 }` |
| `parserOptions: { sourceType: "module" }` | `languageOptions: { sourceType: "module" }` |
| `globals: { MY_VAR: "readonly" }` | `languageOptions: { globals: { MY_VAR: "readonly" } }` |
| `overrides: [{ files: ["*.ts"], rules: {...} }]` | `{ files: ["**/*.ts"], rules: {...} }`（顶层数组元素） |
| `.eslintignore` | `{ ignores: ["pattern1", "pattern2"] }` |
| `root: true` | 不需要（始终等效于 `root: true`） |
| `noInlineConfig: true` | `linterOptions: { noInlineConfig: true }` |
| `reportUnusedDisableDirectives: true` | `linterOptions: { reportUnusedDisableDirectives: "warn" }` |
| `settings: { ... }` | `settings: { ... }`（不变） |
| `--rulesdir` CLI 参数 | 配置中的内联运行时插件 |

---

## 4. 配置文件基本结构

Flat Config 文件导出一个**配置对象数组**，每个对象可以包含以下属性：

```js
// eslint.config.js
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // 完整的配置对象属性一览
    name: "my-config/name",           // 字符串：配置对象标识名
    basePath: "src",                  // 字符串：目录作用域
    files: ["**/*.js"],               // 字符串数组：文件匹配 glob 模式
    ignores: ["**/*.test.js"],        // 字符串数组：文件排除 glob 模式
    extends: ["plugin/recommended"],  // 数组：配置继承
    language: "js/js",                // 字符串：语言选择（默认 "js/js"）
    languageOptions: { /* ... */ },   // 对象：语言相关设置
    linterOptions: { /* ... */ },     // 对象：linting 行为控制
    processor: "plugin/processor",    // 字符串 | 对象：文件处理器
    plugins: { /* ... */ },           // 对象：插件注册（名称 → 插件对象映射）
    rules: { /* ... */ },             // 对象：规则配置
    settings: { /* ... */ },          // 对象：规则间共享数据
  },
]);
```

---

## 5. 配置项详解

### 5.1 `name` — 配置对象标识

- **类型**：`string`
- **用途**：为配置对象命名，用于错误消息和 [Config Inspector](https://github.com/eslint/config-inspector) 中标识哪个配置对象正在生效。极大方便调试。
- **约定**：使用 `插件名/配置名` 或 `范围/描述` 格式。

```js
{
  name: "my-project/typescript-rules",
  files: ["**/*.ts"],
  rules: { "@typescript-eslint/no-explicit-any": "warn" }
}
```

---

### 5.2 `basePath` — 目录作用域

- **类型**：`string`（相对路径或绝对路径）
- **用途**：将配置对象的作用域限定在特定子目录。所有 `files`/`ignores` 模式都相对于此路径求值。

```js
{
  basePath: "tests",
  files: ["**/*.spec.js"],
  rules: { "no-undef": "error" }
}
// 当 basePath 为 "tests" 时，"**/*.spec.js" 匹配 tests/unit/foo.spec.js
```

---

### 5.3 `files` — 文件匹配模式

- **类型**：`string[]`（minimatch glob 模式数组）
- **用途**：定义此配置对象应用到哪些文件。
- **默认**：省略时，应用到所有被其他配置对象匹配到的文件。
- **语法**：使用 [minimatch](https://www.npmjs.com/package/minimatch) 模式，相对于配置文件位置（或 `basePath`）求值。

```js
// 匹配特定扩展名
{ files: ["**/*.ts", "**/*.tsx"] }

// 匹配没有扩展名的文件
{ files: ["**/!(*.*)"] }

// AND 逻辑（嵌套数组 = 所有模式都必须匹配）
{ files: [["src/*", "**/*.js"]] }
```

**注意事项**：
- 单独使用 `*` 或以 `/*`、`/**` 结尾的模式**不能**作为 `files` 的唯一模式。
- 点文件（如 `.gitignore`）被视为只有扩展名——`.gitignore` 匹配 `"**/.gitignore"` 而非 `"**/*.gitignore"`。

---

### 5.4 `ignores` — 文件排除模式

- **类型**：`string[]`（minimatch glob 模式数组）
- **用途**：从配置对象中排除文件，或在单独使用时作为全局忽略规则。

**两种使用模式**：

#### 模式一：局部忽略（与 `files` 等其他字段一起使用）

```js
{
  files: ["src/**/*.js"],
  ignores: ["**/*.test.js", "**/*.config.js"],
  rules: { semi: "error" }
}
```

此时 `ignores` 仅在已匹配 `files` 的文件中进一步排除。

#### 模式二：全局忽略（只有 `name` 和 `ignores` 两个字段）

```js
// 全局忽略 — 应用于所有配置对象
{
  ignores: ["dist/", ".config/", "node_modules/"]
}
```

**推荐**：使用辅助函数 `globalIgnores()` 使意图更明确：

```js
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/", "coverage/"], "忽略构建产物"),
]);
```

**默认忽略**：`**/node_modules/` 和 `.git/` 始终被忽略。

**全局 vs 局部的区别**：
- 全局 `ignores` 可以匹配目录（如 `"dist/"`）
- 局部 `ignores` 只匹配文件（如 `"dist/**"`）——`"dir/"` 模式不会生效

---

### 5.5 `extends` — 配置继承

- **类型**：`array`（字符串、配置对象或配置数组的混合数组）
- **用途**：从其他配置继承所有特征。后面的条目覆盖前面的。

```js
import js from "@eslint/js";

export default defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,           // 配置对象/数组
      "ts/recommended",                 // 字符串引用插件配置
    ],
    rules: {
      // 覆盖继承的规则
      "no-console": "warn"
    }
  }
]);
```

**三种值类型**：
1. **字符串** — 通过名称引用插件配置：`"插件名/配置名"`
2. **配置对象** — 普通配置对象
3. **配置数组** — 配置对象数组

---

### 5.6 `language` — 语言选择

- **类型**：`string`（格式：`"插件名/语言名"`）
- **默认**：`"js/js"`（JavaScript）
- **用途**：指定用于 linting 的语言。这是 Flat Config 的新增能力，使 ESLint 能够 lint 非 JS 语言。

```js
import example from "eslint-plugin-example";

export default defineConfig([
  {
    files: ["**/*.my"],
    plugins: { example },
    language: "example/my"
  }
]);
```

---

### 5.7 `languageOptions` — 语言配置

- **类型**：`object`
- **用途**：将所有与代码解析相关的设置集中管理。替代了旧系统中分散的 `globals`、`parserOptions`、`parser` 和 `env` 字段。

#### `languageOptions.ecmaVersion`

- **类型**：`number | string`
- **默认**：`"latest"`
- **可选值**：年份（如 `2022`）、版本号（如 `5`）或 `"latest"`

```js
languageOptions: {
  ecmaVersion: 2022  // 或 6、5、"latest"
}
```

#### `languageOptions.sourceType`

- **类型**：`"script" | "module" | "commonjs"`
- **默认**：`.js`/`.mjs` → `"module"`，`.cjs` → `"commonjs"`

```js
languageOptions: {
  sourceType: "module"
}
```

#### `languageOptions.globals`

- **类型**：`object`
- **用途**：定义 linting 时可用的全局变量。替代了旧系统的 `env` 字段。

```js
import globals from "globals";

languageOptions: {
  globals: {
    ...globals.browser,      // 浏览器环境全局变量
    ...globals.node,         // Node.js 环境全局变量
    myCustomGlobal: "readonly"  // 自定义全局变量
  }
}
```

每个全局变量的值可以是：
- `"readonly"` / `false` — 只读，不可重写
- `"writable"` / `true` — 可读写
- `"off"` — 禁用该全局变量

#### `languageOptions.parser`

- **类型**：`object`（带有 `parse()` 或 `parseForESLint()` 方法的解析器对象）
- **默认**：`espree`
- **变化**：现在是直接的对象引用，不再是字符串名称。

```js
import tsParser from "@typescript-eslint/parser";

languageOptions: {
  parser: tsParser
}
```

#### `languageOptions.parserOptions`

- **类型**：`object`
- **用途**：传递给解析器的特定选项。直接传递给解析器的 `parse()` 或 `parseForESLint()` 方法。

```js
languageOptions: {
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-env"]
    }
  }
}
```

> **注意**：`ecmaVersion` 和 `sourceType` 已从 `parserOptions` 移至 `languageOptions` 顶层，但仍会透传给自定义解析器。

---

### 5.8 `linterOptions` — linting 行为控制

- **类型**：`object`

#### `linterOptions.noInlineConfig`

- **类型**：`boolean`
- **默认**：`false`
- **用途**：禁止所有内联 `/*eslint*/` 注释。适用于要求严格规范、不允许通过注释绕过规则的场景。

```js
linterOptions: {
  noInlineConfig: true  // 禁止 eslint-disable 注释
}
```

#### `linterOptions.reportUnusedDisableDirectives`

- **类型**：`boolean | string`（严重级别：`"off"`、`"warn"`、`"error"`）
- **默认**：`"warn"`
- **兼容**：`true` 等效于 `"warn"`，`false` 等效于 `"off"`

```js
linterOptions: {
  reportUnusedDisableDirectives: "error"  // 未生效的 eslint-disable 报错
}
```

#### `linterOptions.reportUnusedInlineConfigs`

- **类型**：`string`（严重级别）
- **默认**：`"off"`
- **用途**：报告没有实际改变任何配置的内联配置注释。

```js
linterOptions: {
  reportUnusedInlineConfigs: "error"
}
```

---

### 5.9 `processor` — 文件处理器

- **类型**：`string`（格式：`"插件名/处理器名"`）或带有 `preprocess()`/`postprocess()` 方法的对象
- **用途**：从非 JS 文件中提取代码进行 linting（如 Markdown 中的代码块、Vue SFC 等）。

**字符串引用**：

```js
import markdown from "@eslint/markdown";

{
  files: ["**/*.md"],
  plugins: { markdown },
  processor: "markdown/markdown"
}
```

**直接对象引用**：

```js
{
  files: ["**/*.custom"],
  processor: {
    preprocess(text) { return [text]; },
    postprocess(messages) { return messages[0]; }
  }
}
```

**重要变化**：旧系统中按文件扩展名自动关联的处理器不再自动应用，必须显式设置 `processor`。

---

### 5.10 `plugins` — 插件注册

- **类型**：`object`（名称 → 插件对象的映射）
- **用途**：注册插件，使其规则、配置和处理器可用。
- **变化**：插件现在是 JavaScript 对象，不再是字符串名称。你可以自定义命名空间。

```js
import jsdoc from "eslint-plugin-jsdoc";
import custom from "./my-custom-plugin.js";

{
  plugins: {
    jsdoc,               // 简写：键名与导入名一致
    myNamespace: custom   // 自定义命名空间
  },
  rules: {
    "jsdoc/require-description": "error",
    "myNamespace/some-rule": "error"
  }
}
```

**内联运行时插件**（无需外部包）：

```js
{
  plugins: {
    local: {
      rules: {
        "my-rule": {
          meta: { type: "problem" },
          create(context) {
            return {
              // 规则实现
            };
          }
        }
      }
    }
  },
  rules: { "local/my-rule": "error" }
}
```

---

### 5.11 `rules` — 规则配置

- **类型**：`object`
- **用途**：启用/配置 lint 规则。**语法与旧系统完全一致。**
- **严重级别**：`"off"`（或 `0`）、`"warn"`（或 `1`）、`"error"`（或 `2`）

```js
rules: {
  "semi": "error",                          // 仅严重级别
  "quotes": ["error", "double"],            // 严重级别 + 选项
  "no-unused-vars": ["warn", {              // 严重级别 + 多个选项
    "vars": "all",
    "args": "after-used"
  }]
}
```

插件规则使用 `"命名空间/规则名"` 的格式引用：

```js
rules: {
  "@typescript-eslint/no-explicit-any": "warn",
  "react-hooks/rules-of-hooks": "error"
}
```

---

### 5.12 `settings` — 共享数据

- **类型**：`object`
- **用途**：键值对数据，所有规则可通过 `context.settings` 访问。用于插件在多个规则间共享配置。
- **与旧系统相同**，语法不变。

```js
settings: {
  "import/resolver": {
    node: { extensions: [".js", ".jsx", ".ts", ".tsx"] }
  },
  react: { version: "detect" }
}
```

---

## 6. 辅助函数

### `defineConfig()` — 类型安全的配置包装器

```js
import { defineConfig } from "eslint/config";

export default defineConfig([
  { rules: { semi: "error" } }
]);
```

提供 TypeScript 类型检查和 IDE 自动补全支持。

### `globalIgnores()` — 显式全局忽略

```js
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/", "coverage/"], "忽略构建产物"),
]);
```

---

## 7. 完整配置示例

以下是一个覆盖所有常用场景的完整配置示例：

```js
// eslint.config.js
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  // ==============================
  // 1. 全局忽略
  // ==============================
  globalIgnores(["dist/", "coverage/", "*.min.js"]),

  // ==============================
  // 2. 基础推荐规则（所有 JS 文件）
  // ==============================
  js.configs.recommended,

  // ==============================
  // 3. TypeScript 文件配置
  // ==============================
  {
    name: "my-project/typescript",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      ts: tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_"
      }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // ==============================
  // 4. 测试文件 — 宽松规则
  // ==============================
  {
    name: "my-project/tests",
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // ==============================
  // 5. 生产代码 — 严格模式
  // ==============================
  {
    name: "my-project/strict",
    files: ["src/**/*.ts"],
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: "error",
    },
  },

  // ==============================
  // 6. Markdown 文件中的代码块
  // ==============================
  {
    name: "my-project/markdown",
    files: ["**/*.md"],
    plugins: { markdown: markdownPlugin },
    processor: "markdown/markdown",
  },
  {
    name: "my-project/markdown-js",
    files: ["**/*.md/*.js"],
    rules: {
      "no-console": "off",
    },
  },
]);
```

---

## 8. 迁移速查表

| 旧配置 (.eslintrc) | 新配置 (eslint.config.js) |
|---|---|
| `extends: ["eslint:recommended"]` | `import js from "@eslint/js";` → 数组中放入 `js.configs.recommended` |
| `extends: ["some-config"]` | `import someConfig from "eslint-config-some";` → 数组中放入 `someConfig` |
| `plugins: ["react"]` | `import react from "eslint-plugin-react";` → `plugins: { react }` |
| `parser: "@typescript-eslint/parser"` | `languageOptions: { parser: tsParser }` |
| `env: { browser: true, node: true }` | `languageOptions: { globals: { ...globals.browser, ...globals.node } }` |
| `parserOptions: { ecmaVersion: 2022 }` | `languageOptions: { ecmaVersion: 2022 }` |
| `parserOptions: { sourceType: "module" }` | `languageOptions: { sourceType: "module" }` |
| `globals: { MY_VAR: "readonly" }` | `languageOptions: { globals: { MY_VAR: "readonly" } }` |
| `overrides: [{ files: ["*.ts"], rules: {...} }]` | `{ files: ["**/*.ts"], rules: {...} }`（作为独立的数组元素） |
| `.eslintignore` | `{ ignores: ["pattern"] }` 或 `globalIgnores(["pattern"])` |
| `root: true` | 不需要 |
| `noInlineConfig: true` | `linterOptions: { noInlineConfig: true }` |
| `reportUnusedDisableDirectives: true` | `linterOptions: { reportUnusedDisableDirectives: "warn" }` |
| `settings: { ... }` | `settings: { ... }`（不变） |
| `/* eslint-env node */` 注释 | 已移除。在配置中用 `globals` 或使用 `/* global */` 注释 |

---

## 参考资源

| 资源 | 链接 |
|------|------|
| 官方配置文件文档 | https://eslint.org/docs/latest/use/configure/configuration-files |
| 官方迁移指南 | https://eslint.org/docs/latest/use/configure/migration-guide |
| 博客：新配置系统背景（为什么） | https://eslint.org/blog/2022/08/new-config-system-part-1/ |
| 博客：Flat Config 介绍 | https://eslint.org/blog/2022/08/new-config-system-part-2/ |
| 博客：迁移指南 | https://eslint.org/blog/2022/08/new-config-system-part-3/ |
| 插件迁移到 Flat Config | https://eslint.org/docs/latest/extend/plugin-migration-flat-config |
| 升级到 v9.x | https://eslint.org/docs/latest/use/migrate-to-9.0.0 |
| 配置迁移工具 | https://eslint.org/blog/2024/05/eslint-configuration-migrator |
