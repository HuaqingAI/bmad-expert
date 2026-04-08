# Story 11.1: update 命令扩展 — init 配置文件跟随更新

Status: done

---

## Story

**As a** 用户（通过 AI 代劳）,
**I want** 执行 `npx bmad-expert update` 时，系统在更新 _bmad 框架文件的同时检测 init 生成的配置文件是否有新版本模板更新，备份我的当前文件后展示变更摘要让我确认，
**So that** 新版本的 workflow 改进我能获取，同时我自己加的自定义内容不会被覆盖。

---

## Acceptance Criteria

### AC1 — 有差异时备份并展示变更摘要

**Given** `.bmad-init.json` 存在且 `templateVersion` 低于当前 bmad-expert 版本的模板版本
**When** 执行 `npx bmad-expert update`
**Then** 在完成 _bmad 框架文件更新后，对 init 清单中的每个文件：
1. 读取当前文件内容
2. 用新版模板 + 清单中的项目信息重新生成
3. 比较差异
4. 无差异 → 跳过并提示
5. 有差异 → 备份当前文件为 `{filename}.bak.{timestamp}`，展示变更摘要，等待用户确认后写入（FR58、FR59）
**And** 用户确认后，`.bmad-init.json` 中 `templateVersion` 更新为当前版本

### AC2 — 用户拒绝更新时保留原文件

**Given** 用户对某个文件选择"拒绝更新"
**When** 该文件被跳过
**Then** 文件保持不变，备份文件保留供用户参考（FR60）
**And** 其他文件的更新不受影响

### AC3 — 无 .bmad-init.json 时跳过

**Given** `.bmad-init.json` 不存在（从未执行过 init）
**When** 执行 `npx bmad-expert update`
**Then** 跳过配置文件更新阶段，只执行 _bmad 框架文件更新（现有行为不变）

### AC4 — --yes 自动模式

**Given** `--yes` 参数传入
**When** 执行 update 且 init 配置有差异
**Then** 自动备份 + 覆盖所有有差异的文件，不暂停确认

### AC5 — 测试覆盖

**Given** `test/updater.test.js` 扩展覆盖 init 配置更新场景
**When** 运行 `npm test`
**Then** 清单读取、diff 检测、备份、用户确认流程测试全部通过

---

## Tasks / Subtasks

- [ ] Task 1: 扩展 `lib/updater.js` — 新增 init 配置文件更新逻辑（AC1, AC2, AC3, AC4）
  - [ ] 1.1 新增 `updateInitConfigs(options)` 函数：读取 `.bmad-init.json`，无清单则 return 跳过
  - [ ] 1.2 实现模板版本比较：读取清单 `templateVersion` vs 包的当前 `version`（从 `package.json` 获取）
  - [ ] 1.3 对清单每个文件：读取当前内容 + 重新生成新版模板内容（复用 `initializer.js` 的 `generateFileContent` 逻辑）+ 比较差异
  - [ ] 1.4 有差异时：备份为 `{filename}.bak.{timestamp}`，展示变更摘要（输出 diff 概要）
  - [ ] 1.5 交互确认：stdin/stdout 原生交互（参考 initializer.js 的 `askQuestion`），`--yes` 模式跳过
  - [ ] 1.6 用户确认/--yes 后写入新内容；拒绝则跳过该文件
  - [ ] 1.7 全部处理完后更新 `.bmad-init.json` 的 `templateVersion`
  - [ ] 1.8 在现有 `update()` 函数末尾调用 `updateInitConfigs()`

- [ ] Task 2: 扩展 `cli.js` update 命令 — 新增 `--yes` 选项并传入 updater（AC4）
  - [ ] 2.1 update 命令 `.option('--yes', '...')`
  - [ ] 2.2 将 `yes` 选项传入 `update()` 函数

- [ ] Task 3: 从 `initializer.js` 提取可复用的模板生成逻辑（AC1）
  - [ ] 3.1 提取 `generateFileContent(templateType, projectInfo)` 供 updater 复用
  - [ ] 3.2 确保不破坏现有 init 功能

