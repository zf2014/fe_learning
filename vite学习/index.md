# Vite学习记录
> 版本 3.0.4

## 一、Vite 插件:



不管在 **build** 阶段还是在 **serve** 阶段，vite内部都会利用rollup的编译能力。尤其在plugin的使用上，大部分情况rollup的plugin也同样适用于vite。

通过配置vite.config.js文件，可根据项目需求选择性的使用插件：

- 1、可通过插件的 apply 属性，明确该插件适用环境（serve 或 build）
- 2、可通过插件的 enforce 属性，明确该插件的执行顺序（pre，post，null），除此之外按照插件引入的顺序执行
- 3、除了用户定义的插件外，vite也会根据运行环境内置插件，在build阶段，还会有rollup内置的插件


vite运行时插件:
1、 ensureWatchPlugin：build模式 且 开启config.build.watch
    1.1、 记录可监控的文件
    1.2、如果有监控器，则开启监控
2、metadataPlugin：build模式
    为build阶段renderChunk做准备
3、preAliasPlugin: 收集未被记录在案的可优化模块
    3.1、 判断是否为bare import
    3.2、判断是否满足别名替换模式
    3.3、再次通过所有vite插件resolveId钩子函数，得到最终的resolveId
    3.5、判断resolveId是否为未优化模块
    3.6、注册为可优化丢失模块
    3.7、执行优化，并收集模块信息
4、aliasPlugin：使用rollup下的别名插件
    根据提供的匹配规则，替换import地址
5、prePlugins：用户自定义的 enforce  为 pre 级别的插件
6、modulePreloadPolyfillPlugin：开启config.build.polyfillModulePreload，使得项目开启模块预加载
    在使用import 'vite/modulepreload-polyfill'表达式的模块中，会去执行一次 polyfill 方法
    在 polyfill 方法体内，将会去触发 modulepreload 机制
7、optimizedDepsBuildPlugin：build模式
    7.1、 buildStart钩子：先初始化基础信息
    7.2、load钩子：读取文件信息 并 确认首次优化是否已执行
    7.3、transform钩子：等待所有可优化模块已完成，并触发 onCrawlEnd 内置回调
8、optimizedDepsPlugin：非build模式，处理可优化模块
    比较模块url中的版本信息 和 内存中记录的版本信息，如果存在差异，则通过控制台提醒给用户
    读取文件最新内容
