# Story 2.4: HappyCapy 完整安装流程编排

Status: done

## Story

As a 用户（通过 AI 代劳）,
I want 在 HappyCapy 聊天界面触发一句话后，`npx bmad-expert install` 在 60 秒内完成平台感知、文件写入、happycapy-cli 注册，并实时输出每步进度，
so that 我可以在不打开 terminal 的情况下完成完整 BMAD 安装，全程看到进度反馈而不是沉默等待。

## Acceptance Criteria

1. **Given** HappyCapy 平台，`happycapy-cli` 可用，目标路径不存在
   **When** 执行 `npx bmad-expert install`
   **Then** stdout 依次输出各步进度：`正在检测平台... ✓`、`正在检测安装状态... ✓`、`正在复制 agent 文件... ✓`、`正在替换模板变量... ✓`、`正在注册 agent... ✓`
   **And** 每步进度输出间隔不超过 2 秒（NFR2）
   **And** 全流程在 60 秒内完成（NFR1）
   **And** `~/.happycapy/agents/bmad-expert/` 目录包含四个已替换变量的文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）
   **And** `happycapy-cli add bmad-expert` 被成功调用（通过 execa，非 child_process）
   **And** 进程以 exit code 0 退出

2. **Given** HappyCapy 平台，`happycapy-cli` 不存在（降级场景）
   **When** 执行安装注册步骤
   **Then** 输出手动注册命令（降级路径），不抛出未处理异常，进程正常完成（exit code 0）

3. **Given** 目标路径已存在且包含 `AGENTS.md`（已安装）
   **When** 执行 `npx bmad-expert install`
   **Then** 输出 "检测到已有安装，跳过重复安装，当前状态正常。"（stdout）
   **And** 进程以 exit code 6（ALREADY_INSTALLED）退出

4. **Given** `test/integration/happycapy.test.js` 使用 mock 文件系统和 mock execa
   **When** 运行 `npm test`
   **Then** 完整安装流程集成测试通过，且已有全部单元测试无回归

## Tasks / Subtasks