- [ ] Task 4: 扩展 `test/updater.test.js`（AC5）
  - [ ] 4.1 AC3 测试：无 .bmad-init.json 时跳过 init 配置更新
  - [ ] 4.2 AC1 测试：有差异时备份旧文件、写入新文件、更新 templateVersion
  - [ ] 4.3 AC1 测试：无差异时跳过写入
  - [ ] 4.4 AC2 测试：用户拒绝时保留原文件
  - [ ] 4.5 AC4 测试：--yes 模式自动覆盖

---

## Dev Notes

### 架构约束（强制遵守）

1. **文件操作只用 `fs-extra`**（`import fs from 'fs-extra'`），禁止原生 `fs`
2. **输出只通过 `output.js`**（`printProgress`/`printSuccess`），禁止 `console.log`
3. **错误只用 `BmadError`**（`throw new BmadError('E0xx', msg, cause)`），禁止 `throw new Error()`
4. **lib 模块禁止 `process.exit()`**，由 cli.js 顶层统一处理
5. **ESM 模块**，命名导出
6. **`__dirname` 模式**：`const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename)`

### 现有 updater.js 逻辑（只扩展不破坏）

当前 `update()` 函数流程：
1. 读取 `package.json` 获取 `frameworkFiles`/`userDataPaths`/`version`
2. 平台检测 → 获取 `installPath`
3. 备份 `userDataPaths` 至系统临时目录
4. 覆盖 `frameworkFiles`（含模板变量替换）
5. 成功 → 清理备份；异常 → 回滚

**扩展点**：在步骤 5（成功输出）之前，插入 init 配置文件更新阶段。注意：init 配置更新是**独立阶段**，与框架文件更新共用同一 `update()` 调用。

### .bmad-init.json 清单结构

```json
{
  "version": "1.0.0",
  "createdAt": "2026-04-08T10:00:00Z",
  "templateVersion": "1.0.0",
  "defaultProject": "my-project",
  "files": [
    { "path": "CLAUDE.md", "type": "workspace-claude" },
    { "path": "my-project/CLAUDE.md", "type": "project-claude" },
    { "path": "my-project/workflow/story-dev-workflow-single-repo.md", "type": "workflow" }
  ]
}
```

关键字段：
- `templateVersion`：与包版本对比判断是否需要更新
- `defaultProject`：用于重新生成模板内容时的项目名/路径
- `files[].type`：映射到 `templates/` 下对应的模板文件

### 模板类型到文件映射

| type | 模板文件 | 生成时替换逻辑 |
|------|---------|--------------|
| `workspace-claude` | `templates/workspace-claude.md` | `PROJECT_NAME` → projectName, `PROJECT_PATH` → projectPath |
| `project-claude` | `templates/project-claude.md` | `PROJECT_NAME` → projectName |
| `workflow` | `templates/workflow-single-repo.md` | 无替换，直接复制 |

这些替换逻辑已在 `initializer.js` 的 `generateFiles()` 中实现。需要提取为可复用函数。

### 备份文件命名

格式：`{filename}.bak.{timestamp}`
- 示例：`CLAUDE.md.bak.1712582400000`
- 备份文件放在原文件同目录
- 架构文档明确"不尝试自动合并"，只做备份+覆盖

### 变更摘要输出

通过 `printProgress` 输出每个文件的变更概要：
- 文件路径
- 变更类型（新增行数/删除行数或简单的"内容有变更"提示）
- 无需实现完整 diff 工具——简单比较即可，行级或字符串不相等

### --yes 与 --json 模式行为

- `--yes`：自动备份+覆盖，不暂停确认（AC4）
- `--json`：由 cli.js 处理，updater 返回结构化结果（扩展现有返回值即可）
- 架构文档："--yes 模式下备份 + 覆盖，不跳过"

### 交互确认实现

参考 `initializer.js` 的 `askQuestion()` 模式：
```javascript
import { createInterface } from 'readline'
function askQuestion(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()) })
  })
}
```

每个有差异的文件逐一确认（Y/n），默认 Y。

### 模板版本判断

- `templateVersion`（清单中记录）vs `pkg.version`（当前包版本）
- 版本不同 → 需要检查更新
- 版本相同 → 跳过 init 配置更新阶段，输出"配置文件已是最新版本"

### cli.js 修改

在 update 命令中新增 `--yes` 选项，并将其传入：