9、resolvePlugin：对模块地址做正确分析处理，为后续的钩子函数使用
    resolveId钩子：
    9.1、 收集配置项：scan、isRequest、isFromTsImporter、config.resolve配置项
    9.2、如果模块地址为可优化的模块地址，importUrl =  /@fs/xxxFilePath，则xxxFilePath为模块地址
    9.3、如果模块地址以/@fs/*开头 -> importUrl =  /@fs/xxxFilePath，并且执行 ★tryFsResolve(xxxFilePath, options)方法：
    9.4、如果模块地址以/开头 -> importUrl =  /xxxFilePath 传入 ★tryFsResolve(`${config.root}/xxxFilePath `) 方法
    9.5、如果模块地址为相对地址 
            1、 importUrl = ./xxxFilePath，则会基于importer文件，计算出该文件所在的目录importerPath，
            2、得到导入文件地址importFileUlr = path.resolve(importerPath, "./xxxFilePath")
            3、如果 importFileUlr = xxx/node_module/bareImportName，从而得到 bare import，并调用 tryNodeResolve 方法
            4、根据importer所在package.json数据pkg, 并根据pkg.dir 和 pkg.data.browser 配置信息，得到browserMapFilePath，并传入                       ★tryFsResolve(browserMapFilePath, options)
            5、如果以上办法都没得到文件地址，则再次将 importFileUlr 传入 ★tryFsResolve(importFileUlr , options)
    9.6、如果是windows系统，且模块地址以/开头 -> importUrl =  /xxxFilePath
            则会根据importer文件得到所在目录importerPath，执行tryFsResolve(path.resolve(importerPath, "/xxxFilePath"), options)
    9.7、如果是windows系统，且模块地址是  importUrl =  C:/xxxFilePath 或者 非windows系统, importUrl = /xxxFilePath
            则直接使用 ★tryFsResolve(importUrl , options)
    9.8、如果是外部链接，importUrl = http://xxx.xx.x/module.js，则直接使用该地址
    9.9、如果直接就是bare import，则参考9.5中第3和第4步骤
    9.10、如果是内置的node模块，importUrl  = node:xxx，则统一替换：
              1、 build模式下：importUrl  =  '__vite-browser-external'
              2、serve模式下：importUrl  =  '__vite-browser-external:node:xxx'
              3、ssr模式下，importUrl = node:xxx
    load钩子：
        如果模块名 是以__vite-browser-external 开头的，则说明该模块为内置node依赖，因此其加载内容为：
        build模式： export default {}
        serve模式：
        export default new Proxy({}, {
              get(_, key) {
                throw new Error(\`Module "${id}" has been externalized for browser compatibility. Cannot access "${id}.\${key}" in                     client code.\`)
              }
         })
        小结：不管在build还是在serve模式下，都是无法直接使用node的内置模块
   
   ★tryFsResolve(importPath, options) 方法：根据url地址，得到file(地址) 和 postfix(查询参数信息)，再根据这些信息去获取文件地址
     1、 判断是否为正常的可读文件
     2、如果importer为 ts 文件，而file也有后缀(js/mjs/cjs/jsx)，则会尝试去找后缀为.ts和.tsx的file文件
     3、如果配置config.resolve.tryPrefix，则会加上该前置去尝试获取文件地址
     4、如果file地址为目录，如果有file/package.json文件，则尝试从切入点确定文件地址，可通过 config.resolve.skipPackageJson 跳过该步骤
    ５、尝试获取file/index.[ext]文件，这里的后缀名可通过config.resolve.extensions来定义，否则默认为 [mjs,js,mts,ts,jsx,tsx,json]
    
    tryNodeResolve(importPath, options)方法：尝试以nodejs的方式获取依赖文件地址
     1、 根据传入的importPath，获得 nestedRoot 和 nestedPath
          1.1、 假如 importPath = foo > bar > xx/baz，结果 nestedRoot  = foo > bar，nestedPath = xx/baz
          1.2、假如 importPath = xx/baz，则 nestedRoot = ‘’， nestedPath = xx/baz
     2、 在根据 nestedPath，分析获得可能存在的package目录集合 possiblePkgIds
          假如 nestedPath= foo/bar， 则 possiblePkgIds = ['foo'，'foo/bar']
          假如 nestedPath= @foo/bar 则 possiblePkgIds = ['@foo/bar']
     3、确定baseDir目录
          3.1、 根据config.root
          3.2、根据importer所在目录
          3.3、根据 nestedRoot 和 第1,2步获得的baseDir值，重新确定合适的baseDir
              假如 nestedRoot = foo > bar， baseDir = ‘.’
              则会尝试获取 ./node_module/foo/node_module/bar 模块文件地址
    4、再根据 baseDir 和 possiblePkgIds，然后反向依次加载${baseDir}/${pkgId}/package.json文件，并得到 pkg 对象
    5、根据获得的pkg配置，找到该模块合适的切入点[entryPoint]配置项，终止得到模块文件地址 resolvedNodePath
    6、对 resolvedNodePath 加上各种特殊功能的参数(?__vite_skip_optimization、?v=版本信息)
    7、如果 resolvedNodePath 是可优化的模块，则启动优化机制
         
10、htmlInlineProxyPlugin：加载页面上inline资源
     build阶段：
     通过另一个插件：buildHtmlPlugin，在编译html内容时，会收集页面上inline资源，并且包装成一个资源模块
     serve阶段：
     在内置的 devHtmlHook 服务中间件中，解析html文件
     1、如果是内联脚本
     <script src="index.html?html-proxy&index=${index}.js "></script>
     并且把 内联脚本的代码 和  index.html?html-proxy&index=${index}.js 做一个映射关系 htmlProxyInnerMap
    2、如果是内联css
     同样会创建一个url = index.html?html-proxy&direct&index=${index}.css
     然后对内联的css会经历一次 plugin.transform(cssInnerCode, url)
     最终还是内联的方式在页面上

     load钩子:
     判断 importUrl 是否匹配 /\?html-proxy&index=[\d+]/\.[css|js] 规则，如果满足匹配，则从 htmlProxyInnerMap 中
     得到实际的内联代码

 11、cssPlugin：处理css样式
    1、对原始css代码进行编译工作 - 模块化、预编译、postcss
          1.1、 原生css内容
          1.2、预编译处理 - scss、stylus、less等
          1.3、postcss处理：
              1、读取postcss配置信息
              2、判断代码中是否存在 @import 语法，如果有则添加 postcss-import 插件
              3、添加vite内置的 url-rewrite 插件
              4、判断css文件是否支持css-module，如果有则添加 postcss-modules 插件
    2、处理编译结果: css、modules、deps
        1、缓存modules信息
        2、build模式且开启config.build.watch，则会开启监控所有dep依赖文件
        3、serve模式下，动态添加当前模块的依赖信息，并且对依赖文件开启监控

12、esbuildPlugin：对文件内容进行esbuild处理，通过config.esbuild = false来禁用，默认为开启的
    configResolved钩子：
    1、通过 tsconfck 依赖来得到ts的配置信息
    transform钩子：
    2、文件筛选：
         根据 config.esbuild.include 和 config.esbuild.exclude来选择可esbuild的文件
         默认：处理.ts、.tsx、.jsx、.mts、.tsx后缀文件，不处理.js后缀文件
    3、执行编译，得到compiledResult
          3.1、 配置esbuild loader：
             ① 直接配置config.esbuild.loader
             ② 根据文件后缀名确定
          3.2、配置esbuild tsconfigRaw
              ① 直接配置 config.esbuild.tsconfigRaw
              ② 根据tsconfig.json中定义
          3.3、执行esbuild.transform，得到编译结果
    4、如果 config.esbuild.jsxInject ，则会插入该配置内容
    
13、jsonPlugin：处理json文件内容 转换为 模块代码
    1.1、 如果配置config.json.stringify，则直接export default JSON.parse(`${JSON.stringify(code)}`)

    1.2、否则 dataToEsm 工具函数转成标准的esm格式的文件
14、wasmHelperPlugin：支持wasm
     load钩子:
     1、如果 importPath = /__vite-wasm-helper，则模块内容为：
     export default ${wasmHelperCode}
     wasmHelperCode：为vite内部方法，用于初始化wasm文件

     2、如果 importPath = xxx.wasm?init，则模块内容为：
     import { initWasm } from '/__vite-wasm-helper'
     export default opts => initWasm(opts, ${JSON.stringify(‘xxx.wasm’)})
     注：并不会去加载.wasm文件内容，而是通过这种代理的方式，交给开发者去择时初始化 WebAssembly

15、webWorkerPlugin：支持Web Worker
    transform钩子：转换为允许Web Worker模块
       1、 如果提供url参数，则只返回转换后处理的地址 -> worker.js?worker&worker_file&type=${type}
       2、如果未提供 url参数，则export default function workerWrapper() { ... }
       3、如果是build阶段，会将每个worker.js作为entryPoint，然后进行rollup打包编译，并将打包后的块文件地址作为该worker地址
            此时可以通过config.worker配置中的 rollupOptions 和 plugins来设置此次rollup的配置
    renderChunk钩子：build阶段，替换特殊依赖[ import.meta.url 和 其他worker.js文件]

    importPath可使用的参数：例如 import workerUrl from 'worker.js?url&worker'
        1、 [内部]worker_file参数：表示原始地址已被处理，会根据type决定如何导入环境变量
        2、[内部]type：classic | module | ignore，由config.worker.format决定，如果是format = es，则type为module，否则为classic
        3、sharedworker：表示使用 SharedWorker类
        4、worker：表示使用Worker类
        5、url：表示该模块只需返回其worker地址
  
16、assetPlugin：处理资源依赖
    resolveId钩子：
    1、根据文件后缀名，判断是否满足：
         默认后缀 - 图片类型、媒介类型、字体类型等等
         通过配置 config.assetsInclude 来满足额外需求
    2、判断文件是否存在于/public目录下，可通过config.publicDir来设置，默认为/public
    load钩子: 将资源文件模块化
    1、 如果是 xxx.txt?raw，则返回文件原始内容
    2、如果是 xxx.txt?url，则返回该文件的地址：
         serve阶段，得到相对服务的访问地址
         build阶段
              1、 如果改文件存在 config.publicDir 目录下，则返回该地址 __VITE_PUBLIC_ASSET__${hash}__
              2、如果配置为config.build.lib，则将转换为一个data:协议地址
              3、否则得到 __VITE_ASSET__${hash}__${postfix}__
   renderChunk钩子: 在替换chunk内容
       替换 __VITE_ASSET__${hash}__${postfix}__
       替换 __VITE_PUBLIC_ASSET__${hash}__

17、normalPlugins：用户未定义的 enforce 的所有插件
18、wasmFallbackPlugin：vite内部不支持直接引入xxx.wasm，可以用xxx.wasm?init 或 xxx.wasm?url
19、definePlugin：使用环境变量 和 用户自定义变量
serve阶段：如果模块中使用环境变量，则会加载内置模块 @vite/env，并将配置变量定义到全局对象上(window 或 global)
build阶段：将环境变量、用户自定义变量存储在内存中，然后在编译的过程中通过正则表达式的方式，进行内容替换

环境变量来源：通过.env文件配置(优先级策略)，BASE_URL、MODE、DEV、PROD

注：和webpack不同，使用 import.meta.env.${key} 表示系统环境变量

20、cssPostPlugin：css内容后置处理插件
transform钩子：
1、 根据导入模块的信息，得到css内容：css module 或 raw css content
2、如果是serve模式，则会通过 @vite/client 内置模块，将css内容转换成 js module代码
3、如果是非serve模式
    3.1、 如果模块类型是?inline 或 ?html-proxy，则会将css内容记录到内存中，等待插件 vite:build-html 去生产处理
    3.2、如果是非?inline，则会将css内容 转换成 模块格式内容

renderChunk钩子：修改chunk内容及收集相关信息
1、首先记录当前chunk所有的非inline模块的css内容，并且合并到 chunkCSS 变量上
2、如果支持代码切割技术 -》config.build.cssCodeSplit
3、如果不支持代码切割技术 -》config.build.cssCodeSplit

generateBundle：处理可打包的css信息

21、ssrRequireHookPlugin：ssr模式下设置必要配置
1、为所有入口脚本，注入一段内置的自执行代码：
     ;(dedupeRequire(depupe){...代码实现...})(config.resolve.dedupe)

22、buildHtmlPlugin：处理.html后缀的依赖模块
    1、 收集适用于html文件的 transform钩子函数： 通过配置 config.plugins 和 plugin.transformIndexHtml 
transform钩子：
    2、执行 步骤1 收集到的 pre transform 函数，可替换当前html的内容
    3、分析 并 处理 html内容 -- 基于 @vue/compiler-dom 依赖
          3.1、处理 <script ...>标签
              ① 处理 src 地址
              ② 处理 type = module 类型脚本
                   如果有src，则会插入 import '${src}'
                   如果是inline模式，则会注入 import "xxx.html?html-proxy&index=${inlineModuleIndex}.js"
              ③ 非type = module 类型脚本
                   src地址必须是 public目录下资源
                   inline content：收集该内联脚本中出现的import地址，并记录在 scriptUrls
          3.2、处理其他资源标签：<link>、<video>、<source>、<img>、<image>、<use>
              ① 如果是link标签 且是 css资源，则插入 import '${linkHref}'，则记录资源地址到内存中 styleUrls
              ② 如果是其他标签，则记录标签属性并记录到 assetUrls
          3.3、处理内联样式
              ① 如果该内联样式中，存在url规则，则会将改内联样式内容添加到内存中 htmlProxyMap
              ② 注入代码 import "xxx.html?html-proxy&inline-css&index=${inlineModuleIndex}.css"
              ③ 替换内联样式内容：style =`"__VITE_INLINE_CSS__${hash}_${inlineModuleIndex}__"`
          3.4、处理<style>标签
              ① 提取标签内容：styleContent，并会将其内容 htmlProxyMap
              ② 注入代码 import "xxx.html?html-proxy&inline-css&index=${inlineModuleIndex}.css"
              ③ 替换标签内容：<style>__VITE_INLINE_CSS__${hash}_${inlineModuleIndex}__</style>
    4、处理assetUrls -》在遍历html时，根据地址路径，替换成统一的资源替换符，可参考 assetPlugin 插件
         将地址转换成  __VITE_ASSET__${hash}__${postfix}__
         将地址转换成  __VITE_PUBLIC_ASSET__${hash}__

    5、处理 scriptUrls -》处理内联脚本导入地址
         将内联脚本中的导入地址，转换成实际可访问的文件地址
    6、处理 styleUrls -》处理已处理的css资源
    7、判断是否注入 import 'vite/modulepreload-polyfill'
          7.1、如果配置 config.build.polyfillModulePreload
          7.2、如果该html中存在 async 或 defer 属性的脚本
    8、将处理后的html内容记录在内存中：processedHtml
    9、返回js内容：处理页面内容时，注入的各种import语句
generateBundle钩子﻿：处理打包信息
    build阶段，﻿根据所有html模块的chunk信息，对 processedHtml 内存中记录的每个html内容进行再次处理，并处理后的结果进行打包
    10、向head标签内，插入依赖模块: 全量 或 preload
    11、 向head标签内，插入依赖的css模块
    12、替换 __VITE_INLINE_CSS__${hash}_${inlineModuleIndex}__内容，源自: htmlProxyMap
    13、执行其他插件的 post transform 钩子函数

    14、替换 __VITE_ASSET__${hash}__${postfix}__ 为真实可访问的文件地址
    15、替换 __VITE_PUBLIC_ASSET__${hash}__ 为真实可访问的文件地址
    16、触发 this.emitFile，告诉rollup去打包

20、workerImportMetaUrlPlugin：worker语法糖 -> 支持 new Worker(new URL('xxx/xx'), import.meta.url) 
    transform钩子：
    1、如果在处理模块代码时，发现代码格式为 new Worker(new URL('xxx/xx'), import.meta.url，{...}) 
    2、会根据当前模块的位置，得到具体 xxx/xx 文件所在目录
    3、将源代码替换成 new Worker('xxx/new_xx'，{...}) 
22、buildPlugins.pre：build阶段 前置 插件: 内置 及 用户定义
    22.1、 ensureWatchPlugin：
    22.2、watchPackageDataPlugin：
    22.3、commonjsPlugin：
    22.4、dataURIPlugin：
    22.5、assetImportMetaUrlPlugin：
    22.6、config.build.rollupOptions.plugins：用户自定义插件
23、dynamicImportVarsPlugin：支持动态导入语法
    通过config.build.dynamicImportVarsOptions配置的include 和 exclude，可明确哪些目录模块是支持动态导入的
    默认exclude = [/node_module/]

    load钩子：
    如果导入的模块地址为 @vite/dynamic-import-helper，则该模块内容为
    内置方法：export default function dynamicImportHelper(...) { ... }
   
    transform钩子：处理import(`xxx/${exp}`)表达式
    1、 根据include 和 exclude配置，确定当前模块代码是否支持动态导入
    2、根据 es-module-lexer 依赖，分析得到当前模块内容的所有import语法
    3、判断每个import语法，判断是否为动态导入，满足条件：
          import(urlExp)表达式
          urlExp：导入地址必须以`开头，如：urlExp = `xxx/${exp}`
    4、通过 acorn 依赖，解析上面的urlExp
    5、在通过 @rollup/plugin-dynamic-import-vars 依赖将 urlExp转换成 globExp = xxx/*
    6、最终转换成 importGlob = import.meta.glob(globExp，params)
    7、把原来的import(`xxx/${exp}`)表达式，转换成 __variableDynamicImportRuntimeHelper(importGlob, rawImport)
    8、同时也必须引入 import __variableDynamicImportRuntimeHelper from "${dynamicImportHelperId}";
         这里的 dynamicImportHelperId 就是在上面load钩子中定义的内置方法

24、importGlobPlugin：处理import.meta.[ glob | globEager | globEagerDefault ](...)表达式
    预发import.meta.glob(args1, args2)
    1、 解析代码，收集代码中所有满足规则的 globType  和 globTypeIndex
    2、通过 acorn.parseExpressionAt 、globType  和 globTypeIndex方法分析表达式，并得到AST值
    3、根据返回的AST，得到表达式中定义的参数信息：args1 和 args2 -- 至少有1个参数，不能超过2个
    4、处理args1参数 -- glob地址或一组glob地址
         1、 如果 args1 类型为 Literal(字符串)，例如 glob('/a/b/*')，则会记录 /a/b/*
         2、如果 args1 类型为 TemplateLiteral，例如 glob('/a/b/${c}')，则会记录 /a/b，如果glob('/a/${b}/c')，则只会记录 /a/
         即如果使用Template表达式，${...} 表达式只能放在最后面 - 源码
         3、如果 args1 类型为 ArrayExpression，则执行递归
         4、最终将代码中所有glob(...)表达式第一个参数args1 都集中起来 globs = [...]
    5、处理args2参数 -- 配置参数
         1、处理args2参数，args2必须是一个对象结构：glob('/a/b/*', {...})，且允许字段：
             query: 'string | object', 导入文件地址参数
             as: 'string',  url 、raw 或 空 -- 决定模块内容
             eager: 'boolean', true 表示 静态方式导入，false 表示采用动态方式导入
                 如果eager=true，则会生成import {...} from 'globMetaPath'语句
                 如果eager=false，则会生成import(...).then(...)表达式
                 两者的区别：
                     为 true 时，在加载该宿主模块时，会同时加载glob模块
                     为 false 时，只有在使用时，才会去加载glob模块
             import: 'string',  导入模块名称，支持 default，* 和 exportName
             exhaustive: 'boolean' -- 决定文件扫描规则 dot 和 ignore 规则
                  如果 exhaustive = true，在扫描文件时，将包含dot文件，以及不排除node_module目录文件
                  如果 exhaustive = false，与之上一条规则相反
         2、并将字段信息收集到options中
    6、处理配置信息 options -- 配置import语句不同形式 -- 静态import ... from ... 和 动态import(...)
          1、 如果存在 options.as 且 该值为 raw 或 url，则 options.import 必须是 default 或 *
          2、options.as 和 options.query 不能同时出现
          3、如果存在 options.as，则将 options.query = options.as
    7、处理globs信息 - 根据config.root 或 importer所在目录，得到具体的glob地址
          1、 已 / 开头 = 相对于 root
          2、已 ./ 开头 = 相对于当前模块文件
          3、已 ../ 开头 = 相对于当前模块文件
          4、已 ** 开头 = 不相关
          5、如果是bare import，则会通过插件的resolveId处理，处理结果必须是
    8、得到每个import.meta.glob表达式处理结果：
          type：glob类型 =》globType = glob | globEager | globEagerDefault
             其中 globEager 和 globEagerDefault 可以看做是 glob(..., { eager: true, import: 'default' }) 语法糖
          globs：表达式中的args1 
          globsResolved：根据globs对应的路径
          options：表达式中的 args2
          其他信息
    9、根据 globsResolved ，得到基础路径 commonBase
    10、通过 fast-glob 得到所有满足匹配规则的文件，并且会将import.meta.glob(...)替换成一个对象
           对象内容：{
             fileName：import模块        
           }
25、postPlugins：用户自定义后置插件
26、buildPlugins.post：build阶段，vite内置的后置插件
    26.1、 buildImportAnalysisPlugin：
    26.2、buildEsbuildPlugin：
    26.3、terserPlugin：
    26.4、manifestPlugin：
    26.5、ssrManifestPlugin：
    26.6、buildReporterPlugin：
    26.7、loadFallbackPlugin：
27、clientInjectionsPlugin：注入vite内置的依赖模块 - 仅在serve有效
    处理 @vite/client 和 @vite/env 这两个vite内部模块中出现的占位符：
    __MODE__         =》 config.root
    __BASE__          =》 config.base
    __DEFINES__    =》  环境变量
    __SERVER_HOST__
    __HMR_PROTOCOL__
    __HMR_HOSTNAME__
    __HMR_PORT__
    __HMR_DIRECT_TARGET__
    __HMR_BASE__
    __HMR_TIMEOUT__
    __HMR_ENABLE_OVERLAY__

28、importAnalysisPlugin：import表达式分析插件 - 仅在serve有效
    1、 排除无需分析的模块：.json、.map、.css 或 带?direct参数
    2、获得当前模块所有的import和export语句
         根据当前模块的父模块的文件后缀，提示用户安装合适的插件 -- vue文件、jsx文件
    3、分析所有import语句 - 【循环】
          1、 判断是否存在import.meta.hot表达式，如果存在则表示该模块支持HRM -- 参考@vite/vue-plugin
               ① 分析import.meta.hot.accept(depsExp，...)表达式，并收集依赖信息到acceptedUrls中
               ② 分析import.meta.hot.acceptExports(exportsExp，...)表达式，并收集暴露信息到acceptedExports中
          2、分析每个import表达式中的url，从而计算出实际的导入文件地址
              可格式化的url规则：
              1、 非http[s]:// 或 data:// 地址
              2、非 @vite/client
              3、/public目下的非资源型文件
              normalizeUrl方法：
              1、 先确定importer文件地址 -》importerUrl
              2、再遍历所有插件的resolveId钩子函数，对传入的url做处理 -》resolved
              3、处理 resolved.id 不同场景，得到url
                   ① 以 config.root + / 开头，则截取
                   ② 以 config.cacheDir + deps 开头，且文件确实存在，则 url = /@fs/ + resolved.id
                   ③ url = resolved.id
              4、如果 url 是外部链接 -》 http[s]:// 开头
              5、如果 url 不是以 . 和 / 开头，则 url = /@id/ + resolved.id
              6、如果 url 不是以 .css 或 .js 结束，则url会跟上参数 import -》 url = url?import
              7、如果 url 是 js 或 css，且 url 上没有版本信息，则会把importer的版本信息补上  -》url = url?v=xxx
              8、设置 url 最近HRM时间 -》url = url?t=xxx
              9、结果返回：[url, resolved.id]
                   
         3、如果原始import url 和 normalize url 不一致，根据情况重新import表达式
         4、收集导入模块的依赖文件 imortedUrls
         5、收集导入模块的export属性 importedBindings
         6、收集当前模块所有静态依赖信息 staticImportedUrls
    4、判断是否存在import.meta.env表达式，如果存在则表示支持环境变量，会把用户自定义的环境变量设置到 import.meta.env 对象中
    5、如果支持HRM，则注入HRM模块代码，使得引入该模块时，会先创建一个import.meta.hot = hotContext对象
              通过hot.accept和acceptExports，将文件和变更回调进行绑定，例如在 @vitejs/plugin-vue 插件中，会动态注入 hot.accept(...)
              等待合适的时机去触发与文件绑定的回调函数

             `import { createHotContext as __vite__createHotContext } from "@vite/client";` +
                `import.meta.hot = __vite__createHotContext(${JSON.stringify(
                  importerModule.url
              });`
              
              注：创建的 import.meta.hot 对象包含的方法：
              accept(deps, callback)  -- 记录热更模块 和 热更方法，并且通过 hotModulesMap 维护到内存中
              acceptExports(_, callback) -- 同 accept方法类似，记录当前文件
              dispose(callback)：记录当前模块的 disposer 方法
              prune(callback)：记录当前模块 prune 方法
              invalidate：失效，重新加载页面
              on：添加自定义的事件，执行 notifyListeners(event, data) 方法时，会被触发
              send(event, data)：往服务端发送消息，消息结构：{ type: 'custom', event, data }
              同时需要配合ws.on(event, callback)

   6、根据 acceptedUrls 信息，替换import.meta.hot.accept(depExp,...)中的依赖信息
   7、如果importer是非css文件，更新当前模块的模块信息
   8、返回结果

二、钩子函数 - hooks
1、 config： 在初始化配置文件时被触发，由插件来动态扩展配置（单次）
2、configResolved：完成配置初始化后执行（单次）
--------------------------------------------------------------------- serve阶段 -----------------------------------------------------------------------
3、options： 创建 PluginContainer 时被触发，可扩展plugin容器的选项 和 minimalContext【最小上下文】（单次）
4、configureServer：添加后置服务函数
5、buildStart：编译开始回调
----》浏览器访问:html
6、transformIndexHtml：转化index.html文件内容, 内置钩子函数, 会将页面上的js/style模块化, 并且通过 ModuleGraph 对象进行统一管理
----》在浏览器访问页面时，会去加载资源文件(js/css/image/json)，此时会被内服务拦截转换
7、★resolveId：处理资源ID
8、★load：加载资源内容
----》资源文件添加到监听队列中（文件变化将会触发HMR）
9、★transform：对资源进行内容转换，及生成source map数据
----》资源请求响应结果


三、plugin-vue插件:
首先会在vite.config.js配置文件中, 配置  @vitejs/plugin-vue 插件
load：仅处理.vue依赖
    1、 如果是内置的 EXPORT_HELPER_ID 依赖，则加载内置辅助代码
    2、否则必须是带?vue的导入地址
          1、 如果 importUrl = xxx.vue?vue&src，则直接读取xxx.vue内容
          2、否则 先通过@vue/compiler-sfc将xxx.vue分析后得到 descriptor
          3、再根据地址上的 ?type&index=0 参数，得到具体内容
              type类型：script、template、style 和 customBlocks

transform：模块内容转换
    1、 如果不是.vue文件且没有?vue参数，则直接返回文件内容  -- main.js文件
    2、如果是.vue文件且没有?vue参数 -- 未被vue编译器处理的原生内容
          例如：main.js中的导入的vue文件
          1、 通过 @vue/compiler-sfc 对vue文件进行编译，得到不同类型的信息
               处理 script ：
                 ① 如果未提供src，则会通过ts方式进行编译，得到编译代码 const _sfc_main = { ... }
                 ② 如果提供src，则会把 <script> 标签代码转化成 import _sfc_main from xxx.vue?vue&type=script&scoped=&其他属性
               处理 templte：
                 ① 如果未提供lang 且 未提供src，则会把template模板内容变异成 const _sfc_render = ...
                 ② 否则则会生成 import { render as _sfc_render } from xxx.vue?vue&type=template&scoped=&其他属性
               处理 style：可以存在多个style标签
                 ① 如果是非css module，则会生成
                     import _style_${index} from xxx.vue?vue&type=style&index=${index}&scoped=&inline&lang.css
                 ② 如果是css module，则会生成
                     import moduleValueN  from xxx.vue?vue&type=style&index=${index}&scoped=&inline&lang.module.css
                     const cssModules = {moduleName: moduleValue, moduleName2: moduleValue2,...,moduleNameN: moduleValueN}
               处理custom：-- <custom type=“customType”>...</custom>
                 ① 生成自定义代码：
                     import block_${index} from xxx.vue?vue&type=customType&scoped=&其他属性
                     if (typeof block_${index} === ‘function’) { block_${index}( _sfc_main ) }
           2、在处理上述代码片段时，同时会往 _sfc_main 对象上特定属性
                 _sfc_main.render = _sfc_render 
                 _sfc_main.styles = [ _style_1, _style_2,..., _style_n ]
                 _sfc_main.__cssModules = cssModules 
           3、如果是scoped style，则设置
                 _sfc_main.__scopedId = `data-v-${descriptor.id}`
           4、如果是serve环境 或者 开启 devToolsEnabled 配置
                 _sfc_main.__file = fileName
           5、如果支持HMR
                _sfc_main.__hmrId = descriptor.id
                新增代码
                typeof __VUE_HMR_RUNTIME__ !== 'undefined' && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId,                             _sfc_main)
                export const _rerender_only = true // 如果仅仅是template变化
                import.meta.hot.accept(mod => {
                   if (!mod) return
                   const { default: updated, _rerender_only } = mod
                   if (_rerender_only) {
                        __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render)
                    } else {
                        __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated)
                    }
                })
                注：这里的 __VUE_HMR_RUNTIME__，是在vue项目中定义的，提供了3个方法：
                 createRecord -- 创建组件记录
                 rerender -- 当前组件重新渲染
                 reload -- 当前组件重新加载

          6、如果是支持SSR，则插入SSR相关代码
          7、新增代码
              import _export_sfc from '${EXPORT_HELPER_ID}'
              // 就是上面第2,3,4,5步，用于丰富 _sfc_main 对象的
              export default /*#__PURE__*/_export_sfc(_sfc_main, {....})
   
     3、如果带有?vue参数，已被compiler-sfc处理后的特定类型文件
        1、 如果type = template，返回结果：
        export const render = ...
        import.meta.hot.accept(...)
         
        2、如果type = style，通过 @vue/compiler-sfc 对样式进行编译处理
        
