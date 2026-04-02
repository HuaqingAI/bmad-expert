# Story 4.3：安装时写入持久配置的集成验证

Status: review

## Story

As a 开发者（AI agent）,
I want 一个集成测试验证安装后 agent 目录中所有文件内容符合设计规范，
so that 确保模板变量已完整替换、AGENTS.md 包含会话检测逻辑、BOOTSTRAP.md 包含自毁指令，防止文件内容错误导致 agent 首次运行失败。

## Acceptance Criteria

1. **Given** 在 mock HappyCapy 环境中执行完整安装流程
   **When** 检查写入目标目录的文件内容
   **Then** 写入文件数量为 5（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md、bmad-project-init.md）
   **And** 每个文件中不存在任何未替换的 `{{...}}` 占位符

2. **Given** 安装完成后检查 AGENTS.md 内容
   **When** 断言文件结构
   **Then** AGENTS.md 包含 `Session Startup` 区块
   **And** AGENTS.md 包含检测 `BOOTSTRAP.md` 存在性的逻辑（Step 2）

3. **Given** 安装完成后检查 BOOTSTRAP.md 内容
   **When** 断言文件结构
   **Then** BOOTSTRAP.md 包含自毁指令区块（`rm -f` 或 COMPLETED 降级标记）
   **And** BOOTSTRAP.md 包含跳转 `bmad-help` 的指令

4. **Given** `test/integration/happycapy.test.js` 扩展覆盖文件内容验证
   **When** 运行 `npm test`
   **Then** 所有文件内容验证测试通过

## Tasks / Subtasks

- [x] 扩展 `test/integration/happycapy.test.js`，新增文件内容验证测试套件（AC: #1 #2 #3 #4）
  - [x] 在文件顶部导入 `readFileSync` from `'node:fs'` 和 `join`/`dirname`/`fileURLToPath` 用于读取实际模板内容
  - [x] 添加辅助工具：在 `beforeEach` 中使 `readFile` mock 按文件名返回真实模板内容、使 `outputFile` mock 捕获写入内容
  - [x] 新增 `it('文件数量：写入 5 个框架文件')` — 断言 5 个文件名均出现在捕获的写入记录中（AC: #1）
  - [x] 新增 `it('占位符替换：所有写入文件无残留 {{...}}')` — 遍历每个捕获文件，断言不含 `{{...}}` 格式（AC: #1）
  - [x] 新增 `it('AGENTS.md 内容：含 Session Startup 与 BOOTSTRAP.md 检测逻辑')` — 断言关键字段（AC: #2）
  - [x] 新增 `it('BOOTSTRAP.md 内容：含自毁指令与 bmad-help 跳转')` — 断言关键字段（AC: #3）
- [x] 运行 `npm test` 确认全部测试绿灯（AC: #4）

## Dev Notes

### 关键约束：扩展而非新建

**本故事只修改一个文件：`test/integration/happycapy.test.js`**。不创建新测试文件。

### 文件数量：5 个（不是 4 个）

`lib/installer.js:27` 的 `FRAMEWORK_FILES` 为：

```javascript
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md', 'bmad-project-init.md']
```

现有集成测试已断言 `expect(fsExtra.outputFile).toHaveBeenCalledTimes(5)` — 本故事的测试与此数量保持一致。epics.md 中描述的"4 个文件"为旧规格，Story 4.2 实现时加入了 `bmad-project-init.md`。

### 测试实现模式：读取真实模板内容

现有 `readFile` mock 固定返回 `'Hello {{agent_id}} on {{install_date}}'`。内容验证测试需要 mock 返回 **真实模板文件内容**，以便测试实际写入内容是否符合规范。

**推荐实现方式**：在新的 `describe` 块中，用 `beforeEach` 覆盖 `readFile` mock：

```javascript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// agent/ 目录相对 test/integration/ 向上两级
const AGENT_DIR = join(__dirname, '../../agent')
```

在 `beforeEach` 中覆盖 `readFile`：

```javascript
fsExtra.readFile.mockImplementation(async (filePath) => {
  return readFileSync(join(AGENT_DIR, basename(filePath)), 'utf8')
})
```

在 `beforeEach` 中覆盖 `outputFile` 并捕获内容：

```javascript
const writtenFiles = {}
fsExtra.outputFile.mockImplementation(async (filePath, content) => {
  writtenFiles[basename(filePath)] = content
})
```

