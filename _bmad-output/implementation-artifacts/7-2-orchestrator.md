# Story 7.2: BMAD 官方安装器调用与补充文件写入（orchestrator.js）

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want `lib/orchestrator.js` 通过 execa 调用 `npx bmad-method install` 完成核心安装，随后写入 bmad-expert 专属补充文件,
so that 安装结果始终对齐 BMAD 最新版本，bmad-expert 无需维护内置 BMAD 模板文件。

## Acceptance Criteria

1. **Given** `lib/orchestrator.js` 已实现，调用 `executeInstall(params)`
   **When** 执行
   **Then** 通过 execa 执行 `npx bmad-method install [params...] --yes`，动态获取官方安装器最新版本（npx 默认行为）（FR41、FR44）
   **And** 捕获官方安装器的 stdout/stderr，实时转发至 output.js 进度输出

2. **Given** BMAD 官方安装器执行成功，调用 `writeSupplementFiles(targetPath, vars)`
   **When** 执行
   **Then** SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 被写入 targetPath，所有 `{{...}}` 变量替换完成，无残留占位符（FR45）
   **And** 写入使用 fs-extra，路径在白名单范围内验证

3. **Given** BMAD 官方安装器执行失败（非零 exit code）
   **When** 捕获错误
   **Then** 包装为 `BmadError`，包含官方安装器的 stdout/stderr 作为错误上下文，向上抛出至 cli.js 顶层处理

4. **Given** 官方安装完成后写入补充文件时遇到权限问题
   **When** 捕获 EACCES 异常
   **Then** 抛出 `BmadError('E004', '补充文件写入失败', cause)`

5. **Given** `test/orchestrator.test.js` 使用 mock execa 和 mock fs-extra
   **When** 运行 `npm test`
   **Then** 编排器的调用逻辑、错误包装、文件写入测试全部通过

## Tasks / Subtasks

