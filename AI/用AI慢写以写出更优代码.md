# 使用 AI 更慢地写出更好的代码

作者：Nolan Lawson  
发布日期：2026年5月25日

许多人似乎确信 AI 编程的目标就是尽可能快地写出低质量的代码。大量喷出勉强合格的垃圾代码，打开巨大的 PR（Pull Request），未经审查就合并它们。赶紧发布！

但实际上，LLM（大语言模型）非常灵活。你也可以同样有效地利用它们来*更慢*地写出*高质量*的代码。

在这一点上，这个陈述对我来说似乎完全显而易见，我甚至不想写这篇文章。但似乎有足够多的人确信 LLM 只能作为[垃圾代码大炮](https://x.com/i/status/2021617680525172840)，所以提出相反的观点是值得的。

如果 [Mythos](https://www.anthropic.com/research/glasswing-initial-update) 教会了我们什么，那就是 LLM 代理*非常擅长*发现 bug。如果你把它们投向代码库足够多次，它们会发现如此多的 bug，以至于你几乎不知道该如何处理它们。

像[许多人](https://xbow.com/blog/mythos-like-hacking-open-to-all)一样，我也发现这对于非 Mythos 模型也是如此——有些模型可能在发现微妙的 bug 或避免误报方面比其他模型更好，但事实是，Anthropic 和 OpenAI 的最新公共模型已经足够好，可以找到未经审查的代码库中的大量 bug。

问题不在于*发现* bug，而在于确定优先级和验证它们。因此，我有一个 Claude 技能，我是根据[这篇文章](https://milvus.io/blog/ai-code-review-gets-better-when-models-debate-claude-vs-gemini-vs-codex-vs-qwen-vs-minimax.md)的核心洞察改编的，即你向 PR（Pull Request）审查投入的更多、不同的模型，你就越不可能产生幻觉或虚假的 bug。

这个技能说（意译）：

> 运行一个 Claude 子代理、Codex 和 Cursor Bugbot 来查找这个 PR 中的 bug，按关键/高/中/低排名。一旦它们都完成了，审查它们的发现，进行你自己的研究以排除误报，并编写最终报告。

基本上就是这样。如果你愿意，可以添加你自己的"bug"定义——我的定义包括关于 [KISS](https://en.wikipedia.org/wiki/KISS_principle)和 [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)原则的规定、编写可访问的 HTML/JSX、为 SQL 查询使用适当的索引等。

根据我的经验，这个技能总是在 PR 中发现大量 bug，误报率接近于零。它发现了如此多的 bug，以至于如果你试图处理所有这些 bug，你会无聊得发疯。这些 bug 范围从关键的安全或正确性 bug，到更平凡的中级性能 bug，再到低级的"此评论具有误导性"类型的 bug。

我的典型工作流程是：

- 让代理修复所有关键和高优先级的 bug（在我的指导下采用正确的解决方案），然后重复，直到没有关键/高优先级的 bug
- 跳过那些不值得的（为了修复一个狭窄的边缘情况需要 100 行代码）
- 如果它有如此多的关键 bug，以至于我意识到整个方法都是错误的，就放弃这个 PR

当我使用这种技术时，我不一定看到我的速度提高了。如果有的话，审查过程经常发现*预先存在*的 bug，所以我最终会进入一个切线的侧任务，编写单元测试并修复早于 PR 的微妙缺陷。这与大多数人想象"氛围编程"时的"10倍生产力"垃圾代码大炮式开发完全相反，但我发现它非常令人满意。

这是提高代码库整体健康的好方法，同时也教会你代码库的奇怪角落。根据我的经验，复杂架构的愉快路径不如其失败模式有趣。而在 LLM 之前，这通常是我熟悉代码库的方式：理解假设在哪里崩溃，然后动手修复它。

如果你是那种怀疑 AI 编程对*任何事*都有好处的人，那么我怀疑这篇文章不会说服你。但如果你是那种使用代理编写你自己几乎都不理解的数百行 PR 的开发者，我邀请你慢下来，尝试这种其他、更慢的"氛围编程"风格。询问代理你的 PR 如何工作以及它可能会如何失败。让它在必要时编写带有 [Mermaid 图表](https://mermaid.ai/open-source)的 Markdown 文档。使用 [Matt Pocock 的 `/grill-me`](https://www.aihero.dev/my-grill-me-skill-has-gone-viral)技能，直到你从前到后完全理解整个 PR。

你可能在原始代码行数方面不一定更"富有成效"。你可能花费大量的 tokens 只是为了发现你的整个计划从一开始就是错误的。但我发现这种编码风格是我在 LLM 之前就已经尝试的那种编程的更强大版本：仔细、有条理、痴迷于质量，专注于为下一个编码者改进事物。

所以深呼吸，慢下来，尝试这种技术，看看你不喜欢更慢地写出更好的代码。

---

**原文链接**：[Using AI to write better code more slowly](https://nolanlawson.com/2026/05/25/using-ai-to-write-better-code-more-slowly/)
