# Story 2.3: 幂等检测与安装状态判断

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 重复执行 `npx bmad-expert install` 时系统自动检测已有安装并安全跳过，
so that 不产生重复文件、冲突配置或状态损坏，即使 AI 误触发多次也不会破坏已有环境。

## Acceptance Criteria

1. **Given** 目标路径 `~/.happycapy/agents/bmad-expert/` 已存在且包含 `AGENTS.md`
   **When** 执行 `npx bmad-expert install`
   **Then** `adapter.check('bmad-expert')` 返回 `'installed'`
   **And** 安装流程跳过文件写入和注册步骤
   **And** stdout 输出："检测到已有安装，跳过重复安装，当前状态正常。"（FR13）
   **And** 进程以 exit code 6（ALREADY_INSTALLED）退出（FR31）
   **And** 检测耗时不超过 3 秒（NFR3）

2. **Given** 目标路径存在但文件不完整（缺少 AGENTS.md）
   **When** 执行 `adapter.check('bmad-expert')`
   **Then** 返回 `'corrupted'`，`checkInstallStatus` 返回 `{ status: 'corrupted' }`，安装流程继续执行

3. **Given** 目标路径不存在
   **When** 执行 `adapter.check('bmad-expert')`
   **Then** 返回 `'not_installed'`，`checkInstallStatus` 返回 `{ status: 'not_installed' }`，安装流程正常进行

4. **Given** `test/installer.test.js` 新增 `checkInstallStatus` 测试
   **When** 运行 `npm test`
   **Then** 所有新增测试通过，已有 12 个测试零回归

## Tasks / Subtasks

