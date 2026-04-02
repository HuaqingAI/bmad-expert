# Story 6.3: --json 结构化输出模式

Status: review

## Story

As a AI（自动化调用方）,
I want 在 install/update/status 命令上传入 `--json` 参数获得结构化 JSON 输出,
so that 我可以通过编程方式解析执行结果，进行条件判断和错误处理，而不依赖文本解析。

## Acceptance Criteria

1. **Given** 执行 `npx bmad-expert install --json` 且安装成功
   **When** 进程完成
   **Then** stdout 输出单个合法 JSON 对象：`{"success": true, "platform": "happycapy", "agentId": "bmad-expert", "installPath": "...", "duration": N}`
   **And** stderr 无任何输出
   **And** 进程以 exit code 0 退出

2. **Given** 执行 `npx bmad-expert install --json` 且安装失败（BmadError 被捕获）
   **When** BmadError 被捕获
   **Then** stdout 输出单个合法 JSON 对象：`{"success": false, "errorCode": "E004", "errorMessage": "...", "fixSteps": [...], "retryable": true}`
   **And** stderr 无任何输出（JSON 模式下所有输出走 stdout）
   **And** 进程以对应分类 exit code 退出（FR40）

3. **Given** 执行 `npx bmad-expert update --json`
   **When** 更新成功
   **Then** stdout 输出 JSON：`{"success": true, "version": "X.X.X", "message": "..."}`
   **And** stderr 无任何输出

4. **Given** 执行 `npx bmad-expert update --json` 且更新失败
   **When** BmadError 被捕获
   **Then** stdout 输出错误 JSON（同 AC2 格式），stderr 无输出

5. **Given** JSON 模式启用时（任意命令 + `--json`）
   **When** 执行过程中产生 printProgress / printSuccess 调用
   **Then** 这些调用沉默（不向任何流输出），由 cli.js 统一控制 JSON 输出

6. **Given** 执行 `npm test`
   **When** 测试运行
   **Then** `test/json-mode.test.js` 中所有用例通过；`test/output.test.js` 新增测试通过；无回归

## Tasks / Subtasks

