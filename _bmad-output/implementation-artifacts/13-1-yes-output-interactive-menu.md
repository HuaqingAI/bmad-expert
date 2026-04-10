# Story 13.1: --yes 输出增强与交互确认菜单

Status: ready-for-dev

## Story

As a AI caller 和 CLI 用户,
I want --yes 模式输出完整操作摘要（每个文件的处理结果），交互模式提供智能推荐的选项菜单,
So that AI 可解析操作效果做后续决策，人类用户在交互中获得合理的默认推荐。

## Acceptance Criteria

1. **AC1 — init --yes 逐文件摘要（FR72）**
   **Given** 执行 `npx bmad-expert init --yes`，处理了 3 个文件
   **When** 完成后
   **Then** 输出操作摘要，每个文件标注处理结果：`CLAUDE.md: appended`、`bmad-expert/CLAUDE.md: created`、`bmad-expert/workflow/...: created`

2. **AC2 — update --yes 逐文件摘要（FR72）**
   **Given** 执行 `npx bmad-expert update --yes`，处理了框架文件和标记管理文件
   **When** 完成后
   **Then** 输出操作摘要：`CLAUDE.md: section-replaced`、`SOUL.md: confirmed-overwrite`、`IDENTITY.md: skipped (no change)`

3. **AC3 — init 交互模式：workspace-claude 无标记（FR75）**
   **Given** 执行 `npx bmad-expert init`（交互模式），workspace CLAUDE.md 已存在但无 bmad 标记
   **When** 处理该文件
   **Then** 选项菜单为：① 追加 BMAD 配置段落（推荐）② 覆盖（先备份）③ 跳过 ④ 查看 diff，默认推荐"追加"

4. **AC4 — init 交互模式：workflow 文件已存在（FR75）**
   **Given** 执行 `npx bmad-expert init`（交互模式），workflow 文件已存在
   **When** 处理该文件
   **Then** 选项菜单为：① 覆盖（先备份）（推荐）② 跳过 ③ 查看 diff，默认推荐"覆盖"

5. **AC5 — 测试覆盖**
   **Given** `test/initializer.test.js` 和 `test/updater.test.js` 扩展
   **When** 运行 `npm test`
   **Then** --yes 输出摘要格式、交互菜单选项测试通过

## Tasks / Subtasks

