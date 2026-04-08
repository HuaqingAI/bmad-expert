# Story 10.2: workspace 结构检测与 init 命令核心逻辑（initializer.js）

Status: ready-for-dev

---

## Story

**As a** 用户（通过 AI 代劳）,
**I want** 执行 `npx bmad-expert init` 时系统自动检测 workspace 目录结构、识别项目子目录、交互式收集必要信息，并生成所有配置文件，
**So that** 从"装好 BMAD"到"完整工作环境"只需一条命令，不需要手动创建和编辑配置文件。

---

## Acceptance Criteria

### AC1 — 单项目 workspace 检测

**Given** workspace 目录下有一个含 `.git/` 的子目录（如 `my-project/`）
**When** 执行 `npx bmad-expert init`
**Then** `detectWorkspaceStructure()` 识别出项目目录为 `my-project/`
**And** 交互式提示确认项目名（默认值：`my-project`）和工作流偏好（默认：全部生成）
**And** 在 workspace 根目录生成 `CLAUDE.md`（基于 workspace-claude.md 模板，填入实际项目名和路径）
**And** 在 `my-project/` 目录生成 `CLAUDE.md`（基于 project-claude.md 模板）
**And** 在 `my-project/workflow/` 目录生成 `story-dev-workflow-single-repo.md`（基于 workflow 模板）
**And** 在 workspace 根目录生成 `.bmad-init.json` 清单文件，记录所有生成文件路径和模板版本

### AC2 — 多项目 workspace 检测

**Given** workspace 目录下有多个含 `.git/` 的子目录
**When** 执行 `npx bmad-expert init`
**Then** 交互式列出所有项目目录，让用户选择默认项目

### AC3 — 无项目目录错误处理

**Given** workspace 目录下无项目子目录（无 `.git/` 也无 `_bmad/`）
**When** 执行 `npx bmad-expert init`
**Then** 输出结构化错误提示："未检测到项目目录，请先在 workspace 中创建项目或指定项目路径"

### AC4 — --yes 非交互模式

**Given** `--yes` 参数传入
**When** 执行 init
**Then** 使用所有默认值，不进行交互式提示

### AC5 — CLI 帮助信息

**Given** `cli.js` 已注册 `init` 子命令
**When** 执行 `npx bmad-expert init --help`
**Then** 输出 init 命令帮助信息，与 install/update/status 命令格式一致

### AC6 — 测试覆盖

**Given** `test/initializer.test.js` 覆盖以上场景
**When** 运行 `npm test`
**Then** 所有 workspace 检测、文件生成、清单写入测试通过

---

## Tasks / Subtasks

- [ ] Task 1: 创建 `lib/initializer.js` 模块（AC1, AC2, AC3, AC4）
  - [ ] 1.1 实现 `detectWorkspaceStructure(cwd)` — 扫描一级子目录，识别含 `.git/` 或 `_bmad/` 或 `package.json` 的项目目录
  - [ ] 1.2 实现 `collectProjectInfo(workspaceInfo, options)` — 交互式或 --yes 模式收集项目名、路径、工作流偏好
  - [ ] 1.3 实现 `generateFiles(workspaceInfo, projectInfo)` — 读取 templates/，拼接项目信息，写入目标路径
  - [ ] 1.4 实现 `writeManifest(cwd, files)` — 写入 `.bmad-init.json` 清单
  - [ ] 1.5 实现 `init(options)` 主函数 — 串联上述步骤

- [ ] Task 2: 注册 `init` 子命令到 `cli.js`（AC5）
  - [ ] 2.1 添加 `program.command('init')` 及 `--yes`、`--json` 选项
  - [ ] 2.2 action handler 调用 `initializer.init()`
  - [ ] 2.3 JSON 模式输出 `printJSON(result)`

- [ ] Task 3: 编写 `test/initializer.test.js`（AC6）
  - [ ] 3.1 单项目检测场景
  - [ ] 3.2 多项目检测场景
  - [ ] 3.3 无项目目录错误场景
  - [ ] 3.4 --yes 模式场景
  - [ ] 3.5 文件生成验证（内容包含正确的项目名/路径）
  - [ ] 3.6 .bmad-init.json 清单内容验证

---

## Dev Notes

### 架构约束（强制遵守）

以下规则来自 architecture.md，**所有 lib 模块必须遵守**：

1. **文件操作只用 `fs-extra`**（`import fs from 'fs-extra'`），禁止原生 `fs`
2. **输出只通过 `output.js`**（`printProgress`/`printSuccess`/`printError`），禁止 `console.log`
3. **错误只用 `BmadError`**（`throw new BmadError('E0xx', msg, cause)`），禁止 `throw new Error()`
4. **lib 模块禁止 `process.exit()`**，由 cli.js 顶层统一处理
5. **ESM 模块**，命名导出，无 `export default`
6. **`__dirname` 模式**：`const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename)`

### initializer.js 设计（来源：architecture.md init 命令架构）

```javascript
// lib/initializer.js 职责：
{
  detectWorkspaceStructure(cwd): WorkspaceInfo,   // 检测 workspace 目录结构
  collectProjectInfo(workspaceInfo, options): ProjectInfo,  // 收集项目信息
  generateFiles(workspaceInfo, projectInfo): GeneratedFile[],  // 生成配置文件
  writeManifest(cwd, files): void,  // 写入 .bmad-init.json
  init(options): InitResult,  // 主入口函数
}
```

