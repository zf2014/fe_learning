# React 文件夹结构最佳实践 [2026]

> 原文：[React Folder Structure Best Practices [2026] - Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)
> 作者：Robin Wieruch • 更新于 2026年5月5日

组织大型 React 应用的文件夹和文件结构，是一个经常引发激烈讨论的话题。我发现写这个话题很有挑战性，因为没有绝对"正确"的方法。不过，我经常被问及如何组织我的 React 项目——从小型到大型——我很乐意分享我的方法。

在从事 React 应用开发超过十年的今天，我想详细介绍一下我如何处理这个问题——包括我的个人项目、自由职业项目、React 课程以及 React SaaS 产品。我们将逐步深入，你可以决定哪些方法对你有意义，以及你想应用到什么程度。让我们开始吧。

---

## 一、单个 React 文件

第一步遵循的理念是：**一个文件统治一切**。大多数 React 项目从一个 `src/` 文件夹和一个 `src/[name].(js|ts|jsx|tsx)` 文件开始，里面通常有一个 App 组件。至少，当你使用 [Vite](https://www.robinwieruch.de/react-starter/) 创建客户端 React 应用时是这样的。如果你使用的是像 [Next.js](https://www.road-to-next.com/) 这样的服务端驱动 React 框架，你会从 `src/app/page.js` 文件开始。

下面是一个函数组件的示例，它只在单个文件中渲染 JSX：

```tsx
const App = () => {
  const title = "React";

  return (
    <div>
      <h1>Hello {title}</h1>
    </div>
  );
};

export default App;
```

随着这个组件添加更多功能，它自然变得越来越大，有必要将其拆分为更小、独立的 React 组件。在这个例子中，我们从 App 组件中提取了一个列表组件和另一个子组件，需要通过 props 传递数据：

```tsx
const projects = [
  {
    id: "1",
    name: "Internal Tools",
  },
  {
    id: "2",
    name: "Mobile App",
  },
];

const ListItem = ({ project }) => (
  <li>
    <span>{project.id}</span>
    <span>{project.name}</span>
  </li>
);

const List = ({ list }) => (
  <ul>
    {list.map((project) => (
      <ListItem key={project.id} project={project} />
    ))}
  </ul>
);

const App = () => <List list={projects} />;
```

启动新 React 项目时，一个文件中有多个组件是可以接受的。在较大的应用中，如果组件之间关系紧密，这种做法仍然可以容忍。但随着项目增长，单个文件最终会变得不够用。到那时，你就需要过渡到使用多个文件。

---

## 二、多个 React 文件

第二步遵循的理念是：**多个文件统治一切**。以我们之前的 `List` 和 `ListItem` 组件为例——不必把所有内容都放在一个文件中，我们可以将这些组件拆分到多个文件中。你决定要做到什么程度。例如，我会采用以下文件夹结构：

```
- src/
--- app.js
--- list.js
```

`list.js` 文件包含 `List` 和 `ListItem` 组件的实现细节，但只将 List 组件作为 API 从文件中导出：

```tsx
const ListItem = ({ project }) => (
  <li>
    <span>{project.id}</span>
    <span>{project.name}</span>
  </li>
);

const List = ({ list }) => (
  <ul>
    {list.map((project) => (
      <ListItem key={project.id} project={project} />
    ))}
  </ul>
);

export { List };
```

接着，`app.js` 文件可以导入 List 组件并使用它：

```tsx
import { List } from './list';

const projects = [ ... ];

const App = () => <List list={projects} />;
```

如果你想更进一步，也可以将 `ListItem` 组件提取到自己的文件中，让 `List` 组件导入它：

```
- src/
--- app.js
--- list.js
--- list-item.js
```

不过，如前所述，这可能有点过头了，因为此时 `ListItem` 组件与 `List` 组件紧密耦合，且没有在其他地方复用。因此，最好把它留在 `src/list.js` 文件中。

> **关于文件命名**：推荐使用 kebab-case（短横线命名）而非 PascalCase（大驼峰命名）。参考 [Robin 的推文](https://x.com/rwieruch/status/1836434009041035635)。

我遵循的经验法则是：当一个 React 组件变成可复用的 React 组件时，就将其拆分为独立的文件，就像我们对 `List` 组件做的那样，使其可供其他 React 组件访问。

另请注意，为了简单起见，我在本文中通篇使用 `.js` 扩展名。在现代 React 代码库中，你几乎总会看到 `.tsx` 文件（TypeScript with JSX），因为 TypeScript 已经成为严肃 React 开发的默认选择。文件夹结构无论哪种方式都保持不变。

---

## 三、从文件到文件夹

从这里开始，情况变得更有趣也更有争议性。每个 React 组件最终都会变得复杂。不仅因为添加了更多逻辑（例如更多的 JSX 条件渲染或带有 React Hooks 和事件处理的逻辑），还因为有更多的技术关注点，如样式、测试、常量、工具函数、类型。所有这些都可能被提取到各自独立的文件中。

一个天真的方法是在每个 React 组件旁边添加更多文件。例如，假设每个 React 组件都有一个测试文件和一个样式文件：

```
- src/
--- app.js
--- app.test.js
--- app.css
--- list.js
--- list.test.js
--- list.css
```

不难看出，这不能很好地扩展，因为随着 `src/` 文件夹中每个额外的 React 组件的增加，我们会越来越看不清每个单独的组件。这就是为什么我喜欢为每个 React 组件建一个文件夹：

```
- src/
--- app/
----- index.js
----- component.js
----- test.js
----- style.css
--- list/
----- index.js
----- component.js
----- test.js
----- style.css
```

新的 style 和 test 文件分别实现每个本地组件的样式和测试，而新的 `component.js` 文件则保存组件的实际实现逻辑。

如果你使用的是 Tailwind CSS（或其他 utility-first 或 CSS-in-JS 方法），你的组件文件夹可能根本不需要 `style.css` 文件。样式作为 className 字符串存在于 `component.js` 中，因此每个组件少了一个文件。文件夹的结构仍然保持不变。

### 关于 index.js（Barrel 文件）

需要解释的是新的（但可选的）`index.js` 文件，它代表文件夹（即模块）的公共接口（即公共 API），所有与外部世界相关的内容都从这里导出。许多人称之为 **barrel 文件**，这在 JavaScript 中通常不被推荐，因为它使打包工具的 tree shaking 更加困难。

但是，如果你不只是重新导出文件夹中的所有内容，而是只导出公共 API，那么这可能是一个好做法，因为你不会向外部世界泄露实现细节（例如样式）。换句话说，你只允许从 `index.js` 文件导入，而不能从 `component.js` 或 `style.css` 文件导入。

例如，对于 `List` 组件，`src/list/index.js` 文件如下所示：

```tsx
export * from "./list";
```

如果你想要更具体，以避免泄露实现细节，你也可以直接导出 List 组件：

```tsx
import { List } from "./list";

export { List };
```

App 组件在其 `component.js` 文件中仍然可以通过以下方式导入 List 组件：

```tsx
import { List } from "../list/index.js";
```

我们也可以省略 `/index.js`，因为对于大多数 JavaScript 打包工具来说，这是默认行为：

```tsx
import { List } from "../list";
```

无论如何，barrel 文件在 JavaScript 中逐渐过时了，因为它们使打包工具的 tree shaking 更加困难。所以你也可以直接从 `src/list/list.js` 文件导入 `List` 组件，省略 `src/list/index.js` 文件。

### 命名约定的灵活性

另外，所展示文件的命名约定也是有争议的：例如，如果想要复数形式的文件名，`test.js` 可以变成 `spec.js`，`style.css` 可以变成 `styles.css`。此外，如果你不使用 CSS 而是使用 CSS Modules，你的文件扩展名也可能从 `style.css` 变为 `style.module.css`。

> 了解更多：[React 中的 CSS 样式](https://www.robinwieruch.de/react-css-styling/)

一旦你习惯了这种文件夹和文件的命名约定，你就可以在 IDE 中模糊搜索 "list component" 或 "app test" 来打开每个文件。

但在这里我承认，与我个人偏爱简洁文件名相反的是，人们往往更喜欢在他们的文件夹/文件命名中更加冗余：

```
- src/
--- app/
----- index.js
----- app.js
----- app.test.js
----- app.style.css
--- list/
----- index.js
----- list.js
----- list.test.js
----- list.style.css
```

### 折叠后的视图

如果你折叠所有组件文件夹，不管文件名如何，你都会得到一个简洁的文件夹结构，其中隐藏了组件的所有实现细节：

```
- src/
--- app/
--- list/
```

### 更多技术关注点的扩展

如果组件有了更多技术关注点，例如你可能想要将自定义 React Hooks、类型（如 TypeScript 定义）、stories（如 Storybook）、工具函数（如辅助函数）或常量（如 JavaScript 常量）提取到专用文件中，你可以在组件文件夹内横向扩展这种方法：

```
- src/
--- app/
----- index.ts
----- component.ts
----- test.ts
----- style.css
----- types.ts
--- list/
----- index.ts
----- component.ts
----- test.ts
----- style.css
----- hooks.ts
----- stories.ts
----- types.ts
----- utils.ts
----- constants.ts
```

### 子组件的处理

如果你决定通过将 `ListItem` 组件提取到自己的文件来保持 `List` 组件更小，那么你可以尝试以下文件夹结构：

```
- src/
--- app/
----- index.js
----- component.js
----- test.js
----- style.css
--- list/
----- index.js
----- component.js
----- test.js
----- style.css
----- list-item.js
```

一旦 `ListItem` 组件的规模和复杂度增长，你可以更进一步，为该组件提供自己的嵌套文件夹，包含所有其他技术关注点：

```
- src/
--- app/
----- index.js
----- component.js
----- test.js
----- style.css
--- list/
----- index.js
----- component.js
----- test.js
----- style.css
----- list-item/
------- index.js
------- component.js
------- test.js
------- style.css
```

> **嵌套深度**：我的经验法则是避免嵌套超过两层。例如，`list` 和 `list-item` 文件夹保持现状即可，但不应在 `list-item` 文件夹内部再创建另一个嵌套文件夹。当然，这个规则总有例外。

> 了解更多：[2026 年 React 库](https://www.robinwieruch.de/react-libraries/)

**小结**：如果你的项目不超过小型 React 项目，我认为这是组织 React 组件的最佳方式。

---

## 四、React 中的技术文件夹

下一步将帮助你组织**中型 React 应用**，因为它将 React 组件与可复用的 React 特性（如自定义 Hooks 和 Context）分开，也与非 React 相关的特性（如辅助函数，即 `utils/`）分开。

以下面的文件夹结构为基础，增加一个分隔文件夹：

```
- src/
--- components/
----- app/
------- index.js
------- component.js
------- test.js
------- style.css
----- list/
------- index.js
------- component.js
------- test.js
------- style.css
```

之前的所有 React 组件被归入一个新的 `components/` 文件夹。这给了我们另一个垂直层级，用于为其他技术类别创建文件夹。

> 了解更多：[自定义 React Hooks](https://www.robinwieruch.de/react-custom-hook/)

### Hooks 文件夹

例如，在某个时候，你可能有可以被多个组件使用的可复用 React Hooks。所以，与其将 hook 与组件紧密耦合，你可以将其实现放在一个专用文件夹中，与所有组件共享：

```
- src/
--- components/
----- app/
------- index.js
------- component.js
------- test.js
------- style.css
----- list/
------- index.js
------- component.js
------- test.js
------- style.css
--- hooks/
----- use-click-outside.js
----- use-scroll-detect.js
```

> **注意**：并非所有 hooks 都应该放在这个文件夹中。仍然只被一个组件使用的 React Hooks 应该保留在组件的文件中，或者放在组件文件夹中组件旁边的 `hooks.js` 文件中。只有可复用的 hooks 才会放入新的 `hooks/` 文件夹。

如果一个 hook 需要更多文件，你可以再次将其改为文件夹。你也可以混合使用文件夹和文件结构：

```
- src/
--- components/
----- app/
------- index.js
------- component.js
------- test.js
------- style.css
----- list/
------- index.js
------- component.js
------- test.js
------- style.css
--- hooks/
----- use-click-outside/
------- index.js
------- hook.js
------- test.js
----- use-scroll-detect.js
```

### Context 文件夹

同样的策略可能适用于你在 React 项目中使用 React Context 的情况。因为 context 需要某处实例化，为它设置一个专用的文件夹/文件是最佳实践，因为它最终需要被许多 React 组件访问：

```
- src/
--- components/
----- app/
------- index.js
------- component.js
------- test.js
------- style.css
----- list/
------- index.js
------- component.js
------- test.js
------- style.css
--- hooks/
----- use-click-outside.js
----- use-scroll-detect.js
--- context/
----- session.js
```

### Utils 文件夹

从这里开始，可能还有其他工具函数需要从 `components/` 文件夹访问，也需要从 `hooks/` 和 `context/` 等其他新文件夹访问。

对于各种杂项工具函数，我通常创建一个 `utils/` 文件夹。名称由你决定。同样，让逻辑可被项目中其他代码访问的原则驱动了这种技术划分：

```
- src/
--- components/
----- app/
----- list/
--- hooks/
----- use-click-outside.js
----- use-scroll-detect.js
--- context/
----- session.js
--- utils/
----- error-tracking/
------- index.js
------- util.js
------- test.js
----- format/
------- date-time/
--------- index.js
--------- util.js
--------- test.js
------- currency/
--------- index.js
--------- util.js
--------- test.js
```

以 `date-time/index.js` 文件的实现细节为例：

```tsx
export const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).format(date);

export const formatMonth = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(date);
```

> 推荐使用 [JavaScript 的 Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) 进行日期转换，而不是在 React 组件中直接使用该 API。

现在可以单独导入每个日期格式化函数：

```tsx
import { formatMonth } from "../../utils/format/date-time";

const month = formatMonth(new Date());
```

但我更喜欢将其作为一个带有公共 API 的封装模块，采用以下导入策略：

```tsx
import * as dateTimeUtil from "../../utils/format/date-time";

const month = dateTimeUtil.formatMonth(new Date());
```

使用相对路径导入可能会变得困难。因此，我始终选择使用别名搭配绝对导入：

```tsx
import * as dateTimeUtil from "@/utils/format/date-time";

const month = dateTimeUtil.formatMonth(new Date());
```

你可以根据需求调整这个结构，例如让 utils 结构更细粒度：

```
--- utils/
----- error-tracking/
------- index.js
------- util.js
------- test.js
----- format/
------- date-time/
--------- date-time/
----------- index.js
----------- util.js
----------- test.js
--------- date/
----------- index.js
----------- util.js
----------- test.js
--------- time/
----------- index.js
----------- util.js
----------- test.js
------- currency/
--------- index.js
--------- util.js
--------- test.js
```

### 其他常见技术文件夹

| 文件夹 | 通常存放的内容 |
|--------|----------------|
| `lib/` | 第三方库的预配置封装（axios 实例、Firebase 初始化、配置好的客户端） |
| `api/` | 当多个功能共享相同端点时的集中式 API 客户端代码 |
| `stores/` | 全局状态（Redux、Zustand、Jotai stores） |
| `config/` | 环境变量、应用级常量、运行时配置 |
| `types/` | 共享的 TypeScript 类型和接口 |
| `providers/` | Context provider 组件，通常与 `context/` 配合使用 |
| `layouts/` | 顶级布局组件，如侧边栏、导航栏、容器 |
| `assets/` | 静态文件：图片、字体、图标 |
| `utils/` vs `helpers/` | 一些团队拆分这两者：`utils/` 是通用的、可跨项目复制粘贴的；`helpers/` 是项目特定的 |
| `routes/` 或 `router/` | 路由配置（替代 `pages/`） |
| `testing/` | 集中式的 mock、测试工具、测试工厂 |

> **建议**：你不需要所有这些。选择那些映射到项目中实际关注点的文件夹。如有疑问，从 `components/`、`hooks/` 以及 `utils/` 或 `lib/` 之一开始，然后随着代码库的需要逐步添加。

**请将提议的文件夹结构视为结构指南而非命名约定。文件夹和文件的命名由你决定。**

---

## 五、React 中的功能文件夹

下一步将帮助你组织**大型 React 应用**，因为它将特定的功能相关组件与通用 UI 组件分开。前者通常在 React 项目中只使用一次，后者则是被多个组件使用的 UI 组件。

当你的 `components/` 文件夹中的组件过多时：

```
- src/
--- components/
----- list/
----- input/
----- button/
----- checkbox/
----- radio-button/
----- dropdown/
----- profile/
----- avatar/
----- project-form/
----- project-list/
----- customer-form/
----- customer-detail/
----- contact-card/
----- contact-list/
```

**解决思路**：将 `components/` 文件夹仅用于可复用的组件（如 UI 组件）。所有其他组件应该移到各自的功能文件夹中。

```
- src/
--- features/
----- user/
------- profile/
------- avatar/
----- project/
------- project-form/
------- project-list/
----- customer/
------- customer-form/
------- customer-detail/
----- contact/
------- contact-card/
------- contact-list/
--- components/
----- list/
----- input/
----- button/
----- checkbox/
----- radio-button/
----- dropdown/
```

### 命名规范

我全程保持文件夹和组件名称使用**单数**：
- `features/customer`，而不是 `features/customers`
- `customer-list`，而不是 `customers-list`
- `customer-list-item` 而非 `customer-list-items`

**例外情况**：当文件夹或文件真正持有一个集合时：
- 顶层文件夹如 `features/`、`components/`、`hooks/` 使用复数
- bundle 文件如 `types.ts`、`hooks.ts`、`stories.ts`、`utils.ts`、`constants.ts` 使用复数

### 功能文件夹内的技术关注点

如果某个功能组件需要共享的 UI 组件，从可复用的 UI 组件文件夹中导入。此外，如果工具函数与某个功能紧密耦合，则将其移到特定的功能文件夹中：

```
- src/
--- features/
----- user/
------- profile/
------- avatar/
----- project/
------- project-form/
------- project-list/
----- customer/
------- customer-form/
------- customer-detail/
------- utils/
--------- address/
----------- index.js
----------- util.js
----------- test.js
----- contact/
------- contact-card/
------- contact-list/
------- utils/
--------- phone/
----------- index.js
----------- util.js
----------- test.js
--- components/
--- hooks/
--- context/
--- utils/
----- format/
------- date-time/
--------- index.js
--------- util.js
--------- test.js
```

你也可以进一步细分功能文件夹：

```
----- customer/
------- components/
--------- customer-form/
--------- customer-detail/
------- utils/
--------- address/
----------- index.js
----------- util.js
```

整体思路：

```
- src/
--- features/
----- feature-one/
------- technical-concern-one/
------- technical-concern-two/
------- ...    // <--- 可能更多技术关注点
----- feature-two/
------- technical-concern-one/
------- technical-concern-two/
------- ...    // <--- 可能更多技术关注点
--- components/
--- hooks/
--- context/
--- utils/
...            // <--- 可能更多全局共享的技术文件夹
```

**核心思想**：将功能相关组件与可复用组件分离，并将技术关注点与功能相关组件分离。

---

## 六、将工具函数提升到共享层

当某个工具函数只被一个功能使用时，放在该功能内部是正确做法。但一旦第二个功能也需要同样的逻辑，就应该将其**提升**到顶层的共享 `utils/` 文件夹。

例如，address 格式化从 `features/customer/utils/address/` 提升到 `utils/format/address/`：

```
- src/
--- features/
----- user/
------- profile/
------- avatar/
----- project/
------- project-form/
------- project-list/
----- customer/
------- customer-form/
------- customer-detail/
----- contact/
------- contact-card/
------- contact-list/
------- utils/
--------- phone/
--- components/
--- hooks/
--- context/
--- utils/
----- format/
------- address/
--------- index.js
--------- util.js
--------- test.js
------- date-time/
--------- index.js
--------- util.js
--------- test.js
```

> **经验法则**：如果恰好只有一个功能使用某个工具函数，它就放在该功能内部；一旦有两个或更多功能需要它，就将其上移到共享层。

同样的逻辑也适用于 hooks、context 和组件。顶层技术文件夹的全部目的就是成为那些真正跨越功能边界的事物的归属地。

---

## 七、React 中功能之间的边界

有了功能文件夹之后，关键问题不在于东西放在哪里，而在于**它们如何被允许相互通信**。

### 三条核心规则

1. **代码单向流动**
   - 从共享工具（`components/`、`hooks/`、`utils/`）→ 功能 → 页面
   - 绝不允许反方向。可复用组件不应深入功能内部。

2. **功能之间不互相导入**
   - 如果 `features/project/` 需要来自 `features/customer/` 的东西，说明共享部分应该上移一层，或者两个功能应该在页面级别组合。
   - 保持功能的独立性是使它们可移除的关键。

3. **每个功能都有一个公共 API**
   - 即 `index.js` 文件。外部代码从 `features/project`（公共表面）导入，绝不从内部实现文件导入。
   - 未从公共 API 导出的内容都是实现细节，可以自由重组。

### 边界测试

选择一个功能文件夹，想象**删除它**，问自己有多少其他文件夹会损坏：
- ❌ 如果答案是"所有东西"——边界泄漏了
- ✅ 如果答案是"组合它的那些页面，加上引用了其公共 API 的地方出现干净错误"——状态良好

---

## 八、React 中的领域文件夹

当 `features/` 文件夹增长到一定程度时，你会发现一些功能会聚集在一起。引入 `domains/` 文件夹，按业务领域对功能进行分组：

```
- src/
--- domains/
----- workspace/
------- features/
--------- project/
--------- customer/
--------- contact/
----- core/
------- features/
--------- user/
--------- tenant/
----- cms/
------- features/
--------- comment/
--------- space/
--- components/
--- hooks/
--- context/
--- utils/
```

**边界规则同样适用**：
- `workspace/` 内的功能不直接从 `cms/` 内的功能导入
- 如果需要，共享部分移到 `core/`（允许所有人依赖）或顶层的共享文件夹
- "删除一个领域"测试：如果移除 `cms/` 破坏了 `workspace/`，说明领域泄漏了

> 这对小型或中型应用来说并不适用。它是将共享代码提取到独立 package 之前的自然步骤。

---

## 九、React 中的 Package 文件夹

当应用增长或需要严格边界时，将共享代码提取到 `src/` 旁边的独立 package 中：

```
- src/
--- domains/
----- workspace/features/...
----- core/features/...
--- app/
--- ...
- packages/
--- shared/
----- src/components/
----- src/hooks/
----- src/utils/
- package.json
```

`packages/` 下的每个条目都是自己的模块，有自己的 `package.json`。应用按名称（如 `@yourorg/shared`）从这些包导入。

**配置 package** 也放在这里：
- `packages/typescript-config/` — 共享 tsconfig 预设
- `packages/vitest-config/` — 测试设置
- `packages/eslint-config/` — lint 规则

---

## 十、React 中的应用文件夹（Monorepo）

当一个项目需要交付多个可部署的 Web 应用时：

```
- apps/
--- web-admin/
--- web-workspace/
--- web-cms/
- domains/
--- workspace/src/features/...
--- core/src/features/...
--- cms/src/features/...
- packages/
--- shared/src/...
--- typescript-config/
--- vitest-config/
- package.json
```

### 依赖规则

- **应用** 可以依赖领域和 package。应用之间不互相依赖。
- **领域** 可以依赖 package。大多数领域还可以依赖一个基础领域（`core` 或 `platform`）。除此之外，领域之间不直接互相依赖。
- **Package** 不依赖任何人。它们是基础构建块。

> 这是作者目前在真实生产项目上使用的结构。早期的单应用结构并没有消失——它存在于每个领域（`features/`、`components/`、`hooks/`、`utils/`）和每个应用（`app/`、`pages/`）内部，只是降了一层而已。

---

## 十一、额外内容：页面驱动的项目结构

最终，你的 React 应用中会有多个页面。在 Next.js 中，`app/` 文件夹就是页面文件夹：

```
- src/
--- pages/
--- features/
--- components/
--- hooks/
--- context/
--- utils/
```

Next.js 项目示例（围绕项目功能的 CRUD 应用）：

```
- src/
--- app/
----- page.tsx
----- projects/
------- page.tsx
------- [projectId]
--------- page.tsx
--- features/
----- project/
------- project-list/
----- contact/
------- contact-list/
--- components/
----- list/
--- hooks/
--- context/
--- utils/
```

### 可讨论的设计问题

**Q: contact 功能文件夹是否应该嵌套在 project 功能文件夹中？**
- 如果 contact 仅被 project 使用 → 可以嵌套
- 如果 contact 被多个功能使用 → 不应嵌套

**Q: list 组件是否应该嵌套在 project 功能文件夹中？**
- 如果仅被 project 使用 → 可以
- 如果被多个功能使用 → 不应嵌套

**Q: 是否应将 project 功能作为私有文件夹移到 `pages/projects/` 中？**
- 作者建议不要这样做，因为：1) 破坏功能文件夹结构的一致性；2) 降低灵活性（以后想在其他页面复用就得移出来）

---

## 十二、展望：大规模下的功能内部结构

一个领域 package 内的功能在生产规模下的样子：

```
domains/workspace/src/features/project/
--- types.ts
--- enums/
----- project-state.ts
--- queries/
----- get-project.ts
----- get-projects.ts
--- actions/
----- upsert-project-action.ts
----- delete-project-action.ts
--- components/
----- project-upsert-form.tsx
----- project-delete-button.tsx
----- project-table/
------- columns.tsx
------- table.tsx
------- index.ts
--- relations/
----- customer/
------- actions/
--------- add-customer-to-project-action.ts
------- components/
--------- customer-for-project-manage-button.tsx
----- user/
------- queries/
--------- get-projects-by-user.ts
```

一个功能拥有其完整切片：
- 数据获取（`queries/`）
- 数据变更（`actions/`）
- UI（`components/`）
- 类型和枚举
- 与功能耦合的 hooks 或 utils

**命名约定**：全程使用 kebab-case。server action 使用 `-action.ts` 后缀，query 使用 `get-` 前缀。

**`relations/` 子文件夹**：处理功能之间不可避免的耦合。`project/relations/customer/` 精确地告诉你存在什么样的耦合以及在哪里找到它，而不是让耦合泄漏到任一功能的主文件夹中。

---

> **总结**：以上展示的方法都不是一成不变的。由于每个 React 项目都会随时间增长，大多数文件夹结构也会很自然地演变。这个逐步过程是为了在你觉得失控时提供一些指导。请根据你的项目和团队需求，加入自己的风格。