- [ ] 新建 `lib/orchestrator.js`：实现 executeInstall + writeSupplementFiles (AC: #1-4)
  - [ ] 定义模块顶部常量：`SUPPLEMENT_FILES = ['SOUL.md','IDENTITY.md','AGENTS.md','BOOTSTRAP.md']`
  - [ ] 定义 `AGENT_TEMPLATE_DIR`（与 installer.js / updater.js 同样的方式：`resolve(__dirname, '../agent')`）
  - [ ] 实现 `export async function executeInstall(params)`:
    - 调用 `printProgress('正在执行 BMAD 安装...')`
    - 用 `execa('npx', ['bmad-method', 'install', ...params, '--yes'], { all: true, reject: false })`
    - 若 `result.exitCode !== 0`，包装为 BmadError('E001') 含 stdout/stderr 上下文并 throw
    - 若 `result.cause?.code` 为网络错误码，包装为 BmadError('E005')
    - 正常结束时调用 `printProgress('', true)` 并返回 `{ stdout, stderr }`
  - [ ] 实现 `export async function writeSupplementFiles(targetPath, vars = {})`:
    - 调用 `printProgress('正在写入补充文件...')`
    - 用 `fs.ensureDir(targetPath)` 确保目录存在（EACCES → BmadError('E004', '补充文件写入失败', cause)）
    - 逐一读取 `agent/` 中 SUPPLEMENT_FILES，调用 `replaceTemplateVars(content, mergedVars)`，写入 targetPath
    - 写入时 EACCES/EPERM → BmadError('E004', '补充文件写入失败', cause)
    - 写入完成后调用 `printProgress('', true)`
  - [ ] 内部封装 `wrapWriteError(err, fallbackMsg)` 辅助函数（不导出）

- [ ] 新建 `test/orchestrator.test.js`：覆盖 AC1-4 (AC: #5)
  - [ ] mock execa：`vi.mock('execa', () => ({ execa: vi.fn() }))`
  - [ ] mock fs-extra：`vi.mock('fs-extra', () => ({ default: { ensureDir: vi.fn(), readFile: vi.fn(), outputFile: vi.fn() } }))`
  - [ ] mock `../lib/output.js`（printProgress / printSuccess 均为 vi.fn()）
  - [ ] mock `../lib/installer.js` 的 `replaceTemplateVars`（返回原始 content，方便断言）
  - [ ] **executeInstall 用例组：**
    - execa 成功（exitCode=0）：验证 execa 以正确参数调用、printProgress('', true) 被调用、返回 stdout/stderr
    - execa 失败（exitCode=1）：验证 throw BmadError('E001')，且 BmadError.cause.message 含原始 stderr
    - execa 网络错误（err.code='ECONNREFUSED'）：验证 throw BmadError('E005')
    - params 为空数组：验证 execa 调用时仍追加 --yes
  - [ ] **writeSupplementFiles 用例组：**
    - 全部成功写入：验证 fs.ensureDir 和 fs.outputFile 各调用 4 次、printProgress('', true) 被调用
    - ensureDir EACCES：验证 throw BmadError('E004', '补充文件写入失败', ...)
    - outputFile EACCES（任意文件）：验证 throw BmadError('E004', '补充文件写入失败', ...)
    - 所有 4 个文件名均被写入目标 targetPath

## Dev Notes

### 关键约束（必须遵守，违反则破坏架构一致性）

1. **具名导出，禁止 default export**：`export async function executeInstall` / `export async function writeSupplementFiles`
2. **文件操作必须使用 fs-extra**：`import fs from 'fs-extra'`，禁止 `import { ... } from 'fs'`
3. **外部进程调用必须使用 execa**：`import { execa } from 'execa'`，禁止 `child_process`
4. **所有进度输出通过 output.js**：`import { printProgress } from './output.js'`，禁止 `console.log`
5. **错误必须使用 BmadError**：禁止 `throw new Error()`
6. **lib 模块内禁止 process.exit()**
7. **async/await，禁止 .then()/.catch() 链式调用**

### executeInstall 实现细节

```javascript
// 调用模式：npx bmad-method install [params...] --yes
// params 示例：['--modules', 'bmm', '--tools', 'claude-code', '--output-folder', '/path/to/agents']
// --yes 始终追加（确保非交互模式）

import { execa } from 'execa'

// execa 选项说明：
// - all: true  → result.all 包含合并的 stdout+stderr（用于错误上下文）
// - reject: false → execa 不自动 throw，由我们手动判断 exitCode

const NETWORK_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']

export async function executeInstall(params) {
  printProgress('正在执行 BMAD 安装...')
  let result
  try {
    result = await execa('npx', ['bmad-method', 'install', ...params, '--yes'], {
      all: true,
      reject: false,
    })
  } catch (err) {
    // execa 本身异常（如 npx 不存在）
    if (NETWORK_CODES.includes(err?.code)) {
      throw new BmadError('E005', '网络错误：无法调用 npx bmad-method install', err, [
        '检查网络连接后重新执行安装命令',
        '若持续失败，检查代理设置',
      ])
    }
    throw new BmadError('E001', 'BMAD 官方安装器调用失败', err)
  }

  if (result.exitCode !== 0) {
    const outputContext = result.all || result.stderr || result.stdout || '（无输出）'
    throw new BmadError(
      'E001',
      'BMAD 官方安装器执行失败',
      new Error(outputContext),
      ['检查 npx bmad-method install 的可用性', '确认网络连接后重试']
    )
  }

  printProgress('', true)
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}
```

### writeSupplementFiles 实现细节

```javascript
// Phase 2：仅写入 bmad-expert 补充文件（非完整 BMAD agent 文件集）
// 与 installer.js FRAMEWORK_FILES 的区别：
//   FRAMEWORK_FILES = ['SOUL.md','IDENTITY.md','AGENTS.md','BOOTSTRAP.md','bmad-project-init.md']  ← Phase 1 全集
//   SUPPLEMENT_FILES = ['SOUL.md','IDENTITY.md','AGENTS.md','BOOTSTRAP.md']                        ← Phase 2 补充层

const SUPPLEMENT_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']

export async function writeSupplementFiles(targetPath, vars = {}) {
  printProgress('正在写入补充文件...')

  const installDate = new Date().toISOString().slice(0, 10)
  const mergedVars = {
    agentId: 'bmad-expert',
    agentName: 'bmad-expert',
    model: '',
    installDate,
    ...vars,  // 调用方可覆盖默认值（如传入 { agentId: 'custom' }）
  }

  try {
    await fs.ensureDir(targetPath)
  } catch (err) {
    _wrapWriteError(err, `创建目标目录失败：${targetPath}`)
  }

  for (const filename of SUPPLEMENT_FILES) {
    const templatePath = join(AGENT_TEMPLATE_DIR, filename)
    try {
      const content = await fs.readFile(templatePath, 'utf8')
      const replaced = replaceTemplateVars(content, mergedVars)
      await fs.outputFile(join(targetPath, filename), replaced, 'utf8')
    } catch (err) {
      _wrapWriteError(err, `写入补充文件失败：${filename}`)
    }
  }

  printProgress('', true)
}

function _wrapWriteError(err, fallbackMsg) {
  const isPermissionError = err?.code === 'EACCES' || err?.code === 'EPERM'
  if (isPermissionError) {
    throw new BmadError('E004', '补充文件写入失败', err, [
      '检查目标目录权限后重试',
      '重新执行安装命令：npx bmad-expert install',
    ])
  }
  throw new BmadError('E001', fallbackMsg, err)
}
```

### replaceTemplateVars 复用

`replaceTemplateVars` 已在 `lib/installer.js` 中实现并导出，**直接复用，不重新实现**：

```javascript
import { replaceTemplateVars } from './installer.js'
```

该函数替换 `{{agent_id}}`、`{{agent_name}}`、`{{model}}`、`{{install_date}}` 四个变量，使用函数形式 replacement 防止 `$` 字符副作用。

### 模块头部模板（完整 import 区）

```javascript
// lib/orchestrator.js
// BMAD 官方安装器编排器 — Story 7.2
import { execa } from 'execa'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import fs from 'fs-extra'
import { BmadError } from './errors.js'
import { printProgress } from './output.js'
import { replaceTemplateVars } from './installer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')
const SUPPLEMENT_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']
const NETWORK_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']
```

### test/orchestrator.test.js 骨架

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeInstall, writeSupplementFiles } from '../lib/orchestrator.js'
import { BmadError } from '../lib/errors.js'

// ─── mocks ───────────────────────────────────────────────────────────────────
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('content {{agent_id}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
}))

