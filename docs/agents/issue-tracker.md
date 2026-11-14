# Issue tracker：GitHub

本仓库的 issue 和 PRD 存放在 GitHub Issues 中。所有操作使用 `gh` CLI。

## 操作约定

- 创建 issue：`gh issue create --title "..." --body "..."`。多行正文使用
  heredoc。
- 读取 issue：`gh issue view <number> --comments`，同时获取 labels，并按需使用
  `jq` 过滤评论。
- 列出 issue：
  `gh issue list --state open --json number,title,body,labels,comments`
  并按任务需要添加 `--label`、`--state` 和 `--jq` 过滤条件。
- 评论 issue：`gh issue comment <number> --body "..."`。
- 添加或移除标签：`gh issue edit <number> --add-label "..."` 或
  `gh issue edit <number> --remove-label "..."`。
- 关闭 issue：`gh issue close <number> --comment "..."`。

在仓库 clone 中运行时，通过 `git remote -v` 推断 GitHub 仓库；`gh` 通常会
自动完成该推断。

## Pull Request 是否参与 triage

外部 Pull Request 不作为请求来源，不进入 `triage` 队列。`triage` 只处理
GitHub Issues。

GitHub 的 issue 和 Pull Request 共用编号空间。遇到来源不明的 `#42` 时，可先
运行 `gh pr view 42`，失败后再运行 `gh issue view 42`。

## Skill 指令映射

- 当 skill 要求“发布到 issue tracker”时，创建 GitHub issue。
- 当 skill 要求“获取相关 ticket”时，运行
  `gh issue view <number> --comments`。