四、HMR解析 -- 以Vue项目为例
HMR：hot module replacement -- 模块热替换
HMR功能，只能在serve模式下才有效
vite HRM工作原理：
启动vite serve
1、 会创建一个ws服务端，为后面与客户端做准备
2、利用 chokidar 对文件监控 -- change(改变)、add(新增)、unlink(删除)
    可监控的文件范围：
    ① 监控config.root下所有文件
    ② 排除 **/.git/**
    ③ 排除 **/node_modules/**
    ④ 排除 **/test_results/**
    ⑤ 排除 config.watch.ignored 配置项
3、发现文件有变化 -- change，触发 handleHMRUpdate 方法
    1、 如果变化文件为 .env文件、vite.config.js文件、config.dependencies配置的文件，则会重启服务
    2、如果变化的文件是 dist/client/client.mjs，则会通过ws服务端向客户端发送full-reload消息
    3、获得变化模块集合
          1、 当前文件的模块
          2、plugin.handleHotUpdate(context)钩子函数执行结果
    4、根据变化模块集合，得到模块变更集合updates：
         type：`${moduleInfo.type}-update`
         path
    5、通过ws服务端向客户端发送update信息     
4、因为在serve模式下，在导入@vite/client模块时，会创建一个ws客户端
5、接收服务端发送过来的消息，并且进行处理
6、根据发送过来消息类型，决定执行不同的处理方式，消息类型payload.type：
    connected：与服务端建立连接后触发
    update：需要执行更新，该事件类型是HMR关键
    custom：执行自定义事件
    full-reload：重新刷新页面
    prune：清理事件
    error：错误事件
7、如果是事件类型为update：
    1、 得到本次更新的所有可更新数据 updates
    2、依次处理每个 updates，根据其模块类型，执行不同的处理方式
         type = js-update，执行 fetchUpdate(...)
            ① 根据当前变更文件 和 hotModulesMap，得到与文件关联的依赖模块 和 热更方法
            ② 重新加载待热更文件
            ③ 执行热更方法
         type = css-update，则
            ① 删除原 <link> 样式
            ② 新增新的<link href=“...”>
8、hotModulesMap：记录热更模块 和 热更方法
    通过hot.accept(...) 和  hot.acceptExports(...)来进行收集

页面浏览
假如当前页面已经被访问过，那么该页面上的所有组件都会被vite拦截分析
1、会先经过@vite/plugin-vue，此时所有vue文件上都会出现以下代码：
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

2、然后再经过 importAnalysisPlugin，会在该模块代码的头部添加以下代码
import { createHotContext as __vite__createHotContext } from '@vite/client'
import.meta.hot = __vite__createHotContext(vuePath)

经过以上2个插件的处理，就为当前vue文件注册了热更方法。在vue内部会去注册组件实例

页面组件修改
当vue文件发生了修改，则会首先会被监控到
然后触发 handleHMRUpdate  方法，并且ws服务端向ws客户端发送一条消息
ws客户端接到消息，去加载新的vue文件，得到最新的组件对象
然后根据 __hmrId 找到组件实例，并执行热更方法：rerender 或 reload


--------------------------------------------------------------------- build阶段 -----------------------------------------------------------------------
TODO

二、ModuleGraph【模块画像】
用于记录系统中所有模块的依赖关系和模块信息【ModuleNode】

ensureEntryFromUrl: 通过 PluginContainer, 将url地址生成对应的[url, resolveId, meta], 并由此创建一个ModuleNode对象, 并将其与url、resolveId、file建立关系。

三、optimizeDeps 配置
默认是作用于第三方依赖模块，因为第三方的依赖模块变更频率不快
为什么需要优化依赖：
    1、 统一依赖模块的结构，保证ESM能够正常使用
    2、减少请求次数，提高服务效率

1、读取metedata数据
    用于记录需要被优化的依赖模块信息，并且会落地到 node_modules/.vite/deps/_metadata.json 文件中
    来源：
         从已有的 _metadata.json 获取 -》兼容之前版本的文件
         config.optimizeDeps.force -》强制获取 -》配置及扫描
2、获取可优化依赖模块信息：如果是首次启动 或者 force=true：
     2.1、 添加手动配置的优化依赖：根据config.optimizeDeps.include配置，并将其设置为 metadata.discovered
     2.2、开启默认扫描机制(非build阶段)，收集项目切入点(entries)，三选一：
        根据 config.optimizeDeps.entries 配置
        根据 config.build.rollupOptions.input 配置
        根据 项目中任意的 html 文件 -- 默认方式
     2.3、将收集到的 entries 通过esbuild进行编译处理
        通过 esbuild 编译，可以进一步收集到 每个切入点(entry)所依赖的模块，然后对这些模块进行刷选，
        找到符合条件(bare imports)的模块信息
        通过 esbuild 编译时的不同事件(onResolve 和 onLoad)，对依赖模块及模块内容做适当的处理，最终收集并记录下
        需要的bare imports
3、开始执行优化：runOptimizeDeps 
    3.1、 对所有可优化的模块，进行一次esbuild编译，在编译过程中会将编译的结果文件存到 node_modules/.vite/deps/_temp/ 目录中
    3.2、将优化后信息设置到 metadata.optimized 字段上
    3.3、esbuild编译的结果，可能会产生一些 chunks 信息，则会设置到 metadata.chunks 字段上
    3.4、最终将所有的metadata信息 落地到 node_modules/.vite/deps/_temp/_metadata.json 文件上
4、最终将 node_modules/.vite/deps/_temp 重命名为 node_modules/.vite/deps

小结：通过将会在内存中记录所有可优化模块的信息，该模块信息可用于插件中【importAnalysisPlugin 】，重写import/export表达式
---------------------------------------------------------------------------------------------------------------------------------------------------