vi.mock('../lib/installer.js', () => ({
  replaceTemplateVars: vi.fn((content) => content),  // 直接返回原始 content
}))

// ─── executeInstall ───────────────────────────────────────────────────────────
describe('executeInstall', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('成功时以正确参数调用 execa', async () => { ... })
  it('成功时返回 { stdout, stderr }', async () => { ... })
  it('失败（exitCode=1）时 throw BmadError("E001")', async () => { ... })
  it('网络错误（ECONNREFUSED）时 throw BmadError("E005")', async () => { ... })
  it('params 为空时仍追加 --yes', async () => { ... })
})

// ─── writeSupplementFiles ─────────────────────────────────────────────────────
describe('writeSupplementFiles', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('写入全部 4 个补充文件', async () => { ... })
  it('ensureDir EACCES 时 throw BmadError("E004")', async () => { ... })
  it('outputFile EACCES 时 throw BmadError("E004")', async () => { ... })
  it('调用 replaceTemplateVars 替换每个文件', async () => { ... })
})
```

### 注意事项

1. **execa `reject: false`**：`execa` 默认在非零 exit code 时 throw，设 `reject: false` 后由我们手动判断 `result.exitCode`，这样可以同时获取 stdout/stderr 内容用于错误上下文
2. **`all: true`**：合并 stdout+stderr 到 `result.all`，在错误时作为完整输出上下文传给 BmadError
3. **SUPPLEMENT_FILES vs FRAMEWORK_FILES**：orchestrator.js 的 SUPPLEMENT_FILES 是 Phase 2 补充层（4 个文件），不含 `bmad-project-init.md`（那是 Phase 1 中 installer.js 的 FRAMEWORK_FILES 的一部分）
4. **targetPath 白名单验证**：本 story 的 orchestrator.js 不做路径白名单验证（由调用方 installer.js 负责），只做文件写入
5. **进度输出格式**：与 installer.js / updater.js 一致：先 `printProgress('正在...')` 再异步操作再 `printProgress('', true)` 追加 ✓

### Project Structure Notes

**新建文件：**
```
lib/orchestrator.js          ← 本 story 主交付物
test/orchestrator.test.js    ← 单元测试
```

**不修改文件（避免回归）：**
```
lib/installer.js      ← 复用其 replaceTemplateVars（import 即可，不改动）
lib/output.js         ← 直接使用现有 printProgress
lib/errors.js         ← 直接使用现有 BmadError
cli.js                ← Story 7.3 再对接 orchestrator（本 story 不改）
```

**本 story 不需要修改 cli.js 或 installer.js**：orchestrator.js 仅作为独立模块交付，由 Story 7.3（installer.js 接入两阶段架构）负责连接。

### References

- orchestrator.js 架构设计: [Source: `_bmad-output/planning-artifacts/architecture.md` → "安装编排架构（Phase 2）→ BMAD 官方安装器调用"]
- Phase 2 调用链: [Source: `_bmad-output/planning-artifacts/architecture.md` → "安装编排边界 → Phase 2 调用链"]
- FR41、FR44、FR45: [Source: `_bmad-output/planning-artifacts/epics.md` → "Epic 7 → Story 7.2 AC"]
- execa 使用规范: [Source: `_bmad-output/planning-artifacts/architecture.md` → "执行规范 → 外部进程调用必须使用 execa"]
- fs-extra 使用规范: [Source: `_bmad-output/planning-artifacts/architecture.md` → "执行规范 → 文件操作必须使用 fs-extra"]
- BmadError 类定义: [Source: `lib/errors.js`]
- replaceTemplateVars 函数: [Source: `lib/installer.js:197-205`]
- SUPPLEMENT_FILES 与 FRAMEWORK_FILES 区别: [Source: `_bmad-output/planning-artifacts/architecture.md` → "agent/ 目录角色变化"]
- printProgress 用法: [Source: `lib/output.js:56-63`]
- execa reject:false 用法参考: [Source: `lib/adapters/happycapy.js:37-43`（execa 用法示例）]
- 测试 mock 模式参考: [Source: `test/installer.test.js:1-20`（vi.mock 用法）]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