- [ ] Task 1: init 逐文件摘要输出 (AC: #1)
  - [ ] 1.1 修改 `lib/initializer.js` 的 `init()` 函数末尾摘要输出，从分组格式改为逐文件格式
  - [ ] 1.2 逐文件格式：`{path}: {action}`，每行一个文件
- [ ] Task 2: update 逐文件摘要输出 (AC: #2)
  - [ ] 2.1 修改 `lib/updater.js` 的 `updateMarkerManagedFile()` 和 `updateFullReplaceFile()` 返回细粒度 action 标签
  - [ ] 2.2 修改 `updateInitConfigs()` 收集逐文件结果数组并返回
  - [ ] 2.3 修改 `update()` 函数末尾用逐文件格式输出摘要
- [ ] Task 3: init 交互菜单"推荐"标签 (AC: #3, #4)
  - [ ] 3.1 检查 `lib/initializer.js` 的 `resolveConflicts()` 中现有交互提示文本，确认"推荐"标签是否已存在
  - [ ] 3.2 若缺失，在对应选项后追加"（推荐）"文本
- [ ] Task 4: 测试扩展 (AC: #5)
  - [ ] 4.1 `test/initializer.test.js` 增加 `--yes` 逐文件摘要格式断言
  - [ ] 4.2 `test/updater.test.js` 增加 `--yes` 逐文件摘要格式断言及新 action 标签断言
  - [ ] 4.3 确认交互菜单测试覆盖"推荐"标签

## Dev Notes

### 现状分析（关键差距）

**init 摘要输出** — 当前 `initializer.js` 第 511-525 行使用分组格式：
```
新建: A.md, B.md
追加: C.md
跳过: D.md
```
需改为逐文件格式：
```
CLAUDE.md: appended
bmad-expert/CLAUDE.md: created
bmad-expert/workflow/story-dev-workflow-single-repo.md: created
```
底层 `action` 值（`created`/`appended`/`overwritten`/`skipped`）已在 `resolvedFiles` 数组中正确记录，只需修改输出格式。

**update 摘要输出** — 当前 `updater.js` 中：
- `updateInitConfigs()` 返回 `{ skipped, filesUpdated, filesSkipped }` — 仅计数，无逐文件明细
- `updateMarkerManagedFile()` 返回 `boolean`（是否有变更）
- `updateFullReplaceFile()` 返回 `boolean`
- `update()` 输出单行："已更新至 vX.Y.Z，用户配置和 memory 完整保留。"

需要：
1. `updateMarkerManagedFile()` / `updateFullReplaceFile()` 返回细粒度 action 字符串
2. `updateInitConfigs()` 收集 `{ path, action }[]` 并返回
3. `update()` 用逐文件格式输出

**update action 标签映射**：
| 场景 | action 标签 |
|------|-------------|
| 标记管理文件 section 有变更 | `section-replaced` |
| 框架/workflow 文件已确认覆盖 | `confirmed-overwrite` |
| 文件内容无差异 | `skipped (no change)` |
| 用户拒绝覆盖（交互模式） | `skipped (user declined)` |

**init 交互菜单** — 当前 `resolveConflicts()` 已有完整的 4 选项菜单（第 276-290 行）和 3 选项菜单（第 291-295 行）。检查"（推荐）"文本是否已出现在提示字符串中。若已有则此 Task 可跳过。

### Architecture Compliance

- **输出**: 所有摘要通过 `output.js` 的 `printSuccess()` 输出，禁止 `console.log`
- **文件操作**: 使用 `fs-extra`，禁止原生 `fs`
- **导出**: Named exports only，禁止 default export
- **命名**: 函数 camelCase，常量 UPPER_SNAKE_CASE
- **错误处理**: 使用 `BmadError`，lib 模块禁止 `process.exit()`
- **测试**: vitest，文件在 `test/` 目录，镜像 `lib/` 结构

### 需修改的文件

| 文件 | 修改内容 |
|------|----------|
| `lib/initializer.js` | init() 末尾摘要格式从分组改为逐文件；确认交互菜单"推荐"标签 |
| `lib/updater.js` | updateMarkerManagedFile/updateFullReplaceFile 返回 action 字符串；updateInitConfigs 收集逐文件结果；update() 输出逐文件摘要 |
| `test/initializer.test.js` | 新增 --yes 逐文件摘要格式测试 |
| `test/updater.test.js` | 新增 --yes 逐文件摘要格式测试、action 标签测试 |

**不应修改的文件**: `cli.js`（无需变更）、`lib/checker.js`（13-2 已完成）、`lib/section-manager.js`（Epic 12 已稳定）

### Previous Story Intelligence (13-2)

- `cli.js` 不需修改 — return object 扩展会自动传递
- `templateVersion` 缺失时应省略字段而非返回 `null`
- Mock 策略：`fsMock` 含 `readJSON`/`readFile`/`pathExists`/`outputFile`
- readline mock 模式：`createInterface.mockReturnValue({ question: vi.fn((_, cb) => cb('Y')), close: vi.fn() })`
- 当前 479 个测试全部通过

### Git Commit Convention

- 功能提交: `feat(<scope>): <description>`
- 建议 scope: `init` 或 `update` 或 `cli`
- 作者: `Sue <boil@vip.qq.com>`，无 Co-Authored-By

### Project Structure Notes

所有修改在已有文件内完成，无需新建文件。保持 `lib/` 和 `test/` 目录的既有结构。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 13 Story 13.1] — AC 定义
- [Source: _bmad-output/planning-artifacts/architecture.md#CLI接口与通信模式] — 命令树和 --yes 行为
- [Source: _bmad-output/planning-artifacts/architecture.md#格式规范] — 输出规范
- [Source: _bmad-output/planning-artifacts/architecture.md#配置文件更新架构] — update 流程
- [Source: _bmad-output/planning-artifacts/architecture.md#标记化段落管理引擎] — section-manager API
- [Source: _bmad-output/implementation-artifacts/13-2-status-init-expansion.md] — 前置 Story 经验
- [Source: lib/initializer.js#511-525] — 当前 init 摘要输出
- [Source: lib/initializer.js#236-332] — resolveConflicts 交互菜单
- [Source: lib/updater.js#189-313] — updateInitConfigs
- [Source: lib/updater.js#375-425] — updateFullReplaceFile

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

### File List
