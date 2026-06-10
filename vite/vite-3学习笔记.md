# Vite学习记录
> 版本 3.0.4

## 一、Vite 插件:
由于vite插件的设计思路源自于rollup，因此vite不仅可以直接使用rollup已有插件，甚至也支持特殊的vite的插件配置
vite插件的核心就是钩子函数(**hooks**)，通过钩子函数来维护模块信息

##### 区分使用场景
设置插件的**apply**属性：**serve** 和 **build**

##### 区分使用顺序
设置插件的**enforce**属性：**pre**、**post**、**undefined**

## 二、Hooks
1. **config**： 在初始化配置文件时被触发，由插件来动态扩展配置（单次）
2. **configResolved**：完成配置初始化后执行（单次）
1. **options**： 创建 PluginContainer 时被触发，可扩展plugin容器的选项 和 minimalContext【最小上下文】（单次）
2. **configureServer**：添加后置服务函数
3. **buildStart**：编译开始回调
6. **transformIndexHtml**：转化index.html文件内容, 内置钩子函数, 会将页面上的js/style模块化, 并且通过 ModuleGraph 对象进行统一管理
7. **★resolveId**：处理资源ID
8. **★load**：加载资源内容
9. **★transform**：对资源进行内容转换，及生成source map数据
10. **configurePreviewServer**：服务于 vite preview 服务

