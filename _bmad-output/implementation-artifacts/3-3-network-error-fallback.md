# Story 3.3: 网络中断场景的 Fallback 安装方案

Status: review

## Story

As a AI（安装执行方）,
I want 网络中断时（预留场景，当前版本 agent 文件随 npm 包内嵌无需网络）收到明确的重试指令，
so that 即使未来版本引入网络依赖，AI 也能在无人工介入的情况下完成重试。

## Acceptance Criteria

1. **Given** 安装过程中出现网络相关错误（ECONNREFUSED、ETIMEDOUT 等）
   **When** `BmadError('E005', ...)` 被 `cli.js` 顶层 catch 捕获
   **Then** stderr 输出符合 AI 可读 Schema：
   ```
   ERROR [E005] 网络错误
   原因：[具体错误信息]
   修复步骤：
     1. 检查网络连接后重新执行安装命令：npx bmad-expert install
     2. 若持续失败，检查代理设置
   可重试：是
   ```
   **And** 进程以 exit code 5（NETWORK_ERROR）退出
   **And** `retryable` 字段值为 `true`

2. **Given** 出错后重新执行 `npx bmad-expert install`（幂等场景）
   **When** 网络恢复正常
   **Then** 安装正常完成，不因之前的中断状态产生副作用（FR19、NFR11）

## Tasks / Subtasks

