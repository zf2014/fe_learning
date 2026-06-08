# 如何打造 AI 代理喜爱的代码库

作者：Matt Pocock  
发布日期：2026年2月26日  
原文：[How To Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love)

---

AI 不是一个超能力开发者。它是一个没有记忆的新人。每次你启动一个代理，都像《记忆碎片》里的那个人走进你的代码库，说："好的，我来了，我在干什么？"

你的代码库——远比你的提示词或 `AGENTS.md` 文件重要——是影响 AI 输出的最大因素。如果设计不当，会在三个方面付出代价：

**糟糕的反馈循环。** AI 无法快速收到反馈，所以它不知道自己的改动是否达成了预期目的。

**难以导航。** AI 发现理解事情、查找文件、弄清楚如何测试非常困难。

**认知疲劳。** 你最终不得不手动拼凑维护 AI 和你的代码库，到处打补丁。

### AI 实际看到的是什么

想象这是你的代码库：

每个方块都是一个导出某些功能（函数、变量、组件）的模块。内部有模糊的分组：缩略图编辑器、视频编辑器、认证、CRUD 表单。

你理解这张心理地图。但 AI 不理解。它看到的是这个：

一堆杂乱无章的模块，彼此之间可以相互导入。没有分组，没有关系。文件系统也无济于事——所有东西都混在一起。

你每天要派 20 多个新员工来看你的代码库并做出改动。你的代码库需要对它们友好且易于导航。

## 解决方案：深层模块

你的代码库的文件系统和设计需要与你内心对它的地图相匹配。我找到的最好的方法是使用**深层模块**。

深层模块来自《软件设计哲学》。这个想法很简单：通过简单的接口控制大量的实现。

与其有很多小模块：

你会得到拥有简单、可控接口的大块功能。所有导出都必须通过那个接口。

### 灰盒模块

深层模块在你的代码库中创建了一个自然的接缝。你仔细控制和设计接口。内部的实现？交给 AI 去做。

编写测试来锁定模块的行为。这样你就不需要查看内部。如果你想——应用品味、影响结果或改进性能——你可以查看，但只要测试通过，你就不需要关心。

这就是**灰盒模块**。你拥有接口。AI 拥有实现。测试确保一切诚实。

### 改进的可导航性

为每个模块分配自己的文件夹，带有清晰的公共接口。AI 可以在文件系统上看到所有服务，读取它们的类型，并理解它们的功能——无需深入实现。

**我们为渐进式复杂度揭示设计了代码库。** 接口位于顶部，解释模块的功能。当我们需要时，可以查看内部。

### 减少认知疲劳

与其在脑海中记住数百个相互关联的模块，你只需要保留七八个块。AI 管理每个块内部的内容。你只需要关心设计接口以及它们如何组合在一起。

这仍然与"氛围编码"相差甚远。你需要在边界上应用品味——决定什么放入哪个模块。但心理地图要简单得多。

### 好的实践仍然是好的实践

这并不新鲜。这是好的代码库 20 年来一直以来的设计方式。对人类有效的方案对 AI 也同样出色。

## 总结

你的代码库可能还没有为 AI 做好准备。你没有深层模块，而是拥有一个相互连接的浅层模块网络：

这些模块难以导航、难以测试、难以记在脑海中。

解决方案是带有清晰接口和强大测试的深层模块。从你的 PRD 开始到实现问题，都要考虑模块边界。测试和反馈循环至关重要——它们是你的 AI 新员工了解改动是否有效的方式。

有些语言比其他语言更容易做到这一点。在 TypeScript 中，强制执行这些边界并不容易——我越来越多地使用 Effect，因为它让代码库的模块化变得简单。

---

**原文链接**：[How To Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love)

---

## 前端视角实践指南

### 一、前端落地原则映射

| 原文理念 | 前端落地方式 |
|---------|------------|
| **深层模块** | 一个功能模块 = 一个文件夹，对外只暴露 1 个 `index.ts`（或主组件） |
| **灰盒模块** | 你设计接口（Props / 类型 / 约定），AI 写内部实现 |
| **接口简单可控** | 模块的 public API 不超过 3-5 个导出（组件、hook、类型） |
| **测试锁定行为** | 只测 public 接口，不测内部私有函数 |
| **渐进式复杂度** | 外部只需要看 `index.ts` 的类型签名，内部可以层层深入 |

### 二、要避免的"浅层模块"反面教材

```
src/
  components/
    AvatarUpload.vue      # 散落的单个文件
    AvatarPreview.vue
  composables/
    useAvatarUpload.ts
  utils/
    avatarUtils.ts
    avatarTypes.ts
    avatarApi.ts
  stores/
    avatarStore.ts
```

这些文件分散在 4 个目录下，AI 很难发现它们属于同一个功能。