- [x] 修改 `lib/output.js`：新增 JSON 模式状态与输出函数 (AC: #1-5)
  - [x] 新增模块级 `let _jsonMode = false`
  - [x] 新增 `export function setJsonMode(enabled)` — 设置 JSON 模式开关
  - [x] 新增 `export function getJsonMode()` — 供 cli.js 读取当前模式
  - [x] 新增 `export function printJSON(data)` — 向 stdout 写 `JSON.stringify(data) + '\n'`
  - [x] 修改 `printProgress` / `printSuccess`：jsonMode=true 时提前 return（沉默）
  - [x] `printError` 不修改（JSON 模式下 cli.js 不调用它，而是调用 printJSON 输出错误）

- [x] 修改 `lib/installer.js`：`install()` 返回结构化数据 (AC: #1)
  - [x] 函数末尾返回 `{ platform: platformName, installPath: targetDir, duration }`
  - [x] 不改变现有 printSuccess 调用位置（json 模式由 cli.js 用 setJsonMode 屏蔽）

- [x] 修改 `lib/updater.js`：`update()` 返回结构化数据 (AC: #3)
  - [x] 函数末尾返回 `{ version: pkg.version, message: '已更新至 v..., 用户配置和 memory 完整保留。' }`
  - [x] 不改变现有 printSuccess 调用

- [x] 修改 `cli.js`：各命令新增 `--json` 选项，统一 JSON 模式控制 (AC: #1-5)
  - [x] `install` 命令新增 `.option('--json', '输出结构化 JSON 结果（AI 调用专用）')`
  - [x] install action：`if (options.json) setJsonMode(true)`；成功后 `if (options.json) printJSON({success:true, ...result})`
  - [x] `update` 命令新增 `.option('--json', ...)`
  - [x] update action：同 install 模式；成功后 `printJSON({success:true, ...result})`
  - [x] `status` 命令新增 `.option('--json', ...)` 占位（命令本身仍 TODO）
  - [x] 顶层 `catch`：检测 JSON 模式；是则 `printJSON(buildErrorJson(err))` 到 stdout 并 exit；否则走原有 printError 路径

- [x] 新建 `test/json-mode.test.js`：JSON 模式完整测试 (AC: #6)
  - [x] install --json 成功：stdout 含合法 JSON，含 success/platform/agentId/installPath/duration；stderr 无输出
  - [x] install --json 失败（E004）：stdout 含错误 JSON，含 success:false/errorCode/errorMessage/fixSteps/retryable；stderr 无输出
  - [x] update --json 成功：stdout 含 JSON，含 success:true/version/message
  - [x] update --json 失败：stdout 含错误 JSON，stderr 无输出
  - [x] jsonMode=false（默认）时 printProgress/printSuccess 正常写 stdout

- [x] 修改 `test/output.test.js`：新增 setJsonMode/printJSON 测试 (AC: #6)
  - [x] setJsonMode(true) 后 printProgress 不写任何流
  - [x] setJsonMode(true) 后 printSuccess 不写任何流
  - [x] printJSON 写入 stdout，内容为合法 JSON 字符串（含换行）
  - [x] setJsonMode(false) 还原后 printProgress/printSuccess 恢复正常
  - [x] 每个 test 前后用 setJsonMode(false) 重置状态（防串测试）

## Dev Notes

### 关键约束（必须遵守，否则破坏架构一致性）

1. **JSON 模式下所有输出走 stdout**：包含成功 JSON 和错误 JSON，stderr 保持完全空白
2. **禁止在 lib 模块内直接判断 jsonMode**：仅 `output.js` 感知模式（printProgress/printSuccess 自动沉默），`installer.js`/`updater.js` 不引入 jsonMode 判断
3. **`printError` 不修改**：JSON 模式下 cli.js 不再调用 printError，而是直接 printJSON 错误对象
4. **返回值约定**：`install()` 和 `update()` 必须 return 结构化数据供 cli.js 使用
5. **具名导出**：新增的 `setJsonMode`、`getJsonMode`、`printJSON` 均为具名导出，禁止 default export
6. **测试状态隔离**：每个测试后必须 reset jsonMode=false，防止模块状态污染其他测试

### JSON 输出结构（架构文档权威定义）

**install 成功（stdout）：**
```json
{
  "success": true,
  "platform": "happycapy",
  "agentId": "bmad-expert",
  "installPath": "/home/user/.happycapy/agents/bmad-expert",
  "duration": 38
}
```

**任意命令失败（stdout）：**
```json
{
  "success": false,
  "errorCode": "E004",
  "errorMessage": "文件写入失败（权限不足）",
  "fixSteps": ["手动创建目录...", "重新执行..."],
  "retryable": true
}
```

**update 成功（stdout）：**
```json
{
  "success": true,
  "version": "0.1.0",
  "message": "已更新至 v0.1.0，用户配置和 memory 完整保留。"
}
```

**非 BmadError 普通 Error 失败（stdout）：**
```json
{
  "success": false,
  "errorCode": "E001",
  "errorMessage": "<err.message>",
  "fixSteps": [],
  "retryable": false
}
```

### output.js 修改实现

```javascript
// lib/output.js 新增部分

let _jsonMode = false

export function setJsonMode(enabled) {
  _jsonMode = !!enabled
}

export function getJsonMode() {
  return _jsonMode
}

export function printJSON(data) {
  process.stdout.write(JSON.stringify(data) + '\n')
}

// printProgress 修改：
export function printProgress(message, done = false) {
  if (_jsonMode) return  // JSON 模式沉默
  if (done) {
    process.stdout.write(chalk.green(' ✓') + '\n')
  } else {
    process.stdout.write(message)
  }
}

// printSuccess 修改：
export function printSuccess(message) {
  if (_jsonMode) return  // JSON 模式沉默
  process.stdout.write('\n' + chalk.bold(message) + '\n')
}

// printError 不修改 — JSON 模式下 cli.js 不调用它
```

### installer.js 修改（最小改动）

```javascript
// install() 函数末尾，在 printSuccess 之后添加 return：
export async function install(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert' } = options
  const startTime = Date.now()

  // ... 现有逻辑不变 ...

  const duration = Math.round((Date.now() - startTime) / 1000)
  printSuccess(`安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。...`)

  // 新增返回值（json 模式下 printSuccess 已沉默，cli.js 用此数据输出 JSON）
  return { platform: platformName, installPath: targetDir, agentId, duration }
}
```

注意：`platformName` 已在函数中定义（`const platformName = await detectPlatform(platformOverride)`），`targetDir` 也已定义（`const targetDir = adapter.getInstallPath(agentId)`）。

### updater.js 修改（最小改动）

```javascript
// update() 函数末尾 printSuccess 之后添加 return：
export async function update(options = {}) {
  // ... 现有逻辑不变 ...
  const successMsg = `已更新至 v${pkg.version}，用户配置和 memory 完整保留。`
  printSuccess(successMsg)

  // 新增返回值
  return { version: pkg.version, message: successMsg }
}
```

### cli.js 修改

```javascript
import { setJsonMode, getJsonMode, printJSON, printError } from './lib/output.js'

// install 命令
program
  .command('install')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  // ... 其他 option 不变 ...
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await install({
      platform: options.platform ?? null,
      agentId: options.agentId,
      yes: options.yes ?? false,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

// update 命令
program
  .command('update')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await update({
      platform: options.platform ?? null,
      agentId: options.agentId,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

// status 命令（占位，--json 选项先加上）
program
  .command('status')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(() => {
    // TODO: Story 6.2 实现
  })

// 顶层 catch（替换现有实现）：
program.parseAsync().catch(err => {
  if (getJsonMode()) {
    // JSON 模式：所有错误走 stdout，stderr 保持空白
    if (err instanceof BmadError && err.bmadCode === 'E006') {
      printJSON({ success: true, alreadyInstalled: true })
      process.exit(EXIT_CODES.ALREADY_INSTALLED)
    }
    const errorJson = err instanceof BmadError
      ? {
          success: false,
          errorCode: err.bmadCode,
          errorMessage: err.message,
          fixSteps: err.fixSteps ?? [],
          retryable: err.retryable ?? false,
        }
      : {
          success: false,
          errorCode: 'E001',
          errorMessage: err.message,
          fixSteps: [],
          retryable: false,
        }
    printJSON(errorJson)
    process.exit(
      err instanceof BmadError
        ? (CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
        : EXIT_CODES.GENERAL_ERROR
    )
  } else {
    // 原有逻辑不变
    if (err instanceof BmadError && err.bmadCode === 'E006') {
      process.exit(EXIT_CODES.ALREADY_INSTALLED)
    } else {
      printError(err)
      process.exit(
        err instanceof BmadError
          ? (CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
          : EXIT_CODES.GENERAL_ERROR
      )
    }
  }
})
```

### test/json-mode.test.js 骨架

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setJsonMode, getJsonMode, printJSON, printProgress, printSuccess } from '../lib/output.js'

// mock output.js 中用到的 chalk 即可，或直接测真实 output.js

vi.mock('../lib/installer.js', () => ({
  install: vi.fn().mockResolvedValue({
    platform: 'happycapy',
    agentId: 'bmad-expert',
    installPath: '/home/user/.happycapy/agents/bmad-expert',
    duration: 5,
  }),
  checkInstallStatus: vi.fn(),
  replaceTemplateVars: vi.fn((c) => c),
  writeAgentFiles: vi.fn(),
}))

vi.mock('../lib/updater.js', () => ({
  update: vi.fn().mockResolvedValue({
    version: '0.1.0',
    message: '已更新至 v0.1.0，用户配置和 memory 完整保留。',
  }),
}))

vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn(),
}))

describe('JSON 模式 — output.js', () => {
  afterEach(() => setJsonMode(false))  // 每次重置

  it('setJsonMode(true) 后 printProgress 不写任何流', ...)
  it('setJsonMode(true) 后 printSuccess 不写任何流', ...)
  it('printJSON 写入 stdout 合法 JSON + 换行', ...)
  it('setJsonMode(false) 后 printProgress 恢复正常写 stdout', ...)
  it('getJsonMode 返回当前 JSON 模式状态', ...)
})

describe('JSON 模式 — install --json', () => {
  // 测试 cli.js action 逻辑（通过直接 import 测 output 函数 + mock install）
  it('成功时 stdout 含 success:true/platform/agentId/installPath/duration', ...)
  it('成功时 stderr 无任何输出', ...)
  it('失败时 stdout 含 success:false/errorCode/errorMessage/fixSteps/retryable', ...)
  it('失败时 stderr 无任何输出', ...)
})

describe('JSON 模式 — update --json', () => {
  it('成功时 stdout 含 success:true/version/message', ...)
  it('失败时 stdout 含错误 JSON，stderr 无输出', ...)
})
```

**测试策略说明：** `json-mode.test.js` 优先测试 `output.js` 函数行为（直接 import），CLI 集成逻辑通过 mock install/update 模块测试。不需要运行真实 Commander，用 spy stdout/stderr 验证输出流。

### 注意：E006（ALREADY_INSTALLED）的 JSON 模式处理

JSON 模式下，E006 不应报错，而应视为成功响应（已安装）。建议输出：
```json
{"success": true, "alreadyInstalled": true}
```
并以 exit code 6 退出（不改变 exit code 语义，让调用方自行判断）。

### Project Structure Notes

**修改文件：**
```
lib/output.js          ← 新增 setJsonMode/getJsonMode/printJSON；修改 printProgress/printSuccess
lib/installer.js       ← install() 添加 return 语句
lib/updater.js         ← update() 添加 return 语句
cli.js                 ← 各命令新增 --json 选项；顶层 catch 处理 JSON 模式
```

**新建文件：**
```
test/json-mode.test.js ← JSON 模式专项测试
```

**不修改文件（避免回归）：**
```
lib/errors.js          ← BmadError 类不变
lib/platform.js        ← 平台检测不变
lib/adapters/          ← 适配器不变
test/output.test.js    ← 仅新增测试，不修改现有用例
test/installer.test.js ← installer mock 中需加 return value，但不改测试内容
test/updater.test.js   ← updater mock 中需加 return value，不改现有用例逻辑
```

**installer.test.js / updater.test.js 的 mock 兼容性：**
- 这两个测试文件 mock 了 output.js（printProgress/printSuccess 均为 vi.fn()），不会受到 _jsonMode 状态影响
- updater.test.js 中 `update()` 的 return value 新增不影响现有断言（断言均针对 mock 函数调用，不检查 return value）

### References

- JSON 输出结构权威定义: [Source: `_bmad-output/planning-artifacts/architecture.md` → "格式规范 → JSON 输出结构"]
- FR40 —json 结构化输出: [Source: `_bmad-output/planning-artifacts/epics.md` → "Epic 6 → Story 6.3 AC"]
- 架构强制规则 6 条: [Source: `_bmad-output/planning-artifacts/architecture.md` → "执行规范"]
- stdout/stderr 分离规则: [Source: `_bmad-output/planning-artifacts/architecture.md` → "格式规范 → stdout vs stderr"]
- 错误传播模式: [Source: `_bmad-output/planning-artifacts/architecture.md` → "错误处理模式"]
- 现有 output.js: [Source: `lib/output.js`]
- 现有 cli.js 顶层 catch: [Source: `cli.js:79-92`]
- 现有 installer.js install(): [Source: `lib/installer.js:87-149`]
- 现有 updater.js update(): [Source: `lib/updater.js`]
- Story 6.1 测试 mock 模式参考: [Source: `test/updater.test.js`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 新增 `lib/output.js` 中 `setJsonMode`/`getJsonMode`/`printJSON` 三个导出函数；`printProgress`/`printSuccess` JSON 模式下提前 return（沉默）；`printError` 不改动。
- 修改 `lib/installer.js#install()`：末尾返回 `{ platform, agentId, installPath, duration }` 结构化数据。
- 修改 `lib/updater.js#update()`：末尾返回 `{ version, message }` 结构化数据。
- 修改 `cli.js`：install/update/status 命令各新增 `--json` 选项；顶层 catch 增加 JSON 模式分支（成功/失败/E006 均输出 JSON 到 stdout，stderr 保持空白）。
- 新建 `test/json-mode.test.js`：43 个用例，覆盖 setJsonMode/getJsonMode/printJSON/printProgress/printSuccess JSON 模式行为，install --json 成功/失败场景，update --json 成功/失败场景。
- 修改 `test/output.test.js`：新增 14 个 JSON 模式相关用例；在 beforeEach/afterEach 中重置 jsonMode 防止测试污染。
- 修改 `test/integration/happycapy.test.js`：将 `toBeUndefined()` 改为 `toBeDefined()`，适配 `install()` 现在有返回值的变更。
- 全测试：8 文件 172 用例，全部通过，零回归。

### File List

- lib/output.js（修改）
- lib/installer.js（修改）
- lib/updater.js（修改）
- cli.js（修改）
- test/json-mode.test.js（新建）
- test/output.test.js（修改）
- test/integration/happycapy.test.js（修改）
- _bmad-output/implementation-artifacts/6-3-json-output-mode.md（新建）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）
