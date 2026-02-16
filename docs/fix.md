# fix

使用技能：`browser-extension-developer` + `code-reviewer`（扩展跨浏览器 + 代码审查流程）。

## 修复进度（按顺序）
1. [x] `[Critical] 默认“恢复最新备份”路径与实际备份产物不一致`
2. [x] `[Critical] 书签恢复流程存在“静默失败后仍返回成功”的数据一致性问题`
3. [x] `[High] organize 任务的 delete/rename/tag 分支同样忽略底层失败结果`
4. [x] `[High] 多处硬编码 Chrome 书签 ID（"0"/"1"），与 Firefox 结构不兼容`
5. [x] `[High] 后台服务初始化失败会被吞掉并缓存，当前 SW 生命周期内不会重试`
6. [ ] `[High] task 持久化成功状态可能被误报`
7. [ ] `[Medium] 通用存储读取会把合法 falsy 值误判为 null`
8. [ ] `[Medium] validate 功能当前是“模拟成功”，不是实际校验`
9. [ ] `[Medium] 推送 HTML 时逐条串行抓 favicon，容易触发执行超时`
10. [ ] `[Low] 版本与文档信息存在不一致`

**发现（按严重级别）**
1. `[Critical] 默认“恢复最新备份”路径与实际备份产物不一致，恢复流程默认会失败。`  
影响：用户在不手选备份文件时会走“latest”分支，但仓库里从未写入该文件。  
证据：`src/services/backup-service.ts:13`、`src/services/backup-service.ts:170`、`src/services/backup-service.ts:468`。

2. `[Critical] 书签恢复流程存在“静默失败后仍返回成功”的数据一致性问题。`  
影响：删除旧书签或创建新书签失败时，流程仍可能显示恢复成功，导致部分恢复/数据错乱。  
证据：`src/services/backup-service.ts:607`、`src/services/backup-service.ts:590`、`src/services/backup-service.ts:629`；对应底层方法失败仅返回 `success:false` 不抛异常：`src/utils/bookmark-service.ts:365`、`src/utils/bookmark-service.ts:256`。

3. `[High] organize 任务的 delete/rename/tag 分支同样忽略底层失败结果。`  
影响：任务历史会记录成功，但真实书签操作可能已失败。  
证据：`src/services/organize-service.ts:328`、`src/services/organize-service.ts:329`、`src/services/organize-service.ts:392`、`src/services/organize-service.ts:396`、`src/services/organize-service.ts:497`、`src/services/organize-service.ts:500`；底层失败返回值：`src/utils/bookmark-service.ts:344`、`src/utils/bookmark-service.ts:316`。

4. `[High] 多处硬编码 Chrome 书签 ID（"0"/"1"），与 Firefox 结构不兼容。`  
影响：Firefox 下根目录加载、书签栏识别、恢复定位可能失效，和“多浏览器支持”目标冲突。  
证据：`src/popup/components/BookmarksView/BookmarksView.tsx:89`、`src/popup/components/BookmarksView/BookmarksView.tsx:102`、`src/services/backup-service.ts:498`。

5. `[High] 后台服务初始化失败会被吞掉并缓存，当前 SW 生命周期内不会重试。`  
影响：一次初始化异常后，后续事件仍继续执行但依赖服务可能未就绪。  
证据：`src/entrypoints/background.ts:31`、`src/entrypoints/background.ts:45`、`src/entrypoints/background.ts:46`。

6. `[High] task 持久化成功状态可能被误报。`  
影响：`saveTasks` 没有检查 `setStorageData` 返回值，存储失败时仍返回成功，可能导致“UI 显示成功但实际未写入”。  
证据：`src/services/task-service.ts:686`、`src/services/task-service.ts:688`；底层返回失败而非抛异常：`src/utils/storage-service.ts:462`、`src/utils/storage-service.ts:494`。

7. `[Medium] 通用存储读取会把合法 falsy 值误判为 null。`  
影响：如果某 key 存储 `false/0/''`，读取会被吞成 `null`。  
证据：`src/utils/storage-service.ts:445`。

8. `[Medium] validate 功能当前是“模拟成功”，不是实际校验。`  
影响：用户看到“已验证全部正常”，但没有真实可用性检测。  
证据：`src/services/organize-service.ts:434`、`src/services/organize-service.ts:437`。

9. `[Medium] 推送 HTML 时逐条串行抓 favicon，容易触发执行超时。`  
影响：大书签集下任务耗时高，和执行器 60s 超时冲突，导致 push 失败。  
证据：`src/services/backup-service.ts:1024`、`src/services/backup-service.ts:1063`、`src/services/task-executor.ts:37`。

10. `[Low] 版本与文档信息存在不一致。`  
影响：用户侧信息可信度下降。  
证据：`src/popup/components/SettingsView/AboutSettings.tsx:30`（显示 `v0.1.1`） vs `package.json:3`（`1.0.0`）；README 指向文档目录但仓库无 `docs/`（`README.md:215`）。

**自动化检查结果**
1. `npm run typecheck` 通过。  
2. `npm run lint` 通过但有 28 条 warning（未使用变量、1 处 non-null assertion 等）。  
3. `npm test -- --runInBand`：5/5 suites 通过，12/12 tests 通过。  
4. `npm run build:all`：Chrome/Firefox/Edge 三端构建通过。

