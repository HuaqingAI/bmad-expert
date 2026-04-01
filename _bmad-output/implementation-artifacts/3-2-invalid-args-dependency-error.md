# Story 3.2: 无效参数与依赖缺失错误处理

Status: review

## Story

As a AI（安装执行方）,
I want 传入非法 `--platform` 值或 Node.js 版本不足时，收到包含具体原因和修复步骤的结构化错误，
so that 我能精确判断错误类型并执行对应修复，不产生歧义。

## Acceptance Criteria

1. **Given** 执行 `npx bmad-expert install --platform unknown-platform`
   **When** 参数验证失败
   **Then** stderr 输出 `ERROR [E002] 无效参数: --platform 值 'unknown-platform' 不被支持\n修复步骤：\n  1. 使用支持的平台值：happycapy, cursor, claude-code\n可重试：否`
   **And** 进程以 exit code 2（INVALID_ARGS）退出

2. **Given** 当前 Node.js 版本低于 20.19
   **When** CLI 启动时版本检测失败
   **Then** stderr 输出 `ERROR [E003] 依赖缺失: Node.js 版本不足（当前 vX.X.X，需要 ≥20.19.0）\n修复步骤：\n  1. 升级 Node.js 至 20.19+ 或更高版本\n可重试：否`
   **And** 进程以 exit code 3（MISSING_DEPENDENCY）退出

3. **Given** `test/errors.test.js` 覆盖 E002、E003 场景
   **When** 运行 `npm test`
   **Then** 所有参数和依赖错误测试通过

## Tasks / Subtasks

