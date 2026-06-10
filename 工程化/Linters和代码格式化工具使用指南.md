# 如何在项目中使用 Linters 和代码格式化工具

大家好！在这篇文章中,我们将了解两个非常有用的工具,它们可以让我们的编码工作变得更加轻松:linting 工具(代码检查工具)和代码格式化工具。

我们将讨论这些工具是什么、它们如何工作、为什么有用,最后看看如何在一个基本的 React 项目中实现它们。

让我们开始吧!

## 目录

- [关于 linting 工具](#heading-about-linting-tools)
  - [什么是 linting 工具?](#heading-what-are-linting-tools)
  - [为什么 linting 工具有用?](#heading-why-are-linting-tools-useful)
  - [市场上主要的 linting 工具](#heading-main-linting-tools-in-the-market)
- [关于代码格式化工具](#heading-about-code-formatters)
  - [什么是代码格式化工具?](#heading-what-are-code-formatters)
  - [为什么代码格式化工具有用?](#heading-why-are-code-formatters-useful)
  - [主要的代码格式化工具](#heading-main-code-formatters-available)
- [如何实现 ESLint 和 Prettier](#heading-how-to-implement-eslint-and-prettier)
  - [如何安装 ESLint](#heading-how-to-install-eslint)
  - [如何安装 Prettier](#heading-how-to-install-prettier)
- [总结](#heading-wrapping-up)

## 关于 Linting 工具

在 Web 开发世界中,linting 工具已经成为开发者工具包的重要组成部分。

Linting 工具用于分析源代码中的潜在错误或样式问题,使在整个项目中维护代码质量和一致性变得更加容易。

### 什么是 Linting 工具?

Linting 工具是自动化工具,用于分析源代码以检测潜在错误、安全漏洞或编码样式问题。

它们旨在帮助开发者在问题变得严重之前发现错误,并促进编码最佳实践。

术语"lint"源自第一个 lint 工具的名称,该工具由 Stephen C. Johnson 带领的贝尔实验室研究团队在 20 世纪 70 年代初开发。

最初的 lint 工具旨在分析 C 源代码中的潜在错误和样式问题。

自那时起,linting 工具已经发展到可以与多种编程语言一起工作,包括 JavaScript、Python 和 Ruby。

### 为什么 Linting 工具有用?

Linting 工具有用有很多原因。首先,它们帮助你在开发过程的早期发现错误,此时修复错误更容易且成本更低。

其次,它们可以帮助在开发团队中推广编码标准和最佳实践,确保代码的一致性和可维护性。

最后,它们可以帮助你识别代码中的潜在安全漏洞,降低被攻击的风险。

### 市场上主要的 Linting 工具

今天市场上有几种 linting 工具可用。以下是最流行的一些:

1. **ESLint:** [ESLint](https://eslint.org/) 是广泛使用且高度可配置的 JavaScript 和 TypeScript linter。它可以通过插件进行扩展,支持各种规则集,使其成为强制执行编码标准和防止错误的灵活工具。

2. **JSHint:** [JSHint](https://jshint.com/) 是一个自 2010 年以来就存在的流行 linter。它提供简单的配置和广泛的内置规则,帮助开发者避免常见的陷阱并提高代码质量。

3. **JSLint:** [JSLint](https://www.jslint.com/) 是为 JavaScript 开发的第一个 linter 之一,今天仍在使用。它以其严格性和强制执行特定代码风格而闻名,这对于在团队中保持一致性很有帮助。

4. **StandardJS:** [StandardJS](https://standardjs.com/) 是一个流行的 linter,旨在为 JavaScript linting 提供"开箱即用"的方法。它具有最少的配置,包含一套意见鲜明的规则,旨在促进干净、可读的代码。

我们还应该谈谈 **TypeScript**。使用 [TypeScript](https://www.typescriptlang.org/) 时,TypeScript 编译器本身充当 linter。它检查 TypeScript 代码的语法,并在出现问题时提供警告和错误。这个内置的 linter 可以捕获常见的错误和问题,例如拼写错误的变量名、无效的方法调用和语法错误。

可以在终端中使用 `tsc` 命令运行 TypeScript 编译器。当使用 `--noEmit` 标志时,TypeScript 编译器将只执行语法检查,而不会将代码编译为 JavaScript。这允许编译器充当 linter 并在代码质量方面提供反馈,而无需实际生成任何输出。

你还可以使用 `tsconfig.json` 文件配置 TypeScript 编译器,以指定各种选项,包括检查的严格程度。这可以帮助捕获更多潜在问题并确保代码遵循最佳实践。

如果你不熟悉 TypeScript,我推荐你阅读[我之前写的这篇文章](https://www.freecodecamp.org/news/an-introduction-to-typescript/)。

## 关于代码格式化工具

在现代 Web 开发中,代码格式化工具已成为开发者的必备工具。这些工具自动化了代码格式化过程,使编写和阅读代码变得更加容易。

### 什么是代码格式化工具?

代码格式化工具是帮助你自动格式化源代码的自动化工具。代码格式化工具的主要目的是在整个项目或团队中标准化代码的格式,使阅读和理解代码更加容易。

使用代码格式化工具,开发者不再需要花费时间手动格式化代码,这可以节省大量的时间和精力。

代码格式化工具已经存在了几十年。最早的工具之一是"indent"程序,用于在 20 世纪 70 年代初格式化 C 代码。但这些早期工具功能有限,不具备现代代码格式化工具的相同功能水平。

在 2000 年代初,开发了像"astyle"和"uncrustify"这样的工具,引入了更高级的格式化功能。

### 为什么代码格式化工具有用?

代码格式化工具有用有多种原因。首先,它们帮助标准化代码格式,使阅读和理解代码更加容易。这在处理由多个开发者开发的大型项目时尤为重要,因为每个人都需要能够阅读和理解彼此的代码。

代码格式化工具还有助于确保项目或团队中的代码一致,这可以帮助防止错误并提高代码质量。它们还使得随着时间的推移维护代码变得更加容易,因为代码的格式是一致的,更容易阅读和理解。

### 主要的代码格式化工具

今天市场上有几种代码格式化工具可用。以下是最流行的一些:

1. **Prettier:** [Prettier](https://prettier.io/) 是一个流行的 JavaScript、TypeScript 和 CSS 代码格式化工具。它高度可配置,可以在各种不同的环境中使用,包括编辑器、构建工具和代码质量检查器。

2. **ESLint:** 虽然主要被认为是 linting 工具,但 [ESLint](https://eslint.org/) 也可以用作代码格式化工具。它有一个 `--fix` 标志,可以根据你定义的规则自动格式化你的代码。

3. **Beautify:** Beautify 是一个用于 JavaScript、HTML 和 CSS 的代码格式化工具,可以在各种编辑器和 IDE 中使用。它允许你自定义格式化选项,并支持多种语言。

## 如何实现 ESLint 和 Prettier

很好,现在让我们看看 linter 和代码格式化工具的实际操作!我们将在一个简单的 React 项目中实现两个最流行的工具(ESLint 和 Prettier),以了解这些东西是如何工作的。

首先,通过在命令行中运行以下命令来创建我们的项目:`npm create vite@latest linternsAndFormatters --template react`

然后 `cd` 进入你的项目并运行 `npm install`,这样我们的依赖项就会被安装。

现在我们的项目已经启动并运行,我们将从安装 **ESLint** 开始。

### 如何安装 ESLint

要安装 ESLint,我们可以在控制台中运行 `npm init @eslint/config`。这将触发一系列提示,询问我们要如何在项目中使用 ESLint 并构建相应的配置。你的控制台可能最终看起来像这样:

![安装 ESLint](https://www.freecodecamp.org/news/content/images/2023/04/image-72.png)

完成所有这些后,我们将看到项目根目录中有一个名为 `.eslintrc.cjs` 的新文件。这是 ESLint 配置的位置,我们可以根据自己的偏好自定义 linter。根据我选择的选项,初始配置如下:

```javascript
module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    "overrides": [
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "react"
    ],
    "rules": {
    }
}
```

为了让我们的 linter 工作,让我们在 `package.json` 文件中添加以下脚本:

```json
"lint": "eslint --fix . --ext .js,.jsx"
```

这个脚本执行带有 `--fix` 选项的 `eslint` 命令,以自动修复 linting 错误和警告。该命令对项目根目录中所有扩展名为 `.js` 或 `.jsx` 的文件执行,由 `.` 参数指定。

现在让我们修改我们的 `app.jsx` 文件,使其包含以下代码:

```jsx
import React from 'react'
import './App.css'

function App() {

  const emptyVariable = ''

  return (
    <div className="App">
      <h1>Vite + React</h1>
    </div>
  )
}

export default App
```

然后运行 `npm run lint`,瞧!你的 linter 用红色高亮文本尖叫,告诉你代码中有一个未使用的变量! =D

![ESLint 检测到未使用的变量](https://www.freecodecamp.org/news/content/images/2023/04/image-73.png)

### 如何安装 Prettier

很好,现在让我们转向我们的代码格式化工具。

我们将通过运行 `npm install --save-dev --save-exact prettier` 来安装它。

然后我们将通过运行 `echo {}> .prettierrc.json` 创建一个空配置文件。

既然我们在这里,请将以下选项添加到你新创建的配置文件中:

```json
{
  "singleQuote": true,
  "jsxSingleQuote": true,
  "semi": false
}
```

这样做可以确保尽可能使用单引号,并且不存在分号(因为,天哪,谁喜欢分号...)。

就像我们对 linter 所做的那样,让我们在 `package.json` 文件中添加以下脚本:

```json
"format": "prettier --write ."
```

该脚本在项目目录及其子目录中的所有文件上运行 Prettier 代码格式化工具。使用 `--write` 选项运行时,它会就地修改文件,使其符合 Prettier 关于缩进、行长和其他格式化选项的规则。`.` 参数指定项目目录及其子目录中的所有文件都应该被格式化。

最后,让我们像这样"丑化"`app.jsx` 文件的第一行:

```jsx
import React from "react";
```

运行 `npm run format`,你应该看到它在你面前被纠正:

```jsx
import React from 'react'
```

现在你可以放心了,那些丑陋的分号不会再回来困扰你了。 ;)

正如我们所看到的,这两个工具的设置并不复杂,它们确实有助于使我们的日常工作更加轻松。ESLint 将帮助我们捕获错误和不必要/冗余的代码,Prettier 将帮助我们在整个代码库中标准化代码格式。

另一个技巧是,如果你有 CI/CD 流水线,最好将 linting 和格式化脚本作为工作流程的一部分来实现。这将有助于确保每次部署都自动进行 linting 和格式化。

如果你不熟悉 CI/CD 或设置流水线,我最近[写了一篇关于这个的文章](https://www.freecodecamp.org/news/what-is-ci-cd/)。 ;)

## 总结

Linters 和代码格式化工具是可以使 Web 开发者受益匪浅的强大工具。

Linters 帮助你在潜在 bug 和问题变得严重之前发现它们,并鼓励你编写更易于维护和可读性更强的代码。

代码格式化工具帮助你执行一致的代码风格和格式,节省时间并减少人为错误的机会。

通过在 Web 开发工作流程中使用这些工具,你可以提高生产力和代码质量。

一如既往,我希望你喜欢这篇文章并学到了新东西。

如果你愿意,你也可以在 [LinkedIn](https://www.linkedin.com/in/germancocca/) 或 [Twitter](https://twitter.com/CoccaGerman) 上关注我。下次见!

![作者 - German Cocca](https://cdn.hashnode.com/res/hashnode/image/upload/v1725624619864/093d60f5-5412-4e63-af0b-38a8bebe93a8.jpeg?w=500&h=500&fit=crop&crop=entropy&auto=compress,format&format=webp)

**German Cocca**

我是一名全栈开发人员(typescript | react | react native | node | express)和计算机科学学生。在这个博客中,我写下我在成为尽可能好的开发者的道路上学到的东西。

---

**原文链接:** [How to Use Linters and Code Formatters in Your Projects](https://www.freecodecamp.org/news/using-prettier-and-jslint/)

**翻译日期:** 2026年6月8日