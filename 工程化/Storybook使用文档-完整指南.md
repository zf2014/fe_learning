# Storybook 使用文档

> 整理时间：2025-05-29 | 适用版本：Storybook v10.x | 框架：Vue 3

---

## 一、Storybook 是什么

Storybook 是一个**前端 UI 工作台（Frontend Workshop）**，核心定位是让你**在隔离环境中开发、测试和文档化 UI 单元**——小到一个 Button，大到一个完整页面。

官方定义从早期的 "UI component explorer" 已演变为：

> "A frontend workshop for building UI components **and pages** in isolation"

### 核心价值

**写一次 Story，开发、测试、文档三件事同时完成。**

### 适用与不适用

| 场景 | 是否推荐 |
|---|---|
| 开发组件库/NPM 包 | ✅ 强烈推荐 |
| 大型项目的组件开发 | ✅ 推荐 |
| 设计系统搭建 | ✅ 强烈推荐 |
| 需要视觉回归测试 | ✅ 推荐（搭配 Chromatic） |
| 小型个人项目 | ⚠️ 可选，ROI 不一定高 |
| 纯后端/非 UI 项目 | ❌ 不适用 |

---

## 二、版本说明（v9 → v10）

当前最新版本为 **v10.x**（v10.2.9）。

v9 → v10 **不存在根本性架构差异**，官方定位为"breaking maintenance release"（维护性破坏性更新）。

### v10 三大变化

1. **纯 ESM 分发**（最关键的破坏性变更）
   - `.storybook/main.ts` 必须是合法 ESM
   - 安装体积减小
   - Node.js ≥ 20.19 或 ≥ 22.12 硬性要求

2. **CSF Next（Preview，非强制）**
   - 新增 `defineMain` 工厂函数，更好的类型推断和自动补全
   - 旧的 CSF 3 写法完全兼容

3. **改进的 Tags 过滤** — 基于标签的故事过滤机制增强

### 写 Story 的方式

v9 和 v10 中完全一样，无变化。

### v9 vs v10 对比

| 维度 | 差异 |
|---|---|
| 写 Story 的方式 | ❌ 无变化 |
| 配置文件格式 | ⚠️ 必须 ESM（破坏性） |
| 核心架构 | ❌ 无变化 |
| 插件生态 | ❌ 无变化 |
| CSF Next | ✨ 新增可选特性 |
| 升级难度 | 🟢 低（自动迁移） |

### 迁移方式

```bash
npx storybook@latest upgrade
```

---

## 三、核心概念

### Story（故事）

一个 Story 就是一个组件的**某种状态快照**。比如一个 Button 组件可以有多种状态的 Story：Primary、Disabled、Loading 等。

### CSF（Component Story Format）

Storybook 定义的标准格式，让 Story 可以：
- 在 Storybook UI 中渲染和浏览
- 作为测试用例在 Vitest/Jest 中直接运行（Portable Stories）
- 自动生成文档页面

---

## 四、六大核心用途

### 1. 组件隔离开发

把组件单独拎出来，配好 mock 数据，独立运行、热更新。无需启动整个应用。

### 2. 自动 API 文档（Autodocs）

加一行 `tags: ['autodocs']`，Storybook 自动从 TypeScript 类型提取 Props 表格、生成文档页面，包含源码预览和可交互示例。

### 3. 交互测试（Interaction Testing）

用 `play` 函数直接在 Story 中编写交互测试，无需额外测试文件。开发时在 Storybook UI 中实时回放，CI 中自动执行。

### 4. 视觉回归测试（Visual Testing）

通过 Chromatic（官方云服务）或开源方案，每次提交自动截图对比，发现像素级差异。

### 5. 无障碍测试（Accessibility）

安装 `@storybook/addon-a11y`，自动在每个 Story 上运行 a11y 检查，在 UI 中标出违规项。

### 6. 测试复用（Portable Stories）

Story 可直接导入 Vitest/Jest 中运行，无需重复编写测试。

---

## 五、插件生态

| 插件 | 作用 |
|---|---|
| Controls | 实时调整组件 Props，动态预览 |
| Actions | 捕获并展示用户交互事件 |
| Viewport | 模拟不同屏幕尺寸（响应式调试） |
| Backgrounds | 切换背景色，测试不同主题 |
| Docs | 自动生成组件文档页 |
| A11y | 无障碍合规性检查 |
| Measure/Outline | 可视化检查 CSS 布局和盒模型 |
| Interactions | 调试 play 函数中的交互测试步骤 |

---

## 六、完整使用案例（Vue 3）

### 项目要求

| 要求 | 说明 |
|---|---|
| Vue 3 + Vite | 推荐，原生支持 `@storybook/vue3-vite` |
| TypeScript | 非必须但强烈推荐 |
| Node.js | ≥ 20.19（v10 要求） |

对现有项目结构没有侵入性要求。

### 初始化

```bash
# 一键初始化，自动检测 Vue 3 + Vite
pnpm dlx storybook@latest init
```

执行后项目新增：
- `.storybook/main.ts` — 主配置
- `.storybook/preview.ts` — 全局装饰器、参数
- `package.json` 中新增 storybook 依赖和 scripts

