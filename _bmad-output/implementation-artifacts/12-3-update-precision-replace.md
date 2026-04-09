# Story 12.3: update 精准段落替换与框架文件确认

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want update 对标记管理文件只替换标记内段落不动我的自定义内容，对框架文件更新前让我确认并备份,
So that 我在 CLAUDE.md 标记外添加的自定义配置在更新后完整保留，框架文件更新不会静默覆盖我的调整。

## Acceptance Criteria

1. **AC1 — workspace CLAUDE.md 标记段落精准替换（FR67）**
   **Given** `.bmad-init.json` 存在，workspace CLAUDE.md 含完整 `<!-- bmad-workspace-config -->` 标记段落，新版模板中该段落有变化
   **When** 执行 `npx bmad-expert update`
   **Then** 调用 `section-manager.replaceBmadSection()` 替换标记内段落，标记外用户自定义内容不变
   **And** 输出："CLAUDE.md: bmad 配置段落已更新（用户自定义内容未变）"

2. **AC2 — project CLAUDE.md 标记段落精准替换（FR67）**
   **Given** project CLAUDE.md 含 `<!-- bmad-project-config -->` 标记，新版模板中该段落有变化
   **When** 执行 update
   **Then** 同样调用 `replaceBmadSection()` 精准替换

3. **AC3 — 框架文件确认+备份（FR68, FR69）**
   **Given** SOUL.md 有新版本更新（diff 不为空）
   **When** 执行 `npx bmad-expert update`（交互模式）
   **Then** 先创建 `SOUL.md.bak.{timestamp}` 备份，展示变更摘要（新旧内容 diff 或变更说明），等待用户确认后覆盖
   **And** 用户拒绝 → 文件不变，备份保留

4. **AC4 — --yes 模式自动确认（FR72）**
   **Given** `--yes` 参数传入
   **When** 框架文件有更新
   **Then** 自动备份 + 覆盖，不暂停确认，输出完整操作摘要

5. **AC5 — --force 跳过版本门控（FR74）**
   **Given** `--force` 参数传入，templateVersion === currentVersion
   **When** 执行 `npx bmad-expert update --force`
   **Then** 跳过版本门控，强制执行更新流程

6. **AC6 — 测试全覆盖**
   **Given** `test/updater.test.js` 扩展
   **When** 运行 `npm test`
   **Then** 标记段落替换、框架文件确认+备份、--force、--yes 场景测试全部通过

## Tasks / Subtasks

- [x] Task 1: 重构 `updateInitConfigs()` — 按文件类型分策略处理 (AC: 1, 2)
  - [x] 1.1 引入 `section-manager.js` 的 `replaceBmadSection` 和 `extractBmadSection`
  - [x] 1.2 定义 `SECTION_ID_MAP`：`workspace-claude` → `bmad-workspace-config`，`project-claude` → `bmad-project-config`
  - [x] 1.3 标记管理文件（workspace-claude, project-claude）使用精准段落替换流程
  - [x] 1.4 workflow 类型文件保持现有确认+备份+覆盖流程
- [x] Task 2: 框架文件确认+备份机制增强 (AC: 3, 4)
  - [x] 2.1 框架文件更新前展示变更摘要（文件名 + 行数变化）
  - [x] 2.2 确认+备份模式：备份为 `{filename}.bak.{timestamp}`，用户确认后覆盖
  - [x] 2.3 --yes 模式：自动备份+覆盖，输出完整操作摘要
  - [x] 2.4 用户拒绝时保留原文件和备份
- [x] Task 3: CLI 添加 --force 参数 (AC: 5)
  - [x] 3.1 `cli.js` update 命令添加 `--force` 选项
  - [x] 3.2 `update()` 和 `updateInitConfigs()` 接受 `force` 参数
  - [x] 3.3 `force === true` 时跳过 `templateVersion === currentVersion` 版本门控
- [x] Task 4: 扩展 `test/updater.test.js` (AC: 6)
  - [x] 4.1 标记管理文件精准段落替换测试（workspace-claude, project-claude）
  - [x] 4.2 框架文件确认+备份测试（交互模式 + --yes 模式）
  - [x] 4.3 --force 参数跳过版本门控测试
  - [x] 4.4 用户自定义内容保留验证测试
  - [x] 4.5 无差异时跳过测试
  - [x] 4.6 向后兼容（无 action 字段）测试

## Dev Notes

### 核心改造目标

将 `updateInitConfigs()` 中对所有文件的"全文件替换"逻辑，改为**按文件类型分策略处理**：

| 文件类型 | sectionId | 策略 | 确认 |
|---------|-----------|------|------|
| `workspace-claude` | `bmad-workspace-config` | 精准段落替换 | 无需（自动生成内容） |
| `project-claude` | `bmad-project-config` | 精准段落替换 | 无需（自动生成内容） |
| `workflow` | — | 全文件确认+备份+覆盖 | 需要（--yes 跳过） |

### 精准替换流程（标记管理文件）

```javascript
import { replaceBmadSection, extractBmadSection } from './section-manager.js'

// 1. 生成新版模板全文
const newFullContent = await generateFileContent(type, projectInfo)
// 2. 从新模板中提取标记段落
const newSection = extractBmadSection(newFullContent, sectionId)
// 3. 读取当前文件
const currentContent = await fs.readFile(filePath, 'utf8')
// 4. 精准替换标记段落
const updatedContent = replaceBmadSection(currentContent, sectionId, newSection)
// 5. 比较是否有变化
if (currentContent === updatedContent) { /* 跳过 */ }
// 6. 写入
await fs.outputFile(filePath, updatedContent)
```