**关键**：以上 mock 覆盖必须在每个 `it` 执行前生效。

### 占位符验证正则

使用 `/\{\{.*?\}\}/` 匹配未替换的占位符，符合 `replaceTemplateVars` 的 `{{variable_name}}` 格式约定（`lib/installer.js:194-201`）。

### AGENTS.md 关键断言字段

参考实际模板 `agent/AGENTS.md` 内容（Story 4.1 产物）：
- 包含 `'Session Startup'`
- 包含 `'BOOTSTRAP.md'`（Step 2 检测逻辑）

### BOOTSTRAP.md 关键断言字段

参考实际模板 `agent/BOOTSTRAP.md` 内容（Story 4.2 产物）：
- 包含 `'rm -f'`（自毁指令主路径）
- 包含 `'bmad-help'`（跳转工作流）

### 模板变量替换后 `{{agent_id}}` 不能残留

安装时 `agentId = 'bmad-expert'`，所有 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`、`{{model}}` 均须被替换。

注意 `BOOTSTRAP.md` 第 62 行有：
```
rm -f ~/.happycapy/agents/{{agent_id}}/BOOTSTRAP.md
```
这是一个 **Bash 命令模板**，安装时会被替换为 `rm -f ~/.happycapy/agents/bmad-expert/BOOTSTRAP.md`。验证无残留占位符时，替换后不应有 `{{agent_id}}` 出现。

### vitest mock 隔离原则

新增的 `describe` 块内的 `beforeEach`/`afterEach` 仅作用于该 `describe` 范围，不影响外层 `describe('HappyCapy 完整安装流程（集成测试）')` 的其他测试。利用 vitest 的 `vi.clearAllMocks()` + 新 mock 实现，确保隔离。

### 不需要修改的文件（禁止改动）

- `lib/installer.js` — FRAMEWORK_FILES 已包含 5 个文件，不需改动
- `agent/AGENTS.md` — Story 4.1 已设计完成
- `agent/BOOTSTRAP.md` — Story 4.2 已设计完成
- 任何 `.js` 库文件

### 修改的文件

```
test/
└── integration/
    └── happycapy.test.js    ✏️  新增文件内容验证 describe 块
```

### Project Structure Notes

- 测试文件路径：`test/integration/happycapy.test.js`（按架构规范：`test/integration/` 放端到端/集成测试）
- Agent 模板路径：`agent/`（与 `test/integration/` 的相对路径：`../../agent/`）
- `AGENT_TEMPLATE_DIR` 在 `lib/installer.js:24` 同样定义为 `resolve(__dirname, '../agent')`，测试中需独立计算

### References

- Story 4.3 规格：`_bmad-output/planning-artifacts/epics.md` Epic 4 Story 4.3
- 现有集成测试（需扩展）：`test/integration/happycapy.test.js`
- installer.js FRAMEWORK_FILES：`lib/installer.js:27`
- AGENTS.md 模板（Session Startup 结构）：`agent/AGENTS.md`
- BOOTSTRAP.md 模板（自毁 + bmad-help）：`agent/BOOTSTRAP.md`
- 架构规范（测试结构/命名）：`_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 扩展 `test/integration/happycapy.test.js`，在外层 describe 末尾新增嵌套 describe `安装文件内容验证`
- 在文件顶部添加 `readFileSync`、`fileURLToPath`、`dirname`/`join`/`basename` 导入，及模块级 `AGENT_DIR` 常量
- 新增 describe 块含独立 `beforeEach`：覆盖 `readFile` mock 读取真实模板文件，覆盖 `outputFile` mock 捕获写入内容到 `writtenFiles` 对象
- 新增 4 个 `it` 测试，全部通过：
  - 文件数量：写入 5 个框架文件（SOUL.md/IDENTITY.md/AGENTS.md/BOOTSTRAP.md/bmad-project-init.md）
  - 占位符替换：所有写入文件无残留 `{{...}}`（覆盖 SOUL.md/IDENTITY.md/AGENTS.md/BOOTSTRAP.md 中的变量替换）
  - AGENTS.md 内容：含 `Session Startup` 与 `BOOTSTRAP.md` 检测逻辑
  - BOOTSTRAP.md 内容：含 `rm -f` 自毁指令与 `bmad-help` 跳转
- 全套 141 个测试通过，零回归（7 个测试文件）

### File List

- `test/integration/happycapy.test.js`
- `_bmad-output/implementation-artifacts/4-3-install-integration-validation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