- [x] 实现 `lib/installer.js` — `install(options)` 完整编排函数 (AC: #1, #2, #3)
  - [x] 追加导入：`import { detectPlatform, getAdapter } from './platform.js'`（printProgress/printSuccess 已导入）
  - [x] 替换 `install()` 占位函数体，调用链：detectPlatform → getAdapter → checkInstallStatus → 文件复制 → 变量替换 → adapter.install
  - [x] Step 1（progress）：`printProgress('正在检测平台...')` → detectPlatform → getAdapter → `printProgress('', true)`
  - [x] Step 2（progress）：直接调用已实现的 `checkInstallStatus(adapter, agentId)`（含 "正在检测安装状态..." 进度输出）
  - [x] Step 3（progress）：`printProgress('正在复制 agent 文件...')` → ensureDir + 循环 readFile → `printProgress('', true)`
  - [x] Step 4（progress）：`printProgress('正在替换模板变量...')` → replaceTemplateVars + 循环 outputFile → `printProgress('', true)`
  - [x] Step 5（progress）：`printProgress('正在注册 agent...')` → `adapter.install(null, { agentId })` → `printProgress('', true)`
  - [x] `printSuccess(...)` 输出安装完成引导信息（含用时秒数、两个可执行选项）
  - [x] 文件操作错误用 `wrapFileError()` 包装（已实现，直接调用）

- [x] 修改 `cli.js` — 简化 install action，调用 `install()` (AC: #1)
  - [x] 追加导入：`import { install } from './lib/installer.js'`（去掉 action 内的动态 import）
  - [x] 将 action 函数体替换为：`await install({ platform: options.platform ?? null, agentId: options.agentId, yes: options.yes ?? false })`
  - [x] 删除 action 内的动态 import 行（detectPlatform、checkInstallStatus、printProgress）

- [x] 实现 `lib/adapters/happycapy.js` — `install(files, options)` (AC: #1, #2)
  - [x] 追加导入：`import { printSuccess } from '../output.js'`
  - [x] 通过 `execa('happycapy-cli', ['add', agentId])` 完成注册（agentId 从 options.agentId 取，默认 'bmad-expert'）
  - [x] 捕获所有 execa 异常 → `printSuccess(...)` 输出手动注册命令，不 throw
  - [x] 降级输出格式：`\nhappycapy-cli 未找到，请手动注册：\n  happycapy-cli add ${agentId}\n`
  - [x] 删除 `void files; void options` 占位行

- [x] 创建 `test/integration/happycapy.test.js` (AC: #4)
  - [x] 3 个核心测试：正常安装、降级（无 happycapy-cli）、幂等（已安装）
  - [x] mock 方案：`vi.mock('fs-extra', ...)` + `vi.mock('execa', ...)` + `vi.stubEnv('CAPY_USER_ID', ...)`
  - [x] 正常安装：验证 outputFile 调用 4 次 + execa 含 `['add', 'bmad-expert']`
  - [x] 降级：execa add 调用抛 ENOENT → install() 不 throw
  - [x] 幂等：pathExists 全 true → throw BmadError E006
  - [x] 同时 mock `../../lib/output.js` 静默进度输出（避免 stdout 污染）

- [x] 验证所有测试通过 (AC: #4)
  - [x] `npm test`：integration 绿，且 errors/exit-codes/output/platform/installer 5 个已有测试文件无回归

## Dev Notes

### Story 2-3 带来的重要变更（已合并到 main，必须基于此实现）

**`lib/installer.js` 新增（已实现，直接调用）：**

```javascript
// 幂等检测函数 — 已实现，含 "正在检测安装状态..." 进度输出
export async function checkInstallStatus(adapter, agentId)
// 内部：printProgress('正在检测安装状态...') → adapter.check(agentId) → printProgress('', true)
// installed → printSuccess(...) + throw BmadError('E006')
// corrupted → printProgress('检测到安装损坏，将重新安装...')（无 done=true）→ return { status }
// not_installed → return { status }
```

**`cli.js` install action 当前状态（需要重构）：**
```javascript
// 当前：action 内动态 import + 手动平台检测 + checkInstallStatus + TODO
.action(async (options) => {
  const { detectPlatform, getAdapter } = await import('./lib/platform.js')
  const { checkInstallStatus } = await import('./lib/installer.js')
  const { printProgress } = await import('./lib/output.js')
  printProgress('正在检测平台...')
  const platform = await detectPlatform(options.platform ?? null)
  printProgress('正在检测平台...', true)
  const adapter = getAdapter(platform)
  await checkInstallStatus(adapter, options.agentId)
  // TODO(Story 2.4): 实现完整安装流程
})
// → Story 2.4 重构为：await install({ platform: options.platform ?? null, agentId: options.agentId, yes: options.yes ?? false })
```

### `lib/installer.js:install()` 完整实现

在当前 installer.js 顶部 import 区追加（`printProgress`/`printSuccess`/`BmadError` 等已导入，**不重复声明**）：

```javascript
import { detectPlatform, getAdapter } from './platform.js'
```

替换占位 `install()` 函数体：

```javascript
/**
 * HappyCapy 完整安装编排
 * 调用链：detectPlatform → checkInstallStatus → 文件复制 → 替换变量 → adapter.install
 * @param {Object} [options={}]
 * @param {string|null} [options.platform=null]   - --platform 覆盖值，null 表示自动检测
 * @param {string} [options.agentId='bmad-expert'] - agent 标识符
 * @param {boolean} [options.yes=false]            - 非交互模式（保留参数位）
 * @throws {BmadError} E006 — 已安装（exit code 6）
 * @throws {BmadError} E002 — 无效 platform 或路径非法
 * @throws {BmadError} E004 — 文件写入权限不足
 */
export async function install(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert' } = options
  const startTime = Date.now()

  // ── Step 1: 平台检测 ──────────────────────────────────────────────────────
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  printProgress('', true)

  // ── Step 2: 幂等检测（使用已实现的 checkInstallStatus，含进度输出）──────────
  await checkInstallStatus(adapter, agentId)
  // 若 installed → checkInstallStatus 内部已 throw BmadError('E006')，不往下执行
  // 若 corrupted/not_installed → 继续

  const targetDir = adapter.getInstallPath(agentId)
  const installDate = new Date().toISOString().slice(0, 10)
  const vars = { agentId, agentName: agentId, model: '', installDate }

  // ── Step 3: 复制 agent 文件（读模板到内存）───────────────────────────────
  printProgress('正在复制 agent 文件...')
  try {
    await ensureDir(targetDir)
  } catch (error) {
    wrapFileError(error, `创建目标目录失败：${targetDir}`)
  }
  const fileContents = {}
  for (const filename of FRAMEWORK_FILES) {
    try {
      fileContents[filename] = await readFile(join(AGENT_TEMPLATE_DIR, filename), 'utf8')
    } catch (error) {
      wrapFileError(error, `读取模板文件失败：${filename}`)
    }
  }
  printProgress('', true)

  // ── Step 4: 替换模板变量 + 写入目标目录 ──────────────────────────────────
  printProgress('正在替换模板变量...')
  for (const filename of FRAMEWORK_FILES) {
    const replaced = replaceTemplateVars(fileContents[filename], vars)
    try {
      await outputFile(join(targetDir, filename), replaced, 'utf8')
    } catch (error) {
      wrapFileError(error, `写入文件失败：${filename}`)
    }
  }
  printProgress('', true)

  // ── Step 5: 平台注册 ─────────────────────────────────────────────────────
  printProgress('正在注册 agent...')
  await adapter.install(null, { agentId })
  printProgress('', true)

  // ── 安装完成引导 ──────────────────────────────────────────────────────────
  const duration = Math.round((Date.now() - startTime) / 1000)
  printSuccess(
    `bmad-expert 已就绪。安装完成（用时 ${duration}s）\n\n现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  )
}
```

> `wrapFileError`、`ensureDir`、`readFile`、`outputFile`、`join`、`AGENT_TEMPLATE_DIR`、`FRAMEWORK_FILES`、`replaceTemplateVars`、`checkInstallStatus` 均已在 installer.js 定义或导入，**直接使用，不重复声明**。

### `lib/adapters/happycapy.js:install()` 完整实现

在 `happycapy.js` 顶部 import 区追加：

```javascript
import { printSuccess } from '../output.js'
```

替换占位 `install()` 函数体（保留原 JSDoc 注释）：

```javascript
export async function install(files, options = {}) {
  // files 参数由 installer.js 在 Step 3/4 写入文件系统，此处仅做平台注册
  const agentId = options.agentId ?? 'bmad-expert'

  try {
    await execa('happycapy-cli', ['add', agentId])
  } catch {
    // 降级路径：happycapy-cli 不存在或注册失败 → 输出手动命令，不 throw
    printSuccess(
      `\nhappycapy-cli 未找到，请手动注册：\n  happycapy-cli add ${agentId}\n`
    )
  }
}
```

### `cli.js` 修改

1. 在顶部 import 区末尾追加（放在现有 import 之后）：
```javascript
import { install } from './lib/installer.js'
```

2. 替换 install command action 函数体（删除内部动态 import 和手动步骤）：
```javascript
.action(async (options) => {
  await install({
    platform: options.platform ?? null,
    agentId: options.agentId,
    yes: options.yes ?? false,
  })
})
```

> 无需 `process.exit(0)`。E006 捕获逻辑在 cli.js 底部 `program.parseAsync().catch(...)` 已处理，无需修改。

### `test/integration/happycapy.test.js` 完整实现

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { install } from '../../lib/installer.js'
import { BmadError } from '../../lib/errors.js'

// ── 模块 Mock ──────────────────────────────────────────────────────────────
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

// output.js mock：静默进度输出，避免 stdout 污染
vi.mock('../../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

// ── 测试套件 ───────────────────────────────────────────────────────────────
describe('HappyCapy 完整安装流程（集成测试）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // HappyCapy 平台特征变量（detect() 用 env var 通过，无需 execa --version）
    vi.stubEnv('CAPY_USER_ID', 'test-user-123')

    // 默认：目标路径不存在（not_installed）
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)

    // 默认：happycapy-cli add 成功
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常安装：写入 4 个文件并调用 happycapy-cli add', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const fsExtra = (await import('fs-extra')).default
    // 4 个框架文件全部写入
    expect(fsExtra.outputFile).toHaveBeenCalledTimes(4)

    // happycapy-cli add 被调用
    const { execa } = await import('execa')
    const addCall = execa.mock.calls.find(
      (args) => args[0] === 'happycapy-cli' && args[1]?.[0] === 'add'
    )
    expect(addCall).toBeDefined()
    expect(addCall[1]).toContain('bmad-expert')
  })

  it('降级安装：happycapy-cli add 失败时不 throw，install() 正常完成', async () => {
    const { execa } = await import('execa')
    execa.mockImplementation((_cmd, args) => {
      if (args?.[0] === 'add') {
        const err = new Error('Command not found: happycapy-cli')
        err.code = 'ENOENT'
        return Promise.reject(err)
      }
      return Promise.resolve({ exitCode: 0 })
    })

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).resolves.toBeUndefined()
  })

  it('幂等检测：已安装时 throw BmadError(E006)', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 目标路径存在（pathExists 全 true → check() 返回 'installed'）
    fsExtra.pathExists.mockResolvedValue(true)

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })
  })
})
```

> **mock 注意**：`vi.mock('../../lib/output.js', ...)` 静默所有进度输出，避免测试日志被 `process.stdout.write` 污染。

### 架构守则（严禁违反）

1. **禁止 `console.log`** — 进度输出通过 `printProgress`/`printSuccess`
2. **禁止原生 `fs`** — 文件操作通过 `fs-extra`（ensureDir、readFile、outputFile）
3. **禁止 `child_process`** — CLI 调用通过 `execa`（happycapy.js 已导入）
4. **禁止 `process.exit` 在 lib 模块** — 退出通过 throw BmadError，cli.js 顶层处理
5. **禁止 `default export`** — 全部为具名导出
6. **禁止 `.then()/.catch()` 链** — 全部 `async/await`
7. **`install()` 中直接使用已有 helper**：`checkInstallStatus`、`wrapFileError`、`ensureDir`、`readFile`、`outputFile`、`replaceTemplateVars`、`FRAMEWORK_FILES`、`AGENT_TEMPLATE_DIR` — 不重复实现

### 依赖版本（精确锁定，不可更改）

```json
{
  "execa": "9.6.1",
  "fs-extra": "11.3.4",
  "chalk": "5.6.2",
  "commander": "14.0.3",
  "vitest": "4.1.1"
}
```

**execa v9 ESM 具名导入：**
```javascript
import { execa } from 'execa'   // ✅
import execa from 'execa'        // ❌（非 default export）
```

### 不修改的文件（严禁改动）

- `lib/errors.js`、`lib/exit-codes.js`、`lib/output.js`、`lib/platform.js`
- `lib/adapters/cursor.js`、`lib/adapters/claude-code.js`
- `test/errors.test.js`、`test/exit-codes.test.js`、`test/output.test.js`、`test/platform.test.js`、`test/installer.test.js`
- `package.json`（`bmadExpert.frameworkFiles` 已有，不修改）

### Project Structure Notes

本故事修改/新建的文件：

```
bmad-expert/
├── cli.js                              ✏️  追加 import install；替换 install action
├── lib/
│   ├── installer.js                    ✏️  追加 import platform；实现 install()
│   └── adapters/
│       └── happycapy.js               ✏️  追加 import printSuccess；实现 install()
└── test/
    └── integration/
        └── happycapy.test.js          🆕  新建，3 个集成测试
```

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Story 2-3 的 `checkInstallStatus()` 已实现，`install()` 直接调用，无需重复逻辑
- `writeAgentFiles()` 不含进度输出插入点，`install()` 使用底层 `ensureDir`/`readFile`/`replaceTemplateVars`/`outputFile` 实现 Step 3 & 4
- 全部 6 个测试文件 90 个测试通过，含 3 个集成测试无回归

### File List

- `cli.js` — 追加 import install，替换 install action（去除动态 import）
- `lib/installer.js` — 追加 import platform，实现 install() 完整编排
- `lib/adapters/happycapy.js` — 追加 import printSuccess，实现 install() 平台注册
- `test/integration/happycapy.test.js` — 新建，3 个集成测试
