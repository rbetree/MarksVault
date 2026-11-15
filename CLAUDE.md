# CLAUDE.md

本文件为 Claude Code 提供本仓库的工作指引。更详细的架构说明与关键模式见 `AGENTS.md`，领域术语见 `CONTEXT.md`。

## 一、项目概述

MarksVault 是基于 WXT（Vite）的浏览器扩展，支持 Chrome MV3、Edge MV3 与 Firefox MV2。使用 React 18、TypeScript 与 Material-UI 5 开发，提供书签管理、GitHub 备份/恢复和事件驱动的自动化任务。

## 二、开发命令

| 命令 | 用途 |
| :--- | :--- |
| `npm run dev` / `dev:firefox` / `dev:edge` | 开发模式，输出到 `.output/<target>-dev/` |
| `npm run build` / `build:firefox` / `build:edge` | 生产构建，输出到 `.output/<target>/` |
| `npm run build:all` | 构建 Chrome、Firefox、Edge 三端 |
| `npm run zip:all` | 生成三端发布 zip |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint（`src/**/*.{ts,tsx}` 与 `wxt.config.ts`） |
| `npm test` | Jest 测试 |
| `npm run clean` | 清理 WXT 构建产物 |

提交前至少执行 `npm run typecheck && npm run lint && npm test`；改动构建配置或入口时再执行 `npm run build:all`。

## 三、目录结构

```text
src/
├── entrypoints/          # WXT 入口，manifest 由 WXT 生成
│   ├── background.ts     # MV3 Service Worker（Chromium）
│   ├── popup/            # Popup 页面 -> popup.html
│   ├── options/          # Options 页面 -> options.html
│   └── taskconfig/       # 独立任务配置/执行页 -> taskconfig.html
├── popup/                # Popup React UI 与主题 Context
├── taskconfig/           # 任务配置页 React UI
├── services/             # 业务服务层，全部为单例
├── types/                # 类型定义
└── utils/                # 书签、存储、favicon、日期工具
public/assets/icons/      # 扩展图标，随构建复制到输出目录
assets/images/            # README 宣传素材，不参与构建
test/mocks/               # Jest 使用的 wxt/browser mock
```

构建配置在 `wxt.config.ts`。Chrome/Edge 的 `_favicon` 权限与固定扩展 key 也在该文件处理。

## 四、架构要点

- **服务单例**：`src/services/` 下的服务统一通过 `ServiceClass.getInstance()` 获取，不要直接 `new`。
- **存储分层**：GitHub 凭据存放 `browser.storage.sync`，其余业务数据存放 `browser.storage.local`，封装在 `src/utils/storage-service.ts`。
- **事件统一**：书签的 `onCreated`、`onRemoved`、`onChanged`、`onMoved` 统一转换为 `EventType.BOOKMARK_CHANGED` 交给任务系统。
- **MV3 冷启动**：Service Worker 可能随时重启，事件入口通过 `ensureServicesInitialized` 保证服务就绪。
- **任务可靠性**：执行租约、书签写入租约、任务快照、三态执行结果等术语与语义见 `CONTEXT.md`。

## 五、关键约定

- **GitHub 文件编码**：上传文件内容必须使用 `btoa(unescape(encodeURIComponent(content)))`，普通 `btoa()` 会破坏非 ASCII 内容。
- **存储写入重试**：扩展存储写入封装了 3 次重试与指数退避，不要绕过 `storage-service` 直接写。
- **设置深合并**：`settings` 是嵌套对象，更新必须深合并，避免覆盖其他字段。
- **版本号**：每次完成一个开发里程碑，同时更新 `package.json` 与 `package-lock.json`（根与 `packages[""]`）的版本。UI 通过 `browser.runtime.getManifest().version` 读取，无需改界面。
- **锁文件来源**：依赖安装与 lockfile 重生成使用 `https://registry.npmjs.org/`。npmmirror 镜像会生成 `version` 与 `resolved` 不一致的条目。

## 六、测试

- Jest + ts-jest，测试文件与源码同目录，命名为 `*.test.ts`。
- `wxt/browser` 在 Jest 中映射到 `test/mocks/wxt-browser.ts`。
- 核心服务（任务执行、备份、整理）已有单元测试；`github-service.test.ts` 目前仅覆盖 `validateCredentials`。新增失败分支或状态迁移时同步补测试。

## 七、文档

| 文件 | 内容 |
| :--- | :--- |
| `AGENTS.md` | Agent 架构说明与关键模式 |
| `CONTEXT.md` | 领域术语与语义约定 |
| `docs/agents/issue-tracker.md` | GitHub Issue 操作约定 |
| `docs/agents/triage-labels.md` | triage 角色与仓库 label 映射 |
| `docs/agents/domain.md` | 领域文档读取约定 |
| `docs/fix.md` | 2026-02 代码审查修复记录 |
| `docs-myself/` | 本地过程文档，不入库 |