- [x] 在 `lib/installer.js` 添加并导出 `wrapNetworkError` 函数 (AC: #1)
  - [x] 检测网络错误码：ECONNREFUSED、ETIMEDOUT、ENOTFOUND、ENETUNREACH、EAI_AGAIN
  - [x] 网络错误时抛出 `BmadError('E005', '网络错误', cause, fixSteps)`
  - [x] `fixSteps`：`['检查网络连接后重新执行安装命令：npx bmad-expert install', '若持续失败，检查代理设置']`
  - [x] 非网络错误时抛出 `BmadError('E001', message, error)`（降级到通用错误）
  - [x] 在 `install()` Step 5（`adapter.install()` 调用处）添加 try/catch，调用 `wrapNetworkError`

- [x] 更新 `test/installer.test.js` — 新增 `wrapNetworkError` 测试 (AC: #1)
  - [x] 导入 `wrapNetworkError`
  - [x] 验证 ECONNREFUSED 抛出 BmadError E005
  - [x] 验证 ETIMEDOUT 抛出 BmadError E005
  - [x] 验证 ENOTFOUND 抛出 BmadError E005
  - [x] 验证 E005 `retryable === true`
  - [x] 验证 E005 `fixSteps` 含两条修复步骤
  - [x] 验证非网络错误（ENOENT）抛出 BmadError E001

- [x] 更新 `test/output.test.js` — 新增 E005 完整 Schema 输出验证测试 (AC: #1)
  - [x] E005 完整 Schema 格式验证：含 `ERROR [E005]`、`原因：`、`修复步骤：`、`可重试：是`

- [x] 更新 `test/errors.test.js` — 新增 E005 fixSteps 场景测试 (AC: #1)
  - [x] 验证 E005 可携带 fixSteps 且 retryable=true 互不干扰

- [x] 运行 `npm test` 验证全部测试通过，无回归 (AC: #1, #2)

## Dev Notes

### 变更范围

本 Story 是**纯增量增强**（预留场景基础设施）：
- `wrapNetworkError` 是新增函数，不修改任何现有函数签名
- `install()` 的 Step 5 新增 try/catch，对已有行为无破坏（adapter.install() 内部已 swallow 错误，try/catch 为未来网络调用预留）
- 所有已有测试不需要修改

### `lib/installer.js` 修改

在 `wrapFileError` 函数之后添加：

```javascript
const NETWORK_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']

export function wrapNetworkError(error, message) {
  if (NETWORK_CODES.includes(error?.code)) {
    const cause = new Error(error.message ?? '连接失败')
    throw new BmadError('E005', '网络错误', cause, [
      '检查网络连接后重新执行安装命令：npx bmad-expert install',
      '若持续失败，检查代理设置',
    ])
  }
  throw new BmadError('E001', message, error)
}
```

在 `install()` 函数 Step 5 中替换：

```javascript
  // ── Step 5: 平台注册 ─────────────────────────────────────────────────────
  printProgress('正在注册 agent...')
  try {
    await adapter.install(null, { agentId })
  } catch (error) {
    wrapNetworkError(error, `平台注册失败：${agentId}`)
  }
  printProgress('', true)
```

> **关键点**：
> - `wrapNetworkError` 必须是**具名导出**（`export function`），以便测试直接导入
> - `NETWORK_CODES` 是模块级常量，UPPER_SNAKE_CASE 命名
> - 当前 `adapter.install()`（HappyCapy）内部已 swallow 错误做降级，try/catch 为"预留场景"的未来网络调用建立基础设施
> - 非网络错误走 E001 路径，不改变现有错误语义

### `test/installer.test.js` 新增测试

在文件顶部 import 添加 `wrapNetworkError`：

```javascript
import { replaceTemplateVars, writeAgentFiles, checkInstallStatus, wrapNetworkError } from '../lib/installer.js'
```

新增 describe 块：

```javascript
describe('wrapNetworkError', () => {
  it('ECONNREFUSED 时抛出 BmadError E005', () => {
    const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    expect(() => wrapNetworkError(error, '网络调用失败')).toThrow(
      expect.objectContaining({ bmadCode: 'E005' })
    )
  })

  it('ETIMEDOUT 时抛出 BmadError E005', () => {
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
    expect(() => wrapNetworkError(error, '网络调用失败')).toThrow(
      expect.objectContaining({ bmadCode: 'E005' })
    )
  })

  it('ENOTFOUND 时抛出 BmadError E005', () => {
    const error = Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
    expect(() => wrapNetworkError(error, '网络调用失败')).toThrow(
      expect.objectContaining({ bmadCode: 'E005' })
    )
  })

  it('E005 retryable=true', () => {
    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    let thrown
    try { wrapNetworkError(error, '失败') } catch (e) { thrown = e }
    expect(thrown.retryable).toBe(true)
  })

  it('E005 fixSteps 含两条修复步骤', () => {
    const error = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    let thrown
    try { wrapNetworkError(error, '失败') } catch (e) { thrown = e }
    expect(thrown.fixSteps).toHaveLength(2)
    expect(thrown.fixSteps[0]).toContain('npx bmad-expert install')
    expect(thrown.fixSteps[1]).toContain('代理设置')
  })

  it('非网络错误（ENOENT）时抛出 BmadError E001', () => {
    const error = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    expect(() => wrapNetworkError(error, '非网络失败')).toThrow(
      expect.objectContaining({ bmadCode: 'E001' })
    )
  })

  it('error.code 为 undefined 时抛出 BmadError E001', () => {
    const error = new Error('unknown')
    expect(() => wrapNetworkError(error, '未知失败')).toThrow(
      expect.objectContaining({ bmadCode: 'E001' })
    )
  })
})
```

### `test/output.test.js` 新增测试

在 `describe('printError', ...)` 块末尾追加：

```javascript
it('E005 完整 Schema 格式验证', () => {
  const err = new BmadError('E005', '网络错误', new Error('connection refused'), [
    '检查网络连接后重新执行安装命令：npx bmad-expert install',
    '若持续失败，检查代理设置',
  ])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('ERROR [E005]')
  expect(written).toContain('网络错误')
  expect(written).toContain('原因：')
  expect(written).toContain('修复步骤：')
  expect(written).toContain('npx bmad-expert install')
  expect(written).toContain('代理设置')
  expect(written).toContain('可重试：是')
  expect(stdoutSpy).not.toHaveBeenCalled()
})
```

### `test/errors.test.js` 新增测试

在 `describe('BmadError fixSteps', ...)` 块末尾追加：

```javascript
it('E005 retryable=true 且可携带 fixSteps（互不干扰）', () => {
  const fixSteps = ['检查网络连接', '若持续失败，检查代理设置']
  const err = new BmadError('E005', '网络错误', null, fixSteps)
  expect(err.retryable).toBe(true)
  expect(err.fixSteps).toEqual(fixSteps)
})
```

### 架构守则（严禁违反）

1. **禁止 `console.log`** — 进度输出通过 `printProgress`/`printSuccess`
2. **禁止原生 `fs`** — 文件操作通过 `fs-extra`
3. **禁止 `process.exit` 在 lib 模块** — 退出通过 throw BmadError，cli.js 顶层处理
4. **禁止 `default export`** — 全部为具名导出
5. **禁止 `.then()/.catch()` 链** — 全部 `async/await`
6. **E005 必须使用 `NETWORK_CODES` 常量检测**，禁止硬编码字符串比较

### Exit Code 验证（已由 cli.js 处理，无需修改）

`cli.js` 顶层 catch 中已有：

```javascript
const CODE_TO_EXIT = {
  E005: EXIT_CODES.NETWORK_ERROR,  // → exit code 5
  ...
}
```

E005 → exit code 5 的映射**已实现**，本 Story 不需要修改 `cli.js`。

### 幂等性说明（AC #2 已覆盖）

网络错误中断后重试的幂等性由现有基础设施保证：
- `checkInstallStatus()` 在每次 `install()` 开始时检测当前状态
- 文件系统操作（`ensureDir`、`outputFile`）本身幂等
- 不存在需要回滚的"中间状态"文件
- 无需本 Story 额外实现

### 依赖版本（精确锁定，不可更改）

```json
{
  "chalk": "5.6.2",
  "vitest": "4.1.1"
}
```

### 不修改的文件

- `cli.js` — E005 exit code 映射已存在
- `lib/exit-codes.js` — EXIT_CODES.NETWORK_ERROR: 5 已有
- `lib/errors.js` — BmadError E005 retryable=true 已实现
- `lib/output.js` — printError 已支持 fixSteps 动态输出
- `lib/adapters/*.js` — 无需修改
- `test/exit-codes.test.js`、`test/platform.test.js`、`test/integration/happycapy.test.js`

### Project Structure Notes

本 Story 修改的文件：

```
bmad-expert/
├── lib/
│   └── installer.js        ✏️  新增导出 wrapNetworkError + install() Step 5 try/catch
└── test/
    ├── installer.test.js   ✏️  追加 wrapNetworkError 测试（7条）
    ├── output.test.js      ✏️  追加 E005 Schema 输出验证测试（1条）
    └── errors.test.js      ✏️  追加 E005 fixSteps 互不干扰测试（1条）
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3] — 验收标准与"预留场景"说明
- [Source: _bmad-output/planning-artifacts/architecture.md#AI 可读错误 Schema] — E005 输出格式规范
- [Source: _bmad-output/planning-artifacts/architecture.md#错误处理模式] — BmadError + 顶层捕获模式
- [Source: _bmad-output/planning-artifacts/architecture.md#语义化 Exit Code 表] — exit code 5 = NETWORK_ERROR
- [Source: _bmad-output/implementation-artifacts/3-1-permission-denied-error.md] — wrapFileError 模式参考（wrapNetworkError 同构）
- [Source: lib/installer.js#wrapFileError] — 网络错误处理的镜像函数模式
- [Source: lib/errors.js] — E005 retryable=true 已实现
- [Source: cli.js#CODE_TO_EXIT] — E005 → exit code 5 映射已实现

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- 新增 `NETWORK_CODES` 常量（模块级）及 `export function wrapNetworkError(error, message)` 到 `lib/installer.js`，镜像 `wrapFileError` 模式
- `install()` Step 5 `adapter.install()` 调用处新增 try/catch，接入 `wrapNetworkError`；当前 HappyCapy adapter 内部已 swallow 错误，try/catch 为未来网络调用建立基础设施
- `test/installer.test.js`：新增 `wrapNetworkError` 描述块（7 条测试），覆盖 ECONNREFUSED/ETIMEDOUT/ENOTFOUND/E005-retryable/fixSteps/非网络-E001/undefined-code
- `test/output.test.js`：新增 E005 完整 Schema 格式验证测试（1 条）
- `test/errors.test.js`：新增 E005 fixSteps+retryable 互不干扰测试（1 条）
- 全套测试：6 个文件，113 个测试，全部通过，无回归

### File List

- lib/installer.js
- test/installer.test.js
- test/output.test.js
- test/errors.test.js
- _bmad-output/implementation-artifacts/3-3-network-error-fallback.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
