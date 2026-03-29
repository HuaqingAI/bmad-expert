# Story 2.2: agent 模板文件集与变量替换引擎

Status: review

## Story

As a 开发者（AI agent）,
I want `agent/` 目录下的四个模板文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）包含正确的 `{{variable}}` 占位符，以及 `lib/installer.js` 中的模板变量替换函数与文件写入函数，
so that 安装时 `{{agent_id}}`、`{{agent_name}}`、`{{model}}`、`{{install_date}}` 被正确替换为实际值后写入目标路径，且写入路径通过白名单安全验证。

## Acceptance Criteria

1. **Given** `agent/` 目录下四个模板文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）存在，内容包含 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}` 变量
   **When** 调用 `replaceTemplateVars(content, { agentId: 'bmad-expert', agentName: 'BMAD Expert', installDate: '2026-03-24' })`
   **Then** 返回字符串中 `{{agent_id}}` → `bmad-expert`、`{{agent_name}}` → `BMAD Expert`、`{{install_date}}` → `2026-03-24`
   **And** 不存在任何未替换的 `{{...}}` 占位符残留（`{{model}}` 等已知变量也全部替换，未知占位符可保留）

2. **Given** 模板替换后的文件内容
   **When** 调用 `writeAgentFiles(targetDir, vars)` 写入目标路径（通过 fs-extra，非原生 fs）
   **Then** 四个文件写入成功，内容与 `replaceTemplateVars` 替换结果完全一致
   **And** 写入路径通过安全验证，调用包含 `..` 的路径时抛出 `BmadError('E004', ...)`

3. **Given** `test/installer.test.js` 已实现，覆盖变量替换逻辑
   **When** 运行 `npm test`
   **Then** 所有变量替换测试通过，包括空值处理、特殊字符场景、路径安全验证

## Tasks / Subtasks

- [x] 实现 `replaceTemplateVars(content, vars)` 具名导出函数 (AC: #1)
  - [x] 在 `lib/installer.js` 中实现，替换占位内容（勿删架构注释）
  - [x] 支持 4 个变量：`{{agent_id}}` → `agentId`、`{{agent_name}}` → `agentName`、`{{model}}` → `model`、`{{install_date}}` → `installDate`
  - [x] 对变量值为空字符串时替换为空字符串（不报错，不保留占位符）
  - [x] 使用全局正则（`/\{\{agent_id\}\}/g`），不使用 `String.prototype.replaceAll`（ESM 兼容性更好）
  - [x] 具名导出：`export function replaceTemplateVars(content, vars) {}`

- [x] 实现 `writeAgentFiles(targetDir, vars)` 具名导出函数 (AC: #2)
  - [x] 路径安全检查：`targetDir` 包含 `..` 时抛出 `BmadError('E004', '路径不安全：包含路径遍历 (..)', null)`
  - [x] 使用 ESM `__dirname` 等价方案计算 `agent/` 模板目录路径（见 Dev Notes）
  - [x] 使用 `fs-extra` 的 `ensureDir(targetDir)` 确保目录存在
  - [x] 遍历 `FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']`
  - [x] 每个文件：`readFile(templatePath, 'utf8')` → `replaceTemplateVars(content, vars)` → `outputFile(destPath, replaced, 'utf8')`
  - [x] 导入 `BmadError` from `'./errors.js'`（相对路径）
  - [x] 使用 `import fsExtra from 'fs-extra'` 再解构（ESM 兼容写法，见 Dev Notes）