## 三、vite运行时插件
#### ensureWatchPlugin  
> **注:** 仅限**build**模式 且 开启config.build.watch
> 对当前导入文件进行监控 
#### metadataPlugin
> **注:** 仅限**build**模式
> 在renderChunk阶段，初始化chunk.viteMetadata信息
#### preAliasPlugin: 
> 保证符合**pre-bunding**条件的模块，被记录到可优化模块信息中
> 判断是否为bare import
> 判断是否满足别名替换模式
> 再次通过所有vite插件resolveId钩子函数，得到最终的resolveId
> 判断resolveId是否为未优化模块
> 注册为可优化丢失模块
> 执行优化，并收集模块信息
#### aliasPlugin：
> 直接使用 [@rollup/plugin-alias](https://github.com/rollup/plugins/tree/master/packages/alias) 插件  
> import表达式中别名替换

配置[规则](https://github.com/rollup/plugins/tree/master/packages/alias#entries):
``` javascript
config.resolve.alias = [
    { find: 'utils', replacement: '../../../utils' },
    { find: 'batman-1.0.0', replacement: './joker-1.5.0' }
]
```
#### prePlugins
> 执行顺序为 pre 的自定义插件

#### modulePreloadPolyfillPlugin
> **注：** 根据 config.build.polyfillModulePreload 配置，决定是否需要使用该插件

> 替换 vite/modulepreload-polyfill 模块内容
``` javascript
// buildHtmlPlugin插件内注入该表达式
import 'vite/modulepreload-polyfill'
```
> 启动 [modulepreload](https://github.com/guybedford/es-module-shims#modulepreload) 
#### optimizedDepsBuildPlugin
> **注:** **build**模式
> **buildStart钩子**：先初始化基础信息
> **load钩子**：读取文件信息 并 确认首次优化是否已执行
> **transform钩子**：等待所有可优化模块已完成，并触发 onCrawlEnd 内置回调
#### optimizedDepsPlugin
> **注:** **serve**模式
> 读取可优化模块内容
> 如果存在版本插件，则需要更新可优化模块信息
#### ★resolvePlugin
> 处理依赖模块的地址
    
**load**：
替换以 **\_\_vite-browser-external\_\_** 开头的模块内容
``` javascript
// 在解析import语句时，会把nodejs的依赖转换为 __vite-browser-external__:xxx
import '__vite-browser-external__:xxx'
```
build模式
``` javascript
export default {}
```
serve模式：
``` javascript
export default new Proxy({}, {
    get(_, key) {
        throw new Error(`Module "${id}" has been externalized for browser compatibility. Cannot access "${id}.${key}" in client code.`)
    }
})
```

**resolveId**：
> 根据**import**表达式，得到模块文件地址
``` javascript
import 'anyModuleFile'
```
> 如果依赖模块属于pre-bunding，则从已优化储存的信息中返回
> 先根据下面不同的情况得到一个importPath ，然后再尝试调用 **tryFsResolve** 方法，得到具体的文件路径:
> 1.以 /@fs/ 开头的
> 2.以 / 开头
> 3.以 . 开头
> 4.windows系统，以 / 开头
> 5.windows系统，以系统盘开头
> 6.如果是 http:\/\/ 或 https:\/\/ 协议地址
> 7.如果是 data:// 协议地址
> 8.如果是 base import，尝试调用 **tryResolveBrowserMapping** 和 **tryNodeResolve** 方法获取
> 9.如果是 node内置依赖，则返回 __vite-browser-external:xxx

##### tryFsResolve
``` javascript
function tryFsResolve(
    fsPath: string,
    options: InternalResolveOptions,
    tryIndex = true,
    targetWeb = true
): string | undefined
```
**探索方式**:
> 1.尝试读取fsPath文件
> 2.尝试读取fsPath.**后缀**文件
> 3.尝试从fsPath目录下的package.json配置找文件
> 4.尝试读取fsPath/index.**后缀**文件

> **后缀**: 默认值[mjs,js,mts,ts,jsx,tsx,json]，可通过配置 config.resolve.extensions 来扩展


##### tryNodeResolve
> 以 尝试类似Nodejs读取模块的方式，得到模块依赖文件位置
```javascript
export function tryNodeResolve(
    id: string,
    importer: string | null | undefined,
    options: InternalResolveOptions,
    targetWeb: boolean,
    depsOptimizer?: DepsOptimizer,
    ssr?: boolean,
    externalize?: boolean,
    allowLinkedExternal: boolean = true
    ): PartialResolvedId | undefined
```
**探索方式**:
> id值形式：
> 普通形式，例如：baz/xyz
> 特殊模式，例如：foo > bar > baz/xyz

```javascript
// 特殊模式，普通模式为空
let nestedRoot = "foo > bar"
let nestedPath = "baz/xyz"
```
> 根据 nestedRoot，得到 basedir  
> 根据 nestedPath, 得到 possiblePkgIds  
``` javascript
let possiblePkgIds = ['baz', 'baz/xyz']
```
> 根据 basedir 和 possiblePkgIds，判断是否存在`${basedir}${possiblePkgIds[index]}/package.json`文件  
> 如果存在文件，则会根据 package.json 内容读取模块信息

##### tryResolveBrowserMapping
> 根据宿主模块**importer**所在目录的package.json文件中的data.browser映射关系，尝试去获取模块地址
    
#### htmlInlineProxyPlugin
> 加载页面上inline资源
> 
> 处理带 **?html-proxy** 查询条件的模块的内容
> 通常情况下，用户不会主动去导入类似的模块，这些模块是vite内部在处理html文件时，对内联的css 和 js 处理方式
> build模式
> 由 **buildHtmlPlugin** 插件来处理内联资源
> serve模式
> 由 **devHtmlHook** 服务中间件来处理内联资源
> **注**：在上面2种模式的处理过程中，会把内联元素的源码 和 创建的?html-proxy地址做映射关系，然后在该插件的load函数内去读取源码


#### cssPlugin
> 处理css模块代码
> 对css代码进行编译处理 - **模块化**、**预编译**、**postcss**
> 1 原生css内容
> 2 预编译处理 - scss、stylus、less等
> 3 postcss处理：
>- 1 读取postcss配置信息
>- 2 判断代码中是否存在 @import 语法，如果有则添加 postcss-import 插件
>- 3 添加vite内置的 url-rewrite 插件
>- 4 判断css文件是否支持css-module，如果有则添加 postcss-modules 插件
>
> 4 处理编译结果
>- 缓存modules信息
>- build模式且开启config.build.watch，则会开启监控所有dep依赖文件
>- serve模式下，动态添加当前模块的依赖信息，并且对依赖文件开启监控

#### esbuildPlugin
> 决定模块内容是否需要通过esbuild处理
> 可以通过在配置文件中的 [esbuild](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/build.ts#L239) 来配置esbuild参数

> 执行过程:
> 通过 [tsconfck](https://www.npmjs.com/package/tsconfck) 得到ts配置信息
> 允许 .ts、.tsx、.jsx、.mts、.tsx 文件，排除.js文件
> 初始化 esbuild.transform 参数
> 首先是 loader -- 可以通过config.esbuild.loader指定，默认由文件后缀决定
> 其次是 [tsconfigRaw](https://esbuild.github.io/api/#tsconfig) -- 可以通过 config.esbuild.tsconfigRaw，也可以由tsconfig文件
> 最后是 执行编译
> 
``` javascript
esbuild.transform(code, options)
```
    
#### jsonPlugin
识别json文件
如果配置config.json.stringify
``` javascript
export default JSON.parse(`${JSON.stringify(code)}`)
```
否则通过 [dataToEsm](https://github.com/rollup/plugins/tree/master/packages/pluginutils#datatoesm) 工具函数转成标准的esm格式的文件

#### wasmHelperPlugin
> 支持[wasm](https://developer.mozilla.org/zh-CN/docs/WebAssembly)功能
> 
> 如果 importPath = /__vite-wasm-helper，则模块内容替换为：
export default ${[wasmHelperCode](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/wasm.ts#L7)}
[wasmHelperCode](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/wasm.ts#L7) 是 vite 内部提供的辅助方法

> 如果 importPath = xxx.wasm?init，则模块内容替换为：
> import initWasm from '/__vite-wasm-helper'
> export default opts => initWasm(opts, ${JSON.stringify(‘xxx.wasm’)})
> **注**：从上面的替换内容可以发现，xxx.wasm?init 只是暴露出一个方法，需要开发者手动去完成触发

#### webWorkerPlugin
> 支持[Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker)功能
> 
> 1.如果提供url参数，则只返回转换后处理的地址 -> worker.js?worker&worker_file&type=${type}
> 2.如果未提供 url参数，则export default function [workerWrapper](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/worker.ts#L302)() { ... }
> 3.如果是build阶段，会将每个worker.js作为entryPoint，然后进行rollup打包编译
>- 可以通过config.worker配置中的 rollupOptions 和 plugins来设置此次rollup编译进行配置

> 在 **<span style="color: red">renderChunk</span>** 阶段：替换特殊依赖[ import.meta.url 和 其他worker.js文件]
> importPath可用查询参数
    >- **worker_file**参数：表示原始地址已被处理，会根据type决定如何导入环境变量
    >- **type**：classic | module | ignore，由config.worker.format决定，如果是format = es，则type为module，否则为classic
    >- **sharedworker**：表示使用 SharedWorker类
    >- **worker**：表示使用Worker类
    >- **url**：表示该模块只需返回其worker地址

#### assetPlugin
处理资源依赖模块
> 在 **<span style="color: red">resolveId</span>** 阶段
> 
> 判断是否属于资源文件：
    1.  [默认后缀](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L91) - 图片类型、媒介类型、字体类型等等
    2.  通过配置 [config.assetsInclude](https://github.com/rollup/plugins/tree/master/packages/pluginutils#include-and-exclude) 来满足额外需求
> 判断文件是否位于 \${config.publicDir}目录下，**publicDir** 默认为 **/public**

> 在 **<span style="color: red">load</span>** 阶段
> 
> 如果是模块地址为 xxx.txt?**raw**，则返回资源模块的内容  
> 如果是模块地址为 xxx.txt?**url**，则返回资源模块的地址 
>- 如果是**serve模式**，则返回具体文件地址
>- 如果是**build模式**
>- 如果该文件存在 config.publicDir 目录下，则返回该地址 **\_\_VITE\_PUBLIC\_ASSET\_\_\${hash}\_\_**  
>- 如果配置为config.build.lib，则将转换为一个data:协议地址  
>- 否则得到 **\_\_VITE\_ASSET\_\_\${hash}\_\_${postfix}\_\_**

> 在 **<span style="color: red">renderChunk</span>** 阶段: 在替换chunk内容
>- 替换 \_\_VITE_ASSET__\${hash}\_\_\${postfix}__  
>- 替换 \_\_VITE_PUBLIC_ASSET\_\_\${hash}__  

#### normalPlugins
> 用户未设置 **enforce** 的插件
#### wasmFallbackPlugin：
> **xxx.wasm**后面必须跟上查询参数，例如：xxx.wasm?url 或 xxx.wasm?init
#### definePlugin
> 使用环境变量 和 用户自定义变量
> 处理系统中的变量定义：环境变量(config.env) 和 用户自定义变量(config.define)
> **注**：环境变量通过解析.env文件获取得到，有优先级关系
> **注**：与 webpack 不同，如果要系统中使用环境变量，则语法 **<span style="color: red">import.meta.env</span>**].key
> 
> **serve**模式
> 在 @vite/env 依赖中，会将所有环境变量配置 和 通过vite.define配置的变量，都会定义到全局对象上
> 
> **build**模式
> 则是在进行 transform 阶段时，直接替换代码中的变量占位符

#### cssPostPlugin
> css内容后置处理插件  
> 
> 在 **<span style="color: red">transform</span>** 阶段
> 根据导入模块的信息，得到css内容：css module 或 raw css content
> 
> **serve**模式
> 如果css地址上有?**direct**参数，则返回css文件内容
> 如果css地址上有?**inline**参数，则返回
> ```javascript
> export default cssCodeStr
> ```
> 其他情况，则返回
> ``` javascript
> import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from '@vite/client'
> const __vite__id = id
> const __vite__css = cssContent
> __vite__updateStyle(__vite__id, __vite__css)
> // 如果是模块化
> import.meta.hot.accept()
> export default __vite__css
> // 热替换
> import.meta.hot.prune(() => __vite__removeStyle(__vite__id))
> ```
> 则会通过 @vite/client 内置模块，将css内容转换成 js module代码

> **build**模式
> 如果 ?inline-css 且 ?html-proxy，则交由 html 插件来处理
> 如果非 ?inline，则会把css代码记录在内存中
> 如果是 ?used，则返回代码模块
>
>在 **<span style="color: red">renderChunk</span>** 阶段
> 修改 css chunk 内容
> 是否支持css代码切割技术，则该css模块允许异步方式被加载，否则为空
>
>在 **<span style="color: red">generateBundle</span>** 阶段
> 处理可打包的css信息

#### ssrRequireHookPlugin
> ssr模式下设置必要配置
> 为所有入口脚本，注入一段内置的自执行代码
> ``` javascript
> (dedupeRequire(depupe){...代码实现...})(config.resolve.dedupe)
> ```

#### buildHtmlPlugin
处理.html后缀的依赖模块
在 **<span style="color: red">transform</span>** 阶段
执行 步骤1 收集到的 pre transform 函数，可替换当前html的内容
分析 并 处理 html内容 -- 基于 @vue/compiler-dom 依赖
1. 处理 \<**script** ...>标签
   1. 处理 src 地址
   2. 处理 type = module 类型脚本
     如果有src，则会插入 import '\${src}'
     如果是inline模式，则会注入 import xxx.html?html-proxy&index=\${inlineModuleIndex}.js
   3. 非type = module 类型脚本
     src地址必须是 public目录下资源
     inline content：收集该内联脚本中出现的import地址，并记录在 scriptUrls
2. 处理其他资源标签：\<link>、\<video>、\<source>、\<img>、\<image>、\<use>
   1. 如果是link标签 且是 css资源，则插入 import \${linkHref}，则记录资源地址到内存中 styleUrls
   2. 如果是其他标签，则记录标签属性并记录到 assetUrls
3. 处理内联样式
   1. 如果该内联样式中，存在url规则，则会将改内联样式内容添加到内存中 htmlProxyMap
   2. 注入代码 import "xxx.html?html-proxy&inline-css&index=${inlineModuleIndex}.css"
   3. 替换内联样式内容：style =`"__VITE_INLINE_CSS__\${hash}_\${inlineModuleIndex}__"`
4. 处理\<**style**>标签
   1. 提取标签内容：styleContent，并会将其内容 htmlProxyMap
   2. 注入代码 import "xxx.html?html-proxy&inline-css&index=${inlineModuleIndex}.css"
   3. 替换标签内容：\<style>\_\_VITE_INLINE_CSS\_\_\${hash}\_\${inlineModuleIndex}__</**style**>
5. 处理assetUrls: 在遍历html时，根据地址路径，替换成统一的资源替换符，可参考 assetPlugin 插件
   1. 将地址转换成  \_\_VITE\_ASSET\_\_\${hash}\_\_\${postfix}\_\_
   2. 将地址转换成  \_\_VITE_PUBLIC_ASSET\_\_\${hash}\_\_
6. 处理 scriptUrls:  处理内联脚本导入地址
    1. 将内联脚本中的导入地址，转换成实际可访问的文件地址
7. 处理 styleUrls:  处理已处理的css资源
8. 判断是否注入 import 'vite/modulepreload-polyfill'
    1. 如果配置 config.build.polyfillModulePreload
    2.  如果该html中存在 async 或 defer 属性的脚本
9.  将处理后的html内容记录在内存中：processedHtml
10. 返回js内容：处理页面内容时，注入的各种import语句

在 **<span style="color: red">generateBundle</span>** 阶段
处理打包信息
build阶段，根据所有html模块的chunk信息，对 processedHtml 内存中记录的每个html内容进行再次处理，并处理后的结果进行打包
1.  向head标签内，插入依赖模块: 全量 或 preload
2.  向head标签内，插入依赖的css模块
3.  替换 \_\_VITE\_INLINE\_CSS\_\_\${hash}\_\${inlineModuleIndex}\_\_内容，源自: htmlProxyMap
4.  执行其他插件的 post transform 钩子函数

5.  替换 \_\_VITE\_ASSET\_\_\${hash}\_\_\${postfix}\_\_ 为真实可访问的文件地址
6.  替换 \_\_VITE\_PUBLIC\_ASSET\_\_${hash}\_\_ 为真实可访问的文件地址
7.  触发 this.emitFile，告诉rollup去打包
#### workerImportMetaUrlPlugin
> worker语法糖 -> 支持 new Worker(new URL('xxx/xx'), import.meta.url) 
> 在 **<span style="color: red">transform</span>** 阶段
> 1. 如果在处理模块代码时，发现代码格式为 new Worker(new URL('xxx/xx'), import.meta.url，{...}) 
> 2. 会根据当前模块的位置，得到具体 xxx/xx 文件所在目录
> 3. 将源代码替换成 new Worker('xxx/new_xx'，{...}) 
#### buildPlugins.pre
> build阶段 前置 插件: 内置 及 用户定义
>1. ensureWatchPlugin：
>2. atchPackageDataPlugin：
>3. ommonjsPlugin：
>4. ataURIPlugin：
>5. ssetImportMetaUrlPlugin：
>6. onfig.build.rollupOptions.plugins：用户自定义插件
#### dynamicImportVarsPlugin
> 支持动态导入语法
> 通过config.build.dynamicImportVarsOptions配置的include 和 exclude，可明确哪些目录模块是支持动态导入的
> 默认exclude = [/node_module/]
>
> 在 **<span style="color: red">load</span>** 阶段
> 如果导入的模块地址为 @vite/dynamic-import-helper，则该模块内容为
> 内置方法：export default function dynamicImportHelper(...) { ... }
> 
> 在 **<span style="color: red">transform</span>** 阶段
> 处理import(`xxx/${exp}`)表达式
>1. 根据include 和 exclude配置，确定当前模块代码是否支持动态导入
>2. 根据 [es-module-lexer](https://www.npmjs.com/package/es-module-lexer) 依赖，分析得到当前模块内容的所有import语法
>3. 判断每个import语法，判断是否为动态导入，满足条件：
>>- import(urlExp)表达式
>>- urlExp表达式必须以\`开头，如：urlExp = \`xxx/${exp}\`
>4. 通过 [acorn](https://www.npmjs.com/package/acorn) 依赖，解析上面的urlExp
>5. 在通过 [@rollup/plugin-dynamic-import-vars](https://www.npmjs.com/package/@rollup/plugin-dynamic-import-vars) 依赖将 urlExp转换成 globExp = xxx/*
>6. 最终转换成 importGlob = import.meta.glob(globExp，params)
>7. 把原来的import(\`xxx/${exp}\`)表达式，转换成 __variableDynamicImportRuntimeHelper(importGlob, rawImport)
>8. 同时也必须引入 import __variableDynamicImportRuntimeHelper from "${dynamicImportHelperId}";

#### importGlobPlugin
> 替换import.meta.[ glob | globEager | globEagerDefault ](...)表达式
> 
>1. 预发import.meta.glob(<span style="color:blue">args1</span>,<span style="color:red">args2</span></span>)
>2. 解析代码，收集代码中所有满足规则的 globType  和 globTypeIndex
>3. 通过 [acorn.parseExpressionAt](https://www.npmjs.com/package/acorn) 、globType  和 globTypeIndex方法分析表达式，并得到[AST](https://zh.m.wikipedia.org/zh-hans/%E6%8A%BD%E8%B1%A1%E8%AA%9E%E6%B3%95%E6%A8%B9)值
>4. 根据返回的AST，得到表达式中定义的参数信息：args1 和 args2 -- 至少有1个参数，不能超过2个
>5. 处理<span style="color:blue">args1</span>参数 -- glob地址或一组glob地址
    >>1. 如果 <span style="color:blue">args1</span> 类型为 Literal(字符串)，例如 glob('/a/b/*')，则会记录 /a/b/\*
    >>2. 如果 <span style="color:blue">args1</span> 类型为 TemplateLiteral，例如 glob('/a/b/\${c}')，则会记录 /a/b，如果glob('/a/\${b}/c')，则只会记录 /a/
    >> 即如果使用Template表达式，\${...} 表达式只能放在最后面 - [源码](https://github.com/vitejs/vite/blob/d30f881c302d91d90a1d5658d7aedab9803d432b/packages/vite/src/node/plugins/importMetaGlob.ts#L189)
    >>3. 如果 <span style="color:blue">args1</span> 类型为 ArrayExpression，则执行递归
    >>4. 最终将代码中所有glob(...)表达式第一个参数 <span style="color:blue">args1</span> 都集中起来 globs = [...]
>6. 处理<span style="color:red">args2</span>参数
    >> 处理 <span style="color:red">args2</span> 参数：
        >>>- **query**: 'string | object', 导入文件地址参数
        >>>- **as**: 'string',  url 、raw 或 空 -- 决定模块内容
        >>>- **eager**: 'boolean', true 表示 静态方式导入，false 表示采用动态方式导入
            >>> 如果eager=true，则会生成import {...} from 'globMetaPath'语句
            >>> 如果eager=false，则会生成import(...).then(...)表达式
            >>> 两者的区别：
            >>> 为 true 时，在加载该宿主模块时，会同时加载glob模块
            >>> 为 false 时，只有在使用时，才会去加载glob模块
        >>>- **import**: 'string',  导入模块名称，支持 default，* 和 exportName
        >>>- **exhaustive**: 'boolean' -- 决定文件扫描规则 dot 和 ignore 规则
            >>> 如果 exhaustive = true，在扫描文件时，将包含dot文件，以及不排除node_module目录文件
            >>> 如果 exhaustive = false，与之上一条规则相反
>7. 根据<span style="color:blue">args1</span> 和 <span style="color:red">args2</span>, 得到一个**options**
>7. 根据 **options** 决定最终import表达式形式
    >>- 如果存在 options.as 且 该值为 raw 或 url，则 options.import 必须是 default 或 *
    >>- options.as 和 options.query 不能同时出现
    >>- 如果存在 options.as，则将 options.query = options.as
>8. 处理globs信息 - 根据config.root 或 importer所在目录，得到具体的glob地址
    >>- 已 / 开头 = 相对于 root
    >>- 已 ./ 开头 = 相对于当前模块文件
    >>- 已 ../ 开头 = 相对于当前模块文件
    >>- 已 ** 开头 = 不相关
    >>- 如果是bare import，则会通过插件的resolveId处理，处理结果必须是
>9. 得到每个import.meta.glob表达式处理结果：
    >>- **type**：glob类型 => globType = glob | globEager | globEagerDefault
    >> 其中 globEager 和 globEagerDefault 可以看做是 glob(..., { eager: true, import: 'default' }) 语法糖
    >>- **globs**：表达式中的args1 
    >>- **globsResolved**：根据globs对应的路径
    >>- **options**：表达式中的 args2
>10. 根据 globsResolved ，得到基础路径 commonBase
>11. 通过 [fast-glob](https://www.npmjs.com/package/fast-glob) 得到所有满足匹配规则的文件
>12. 根据 eager 不同, 可以生成不同形式的import表达式: 静态(eager = true) 和 动态(eager = false)
>13. 如果是静态import, 则会在当面模块原始代码头部插入这些静态import语句
>14. 如果是动态import, 则只有在需要的时候才会触发
>15. 最终将import.meta.glob表达式替换成一个对象
> ```javascript
> // let globImport = import.meta.glob(...)
> Object.assign({
>   ...
>   'globFile1': staticImportVal,
>   'globFile2': () => import(...).then(...),
>   ...
> })
> ```
#### postPlugins
> 用户自定义后置插件
#### buildPlugins.post
> vite内部使用插件, 被用于build模式下
>1. buildImportAnalysisPlugin
>1. buildEsbuildPlugin
>1. terserPlugin
>1. manifestPlugin
>1. ssrManifestPlugin
>1. buildReporterPlugin
>1. loadFallbackPlugin
#### clientInjectionsPlugin
> **注:** 仅限**serve**模式
> 替换vite内置的模块中的占位符: @vite/client 和 @vite/env
    >>
    >> \_\_MODE__
    >> \_\_BASE__
    >> \_\_DEFINES__
    >> \_\_SERVER_HOST__
    >> \_\_HMR_PROTOCOL__
    >> \_\_HMR_HOSTNAME__
    >> \_\_HMR_PORT__
    >> \_\_HMR_DIRECT_TARGET__
    >> \_\_HMR_BASE__
    >> \_\_HMR_TIMEOUT__
    >> \_\_HMR_ENABLE_OVERLAY__
    >> 

#### importAnalysisPlugin
> **注:** 仅限**serve**模式
> 解析模块代码中的import表达式:
>1. 排除无需分析的模块：.json、.map、.css 或 带?direct参数
>2. 获得当前模块所有的import和export语句
>根据当前模块的父模块的文件后缀，提示用户安装合适的插件 -- vue文件、jsx文件
>3. 分析每一条import语句
    >>1. 判断是否存在import.meta.hot表达式，如果存在则表示该模块支持HRM -- 参考@vite/vue-plugin
    >> ① 分析import.meta.hot.accept(depsExp，...)表达式，并收集依赖信息到 **acceptedUrls** 中
    >> ② 分析import.meta.hot.acceptExports(exportsExp，...)表达式，并收集暴露信息到 **acceptedExports** 中
    >>2. 分析每个import表达式中的url，从而计算出实际的导入文件地址
    >> 可格式化的url规则：
        >>>1. 非http[s]:// 或 data:// 地址
        >>>1. 非 @vite/client
        >>>1. /public目下的非资源型文件
>        
    >> **normalizeUrl**函数：处理import表达式中的模块地址
        >>>1. 先确定 importer 模块地址: **importerUrl**
        >>>1. 再遍历所有插件的resolveId钩子函数, 根据当前表达式地址 和 importerUrl, 得到一个**resolved**对象
        >>>1. 根据不同的情况, 处理 resolved.id, 并得到 **resolvedUrl**
        >>>① 以 config.root + / 开头，则截取
        >>>② 以 config.cacheDir + deps 开头，且文件确实存在，则 resolvedUrl = /@fs/ + resolved.id
        >>>③ resolvedUrl = resolved.id
        >>>1. 如果 **resolvedUrl** 是外部链接, 则返回 [**resolvedUrl**, **resolvedUrl**]
        >>>1. 如果 **resolvedUrl** 不是以 . 和 / 开头，则 **resolvedUrl** = /@id/ + resolved.id
        >>>1. 如果 **resolvedUrl** 不是以 .css 或 .js 结束，则url会跟上参数 ?import: url = url?import&已有参数
        >>>1. 如果 **resolvedUrl** 是 js 或 css，且 url 上没有版本信息，url = url?v=版本号&已有参数
        >>>1. 设置 **resolvedUrl** 最近HRM时间 url = url?t=时间戳&已有参数
        >>>1. 结果返回：**[resolvedUrl, resolved.id]**
>       
    >>3. 如果原始import url 和 normalize url 不一致，根据情况重新import表达式
    >>4. 收集导入模块的依赖文件 imortedUrls
    >>5. 收集导入模块的export属性 importedBindings
    >>6. 收集当前模块所有静态依赖信息 staticImportedUrls
>
>4. 判断是否存在import.meta.env表达式
>```javascript
> // 在代码内部插入表达式
> import.meta.env = {...}
> // 来自于 config.defined配置中 {import.meta.env.key: value{
> import.meta.env.key = value
>```
>
>5. 如果支持HRM, 则创建一个**import.meta.hot** = [hotContext](https://github.com/vitejs/vite/blob/main/packages/vite/src/client/client.ts#L520)
    >>```javascript
    >> // 在代码内部插入表达式
    >> import { createHotContext as __vite__createHotContext } from '@vite/client'
    >> import.meta.hot = __vite__createHotContext(importerUrl)
    >>```
    >>
    >> **import.meta.hot**定义的[方法](https://github.com/vitejs/vite/blob/main/packages/vite/src/client/client.ts#L520)：
        >>> **accept**(deps, callback) - 等待 依赖模块 或 自身模块 完成热更后, 触发回调函数
        >>> **acceptExports**(_, callback) - 等待 自身模块 完成热更后, 触发回调函数
        >>> **dispose**(callback) - 当 依赖模块 或 自身模块 有变更时(未完成), 触发回调函数 callback(data)
        >>> **prune**(callback) - 通过 ws.send 发送 type: prune 消息来通知触发回调函数
        >>> **invalidate**(message) - 触发 vite:invalidate 事件, 同时 发送一条 ws 消息 
        >>> **on**(event, callback) - 注册 不同事件(vite内置事件 或 用户自定义事件) 回调函数
        >>> **send**(event, data) - 触发自定义事件, 并且会想 ws 服务发送一条类型为 custom 的数据
>6. 如果有 acceptedUrls, 则对其进行格式化
>7. 如果importer是非css文件，则更新 其importer模块的模块信息
>8. 输出模块内容


## 四、plugin-vue插件
首先在vite.config.js配置文件中, 配置 @vitejs/plugin-vue 插件

在 **<span style="color: red">load</span>** 阶段
1. 如果是内置的 EXPORT_HELPER_ID 模块，则加载内置模块代码
2. 否则必须是带?vue的导入地址
   - 如果importUrl = xxx.vue?vue&src，则直接读取该.vue内容
   - 如果是原始文件在经过transform处理后，特殊的import表达式xxx.vue?vue&type=xxx&...，则会根据type不同，返回不同的内容
   type：script、template、style 和 customBlocks

在 **<span style="color: red">transform</span>** 阶段
1. 如果不是.vue文件且没有?vue参数，则直接返回文件内容
2. 如果是.vue文件且没有?vue参数, 说明该文件内容需要被编译处理
    1. 通过 [@vue/compiler-sfc](https://github.com/vuejs/core/tree/main/packages/compiler-sfc) 对vue文件进行编译，得到不同类型的信息
        1. 处理 **script**
            ① 如果未提供src，则会通过ts方式进行编译，得到编译代码 const _sfc_main = { ... }
            ```javascript
            const _sfc_main = { ... }
            ```
            ② 如果提供src
            ```javascript
            import _sfc_main from xxx.vue?vue&type=script&scoped=&其他属性
            ```

        2. 处理 **templte**
            ① 如果未提供lang 且 未提供src
            ```javascript
            const _sfc_render = { ... }
            ```
            ② 否则则会生成
            ```javascript
            import { render as _sfc_render } from xxx.vue?vue&type=template&scoped=&其他属性
            ```
        3. 处理 **style**
            ① 如果是非css module
            ```javascript
            import _style_${index} from xxx.vue?vue&type=style&index=${index}&scoped=&inline&lang.css
            ```
            ② 如果是css module，则会生成
            ```javascript
            import moduleValueN from xxx.vue?vue&type=style&index=${index}&scoped=&inline&lang.module.css
            const cssModules = {moduleName: moduleValue, moduleName2: moduleValue2,...,moduleNameN: moduleValueN}
            ```
        4. 处理**自定义**模块
            ① 生成自定义代码：
            ```javascript
            import block_${index} from xxx.vue?vue&type=customType&scoped=&其他属性
            if (typeof block_${index} === ‘function’) { block_${index}( _sfc_main ) }
            ```
    2. 初始化vue组件对象
        ```javascript
         _sfc_main.render = _sfc_render
         _sfc_main.styles = [ _style_1, _style_2,..., _style_n ]
         _sfc_main.__cssModules = cssModules 
        ```
    3. 如果是scoped style，则设置
        ```javascript
         _sfc_main.__scopedId = `data-v-${descriptor.id}`
        ```
    4. 如果是serve环境 或者 开启 devToolsEnabled 配置
        ```javascript
         _sfc_main.__file = fileName
        ```
    5. 如果支持HMR
        ```javascript
        // 这个 descriptor.id 值，是根据文件路径 和 文件内容计算得到一个Hash值
         _sfc_main.__hmrId = descriptor.id
         // __VUE_HMR_RUNTIME__是vue内部用于支持HMR一个对象
         // 再通过 createRecord 方法，会创建一个映射对象，并且将组件配置、组件实例 与 hmrId建立映射关系
         // 在Vue框架内部，当组件实例化的时候，会调用registerHMR(instance)方法，将组件实例也被记录在内存中
        typeof __VUE_HMR_RUNTIME__ !== 'undefined' && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main)
        // 判断是否只有template变化，在插件内部判断得出
        export const _rerender_only = true
        // 将文件和热更方法建立关系
        import.meta.hot.accept(mod => {
            if (!mod) return
            const { default: updated, _rerender_only } = mod
            if (_rerender_only) {
                __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render)
            } else {
                __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated)
            }
        })
        ```
        **注**：这里的 [\_\_VUE_HMR_RUNTIME__](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/hmr.ts#L31)，是在vue内部中定义了3个方法：
            **createRecord** -- 创建组件记录
            **rerender** -- 当前组件重新渲染
            **reload** -- 当前组件重新加载
    6. 如果是支持SSR，则插入SSR相关代码
        ```javascript
         import _export_sfc from '${EXPORT_HELPER_ID}'
         // 就是上面第2,3,4,5步，用于丰富 _sfc_main 对象的
         export default /*#__PURE__*/_export_sfc(_sfc_main, {....})
        ```
    7. 最终将上述内容合并在一起得到：
        ```javascript
        import _export_sfc from '${EXPORT_HELPER_ID}'
        import _sfc_main from 'xxx.vue?vue&type=script&scoped=&...'
        import { render as _sfc_render } from 'xxx.vue?vue&type=template&scoped=&...'
        // 多个或单个
        import _style_${index} from `xxx.vue?vue&type=style&index=${index}&scoped=&...`

        // 多个或单个
        import blockN from `xxx.vue?vue&type=${block.type}&index=${index}=&...`
        if (typeof blockN === 'function') blockN(_sfc_main)

        _sfc_main.render = _sfc_render
        _sfc_main.styles = [ _style_1, _style_2, _style_3 ]
        _sfc_main.__cssModules = cssModules 
        _sfc_main.__scopedId = `data-v-${descriptor.id}`

        // TODO hmr部分代码 参考上面第5步

        // 为 _sfc_main 扩展其他数据信息
        _export_sfc(_sfc_main, {...})

        ```
3. 接下来就是针对第2步每个import ... from '.vue?vue&type...'进行处理
    在执行transform之前，会先通过load钩子函数，根据不同类型得到原始的内容
    1. 如果type = **template**，通过 @vue/compiler-sfc 对模板内容编译
     ```javascript
     export const render = ....
     import.meta.hot.accept(({ render }) => {
         __VUE_HMR_RUNTIME__.rerender(${JSON.stringify(descriptor.id)}, render)
     })`
    ```
    
    1. 如果type = **style**，通过 @vue/compiler-sfc 对样式内容编译
     ```javascript
     export default css code
    ```
        
## 五、HMR解析 -- 以Vue项目为例
HMR：hot module replacement -- 模块热替换

vite HRM工作原理：
#### 启动服务
1. 会创建一个ws服务端, 可用于通信

2. 利用 [chokidar](https://www.npmjs.com/package/chokidar) 对文件监控
    - 监控事件:
        change(改变)
        add(新增)
        unlink(删除)

    - 可监控的文件范围：
        ① 监控config.root下所有文件
        ② 排除 **/.git/**
        ③ 排除 **/node_modules/**
        ④ 排除 **/test_results/**
        ⑤ 排除 config.watch.ignored 配置项
3. 发现文件有变化时，触发 **[handleHMRUpdate](https://github.com/vitejs/vite/blob/5df788dfe2d89e541461e166f03afb38c2f1dd7e/packages/vite/src/node/server/hmr.ts#L41)** 方法
    1. 如果变化文件为 .env文件、vite.config.js文件、config.dependencies配置的文件，则会重启服务
    2. 如果变化的文件是 dist/client/client.mjs，则会通过ws服务端向客户端发送full-reload消息
    3. 获得变化模块集合
        1. 当前文件的模块
        2. plugin.handleHotUpdate(context)钩子函数执行结果
    4. 根据变化模块集合，得到模块变更集合updates：
        type：`${moduleInfo.type}-update`
        path: 更新模块的地址
    5. 通过ws服务端向**ws客户端**发送updates信息     

4. 让 vite 识别是否为可 HMR 模块, 通过判断是否存在 import.meta.hot.xxx(...)语句 (在 importAnalysisPlugin 插件中实现)
5. 在可 HMR 的模块代码中, 会插入 import "@vite/client" 和 import.meta.hot = createHotContext(moduleId) 2段代码
6. 然后根据 ws 通信消息的数据类型来执行不同行为
   触发方式: 手动(自定义vite插件) 和 vite内置文件监控(够用)
    **connected**：与服务端建立连接后触发
    **update**：需要执行更新，该事件类型是HMR关键
    **custom**：执行自定义事件
    **full-reload**：重新刷新页面
    **prune**：清理事件
    **error**：错误事件
7. 事件类型为**update**：
    1. 得到本次更新的所有可更新数据 updates
    2. 依次处理每个 updates，根据其模块类型，执行不同的处理方式
        - type = js-update，执行 fetchUpdate(...)
            ① 根据当前变更文件 和 hotModulesMap，得到与文件关联的依赖模块 和 热更方法
            ② 重新加载待热更文件
            ③ 执行热更方法
        - type = css-update，则
            ① 删除原 <link> 样式
            ② 新增新的<link href=“...”>
#### 页面访问

1. 会先经过@vite/plugin-vue插件，此时所有vue文件上都会出现以下代码：
    ```javascript
    __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main)
    import.meta.hot.accept(mod => {
    if (!mod) return
        const { default: updated, _rerender_only } = mod
    if (_rerender_only) {
        // 仅仅是模板变化
        __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render)
    } else {
        // 组件其他内容变化
        __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated)
    }
    })
    ```

2. 然后再经过 importAnalysisPlugin，会在该模块代码的头部添加以下代码
    ```javascript
    import { createHotContext as __vite__createHotContext } from '@vite/client'
    import.meta.hot = __vite__createHotContext(vuePath)
    ```
    @vite/client 模块内部，除了提供一些实用的方法外，同时还会创建一个ws客户端，用于执行模块热替换。

3. 当组件完成实例化时, 会把组件实例[注册](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts#L1211)到HRM中

4. 当页面组件发生修改后, ws客户端会接收到来自于ws服务端的变更消息, 然后得到具体的热更方法并执行

5. 在 handleHMRUpdate 内部, 又会去通知 vite启动的ws服务向ws客户端发送一条消息, 表示当前模块发生变化了

6. 在 ws 客户端得到更新消息, 根据消息内容, 找到待热更模块, 执行热更方法(**reload** 或 **rerender**)

## 六、预绑定机制(Pre-Bounding)
默认是作用于第三方依赖模块，因为第三方的依赖模块变更频率不快
为什么需要优化依赖：
1. 统一依赖模块的结构，保证ESM能够正常使用
2. 减少请求次数，提高服务效率

#### 处理逻辑
在启动 npm serve 后, 会根据 config.optimizeDeps 配置来决定是否需要开启优化扫描, 默认为**true**
1. 初始化[metedata](https://github.com/vitejs/vite/blob/d30f881c302d91d90a1d5658d7aedab9803d432b/packages/vite/src/node/optimizer/index.ts#L186)
    1. 初始化获得 - **首次** 或 **optimizeDeps.force == true**
    2. 从已有_metadata.json文字间中读取[版本旧兼容]
    3. 数据结构:
        - hash  **→** 基于config.optimizeDeps创建的**主hash**值
        - browserHash **→** 基于**主hash** 及 额外信息创建的hash值
        - optimized **→** 已优化模块
        - discovered **→** 待优化模块
        - chunks **→** 非入口模块的模块
        - depInfoList **→** 依赖模块信息
2. 创建一个优化器: **depsOptimizer**
    - 关联**metedata**
    - 各种便利方法: registerMissingImport, run, delayDepsOptimizerUntil等等
    - 配置信息 - config.optimizeDeps

3. 扫描编译: 如果是 **首次** 或 **optimizeDeps.force == true**
    1. 添加手动配置可优化模块：根据config.optimizeDeps.include配置, 并将其保存到**metadata.discovered**
    2. 收集项目切入点(**entries**)，三选一：
       1. 根据 **config.optimizeDeps.entries** 配置
       2. 根据 **config.build.rollupOptions.input** 配置
       3. 根据 项目中任意的 html 文件[**默认**]
    3. 通过**esbuild**对每个**entries**进行编译处理, 找到可优化的bare imports, 并将其补充到**metadata.discovered**
4. 执行优化: [runOptimizeDeps](https://github.com/vitejs/vite/blob/d30f881c302d91d90a1d5658d7aedab9803d432b/packages/vite/src/node/optimizer/index.ts#L446)
    1. 将metadata中的 **optimized** 和 **discovered** 合并到一个 knownDeps 中
    2. 对 knownDeps 中每个模块再次进行esbuild编译, 并将编译的结果输出 node_modules/.vite/deps/**_temp**/ 目录下
    3. 创建一个新的 metadata 对象(**和上面的不是同一个对象**)
    4. 将优化后的模块信息维护到 metadata.optimized
    5. esbuild编译的结果产生的 chunks 信息，则会被维护到 metadata.chunks
    6. 最终将所有的metadata信息 已文件的形式(_metadata.json)保存下来
5. 完成本次优化扫描, 并在合适的时间会把 node_modules/.vite/deps/**_temp** 重命名为 node_modules/.vite/deps

**<span style="color: red">注</span>**: 并不是所有可优化模块在扫描阶段就能完成所有的Pre-Bounding工作的, vite在定义的内部插件中, 还会继续监听模块导入信息, 并且通过 **depsOptimizer.registerMissingImport** 来添加优化模块
**depsOptimizer.registerMissingImport**执行过程:
1. 会把遗漏模块添加到 **metadata.discovered** 中, 
2. 设置newDepsDiscovered = true, 表示此时有新发现
3. 再次执行 runOptimizeDeps() -- 参考上面的**步骤4**

**<span style="color: red">注</span>**: 甚至可以通过 **vite optimize** 命令的方式触发

## 七、ModuleGraph【模块画像】
用于记录系统中所有模块的依赖关系和模块信息【ModuleNode】

ensureEntryFromUrl: 通过 PluginContainer, 将url地址生成对应的[**url, resolveId, meta**], 并由此创建一个ModuleNode对象, 并将其与url、resolveId、file建立关系。

------

## 八、vite build
本质上就是采用rollup.js进行编译

开启debug模式: DEBUG=xxx vite dev, 例如:
DEBUG=vite:plugin-transform 