### 三、正确的"深层模块"结构

```
src/modules/avatar/
  index.ts              # 只导出: AvatarUploader 组件 + useAvatarUpload hook + AvatarTypes
  AvatarUploader.vue    # 对外组件（主入口）
  components/
    DropZone.vue        # 内部组件，不对外暴露
    CropModal.vue
    PreviewStrip.vue
  composables/
    useFileSelect.ts    # 内部逻辑
    useCrop.ts
    useUpload.ts
  utils/
    imageProcessor.ts
    fileValidator.ts
  api/
    uploadApi.ts
  __tests__/
    AvatarUploader.test.ts  # 只测 index.ts 导出的 public API
```

---

## 完整案例：图片上传模块

### 模块结构

```
src/modules/image-uploader/
  index.ts                       ← 唯一对外接口
  ImageUploader.vue              ← 主组件
  types.ts                       ← 模块内部类型（不对外暴露）
  components/
    FileDropTarget.vue            ← 拖拽上传（内部）
    CropOverlay.vue               ← 裁剪覆盖层（内部）
    ProgressBar.vue               ← 上传进度条（内部）
    ThumbnailPreview.vue          ← 缩略图预览（内部）
  composables/
    useFileSelection.ts           ← 文件选择逻辑
    useImageCrop.ts               ← 裁剪逻辑
    useUploadProgress.ts          ← 上传进度管理
    useImageValidation.ts         ← 图片校验（大小、格式、分辨率）
  utils/
    compressImage.ts              ← 图片压缩
    generateThumbnail.ts          ← 生成缩略图
    createFormData.ts             ← 构建上传表单数据
  api/
    uploadService.ts              ← 上传 API 调用
```

### `index.ts` — 极其简单的公共接口

```typescript
// 整个模块只暴露 3 样东西
export { default as ImageUploader } from './ImageUploader.vue'
export { useImageUploader } from './composables/useImageUploader'
export type { ImageUploaderOptions, UploadResult, UploadState } from './types'
```

那 7 个内部文件（`FileDropTarget.vue`、`CropOverlay.vue`、`useFileSelection.ts`、`compressImage.ts` 等）**AI 根本不需要知道它们存在**。

### AI 看到的心理地图

```
src/modules/image-uploader/
  ImageUploader             ← 组件，直接拖到页面用
  useImageUploader          ← hook，需要编程式控制时用
  ImageUploaderOptions      ← 配置选项
  UploadResult              ← 上传结果类型
  UploadState               ← 上传状态类型
```

这就是 **4 个知识点**——任何 AI 代理都能在 5 秒内理解这个模块是干什么的。

### 对内：AI 可以自由发挥的复杂实现

```typescript
// src/modules/image-uploader/composables/useImageCrop.ts
// 内部实现 —— AI 的管辖范围
export function useImageCrop(options: { aspectRatio?: number }) {
  const crop = ref<Crop | null>(null)
  const croppedBlob = ref<Blob | null>(null)

  // 内部有 80 行复杂的 canvas 操作、坐标计算、缩放逻辑...
  // 你不需要看，AI 写，测试通过就行
  async function applyCrop(image: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement('canvas')
    // ... 几十行 canvas 裁剪逻辑
    return new Promise((resolve) => canvas.toBlob(resolve!))
  }

  return { crop, croppedBlob, applyCrop }
}
```

### 对外的测试只测 public API

```typescript
// __tests__/ImageUploader.test.ts
// 只测试 index.ts 导出的公开 API
import { ImageUploader, useImageUploader } from '../index'

describe('ImageUploader 模块', () => {
  it('useImageUploader 应返回预期的状态', () => {
    const { state, upload } = useImageUploader()
    expect(state.value).toBe('idle')
  })

  it('上传成功后应返回 UploadResult', async () => {
    const { upload } = useImageUploader()
    const result = await upload(mockFile)
    expect(result).toMatchObject<UploadResult>({
      url: expect.any(String),
      width: expect.any(Number),
      height: expect.any(Number),
    })
  })
})

// 绝不测试 internal 函数，比如 compressImage、createFormData 等
```

### 案例如何解决原文说的三个问题

| 问题 | 案例中的体现 |
|------|------------|
| **糟糕的反馈循环** | 测试只锁定 public 接口（`ImageUploader` 组件行为、`useImageUploader` 返回值），AI 改了内部实现后跑测试就能立即知道是否破坏了功能 |
| **难以导航** | AI 只需要看 `index.ts` 就知道模块提供了什么，不需要翻阅 10+ 个文件来理解"这个图片上传是怎么组织的" |
| **认知疲劳** | 你只需要记住 4 个导出。内部那 7 个文件、几十个函数，是 AI 操心的事情 |

---