- [x] 确认 `agent/` 模板文件包含必要的 `{{variable}}` 占位符 (AC: #1 前提)
  - [x] 检查 SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 是否含 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`
  - [x] 若当前占位文件缺失这些变量，补充到适当位置（AGENTS.md 和 BOOTSTRAP.md 正文中补充了 `{{agent_name}}`）
  - [x] **不需要补充最终模板内容**（Story 4.1 负责 AGENTS.md 会话检测逻辑，Story 4.2 负责 BOOTSTRAP.md 自毁机制）

- [x] 创建 `test/installer.test.js` (AC: #3)
  - [x] 导入：`import { replaceTemplateVars, writeAgentFiles } from '../lib/installer.js'`
  - [x] 测试 `replaceTemplateVars` 正常替换（4 个变量全替换，无残留 `{{...}}`）
  - [x] 测试空值处理（`agentId: ''` → 空字符串替换，不报错）
  - [x] 测试特殊字符（`agentName` 含 `$`、`$&` 等，不产生 regex 副作用）
  - [x] 测试 `writeAgentFiles` 路径含 `..` 时抛出 `BmadError`（不依赖 fs-extra mock 即可测试此分支）
  - [x] 测试 `writeAgentFiles` 正常写入时调用 fs-extra 的 `ensureDir` 和 `outputFile`（使用 `vi.mock('fs-extra', ...)`）
  - [x] `vi.mock()` 放在文件顶部，mock 模式参见 Dev Notes

- [x] 验证所有测试通过 (AC: #3)
  - [x] 执行 `npm test`，确认 `test/installer.test.js` 全部通过（12 个新测试）
  - [x] 确认已有测试（errors.test.js、exit-codes.test.js、output.test.js）无回归（33 个已有测试全通过）

## Dev Notes

### 关键实现：ESM 模块中的 `__dirname` 等价方案

`lib/installer.js` 是 ESM 模块（`"type": "module"`），不能直接使用 `__dirname`。必须使用以下方式计算模板目录路径：

```javascript
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// agent/ 模板目录（相对于 lib/installer.js）
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']
```

### 关键实现：fs-extra ESM 导入方式

fs-extra v11 的 ESM 导入推荐使用默认导入再解构（避免部分 tree-shaking 问题）：

```javascript
import fsExtra from 'fs-extra'
const { ensureDir, readFile, outputFile } = fsExtra
```

### `replaceTemplateVars` 完整实现

```javascript
/**
 * 替换模板文件中的 {{variable}} 占位符
 * @param {string} content - 模板文件原始内容
 * @param {Object} vars - 变量对象
 * @param {string} [vars.agentId=''] - agent 标识符，替换 {{agent_id}}
 * @param {string} [vars.agentName=''] - agent 名称，替换 {{agent_name}}
 * @param {string} [vars.model=''] - 模型标识，替换 {{model}}
 * @param {string} [vars.installDate=''] - 安装日期，替换 {{install_date}}
 * @returns {string} 替换后的内容
 */
export function replaceTemplateVars(content, vars) {
  const { agentId = '', agentName = '', model = '', installDate = '' } = vars

  return content
    .replace(/\{\{agent_id\}\}/g, agentId)
    .replace(/\{\{agent_name\}\}/g, agentName)
    .replace(/\{\{model\}\}/g, model)
    .replace(/\{\{install_date\}\}/g, installDate)
}
```

> **注意**：`agentName` 等变量值不需要做 regex escape，因为这里是替换目标（replacement），不是 pattern。`String.prototype.replace` 的第二个参数中 `$` 有特殊含义（如 `$&`、`$'`），若变量值含 `$` 字符，需要 escape：
> ```javascript
> // 安全写法：使用函数作为 replacement 而非字符串
> .replace(/\{\{agent_name\}\}/g, () => agentName)
> ```
> 建议所有替换都改用函数形式，防止特殊字符副作用。

**推荐的安全写法（防 $ 字符副作用）：**

```javascript
export function replaceTemplateVars(content, vars) {
  const { agentId = '', agentName = '', model = '', installDate = '' } = vars

  return content
    .replace(/\{\{agent_id\}\}/g, () => agentId)
    .replace(/\{\{agent_name\}\}/g, () => agentName)
    .replace(/\{\{model\}\}/g, () => model)
    .replace(/\{\{install_date\}\}/g, () => installDate)
}
```

### `writeAgentFiles` 完整实现

```javascript
import fsExtra from 'fs-extra'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { BmadError } from './errors.js'

const { ensureDir, readFile, outputFile } = fsExtra
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']

/**
 * 读取 agent/ 模板文件，替换变量，写入目标目录
 * @param {string} targetDir - 目标安装目录（绝对路径）
 * @param {Object} vars - 模板变量（agentId, agentName, model, installDate）
 * @throws {BmadError} E004 - 路径包含 .. 时
 */
export async function writeAgentFiles(targetDir, vars) {
  // 路径安全验证：拒绝 .. 路径遍历
  if (targetDir.includes('..')) {
    throw new BmadError(
      'E004',
      `路径不安全：包含路径遍历 (..) (${targetDir})`,
      null
    )
  }

  await ensureDir(targetDir)

  for (const filename of FRAMEWORK_FILES) {
    const templatePath = join(AGENT_TEMPLATE_DIR, filename)
    const content = await readFile(templatePath, 'utf8')
    const replaced = replaceTemplateVars(content, vars)
    await outputFile(join(targetDir, filename), replaced, 'utf8')
  }
}
```

### 与其他模块的关系（避免重复实现）

- `lib/installer.js` 当前是占位（`export async function install(options) {}`），**本故事只扩充**，不替换整个文件
- 本故事仅实现 `replaceTemplateVars` 和 `writeAgentFiles` 两个导出函数，`install()` 函数留给 Story 2.4 实现
- Story 2.1 实现 `lib/platform.js` 和 `lib/adapters/happycapy.js`，本故事不需要依赖它们
- Story 2.3 实现幂等检测（`adapter.check()`），本故事不需要依赖
- `BmadError` 已由 Story 1.2 实现（`lib/errors.js`），直接导入使用

### `lib/installer.js` 修改策略

当前 installer.js 内容：
```javascript
// lib/installer.js
// PLACEHOLDER — Story 2.x 将实现安装编排、幂等检测、模板变量替换
// ...
export async function install(options) {}
```

本故事在文件中**追加**以下内容（保留原有注释和 `install()` 占位函数）：
1. 在文件顶部添加 ESM 路径工具导入和 fs-extra 导入
2. 在文件末尾添加 `replaceTemplateVars()` 和 `writeAgentFiles()` 两个具名导出函数

### `test/installer.test.js` 实现模式

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { replaceTemplateVars, writeAgentFiles } from '../lib/installer.js'
import { BmadError } from '../lib/errors.js'

// mock fs-extra（必须在 import 前或 vi.mock hoisted）
vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('replaceTemplateVars', () => {
  it('替换所有已知变量', () => {
    const content = 'Agent: {{agent_name}} ({{agent_id}}) installed {{install_date}}'
    const result = replaceTemplateVars(content, {
      agentId: 'bmad-expert',
      agentName: 'BMAD Expert',
      model: 'claude-sonnet',
      installDate: '2026-03-24',
    })
    expect(result).toBe('Agent: BMAD Expert (bmad-expert) installed 2026-03-24')
    expect(result).not.toMatch(/\{\{.*?\}\}/)  // 无残留占位符
  })

  it('空值替换为空字符串（不报错）', () => {
    const result = replaceTemplateVars('{{agent_id}}', { agentId: '' })
    expect(result).toBe('')
  })

  it('变量值含 $ 特殊字符时不产生副作用', () => {
    const result = replaceTemplateVars('{{agent_name}}', { agentName: 'Agent$2' })
    expect(result).toBe('Agent$2')
  })

  it('多次出现的变量全部替换', () => {
    const content = '{{agent_id}} and {{agent_id}} again'
    const result = replaceTemplateVars(content, { agentId: 'my-agent' })
    expect(result).toBe('my-agent and my-agent again')
  })
})

describe('writeAgentFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('路径含 .. 时抛出 BmadError E004', async () => {
    await expect(
      writeAgentFiles('/home/user/../etc/passwd', { agentId: 'test' })
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })

  it('正常路径时调用 ensureDir 和 outputFile', async () => {
    const fsExtra = (await import('fs-extra')).default
    await writeAgentFiles('/home/user/.happycapy/agents/test', {
      agentId: 'test',
      agentName: 'Test',
      model: '',
      installDate: '2026-03-24',
    })
    expect(fsExtra.ensureDir).toHaveBeenCalledWith('/home/user/.happycapy/agents/test')
    expect(fsExtra.outputFile).toHaveBeenCalledTimes(4)  // 4 个框架文件
  })
})
```

> **vitest mock 注意事项：**
> - `vi.mock()` 会被 vitest 自动提升（hoisted）到文件顶部，所以可以在 `import` 语句之后写，但建议放在文件顶部
> - mock 的 `default` 属性对应 `import fsExtra from 'fs-extra'` 中的 `fsExtra`
> - `beforeEach(() => vi.clearAllMocks())` 确保每个测试独立

### 架构守则（严禁违反）

1. **禁止原生 fs**：所有文件操作通过 `fs-extra`（`ensureDir`、`readFile`、`outputFile`），不可 `import fs from 'fs'`
2. **禁止直接 throw new Error()**：路径安全错误使用 `throw new BmadError('E004', ..., null)`
3. **禁止 default export**：`replaceTemplateVars` 和 `writeAgentFiles` 均为具名导出
4. **禁止 .then()/.catch()**：全部使用 `async/await`
5. **禁止直接 console.log**：本故事的两个函数不涉及输出，若需输出调用 `output.js`（本故事暂不需要）
6. **禁止 child_process**：本故事不涉及外部进程调用

### `agent/` 模板文件现状与本故事职责边界

当前 `agent/` 目录中四个文件的内容已包含 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}` 占位符（Story 1.1 建立的占位文件）。