- [x] 修改 `lib/platform.js` — 为 E002 无效 platform 错误添加 fixSteps (AC: #1, #3)
  - [x] 在 `detectPlatform()` 的 `!SUPPORTED_PLATFORMS.includes(platformOverride)` 分支中，为 BmadError('E002', ...) 添加第四参数 fixSteps
  - [x] fixSteps 内容：`['使用支持的平台值：happycapy, cursor, claude-code']`（动态从 `SUPPORTED_PLATFORMS.join(', ')` 生成）

- [x] 修改 `cli.js` — 在 `program.parseAsync()` 之前添加 Node.js 版本检查 (AC: #2, #3)
  - [x] 解析 `process.versions.node` 获取 `[major, minor]`
  - [x] 若 `major < 20 || (major === 20 && minor < 19)` 则调用 `printError` + `process.exit(EXIT_CODES.MISSING_DEPENDENCY)`
  - [x] 构造 BmadError('E003', `依赖缺失: Node.js 版本不足（当前 v${nodeVersion}，需要 ≥20.19.0）`, null, ['升级 Node.js 至 20.19+ 或更高版本'])

- [x] 更新 `test/platform.test.js` — 新增 E002 fixSteps 内容验证测试 (AC: #1, #3)
  - [x] 验证 `detectPlatform('unknown-platform')` 的 error.fixSteps 包含三个支持的平台名称
  - [x] 验证 error.retryable 为 false

- [x] 更新 `test/errors.test.js` — 新增 E002 和 E003 场景测试 (AC: #3)
  - [x] E002 BmadError 可携带 fixSteps、retryable=false
  - [x] E003 BmadError 可携带 fixSteps、retryable=false、bmadCode='E003'

- [x] 更新 `test/output.test.js` — 新增 E002 和 E003 Schema 格式验证 (AC: #1, #2, #3)
  - [x] E002 完整 Schema 验证：ERROR [E002]、参数错误消息、修复步骤、可重试：否、stdout 无输出
  - [x] E003 完整 Schema 验证：ERROR [E003]、版本不足消息、修复步骤、可重试：否、stdout 无输出

- [x] 运行 `npm test` 验证全部测试通过，无回归 (AC: #3)

## Dev Notes

### 变更范围（仅增量修改，不影响已有行为）

本 Story 是**增量增强**：
- `platform.js` 仅对 `!SUPPORTED_PLATFORMS.includes(platformOverride)` 分支的 E002 添加 fixSteps，其他两处 E002 抛出不变
- `cli.js` 添加版本检查代码，完全不改变现有安装流程
- BmadError/printError/exit code 机制**已经全部就绪**，无需修改

### `lib/platform.js` 修改

`detectPlatform()` 函数中，只修改第一个 E002 分支（无效平台名）：

```javascript
// 修改前
if (!SUPPORTED_PLATFORMS.includes(platformOverride)) {
  throw new BmadError(
    'E002',
    `无效参数: --platform 值 '${platformOverride}' 不被支持`,
    new Error(`支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`)
  )
}

// 修改后
if (!SUPPORTED_PLATFORMS.includes(platformOverride)) {
  throw new BmadError(
    'E002',
    `无效参数: --platform 值 '${platformOverride}' 不被支持`,
    new Error(`支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`),
    [`使用支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`]
  )
}
```

> **不修改**：Phase 1.5 未实现平台的 E002、自动检测失败的 E002 — 这两处不是本 Story AC 覆盖范围

### `cli.js` 修改

在 `program.parseAsync()` 调用之前插入版本检查，利用已存在的 `printError`、`BmadError`、`EXIT_CODES`：

```javascript
// 在 program.parseAsync() 调用前插入
const nodeVersion = process.versions.node
const [major, minor] = nodeVersion.split('.').map(Number)
if (major < 20 || (major === 20 && minor < 19)) {
  printError(new BmadError(
    'E003',
    `依赖缺失: Node.js 版本不足（当前 v${nodeVersion}，需要 ≥20.19.0）`,
    null,
    ['升级 Node.js 至 20.19+ 或更高版本']
  ))
  process.exit(EXIT_CODES.MISSING_DEPENDENCY)
}

program.parseAsync().catch(err => { ... })
```

> **关键点**：
> - 不封装为 lib 函数——版本检查属于 CLI 入口职责，cli.js 可以直接调用 `printError` + `process.exit`（架构约束限制的是 lib 模块，不是 cli.js）
> - E003 的 `cause` 设为 `null`：版本号已嵌入 message，无需另外提供 cause（printError 会输出"原因：未知原因"，这是可接受的）
> - E003 `retryable` 自动为 false（BmadError 仅对 E004/E005 设 true）

### `test/platform.test.js` 新增测试

在 `describe('detectPlatform()')` 中追加（紧随"platformOverride 非法时"相关测试之后）：

```javascript
it('无效 platform E002 包含 fixSteps（含三个支持平台名）', async () => {
  const err = await detectPlatform('unknown-platform').catch(e => e)
  expect(err.fixSteps).toHaveLength(1)
  expect(err.fixSteps[0]).toContain('happycapy')
  expect(err.fixSteps[0]).toContain('cursor')
  expect(err.fixSteps[0]).toContain('claude-code')
})

it('无效 platform E002 的 retryable 为 false', async () => {
  const err = await detectPlatform('unknown-platform').catch(e => e)
  expect(err.retryable).toBe(false)
})
```

### `test/errors.test.js` 新增测试

在文件末尾追加（与现有 `BmadError fixSteps` describe 并列）：

```javascript
describe('BmadError E002 场景', () => {
  it('E002 retryable=false 且支持传入 fixSteps', () => {
    const err = new BmadError('E002', "无效参数: --platform 值 'xxx' 不被支持", null, [
      '使用支持的平台值：happycapy, cursor, claude-code',
    ])
    expect(err.bmadCode).toBe('E002')
    expect(err.retryable).toBe(false)
    expect(err.fixSteps).toHaveLength(1)
    expect(err.fixSteps[0]).toContain('happycapy')
  })
})

describe('BmadError E003 场景', () => {
  it('E003 bmadCode 正确且 retryable=false', () => {
    const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
      '升级 Node.js 至 20.19+ 或更高版本',
    ])
    expect(err.bmadCode).toBe('E003')
    expect(err.retryable).toBe(false)
  })

  it('E003 fixSteps 可传入且包含升级指令', () => {
    const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
      '升级 Node.js 至 20.19+ 或更高版本',
    ])
    expect(err.fixSteps).toHaveLength(1)
    expect(err.fixSteps[0]).toContain('20.19')
  })
})
```

### `test/output.test.js` 新增测试

在 `describe('printError', ...)` 块末尾追加：

```javascript
it('E002 完整 Schema 格式验证', () => {
  const err = new BmadError("E002", "无效参数: --platform 值 'unknown' 不被支持", null, [
    '使用支持的平台值：happycapy, cursor, claude-code',
  ])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('ERROR [E002]')
  expect(written).toContain("--platform 值 'unknown' 不被支持")
  expect(written).toContain('修复步骤：')
  expect(written).toContain('使用支持的平台值')
  expect(written).toContain('可重试：否')
  expect(stdoutSpy).not.toHaveBeenCalled()
})

it('E003 完整 Schema 格式验证', () => {
  const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
    '升级 Node.js 至 20.19+ 或更高版本',
  ])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('ERROR [E003]')
  expect(written).toContain('Node.js 版本不足')
  expect(written).toContain('修复步骤：')
  expect(written).toContain('升级 Node.js')
  expect(written).toContain('可重试：否')
  expect(stdoutSpy).not.toHaveBeenCalled()
})
```

### 现有代码状态（关键背景）

- **`lib/errors.js`**：`BmadError` 已支持第四参数 `fixSteps = []`，E002/E003 的 `retryable` 自动为 `false`（Story 3.1 完成）
- **`lib/output.js`**：`printError` 已支持动态输出 `fixSteps`（Story 3.1 完成）
- **`lib/exit-codes.js`**：`INVALID_ARGS: 2`、`MISSING_DEPENDENCY: 3` 已存在
- **`cli.js`**：`CODE_TO_EXIT.E002 = EXIT_CODES.INVALID_ARGS`、`CODE_TO_EXIT.E003 = EXIT_CODES.MISSING_DEPENDENCY` 已存在，顶层 catch 已实现
- **`lib/platform.js`**：E002 已在三处抛出，但都**没有 fixSteps**；本 Story 只为第一处（无效平台名）添加 fixSteps

### 架构守则（严禁违反）

1. **禁止 `console.log`** — 进度输出通过 `printProgress`/`printSuccess`，错误通过 `printError`
2. **禁止原生 `fs`** — 文件操作通过 `fs-extra`
3. **禁止 `process.exit` 在 lib 模块** — 仅 `cli.js` 可调用 `process.exit`
4. **禁止 `default export`** — 全部为具名导出
5. **禁止 `.then()/.catch()` 链** — 全部 `async/await`
6. **错误使用 BmadError** — 不可 `throw new Error()`

### Exit Code 映射（已就绪，无需修改）

```javascript
// cli.js 顶层 catch 中已有
E002: EXIT_CODES.INVALID_ARGS,       // → exit code 2
E003: EXIT_CODES.MISSING_DEPENDENCY, // → exit code 3
```

E003 的 exit code 路径：版本检查失败时直接 `process.exit(EXIT_CODES.MISSING_DEPENDENCY)`（不走 `program.parseAsync().catch`）

### 依赖版本（精确锁定，不可更改）

```json
{
  "chalk": "5.6.2",
  "vitest": "4.1.1"
}
```

### 不修改的文件

- `lib/errors.js` — BmadError 已支持 fixSteps，无需修改
- `lib/output.js` — printError 已支持 fixSteps 动态输出，无需修改
- `lib/exit-codes.js` — INVALID_ARGS/MISSING_DEPENDENCY 已存在
- `lib/installer.js` — 无需修改
- `lib/adapters/happycapy.js` — 无需修改
- `test/installer.test.js`、`test/integration/happycapy.test.js` — 无需修改

### Project Structure Notes

本 Story 修改的文件：

```
bmad-expert/
├── cli.js                    ✏️  添加 Node.js 版本检查（E003，在 parseAsync 之前）
├── lib/
│   └── platform.js           ✏️  detectPlatform 第一处 E002 添加 fixSteps
└── test/
    ├── platform.test.js      ✏️  追加 E002 fixSteps 内容验证测试（2条）
    ├── errors.test.js        ✏️  追加 E002 和 E003 场景测试（共3条）
    └── output.test.js        ✏️  追加 E002 和 E003 Schema 格式验证（2条）
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] — 验收标准与 FR14-FR18 覆盖要求
- [Source: _bmad-output/planning-artifacts/architecture.md#AI 可读错误 Schema] — 错误输出格式规范
- [Source: _bmad-output/planning-artifacts/architecture.md#CLI 接口与通信模式] — E002/E003 exit code 表
- [Source: _bmad-output/planning-artifacts/architecture.md#错误处理模式] — BmadError + 顶层捕获模式
- [Source: lib/platform.js#detectPlatform] — 现有 E002 抛出逻辑（三处，仅修改第一处）
- [Source: cli.js#CODE_TO_EXIT] — E002 → exit code 2、E003 → exit code 3 映射已实现
- [Source: lib/errors.js] — BmadError 已支持 fixSteps 第四参数（Story 3.1）
- [Source: lib/output.js#printError] — 已支持动态 fixSteps 输出（Story 3.1）
- [Source: _bmad-output/implementation-artifacts/3-1-permission-denied-error.md#Dev Agent Record] — 前序 Story 实现模式参考

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- node_modules 不在 worktree 中，创建 symlink 到主仓库 node_modules 解决

### Completion Notes List

- ✅ lib/platform.js: detectPlatform() 第一处 E002（无效平台名）添加 fixSteps，动态生成平台列表字符串
- ✅ cli.js: parseAsync() 前添加 Node.js 版本检查，major < 20 或 20.x < 20.19 时抛 E003 并 exit(3)
- ✅ test/platform.test.js: 新增 2 条 E002 fixSteps 内容验证测试
- ✅ test/errors.test.js: 新增 E002 场景（1条）和 E003 场景（2条）测试
- ✅ test/output.test.js: 新增 E002 和 E003 完整 Schema 格式验证（各1条）
- ✅ 全部 111 测试通过（6 个测试文件），无回归

### File List

- cli.js
- lib/platform.js
- test/platform.test.js
- test/errors.test.js
- test/output.test.js
- _bmad-output/implementation-artifacts/3-2-invalid-args-dependency-error.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
