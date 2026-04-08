# Story 10.3: init 幂等保护与已有文件冲突处理

Status: ready-for-dev

---

## Story

**As a** 用户（通过 AI 代劳）,
**I want** 重复执行 `npx bmad-expert init` 时系统检测到已有配置文件并提供覆盖/跳过/查看 diff 选项，不静默破坏我已定制的内容，
**So that** 即使误触发 init 也不会丢失我手动添加的自定义配置。

---

## Acceptance Criteria

### AC1 — 已有文件交互式冲突处理

**Given** workspace 根目录已存在 `CLAUDE.md`（之前 init 或手动创建）
**When** 执行 `npx bmad-expert init`
**Then** 对每个已有文件交互提示三选一：
  1. 覆盖（先备份为 `CLAUDE.md.bak.{timestamp}`）
  2. 跳过（保留原文件不动）
  3. 查看 diff（展示当前文件与新模板的差异，再决定覆盖或跳过）
**And** 输出中明确标注每个文件的处理结果（覆盖/跳过/新建）

### AC2 — 已有清单增量检测

**Given** `.bmad-init.json` 已存在（之前执行过 init）
**When** 执行 init
**Then** 读取已有清单，对比文件列表，仅处理有变化或新增的文件

### AC3 — --yes 安全默认

**Given** `--yes` 参数传入且存在已有文件
**When** 执行 init
**Then** 默认跳过所有已有文件（安全默认），不覆盖
**And** 输出摘要：哪些文件被跳过，哪些新文件被创建

### AC4 — 测试覆盖

**Given** `test/initializer.test.js` 扩展覆盖冲突处理场景
**When** 运行 `npm test`
**Then** 幂等保护、备份机制、跳过逻辑测试全部通过

---

## Tasks / Subtasks

- [ ] Task 1: 新增 `checkExistingFiles(cwd, filePaths)` 函数（AC1, AC2）
  - [ ] 1.1 接收 cwd 和待写入文件路径列表，返回 `ConflictInfo[]`
  - [ ] 1.2 对每个路径调用 `fs.pathExists()` 判断是否已有同名文件
  - [ ] 1.3 如存在 `.bmad-init.json`，读取并比对 files 列表，标记「已有且未变」和「新增」

- [ ] Task 2: 新增 `resolveConflicts(cwd, conflicts, newContents, options)` 函数（AC1, AC3）
  - [ ] 2.1 交互模式下对每个冲突文件提示三选一（覆盖/跳过/查看 diff）
  - [ ] 2.2 覆盖前调用 `backupFile(cwd, filePath)` 生成 `{filename}.bak.{timestamp}` 备份
  - [ ] 2.3 查看 diff 时生成简单行级差异输出，再让用户选覆盖或跳过
  - [ ] 2.4 `--yes` 模式：直接跳过所有已有文件，不覆盖

- [ ] Task 3: 重构 `generateFiles()` 集成冲突检测（AC1, AC2, AC3）
  - [ ] 3.1 在写入前先生成所有待写入内容到内存
  - [ ] 3.2 调用 `checkExistingFiles()` 获取冲突列表
  - [ ] 3.3 调用 `resolveConflicts()` 获取用户决定
  - [ ] 3.4 只写入用户选择覆盖或新建的文件
  - [ ] 3.5 每个文件附带处理结果标签：`created` / `overwritten` / `skipped`

- [ ] Task 4: 更新 `writeManifest()` 增量更新清单（AC2）
  - [ ] 4.1 如已存在 `.bmad-init.json`，读取后合并（保留跳过的文件记录，更新覆盖的文件时间）
  - [ ] 4.2 新生成的清单包含 `updatedAt` 字段

- [ ] Task 5: 扩展 `test/initializer.test.js`（AC4）
  - [ ] 5.1 `checkExistingFiles` — 无已有文件、部分已有、全部已有
  - [ ] 5.2 `resolveConflicts` — 覆盖选项（含备份验证）、跳过选项、--yes 模式跳过
  - [ ] 5.3 `generateFiles` 集成 — 首次运行（无冲突）vs 重复运行（有冲突）
  - [ ] 5.4 `writeManifest` — 增量更新已有清单
  - [ ] 5.5 `init` 端到端 — --yes 模式下已有文件被跳过

---

## Dev Notes

### 架构约束（强制遵守，与 Story 10-2 一致）

1. **文件操作只用 `fs-extra`**（`import fs from 'fs-extra'`），禁止原生 `fs`
2. **输出只通过 `output.js`**（`printProgress`/`printSuccess`），禁止 `console.log`
3. **错误只用 `BmadError`**，禁止 `throw new Error()`
4. **lib 模块禁止 `process.exit()`**，由 cli.js 顶层统一处理
5. **ESM 模块**，命名导出，无 `export default`

### 现有代码结构（Story 10-2 产物）

`lib/initializer.js` 已有导出函数：
- `detectWorkspaceStructure(cwd)` — 不动
- `collectProjectInfo(workspaceInfo, options)` — 不动
- `generateFiles(cwd, projectInfo)` — **需重构**，当前直接写入无冲突检查
- `writeManifest(cwd, files, defaultProject)` — **需扩展**，当前创建新清单
- `init(options)` — **需修改**，串联新的冲突检测流程

内部 helper `askQuestion(prompt)` — 可复用于冲突提示交互。

### 新增函数设计

#### `checkExistingFiles(cwd, files)`

```javascript
/**
 * @param {string} cwd
 * @param {Array<{path: string, type: string}>} files - 待写入文件列表
 * @returns {Promise<Array<{path: string, type: string, exists: boolean}>>}
 */
```