**本故事职责：** 确认变量存在，实现替换机制和写入链路。

**后续故事职责：**
- Story 4.1：更新 `agent/AGENTS.md` 为包含会话启动检测逻辑的完整模板（FR23、FR24）
- Story 4.2：更新 `agent/BOOTSTRAP.md` 为包含自毁机制的一次性 onboarding 模板（FR27）

**Story 2.2 不需要修改 agent/ 文件内容**，除非文件中完全缺少所需的 `{{variable}}` 占位符。

### 依赖的已有实现（可直接使用）

| 模块 | 实现状态 | 本故事使用方式 |
|------|---------|-------------|
| `lib/errors.js` → `BmadError` | Story 1.2（review）| `import { BmadError } from './errors.js'` |
| `lib/exit-codes.js` → `EXIT_CODES` | Story 1.2（review）| 本故事不需要直接使用 |
| `lib/output.js` → `printProgress/Error/Success` | Story 1.3（review）| 本故事两个函数不输出，不需要 |
| `agent/SOUL.md` 等 4 个文件 | Story 1.1（done）| 作为模板源文件读取 |

### 项目结构变化（本故事新增/修改的文件）

```
bmad-expert/
├── lib/
│   └── installer.js           ✏️  追加 replaceTemplateVars + writeAgentFiles（保留 install() 占位）
└── test/
    └── installer.test.js      🆕  新建，覆盖变量替换与文件写入测试
```