## 老项目落地策略（渐进式，低成本）

深层模块在新项目容易落地，但老项目搞全套重构成本高、风险大。以下是几条低成本的渐进策略：

### 策略一：先加 `index.ts` 做外观层（成本最低，立刻见效）

**不动任何现有文件**，仅在最外层加一个 `index.ts` 做公共接口。

```
src/
  api/
    upload.ts
    user.ts
  components/
    AvatarUpload.vue
    UserProfile.vue
  composables/
    useAuth.ts
```

只需加一个文件：

```
src/modules/user/
  index.ts        ← 新文件，只做 re-export，不移动任何代码
```

```typescript
// src/modules/user/index.ts
export { UserProfile } from '../../components/UserProfile.vue'
export { useAuth } from '../../composables/useAuth'
export { getUserApi } from '../../api/user'
export type { User, AuthState } from '../../types/user'
```

**效果**：AI 现在有了清晰的入口，不需要在 5 个目录里猜哪些文件属于用户功能。

**成本**：每个模块 5 分钟，写一个 `index.ts` 就行。可以按需、逐个模块来。

### 策略二：只改高价值模块（按变化频率排序）

不要全改，只改 AI 最常碰的 20%：

| 优先级 | 模块特征 | 示例 |
|--------|---------|------|
| 🔴 P0 | AI 代理频繁修改的功能 | 表单构建器、权限管理、支付流程 |
| 🟡 P1 | 功能复杂但稳定 | 用户设置页、通知系统 |
| 🟢 P2 | 简单且稳定 | 关于页面、静态展示组件 |

> **经验法则**：如果一个模块过去 3 个月 git log 少于 5 次修改，**别碰它**。花时间重构它省下来的 AI 时间根本不够回本。

### 策略三：用 Strangler Fig 模式逐渐替换

不重构老的，在旁边写新的，渐进切换到新模块。

```
1. 在 src/modules/payment/ 下新建深层模块
   - 新的 checkout 功能直接写在这里
2. 维护一个适配层
   - 新模块 index.ts 中混用"新代码" + "老代码代理"
3. 老模块文件不变，直到自然废弃
```

```typescript
// src/modules/payment/index.ts

// 新代码——直接在新目录下写
export { default as CheckoutWizard } from './CheckoutWizard.vue'
export { usePaymentIntent } from './composables/usePaymentIntent'

// 老代码——通过代理引入，不移动文件
export { calculateTax } from '../../legacy/payment/taxUtils'
export { formatPrice } from '../../legacy/payment/formatters'

// 类型——统一从这里导出
export type { PaymentMethod, CheckoutState } from './types'
```

**效果**：AI 看到的是一个清晰的 Payment 模块。老的 `legacy/` 目录变成黑盒，AI 不需要理解它，只需要通过 `index.ts` 代理调用。新功能直接写在深层模块目录里。随着时间推移，老文件调用越来越少，最终自然删除。

### 策略四：先加边界测试，再碰内部

```
步骤 1: 找到老模块的隐性接口
  → 比如"这个文件被 15 个地方 import"
步骤 2: 在模块外围加集成测试
  → 测试这个模块的 public 行为（不 mock 内部）
步骤 3: 创建 index.ts，验证测试通过
步骤 4: 再慢慢移动内部文件
步骤 5: 内部重构：简化、合并、删除冗余
```

**关键**：步骤 1-3 只需要 30 分钟，**已经获得 80% 的收益**（AI 能看到清晰接口）。步骤 4-5 才是大工程，可以不做，或者以后再做。

### 兜底原则：老项目不需要完美

> **深层模块的目标不是让代码库完美，而是让 AI 不需要理解你 10 年前写的那坨代码。**

即使内部一团糟，只要你为每个模块**切了一个边界**、**写了一层干净的 public 接口**，AI 的心理地图就从：

- ❌ "我要理解 300 个文件的关系"
- ✅ "我有 15 个模块，每个模块 2-3 个接口"

**300 → 45，压力减少 85%。而且不需要移动任何内部文件。**

### 总结：按成本排序的建议

| # | 做法 | 成本 | 收益 |
|---|------|------|------|
| 1 | 给模块加 `index.ts` 外观层 | 5 分钟/模块 | 高 |
| 2 | 只重构 P0 高频变更模块 | 按需 | 最高 ROI |
| 3 | Strangler Fig 渐进替换 | 中等 | 长期收益 |
| 4 | 先加边界测试再做内部重构 | 中高 | 安全第一 |
| 5 | 低优先级模块保持原样 | 0 成本 | 避免浪费 |

> **一句话总结**：给老项目加 `index.ts` 就像给杂乱的房间装了一扇好门——里面乱不乱不重要，重要的是进来的人知道这个房间是干嘛的。AI 也是。