**测试与流程风险**
1. 核心高风险路径（`backup-service`、`organize-service` 的真实写操作/失败分支）缺少单测覆盖。  
2. CI 未执行 `lint`（` .github/workflows/build.yml:28` 之后没有 lint 步骤），warning 会持续累积。

---

## 修复记录

### 1. 默认恢复 latest 路径与实际备份产物不一致（已完成）
- 修复文件：
  - `src/services/backup-service.ts`
  - `src/services/backup-service.test.ts`
- 实现说明：
  - 默认恢复路径不再固定指向 `bookmarks/bookmarks_backup_latest.json`。
  - 新增“最新备份文件解析”逻辑：优先选择 `bookmarks/bookmarks_backup_YYYYMMDDHHMMSS.json` 中时间戳最新的文件。
  - 若仓库没有时间戳文件，则兼容回退到 `bookmarks_backup_latest.json`。
  - 若两者都不存在，返回明确错误：`未找到可恢复的书签备份文件，请先进行备份`。
- 验证与测试（2026-02-16）：
  - `npm run typecheck`：通过。
  - `npm test -- --runInBand src/services/backup-service.test.ts`：通过（3/3）。
  - `npm run lint -- src/services/backup-service.ts src/services/backup-service.test.ts`：通过（项目现存 28 条 warning，无新增 error）。

### 2. 书签恢复静默失败后仍返回成功（已完成）
- 修复文件：
  - `src/services/backup-service.ts`
  - `src/services/backup-service.test.ts`
- 实现说明：
  - 恢复时删除旧书签不再忽略返回值；`removeBookmarkTree` 返回 `success:false` 会立即抛错并终止恢复。
  - 递归创建流程不再“失败后 continue”；`createFolder/createBookmark` 失败会抛错并终止恢复。
  - folder 创建成功但缺少 `data.id` 也视为失败，避免后续写入到无效父节点。
- 验证与测试（2026-02-16）：
  - `npm run typecheck`：通过。
  - `npm test -- --runInBand src/services/backup-service.test.ts`：通过（5/5，新增“删除失败中断”“创建失败中断”）。
  - `npm run lint -- src/services/backup-service.ts src/services/backup-service.test.ts`：通过（项目现存 28 条 warning，无新增 error）。

### 3. organize delete/rename/tag 忽略底层失败结果（已完成）
- 修复文件：
  - `src/services/organize-service.ts`
  - `src/services/organize-service.test.ts`
- 实现说明：
  - `deleteBookmarks`：检查 `removeBookmark` 返回值，`success:false` 记为失败并写入错误日志。
  - `renameBookmarks`：检查 `updateBookmark` 返回值，失败时不再计入成功数。
  - `tagBookmarks`：检查 `updateBookmark` 返回值，失败时计入错误并返回失败结果。
- 验证与测试（2026-02-16）：
  - `npm run typecheck`：通过。
  - `npm test -- --runInBand src/services/organize-service.test.ts`：通过（3/3，覆盖 delete/rename/tag 失败分支）。
  - `npm run lint -- src/services/organize-service.ts src/services/organize-service.test.ts`：通过（项目现存 28 条 warning，无新增 error）。

### 4. 硬编码书签根/书签栏 ID 导致 Firefox 不兼容（已完成）
- 修复文件：
  - `src/utils/bookmark-service.ts`
  - `src/popup/components/BookmarksView/BookmarksView.tsx`
  - `src/services/backup-service.ts`
  - `src/services/backup-service.test.ts`
- 实现说明：
  - 新增统一“书签栏识别”能力：`isBookmarkBarNode` / `findBookmarkBar`，支持 Chrome/Edge 的 `id=1` 与 Firefox `toolbar...` 前缀。
  - `BookmarksView` 初始化改为“先轻量 `getChildren('0')`，失败回退 `getBookmarkRoots`”，避免只依赖 Chrome 根 ID。
  - 路径解析新增可配置根节点终止条件（`bookmarkRootNodeId`），兼容 Firefox 根节点 ID。
  - 书签恢复与 HTML 生成均复用统一识别逻辑，移除重复硬编码判断。
- 验证与测试（2026-02-16）：
  - `npm run typecheck`：通过。
  - `npm test -- --runInBand src/services/backup-service.test.ts`：通过（6/6，新增 Firefox `toolbar` 场景）。
  - `npm run lint -- src/utils/bookmark-service.ts src/services/backup-service.ts src/services/backup-service.test.ts src/popup/components/BookmarksView/BookmarksView.tsx`：通过（项目现存 28 条 warning，无新增 error）。

### 5. 后台初始化失败后同 SW 生命周期不重试（已完成）
- 修复文件：
  - `src/entrypoints/background.ts`
  - `src/entrypoints/background.test.ts`
- 实现说明：
  - 初始化 promise 增加失败回收：初始化抛错时会将缓存 promise 清空，后续事件可再次触发初始化。
  - 新增 `ensureServicesInitializedOrLog`，各事件入口在初始化失败时会安全跳过，避免在未就绪状态继续执行核心逻辑。
  - 暴露测试专用方法 `ensureServicesInitializedForTesting` / `resetServicesInitStateForTesting`，用于验证门闩行为。
- 验证与测试（2026-02-16）：
  - `npm run typecheck`：通过。
  - `npm test -- --runInBand src/entrypoints/background.test.ts`：通过（2/2，覆盖“失败后重试”“并发单次初始化”）。
  - `npm run lint -- src/entrypoints/background.ts src/entrypoints/background.test.ts`：通过（项目现存 28 条 warning，无新增 error）。