对 `files` 中每一项检查 `fs.pathExists(join(cwd, file.path))`，返回带 `exists` 标记的列表。

#### `resolveConflicts(cwd, conflicts, newContents, options)`

```javascript
/**
 * @param {string} cwd
 * @param {Array<{path: string, exists: boolean}>} conflicts - checkExistingFiles 结果
 * @param {Map<string, string>} newContents - path → 模板生成的新内容
 * @param {{yes?: boolean}} options
 * @returns {Promise<Array<{path: string, action: 'create'|'overwrite'|'skip'}>>}
 */
```

- `exists === false` → action = `'create'`
- `exists === true && options.yes` → action = `'skip'`
- `exists === true && 交互模式` → 提示三选一

#### `backupFile(cwd, filePath)`

```javascript
// 备份命名: CLAUDE.md → CLAUDE.md.bak.1712345678901
const timestamp = Date.now()
const backupPath = `${filePath}.bak.${timestamp}`
await fs.copy(join(cwd, filePath), join(cwd, backupPath))
```

#### `showDiff(existingContent, newContent)`

简单行级差异展示，标记 `-`（删除行）和 `+`（新增行）。无需引入 diff 库——逐行比较，展示不同的行即可，保持零外部依赖。

### generateFiles 重构方案

当前 `generateFiles` 直接写文件。重构为：

1. **生成阶段**：读模板 → 替换占位符 → 存入 `Map<path, content>`（不写磁盘）
2. **冲突检测阶段**：`checkExistingFiles(cwd, fileList)`
3. **冲突解决阶段**：`resolveConflicts(cwd, conflicts, contentsMap, options)`
4. **写入阶段**：只写 action 为 `create` 或 `overwrite` 的文件

返回值变为 `Array<{path, type, action}>` 包含每个文件的处理结果。

**向后兼容**：`generateFiles` 签名新增可选 `options` 参数传递 `yes` 标志。首次运行（无已有文件）行为不变。

### writeManifest 增量更新

```javascript
// 1. 尝试读取已有 .bmad-init.json
// 2. 已有 → 合并：保留 skipped 文件的原始记录，更新 overwritten 文件信息
// 3. 新增 updatedAt 字段
// 4. 写入
```

### --yes 模式行为对比

| 场景 | 已有文件行为 | 新文件行为 |
|------|------------|-----------|
| 首次 init --yes | N/A（无已有） | 正常创建 |
| 重复 init --yes | **跳过**（安全默认） | 正常创建 |
| 重复 init（交互） | 提示三选一 | 正常创建 |

**注意**：这与 `update --yes` 的行为**不同**（update 是备份+覆盖，因为用户明确要更新）。init 的 `--yes` 是安全默认跳过。

### 测试策略

**框架**：Vitest，沿用 Story 10-2 的 mock 模式。

新增 mock 需求：
- `fs.pathExists` 需要更精细的 mock 控制（区分检测项目目录 vs 检测已有文件）
- `fs.readFile` 需要 mock 已有文件内容（用于 diff 展示测试）
- `fs.copy` 需要 mock（用于备份测试）

在现有 `vi.mock('fs-extra')` 中添加 `pathExists`、`copy` 的 mock。

关键测试场景：
1. **首次运行无冲突**：所有文件 action=create，与 10-2 行为一致
2. **重复运行 --yes**：已有文件 action=skip，新文件 action=create
3. **备份机制**：覆盖时 `fs.copy` 被调用，备份路径包含时间戳
4. **清单增量更新**：已有清单被合并而非覆盖

### 不实现的内容（边界）

- 不实现 `--force` 强制覆盖选项（架构未定义）
- 不实现模板内容智能合并（架构明确：不尝试自动合并）
- 不修改 `cli.js`（init 命令注册已在 10-2 完成，无需新 CLI 选项）

---

### Project Structure Notes

**修改文件：**
```
lib/initializer.js          # 新增 checkExistingFiles、resolveConflicts、backupFile、showDiff；重构 generateFiles、writeManifest
test/initializer.test.js    # 扩展冲突处理测试场景
```

**不修改的文件：**
```
cli.js                      # init 命令注册已完成，无需变更
templates/*                 # 模板内容不变
lib/output.js               # 复用现有 printProgress/printSuccess
lib/errors.js               # 复用现有 BmadError
```

---

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#init 命令架构] — `checkExistingFiles` 函数定义、冲突处理策略
- [Source: _bmad-output/planning-artifacts/architecture.md#配置文件更新架构] — 备份文件命名规则、--yes 行为差异说明
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3] — AC 原文、BDD 场景
- [Source: _bmad-output/planning-artifacts/prd.md#FR56] — 已有配置文件冲突处理需求
- [Source: _bmad-output/implementation-artifacts/10-2-init-command-core.md] — 前置 Story 实现细节、代码模式、清单格式
- [Source: lib/initializer.js] — 当前实现代码，generateFiles 直接覆盖无冲突检查

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 基于 architecture.md 完整提取 checkExistingFiles 和冲突处理策略
- 从 Story 10-2 实现代码逆向分析 generateFiles 重构切入点
- 明确 --yes 模式下 init（跳过）vs update（覆盖）的行为差异
- diff 展示采用简单行级比较，零外部依赖，符合项目轻量化原则
- 测试策略与 10-2 完全对齐 vitest + vi.mock 模式

### File List

- `lib/initializer.js` (修改)
- `test/initializer.test.js` (修改)