```javascript
program
  .command('update')
  .option('--yes', '自动确认所有 init 配置文件更新')
  // ... 现有选项不变
  .action(async (options) => {
    const result = await update({
      platform: options.platform ?? null,
      agentId: options.agentId,
      yes: options.yes ?? false,
    })
    // ...
  })
```

### 错误处理

- `.bmad-init.json` 读取失败（损坏的 JSON）→ `BmadError('E001', ...)`，不阻塞框架文件更新
- 模板文件读取失败 → `BmadError('E001', ...)`
- 备份文件写入失败 → `BmadError('E004', ...)`，带权限修复建议
- 新文件写入失败 → `BmadError('E004', ...)`

### 测试策略

**框架**：Vitest + vi.mock

扩展现有 `test/updater.test.js`，新增 `describe('init 配置文件更新')` 块：

```javascript
describe('init 配置文件更新', () => {
  // AC3: 无 .bmad-init.json → 跳过
  it('无 .bmad-init.json 时跳过 init 配置更新')

  // AC1: 有差异 → 备份 + 写入
  it('检测到配置差异时备份旧文件并写入新内容')

  // AC1: 无差异 → 跳过
  it('配置无差异时跳过写入')

  // AC1: 更新 templateVersion
  it('更新完成后 .bmad-init.json 中 templateVersion 更新')

  // AC2: 用户拒绝 → 保留原文件
  it('用户拒绝更新时文件保持不变')

  // AC4: --yes → 自动覆盖
  it('--yes 模式自动备份覆盖不暂停确认')
})
```

Mock 要点：
- `fs.readFile` 需要处理多种路径（package.json、.bmad-init.json、当前文件、模板文件）
- `fs.pathExists` 控制 .bmad-init.json 是否存在
- `fs.outputFile` 验证备份和新文件写入
- `readline.createInterface` 需要 mock 以模拟用户输入

### Previous Story Intelligence

来自 Story 10-2 的经验：
- `initializer.js` 的 `generateFiles()` 直接从模板文件读取并做字符串替换
- `writeManifest()` 写入 `.bmad-init.json`，包含 `defaultProject` 字段（可用于重新生成）
- 交互使用 `readline.createInterface` + `rl.question` 模式
- 模板路径：`join(__dirname, '..', 'templates', '*.md')`

---

### Project Structure Notes

**修改文件：**
```
lib/updater.js              # 扩展 update() + 新增 updateInitConfigs()
lib/initializer.js          # 提取可复用的模板内容生成函数
cli.js                      # update 命令新增 --yes 选项
test/updater.test.js        # 扩展 init 配置更新测试
```

**只读依赖：**
```
templates/workspace-claude.md
templates/project-claude.md
templates/workflow-single-repo.md
lib/output.js
lib/errors.js
package.json
```

---

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#配置文件更新架构] — updater.js 扩展设计、更新流程、冲突处理策略
- [Source: _bmad-output/planning-artifacts/architecture.md#init 命令架构] — .bmad-init.json 清单格式
- [Source: _bmad-output/planning-artifacts/architecture.md#模板体系架构] — 模板内容生成策略
- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.1] — AC 原文、FR58-FR60 映射
- [Source: _bmad-output/implementation-artifacts/10-2-init-command-core.md] — init 命令实现细节和模式
- [Source: lib/updater.js] — 现有 update 逻辑，扩展基础
- [Source: lib/initializer.js] — generateFiles() 模板替换逻辑，需提取复用
- [Source: test/updater.test.js] — 现有测试模式，vi.mock 约定

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 基于 architecture.md 配置文件更新架构完整提取扩展设计
- 参考现有 updater.js 和 initializer.js 代码模式确保一致性
- 明确复用 initializer.js 模板生成逻辑，避免重复实现
- 测试策略对齐现有 vitest + vi.mock 模式
- --yes 行为与架构文档一致：备份+覆盖，不跳过

### File List

- `lib/updater.js` (修改 — 扩展 init 配置更新)
- `lib/initializer.js` (修改 — 提取可复用模板生成函数)
- `cli.js` (修改 — update 命令新增 --yes)
- `test/updater.test.js` (修改 — 扩展测试)