- [x] 在 `lib/installer.js` 中添加 `checkInstallStatus(adapter, agentId)` 导出函数 (AC: #1 #2 #3)
  - [x] 添加 `import { printProgress, printSuccess } from './output.js'` 到文件顶部
  - [x] 实现：调用 `adapter.check(agentId)` 前后用 `printProgress` 输出进度
  - [x] `status === 'installed'` 时：`printSuccess(...)` → `throw new BmadError('E006', '检测到已有安装，跳过重复安装，当前状态正常。', null)`
  - [x] `status === 'corrupted'` 时：`printProgress('检测到安装损坏，将重新安装...\n')` → `return { status }`
  - [x] `status === 'not_installed'` 时：`return { status }` 直接返回
  - [x] 具名导出：`export async function checkInstallStatus(adapter, agentId) {}`

- [x] 更新 `cli.js` install 命令 action 以调用平台检测 + 幂等检测 (AC: #1)
  - [x] 在 action 顶部动态导入：`detectPlatform`、`getAdapter` from `'./lib/platform.js'` 和 `checkInstallStatus` from `'./lib/installer.js'`
  - [x] 依次调用：`printProgress('正在检测平台...')` → `detectPlatform(options.platform ?? null)` → `printProgress(..., true)`
  - [x] 调用 `getAdapter(platform)` 获取适配器
  - [x] 调用 `await checkInstallStatus(adapter, options.agentId)`
  - [x] 保留 `// TODO(Story 2.4)` 注释，不实现文件写入和注册

- [x] 更新 `cli.js` 顶层 catch handler，E006 不走 `printError` 路径 (AC: #1)
  - [x] 判断 `err instanceof BmadError && err.bmadCode === 'E006'` 时直接 `process.exit(EXIT_CODES.ALREADY_INSTALLED)`
  - [x] 其余错误走原有 `printError(err)` + `process.exit(...)` 路径

- [x] 在 `test/installer.test.js` 中新增 `checkInstallStatus` 测试套件 (AC: #4)
  - [x] 在文件顶部 `vi.mock('../lib/output.js', ...)` mock output 模块（防止真实 stdout 输出）
  - [x] 新增 `describe('checkInstallStatus', ...)` 套件，使用 `mockAdapter = { check: vi.fn() }`
  - [x] 测试：`installed` → 抛出 `BmadError` 实例
  - [x] 测试：`installed` → `bmadCode === 'E006'`
  - [x] 测试：`corrupted` → 返回 `{ status: 'corrupted' }`，不抛出
  - [x] 测试：`not_installed` → 返回 `{ status: 'not_installed' }`，不抛出
  - [x] 测试：调用 `adapter.check` 时传入正确的 `agentId`

- [x] 运行 `npm test` 验证全部通过 (AC: #4)
  - [x] 确认新增测试通过
  - [x] 确认已有 installer 测试（12 个）零回归
  - [x] 确认 platform 测试（含 check() 的 4 个）仍通过

## Dev Notes

### 关键背景：哪些已实现，哪些是本故事职责

**已在 Story 2.1 实现（无需重写）：**
- `lib/adapters/happycapy.js` 中的 `check(agentId)` 方法：
  - 路径不存在 → `'not_installed'`
  - 路径存在且含 `AGENTS.md` → `'installed'`
  - 路径存在但缺 `AGENTS.md` → `'corrupted'`
- `test/platform.test.js` 中 `check()` 的 4 个单元测试（已通过，无需修改）

**本故事职责：**
- `lib/installer.js`：新增 `checkInstallStatus(adapter, agentId)` 函数
- `cli.js`：连接平台检测 + 幂等检测流程
- `test/installer.test.js`：为 `checkInstallStatus` 新增测试

### `checkInstallStatus` 完整实现

```javascript
import { printProgress, printSuccess } from './output.js'

/**
 * 检测安装状态，实现幂等保护
 * 若已安装：输出提示到 stdout，抛出 BmadError('E006') 触发 exit code 6
 * 若损坏或未安装：返回 { status } 让调用方继续安装流程
 *
 * @param {object} adapter - 平台适配器（必须含 check(agentId) 方法）
 * @param {string} agentId - agent 标识符（如 'bmad-expert'）
 * @returns {Promise<{status: 'not_installed'|'corrupted'}>}
 * @throws {BmadError} E006 — 已安装时
 */
export async function checkInstallStatus(adapter, agentId) {
  printProgress('正在检测安装状态...')
  const status = await adapter.check(agentId)
  printProgress('正在检测安装状态...', true)

  if (status === 'installed') {
    printSuccess('检测到已有安装，跳过重复安装，当前状态正常。')
    throw new BmadError('E006', '检测到已有安装，跳过重复安装，当前状态正常。', null)
  }

  if (status === 'corrupted') {
    printProgress('检测到安装损坏，将重新安装...\n')
  }

  return { status }
}
```

> **注意**：`BmadError` 已在文件顶部 `import { BmadError } from './errors.js'`，本函数添加到文件已有 import 后。
> `output.js` 的 `printProgress` 和 `printSuccess` 需要新增 import：`import { printProgress, printSuccess } from './output.js'`

### `cli.js` install action 完整实现

```javascript
program
  .command('install')
  .description('平台感知完整安装 BMAD agent')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '非交互模式，跳过所有确认提示')
  .action(async (options) => {
    const { detectPlatform, getAdapter } = await import('./lib/platform.js')
    const { checkInstallStatus } = await import('./lib/installer.js')
    const { printProgress } = await import('./lib/output.js')

    printProgress('正在检测平台...')
    const platform = await detectPlatform(options.platform ?? null)
    printProgress('正在检测平台...', true)

    const adapter = getAdapter(platform)
    await checkInstallStatus(adapter, options.agentId)

    // TODO(Story 2.4): 实现完整安装流程（文件复制、变量替换、happycapy-cli 注册）
  })
```

### `cli.js` catch handler 更新

```javascript
program.parseAsync().catch(err => {
  if (err instanceof BmadError && err.bmadCode === 'E006') {
    // ALREADY_INSTALLED 是正常状态：消息已由 checkInstallStatus 打印到 stdout
    // 无需 printError（不是真正的错误），直接以 exit code 6 退出
    process.exit(EXIT_CODES.ALREADY_INSTALLED)
  } else {
    printError(err)
    if (err instanceof BmadError) {
      process.exit(CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
    } else {
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
  }
})
```

> **设计原因**：E006（已存在）是预期的非错误状态，用户（AI）已从 stdout 获得明确信息。若走 `printError` 路径，会在 stderr 输出 `ERROR [E006]...` 造成混淆，与 FR13 要求的正面确认信息矛盾。

### `test/installer.test.js` 新增测试实现

在文件**顶部** mock 部分添加 output.js mock（放在现有 `vi.mock('fs-extra', ...)` 之后）：

```javascript
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))
```

新增 import（在现有 import 行之后）：
```javascript
import { checkInstallStatus } from '../lib/installer.js'
```

新增测试套件（放在文件末尾现有 `describe('writeAgentFiles', ...)` 之后）：

```javascript
// ─── checkInstallStatus ────────────────────────────────────────────────────

describe('checkInstallStatus', () => {
  let mockAdapter

  beforeEach(() => {
    mockAdapter = { check: vi.fn() }
    vi.clearAllMocks()
  })

  it('status 为 installed 时抛出 BmadError 实例', async () => {
    mockAdapter.check.mockResolvedValueOnce('installed')
    await expect(checkInstallStatus(mockAdapter, 'bmad-expert')).rejects.toBeInstanceOf(BmadError)
  })

  it('status 为 installed 时抛出 bmadCode 为 E006 的错误', async () => {
    mockAdapter.check.mockResolvedValueOnce('installed')
    await expect(checkInstallStatus(mockAdapter, 'bmad-expert')).rejects.toMatchObject({
      bmadCode: 'E006',
    })
  })

  it('status 为 corrupted 时返回 { status: corrupted }，不抛出', async () => {
    mockAdapter.check.mockResolvedValueOnce('corrupted')
    const result = await checkInstallStatus(mockAdapter, 'bmad-expert')
    expect(result).toMatchObject({ status: 'corrupted' })
  })

  it('status 为 not_installed 时返回 { status: not_installed }，不抛出', async () => {
    mockAdapter.check.mockResolvedValueOnce('not_installed')
    const result = await checkInstallStatus(mockAdapter, 'bmad-expert')
    expect(result).toMatchObject({ status: 'not_installed' })
  })

  it('调用 adapter.check 时传入正确的 agentId', async () => {
    mockAdapter.check.mockResolvedValueOnce('not_installed')
    await checkInstallStatus(mockAdapter, 'my-custom-agent')
    expect(mockAdapter.check).toHaveBeenCalledWith('my-custom-agent')
  })
})
```

### 架构守则（严禁违反）

1. **禁止直接 console.log**：进度输出必须通过 `printProgress`/`printSuccess`（output.js）
2. **禁止直接 throw new Error()**：使用 `throw new BmadError('E006', ..., null)`
3. **禁止 default export**：`checkInstallStatus` 为具名导出
4. **禁止 .then()/.catch()**：使用 async/await
5. **禁止硬编码 exit code 数字**：使用 `EXIT_CODES.ALREADY_INSTALLED`
6. **不得修改 `check()` 实现**：Story 2.1 已完整实现，不需要改动 `lib/adapters/happycapy.js`

### 本故事不需要实现的内容（避免越界）

- `install()` 函数的完整实现 → Story 2.4 负责
- `happycapy-cli add` 注册调用 → Story 2.4 负责
- 安装完成的情感性确认输出 → Story 2.5 负责
- `agent/` 模板文件变量替换写入 → Story 2.2 已完成

### 项目结构变化（本故事新增/修改的文件）

```
bmad-expert/
├── cli.js                 ✏️  更新 install action（平台检测 + checkInstallStatus），更新 catch handler（E006 分支）
├── lib/
│   └── installer.js       ✏️  新增 checkInstallStatus 导出函数，新增 output.js import
└── test/
    └── installer.test.js  ✏️  新增 vi.mock('../lib/output.js')，新增 checkInstallStatus 测试套件（5 个测试）
```

**其余文件不需要修改。**（尤其不需要改 `lib/adapters/happycapy.js` 和 `test/platform.test.js`）

### 依赖的已有实现（直接复用）

| 模块 | 实现状态 | 使用方式 |
|------|---------|---------|
| `lib/adapters/happycapy.js` → `check()` | Story 2.1（review）| 作为 adapter 参数传入 checkInstallStatus |
| `lib/errors.js` → `BmadError` | Story 1.2（done）| `throw new BmadError('E006', ..., null)` |
| `lib/exit-codes.js` → `EXIT_CODES.ALREADY_INSTALLED` | Story 1.2（done）| `process.exit(EXIT_CODES.ALREADY_INSTALLED)` |
| `lib/output.js` → `printProgress`, `printSuccess` | Story 1.3（review）| 进度输出 |
| `lib/platform.js` → `detectPlatform`, `getAdapter` | Story 2.1（review）| cli.js 动态导入 |

### References

- Story 2.3 验收标准: [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3]
- 架构文档 数据架构（安装状态检测）: [Source: _bmad-output/planning-artifacts/architecture.md#数据架构]
- 架构文档 安装编排边界（adapter.check 调用链）: [Source: _bmad-output/planning-artifacts/architecture.md#安装编排边界]
- 架构文档 Exit Code 表（code 6 = ALREADY_INSTALLED）: [Source: _bmad-output/planning-artifacts/architecture.md#CLI接口与通信模式]
- 架构文档 执行规范（6 条强制规则）: [Source: _bmad-output/planning-artifacts/architecture.md#执行规范]
- Story 2.1（check 实现）: [Source: _bmad-output/implementation-artifacts/2-1-platform-detection-happycapy-adapter.md]
- Story 2.2（installer.js 结构，writeAgentFiles 实现）: [Source: _bmad-output/implementation-artifacts/2-2-agent-template-files.md]
- Story 2.2 Dev Notes（vitest mock 模式）: [Source: _bmad-output/implementation-artifacts/2-2-agent-template-files.md#Dev-Notes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `BmadError('E006')` 属于预期的非错误信号（幂等跳过），不应通过 `printError` 路由到 stderr。因此在 `cli.js` catch handler 中为 E006 添加了独立分支：直接 `process.exit(ALREADY_INSTALLED)`，跳过 `printError`。
- `vi.mock('../lib/output.js')` 需要与 `vi.mock('fs-extra')` 一同放在测试文件顶部，vitest 会自动 hoist。mock 中须提供 `printProgress`、`printSuccess`、`printError` 三个 vi.fn()，否则 installer.js 导入时会报 undefined。
- `checkInstallStatus` 不使用 `E004`（路径错误，retryable=true），E006 不需要 retryable 属性（BmadError 默认 false）。

### Completion Notes List

- ✅ AC#1：`checkInstallStatus` 在 `installed` 时调用 `printSuccess` 输出确认信息（stdout），抛出 `BmadError('E006', ...)` 触发 exit code 6；cli.js 已更新 catch handler 处理 E006 分支
- ✅ AC#2：`checkInstallStatus` 在 `corrupted` 时输出警告并返回 `{ status: 'corrupted' }`，不抛出
- ✅ AC#3：`checkInstallStatus` 在 `not_installed` 时返回 `{ status: 'not_installed' }`，不抛出
- ✅ AC#4：`test/installer.test.js` 新增 5 个 `checkInstallStatus` 测试，全部通过；全套 87 个测试零回归
- ✅ cli.js install action 已实现平台检测 + 幂等检测两个步骤；Story 2.4 占位保留
- ✅ 所有架构守则遵守：BmadError、具名导出、async/await、output.js、无硬编码 exit 数字

### File List

- lib/installer.js（修改：新增 output.js import，新增 checkInstallStatus 导出函数）
- cli.js（修改：install action 实现平台检测 + 幂等检测；catch handler 新增 E006 分支）
- test/installer.test.js（修改：新增 vi.mock output.js，新增 checkInstallStatus 测试套件 5 个）