### Workspace 结构检测逻辑

1. 扫描 `cwd` 下一级子目录
2. 识别项目目录：包含 `.git/`、`_bmad/` 或 `package.json` 的子目录
3. 单项目 → 自动选中；多项目 → 交互选择默认项目
4. 无项目 → 抛 `BmadError('E002', '未检测到项目目录...')`

### 交互式信息收集

使用 **stdin/stdout** 原生交互（项目无 inquirer 等依赖，保持轻量）：

| 收集项 | 用途 | 默认值 |
|--------|------|--------|
| 项目名 | 写入 CLAUDE.md 默认项目声明 | 检测到的目录名 |
| 项目路径 | CLAUDE.md 引用路径 | 检测到的相对路径 |
| 工作流偏好 | 生成哪些 workflow 文件 | 全部生成 |

`--yes` 模式直接用默认值，跳过交互。

### 模板内容生成策略

- 模板位于 npm 包 `templates/` 目录（与 `lib/` 同级）
- 模板是**纯内容起点**，用 `PROJECT_NAME`、`PROJECT_PATH` 等占位文字
- init 通过 `String.replace()` 将占位文字替换为实际值
- **不使用模板引擎库**，原生字符串处理即可
- 读取模板路径：`path.join(__dirname, '..', 'templates', 'xxx.md')`

### .bmad-init.json 清单格式

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

Story 10.3（幂等保护）将扩展此清单的冲突检测逻辑。本 Story **不实现**已有文件冲突处理（AC 中无此要求），直接覆盖写入即可。

### cli.js 注册 init 命令

参考现有 install/update/status 命令注册模式：

```javascript
program
  .command('init')
  .description('Initialize work environment with CLAUDE.md and workflow files')
  .option('--yes', 'Non-interactive mode, use defaults')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await init({ yes: options.yes })
    if (options.json) printJSON(result)
  })
```

### 错误码扩展

现有错误码 E001-E006，init 使用：
- `E002`（Invalid args）— 无项目目录检测到时

### 输出模式

- 正常模式：`printProgress` 报告每步进度 + `printSuccess` 报告完成
- JSON 模式：`printJSON(result)` 输出结构化结果
- 错误：`BmadError` 抛到 cli.js 顶层统一输出

### 测试策略

**框架**：Vitest（`import { describe, it, expect, vi, beforeEach } from 'vitest'`）

**Mock 模式**（参考现有测试文件）：

```javascript
// mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    outputFile: vi.fn(),
    ensureDir: vi.fn(),
  }
}))

// mock output.js
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  setJsonMode: vi.fn(),
  getJsonMode: vi.fn(),
  printJSON: vi.fn(),
}))
```

**测试场景**：
1. `detectWorkspaceStructure` — 单项目、多项目、无项目目录
2. `generateFiles` — 验证生成文件内容包含正确的项目名/路径替换
3. `writeManifest` — 验证 .bmad-init.json 内容和结构
4. `init` 主函数 — 端到端流程，--yes 模式

### 与其他 Story 的关系

- **依赖 10-1**（已 done）：模板文件已在 `templates/` 目录
- **被 10-3 依赖**：幂等保护与已有文件冲突处理（FR56）在 10-3 实现
- **被 11-1 依赖**：update 命令扩展读取 `.bmad-init.json` 实现配置文件跟随更新

### 本 Story 不实现的内容（明确边界）

- ❌ 已有文件冲突处理（FR56 → Story 10-3）
- ❌ --json 模式下的结构化输出细节调整（如需可后续优化）
- ❌ uninstall 命令（Story 11-2）
- ❌ update 命令对 init 文件的跟随更新（Story 11-1）

---

### Project Structure Notes

**新建文件：**
```
lib/initializer.js          # init 命令核心逻辑
test/initializer.test.js    # 单元测试
```

**修改文件：**
```
cli.js                      # 注册 init 子命令
```

**依赖文件（只读）：**
```
templates/workspace-claude.md
templates/project-claude.md
templates/workflow-single-repo.md
lib/output.js
lib/errors.js
lib/exit-codes.js
```

---

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#init 命令架构] — init 数据流、模块职责、清单格式
- [Source: _bmad-output/planning-artifacts/architecture.md#模板体系架构] — 模板设计原则、内容生成策略
- [Source: _bmad-output/planning-artifacts/architecture.md#CLI 接口与通信模式] — init 命令选项定义
- [Source: _bmad-output/planning-artifacts/architecture.md#实现模式与一致性规则] — 架构约束、错误处理模式
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2] — AC 原文
- [Source: _bmad-output/planning-artifacts/prd.md#FR51-FR57] — 工作环境初始化功能需求
- [Source: _bmad-output/implementation-artifacts/10-1-template-design.md] — 前置 Story 完成内容、模板职责边界

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 基于 architecture.md init 命令架构完整提取 initializer.js 模块设计
- 参考现有 lib/ 模块（installer.js, updater.js, checker.js）的代码模式确保一致性
- 测试策略完全对齐现有 vitest + vi.mock 模式
- 明确划定与 Story 10-3（幂等保护）的边界：本 Story 不处理已有文件冲突

### File List

- `lib/initializer.js` (新建)
- `test/initializer.test.js` (新建)
- `cli.js` (修改 — 注册 init 子命令)