### 框架文件确认+备份流程（增强现有逻辑）

现有 `updateInitConfigs` 已有备份+确认逻辑，但需确保：
- 备份命名格式：`{filePath}.bak.{timestamp}`（现有模式 Pattern B，保持一致）
- 交互模式下展示变更摘要后等待确认
- `--yes` 模式跳过确认直接备份+覆盖
- 用户拒绝时文件不变，备份保留

### --force 参数

- `cli.js`：在 update 命令上添加 `.option('--force', '...')`
- 传递到 `update({ force })` → `updateInitConfigs({ force })`
- 在版本门控检查处：`if (!force && manifest.templateVersion === currentVersion) return`

### 关键约束

1. **不使用正则**：section-manager 已用 `indexOf` + `substring` 实现，调用方不需自行解析标记
2. **文件 I/O 用 fs-extra**：`import fs from 'fs-extra'`
3. **输出用 output.js**：`printProgress()`, `printSuccess()`，禁止 `console.log`
4. **错误用 BmadError**：禁止 `throw new Error()`
5. **退出码用 EXIT_CODES 常量**：禁止数字字面量
6. **命名导出**：禁止 `export default`
7. **async/await**：禁止 `.then()` 链
8. **Git 作者**：`Sue <boil@vip.qq.com>`，无 Co-Authored-By

### SECTION_ID_MAP 位置

在 `lib/updater.js` 顶部定义：

```javascript
const SECTION_ID_MAP = {
  'workspace-claude': 'bmad-workspace-config',
  'project-claude': 'bmad-project-config',
}
```

### package.json 中的 fileCategories

`bmadExpert.frameworkFiles`（已有）：`["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md"]`
`bmadExpert.userDataPaths`（已有）：`["MEMORY.md", "USER.md", "memory/"]`
`bmadExpert.markerManagedFiles`（可能需要新增）：`["CLAUDE.md"]`

注意：`markerManagedFiles` 是否已在 package.json 中需确认；代码中 `SECTION_ID_MAP` 按 `.bmad-init.json` 的 `type` 字段匹配即可，不一定需要读 package.json。

### Project Structure Notes

- `lib/updater.js` — 主要修改文件
- `lib/section-manager.js` — 已实现，直接调用
- `lib/initializer.js` — `generateFileContent()` 可复用，无需修改
- `cli.js` — 添加 `--force` 选项
- `test/updater.test.js` — 扩展测试
- `templates/workspace-claude.md` — 含 `<!-- bmad-workspace-config -->` 标记（已有）
- `templates/project-claude.md` — 含 `<!-- bmad-project-config -->` 标记（Story 12.2 已加）

### 前序 Story 情报

**Story 12.1（section-manager）：**
- 所有函数均为纯同步函数，无副作用
- `replaceBmadSection` 在无标记对时返回原内容不变（幂等）
- `extractBmadSection` 对 `bmad-workspace-config` 有 Phase 3 fallback（`## Default Project` 标题）

**Story 12.2（init markers + action field）：**
- `.bmad-init.json` 每个文件条目已有 `action` 字段（`created`/`appended`）
- `generateFileContent(type, projectInfo)` 已封装在 `initializer.js` 中
- project-claude 模板标题行在标记外部

### 测试模式

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Mock: fs-extra, section-manager, initializer (generateFileContent), output, readline
// 测试描述用中文
```

现有测试 mock 模式：
- `MOCK_MANIFEST` 需扩展加入 `action` 字段
- `section-manager` 需新增 mock
- readline mock 用于确认流程测试

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.3] — AC 定义
- [Source: _bmad-output/planning-artifacts/architecture.md#Update Command] — 更新流程架构
- [Source: _bmad-output/planning-artifacts/architecture.md#Section Manager] — 标记管理引擎 API
- [Source: _bmad-output/planning-artifacts/prd.md#FR67-FR69, FR72, FR74] — 功能需求
- [Source: _bmad-output/implementation-artifacts/12-1-section-manager.md] — section-manager 实现详情
- [Source: _bmad-output/implementation-artifacts/12-2-init-project-claude-markers.md] — action 字段与标记模板

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

N/A

### Completion Notes List

- 重构 `updateInitConfigs()` 为按文件类型分策略：标记管理文件用 `section-manager` 精准段落替换，workflow 文件保持确认+备份+覆盖
- 新增 `updateMarkerManagedFile()` 和 `updateFullReplaceFile()` 两个内部函数
- CLI 新增 `--force` 选项，绕过 `templateVersion === currentVersion` 版本门控
- 测试全覆盖：标记段落替换、框架文件确认+备份、--force、--yes、无差异跳过、向后兼容、异常处理
- 所有 528 测试通过

### File List

- `lib/updater.js` — 主要修改：重构 `updateInitConfigs()`，新增 `updateMarkerManagedFile()` 和 `updateFullReplaceFile()`，引入 section-manager
- `cli.js` — 新增 `--force` 选项
- `test/updater.test.js` — 扩展 updateInitConfigs 测试套件