### 配置示例

```typescript
// .storybook/main.ts
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
});
```

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/vue3';

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        light: { name: 'Light', value: '#ffffff' },
        dark: { name: 'Dark', value: '#1a1a2e' },
      },
    },
  },
};
export default preview;
```

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

```bash
pnpm storybook  # 浏览器自动打开 http://localhost:6006
```

### 组件级 Story 示例

以 Button 组件为例：

```typescript
// src/components/BaseButton.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import BaseButton from './BaseButton.vue';

const meta = {
  component: BaseButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof BaseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { label: '确认', variant: 'primary' },
};

export const Loading: Story = {
  args: { label: '提交中', loading: true },
};

export const Disabled: Story = {
  args: { label: '不可用', disabled: true },
};
```

### 交互测试示例

```typescript
import { expect, userEvent, waitFor } from 'storybook/test';
import LoginForm from './LoginForm.vue';

export const InvalidEmail: Story = {
  args: {},
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('邮箱'), 'invalid-email');
    await waitFor(() => {
      expect(canvas.getByText('邮箱格式不正确')).toBeTruthy();
    });
  },
};

export const SuccessfulSubmit: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText('邮箱'), 'user@example.com');
    await userEvent.type(canvas.getByLabelText('密码'), 'mypassword');
    await userEvent.click(canvas.getByRole('button', { name: '登录' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'mypassword',
    });
  },
};
```

### 页面级 Story 示例

```typescript
// src/views/LoginView.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { vueRouter } from 'storybook-vue3-router';
import LoginView from './LoginView.vue';

const meta = {
  component: LoginView,
  tags: ['autodocs'],
  decorators: [
    vueRouter([
      { path: '/', component: LoginView },
      { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    ]),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof LoginView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MobileView: Story = {
  parameters: {
    viewport: { defaultViewport: 'iphone14' },
  },
};
```

### 测试复用（Portable Stories）

```typescript
import { composeStory } from '@storybook/vue3-vite';
import meta, { Primary } from './Button.stories';

test('按钮可点击', async () => {
  const Story = composeStory(Primary, meta);
  await Story.run();
});
```

---

## 七、与传统开发对比

### 传统流程

```
写组件 → 写页面 → 启动 dev server → 手动导航 → 手动测试 → 改代码 → 刷新 → 重新操作...
```

### Storybook 流程

```
写组件 + 同步写 Story → 热更新预览 → Controls 实时调 Props → play 函数自动测试 → Autodocs 自动生成文档
```

### 开发行为变化

| 传统习惯 | Storybook 习惯 | 变化 |
|---|---|---|
| 写完组件再去页面看效果 | 边写组件边写 Story，即时预览 | 开发粒度更细 |
| 手动构造边界场景数据 | Story 中声明式定义每个状态 | 可复用、可回放 |
| 事后补单元测试 | play 函数开发时即测试 | 测试前置 |
| 口头/Wiki 传组件用法 | Autodocs 自动生成文档 | 文档永不过期 |
| 在页面中调试组件 | 隔离环境调试 | 干净、快速 |
| 改样式靠肉眼检查 | 可接入视觉回归测试 | 自动发现 UI 偏差 |

**核心行为改变就一件事**：每个组件/页面写完后，配套写一个 `.stories.ts` 文件。

---

## 八、Story 自动生成方案

### 方案 1：官方 CLI（给人用的）

```bash
# 单组件
pnpm dlx storybook@latest generate src/components/BaseButton.vue

# 批量
pnpm dlx storybook@latest generate "src/**/*.vue"
```

局限：只生成骨架（一个 Default Story），边界状态和交互测试需手动补充。

### 方案 2：AI 智能体生成（最实用）

AI 智能体**不会调用 `storybook generate`**，而是直接读取组件源码和项目上下文，一次写出完整的 `.stories.ts`。

原因：
- `storybook generate` 只能输出骨架
- AI 能读懂 Props 类型、理解业务语义
- 直接写文件比调用 CLI 再编辑更高效

实际过程：
1. 读取组件源码 → 分析 Props、Events、业务逻辑
2. 读取已有 Story → 学习项目风格
3. 直接写入完整文件（包含边界状态和 play 函数）

### 方案 3：自定义 Node 脚本（完全可控）

使用 `vue-docgen-api` 解析组件类型，按自定义模板生成 Story 文件。

### 官方工具总结

| 工具 | 类型 | 功能 |
|---|---|---|
| `storybook generate` | CLI | 为组件生成 Story 骨架 |
| `create-storybook` | CLI | 从零创建 Storybook 项目 |
| `tags: ['autodocs']` | 配置 | 从 Story 自动生成文档 |
| `@storybook/mcp` | MCP 服务器 | 让 AI 读取组件信息（非写 Story） |
| `@storybook/addon-mcp` | 插件 | dev server 内跑 MCP |

注：Storybook 官方没有提供 agent skill 来自动生成 Story。

---

## 九、CI 集成

```yaml
# .github/workflows/storybook.yml
name: Storybook Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm test-storybook --coverage
      - run: pnpm build-storybook
```

构建产物可部署到 GitHub Pages / Vercel，供设计师和 PM 查看组件库。