**其余文件不需要修改。**

### References

- Story 2.2 验收标准: [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2]
- 架构文档 数据架构（模板变量映射表）: [Source: _bmad-output/planning-artifacts/architecture.md#数据架构]
- 架构文档 文件分层契约（frameworkFiles 列表）: [Source: _bmad-output/planning-artifacts/architecture.md#文件分层契约]
- 架构文档 安全架构（路径白名单）: [Source: _bmad-output/planning-artifacts/architecture.md#安全架构]
- 架构文档 执行规范（6 条强制规则）: [Source: _bmad-output/planning-artifacts/architecture.md#执行规范]
- 架构文档 完整目录结构: [Source: _bmad-output/planning-artifacts/architecture.md#完整项目目录结构]
- Story 1.1 Dev Notes（ESM 模式、占位文件结构）: [Source: _bmad-output/implementation-artifacts/1-1-npm-package-init.md#Dev-Notes]
- Story 1.2（BmadError 实现）: [Source: _bmad-output/implementation-artifacts/1-2-exit-codes-and-errors.md]
- Story 1.3 测试模式（vi.spyOn）: [Source: _bmad-output/implementation-artifacts/1-3-output-module.md#Dev-Notes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `replaceTemplateVars` 使用函数形式 replacement（`() => value`）而非字符串，防止 `$&`、`$'`、`$2` 等特殊字符在 `String.prototype.replace` 中被解释为特殊 pattern（测试 `变量值含 $& 特殊字符时不扩展为匹配子串` 验证此行为）
- fs-extra v11 ESM 导入使用默认导入再解构：`import fsExtra from 'fs-extra'; const { ensureDir, readFile, outputFile } = fsExtra`
- ESM 中通过 `fileURLToPath(import.meta.url)` + `dirname()` 替代 `__dirname`
- AGENTS.md 和 BOOTSTRAP.md 正文中原先缺少 `{{agent_name}}`（仅存在于注释），Task 3 补充后四个文件均在正文包含三个必要变量

### Completion Notes List

- ✅ AC#1：`replaceTemplateVars(content, vars)` 实现并通过 7 个单元测试，支持 4 变量替换、空值处理、特殊字符安全、未知占位符保留
- ✅ AC#2：`writeAgentFiles(targetDir, vars)` 实现并通过 5 个单元测试，路径安全验证（`..` 遍历拒绝）、fs-extra 文件写入
- ✅ AC#3：`test/installer.test.js` 创建，12 个测试全部通过；45 个测试套件零回归
- ✅ `agent/AGENTS.md` 和 `agent/BOOTSTRAP.md` 正文补充了 `{{agent_name}}` 占位符
- ✅ 所有架构守则遵守：fs-extra、BmadError、具名导出、async/await、无 console.log

### File List

- lib/installer.js（修改：追加 replaceTemplateVars + writeAgentFiles，保留 install() 占位）
- test/installer.test.js（新建：12 个测试覆盖变量替换与文件写入）
- agent/AGENTS.md（修改：正文补充 `{{agent_name}}`）
- agent/BOOTSTRAP.md（修改：正文补充 `{{agent_name}}`）
