# 领域文档

本文件说明工程 skills 在探索代码库前如何读取 MarksVault 的领域文档。

## 探索前读取

- 读取仓库根目录的 `CONTEXT.md`。
- 如果根目录存在 `CONTEXT-MAP.md`，则按其中映射读取与当前工作相关的
  `CONTEXT.md`。
- 读取 `docs/adr/` 中与当前工作区域相关的 ADR。

如果这些文件尚不存在，继续执行即可，不要仅因缺失而提前创建或报告问题。
`domain-modeling` 会在领域术语或架构决策实际明确时按需创建它们。

## 文档布局

本仓库使用 single-context 布局：

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-decision.md
└── src/
```

## 使用领域词汇

当 issue 标题、重构建议、诊断假设或测试名称涉及领域概念时，使用
`CONTEXT.md` 中定义的术语，不要改用其中明确排除的同义词。

需要使用但 glossary 中不存在的概念，通常意味着当前措辞不符合项目语言，或
领域模型确实存在缺口。前者应重新命名，后者应交给 `domain-modeling` 处理。

## 标记 ADR 冲突

如果输出与现有 ADR 冲突，必须明确指出，而不是静默覆盖。例如：

> 与 ADR-0007 冲突，但由于当前约束已经变化，值得重新讨论。
