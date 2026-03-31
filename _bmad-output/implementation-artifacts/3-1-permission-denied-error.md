# Story 3.1: 权限拒绝错误的结构化输出与备选路径

Status: review

## Story

As a AI（安装执行方）,
I want 沙盒权限拒绝时接收到包含错误码、原因和备选安装路径命令的结构化 stderr 输出，
so that 我可以无需人工介入，自主执行 fix 步骤完成安装修复。

## Acceptance Criteria

1. **Given** 写入 `~/.happycapy/agents/bmad-expert/` 时遇到权限拒绝（EACCES）
   **When** `BmadError('E004', ...)` 被 `cli.js` 顶层 catch 捕获
   **Then** stderr 输出符合 AI 可读 Schema：
   ```
   ERROR [E004] 文件写入失败（权限不足）
   原因：沙盒限制写入路径 /xxx
   修复步骤：
     1. 手动创建并授权目标目录：mkdir -p ~/.happycapy/agents/bmad-expert
     2. 确认路径权限后重新执行：npx bmad-expert install
   可重试：是
   ```
   **And** stdout 无任何内容
   **And** 进程以 exit code 4（PERMISSION_DENIED）退出（FR31）
   **And** `retryable` 字段值为 `true`（FR15）

2. **Given** `test/errors.test.js` 覆盖 E004 错误场景
   **When** 运行 `npm test`
   **Then** 权限错误的 Schema 格式、exit code、retryable 值、fixSteps 测试全部通过

## Tasks / Subtasks

- [x] 扩展 `lib/errors.js` — 为 `BmadError` 添加 `fixSteps` 属性 (AC: #1, #2)
  - [x] 在构造函数签名中添加第四个参数 `fixSteps = []`
  - [x] 赋值 `this.fixSteps = Array.isArray(fixSteps) ? fixSteps : []`

- [x] 更新 `lib/output.js` — `printError` 使用 `err.fixSteps` 输出修复步骤 (AC: #1)
  - [x] 从 `err.fixSteps` 读取步骤数组；若为空则回退到 `['检查错误原因并重试']`
  - [x] 格式化为 `  1. 步骤一\n  2. 步骤二` 形式输出
  - [x] 确保 stderr/stdout 路由规则不变

- [x] 更新 `lib/installer.js` — `wrapFileError` 对 EACCES/EPERM 附加 fixSteps (AC: #1)
  - [x] 检测 `error?.code === 'EACCES' || error?.code === 'EPERM'`
  - [x] E004 时 message 标准化为 `'文件写入失败（权限不足）'`
  - [x] 用 `error.path ?? message` 构造原因描述 cause message
  - [x] 传入两条 fixSteps：`mkdir -p` 命令 + 重试命令

- [x] 更新 `test/errors.test.js` — 新增 E004 fixSteps 及 Schema 格式测试 (AC: #2)
  - [x] 验证 `new BmadError('E004', ..., fixSteps)` 的 `fixSteps` 属性等于传入数组
  - [x] 验证不传第四参数时 `fixSteps` 默认为空数组 `[]`

- [x] 更新 `test/output.test.js` — 新增 fixSteps 输出测试 (AC: #1, #2)
  - [x] 验证 `printError` 对含 `fixSteps` 的 BmadError 将步骤写入 stderr
  - [x] 验证 `printError` 对不含 `fixSteps`（空数组）的 BmadError 输出默认步骤
  - [x] 验证 stderr 格式包含 `修复步骤：` 字段

- [x] 运行 `npm test` 验证全部测试通过，无回归 (AC: #2)

## Dev Notes

### 变更范围

本 Story 是**纯增量增强**：
- `BmadError` 新增可选第四参数 `fixSteps`，不改变现有调用签名（向后兼容）
- `printError` 的输出格式在无 fixSteps 时与之前完全一致（回退默认步骤）
- `wrapFileError` 仅对 EACCES/EPERM 分支做增强，E001 分支不变

### `lib/errors.js` 修改

在构造函数中添加第四参数：

```javascript
export class BmadError extends Error {
  constructor(code, message, cause, fixSteps = []) {
    super(message)
    this.name = 'BmadError'
    this.bmadCode = code
    this.cause = cause
    this.retryable = ['E004', 'E005'].includes(code)
    this.fixSteps = Array.isArray(fixSteps) ? fixSteps : []
  }
}
```

> **关键点**：`fixSteps` 是第四参数且有默认值 `[]`，现有所有 `new BmadError(code, message, cause)` 调用无需修改。

### `lib/output.js` 修改

`printError` 函数中替换硬编码步骤为动态步骤：

```javascript
export function printError(err) {
  if (err instanceof BmadError) {
    const retryableText = err.retryable ? '是' : '否'
    const causeMsg = err.cause?.message ?? '未知原因'
    const steps = err.fixSteps?.length > 0 ? err.fixSteps : ['检查错误原因并重试']
    const stepsLines = steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    const output = [
      `ERROR [${err.bmadCode}] ${err.message}`,
      `原因：${causeMsg}`,
      `修复步骤：`,
      stepsLines,
      `可重试：${retryableText}`,
    ].join('\n') + '\n'
    process.stderr.write(output)
  } else {
    process.stderr.write(`ERROR ${err.message}\n`)
  }
}
```

> **无需修改导入**：chalk 仍用于进度输出，BmadError 已导入。

### `lib/installer.js` 修改

替换 `wrapFileError` 函数：

```javascript
function wrapFileError(error, message) {
  const isPermissionError = error?.code === 'EACCES' || error?.code === 'EPERM'
  if (isPermissionError) {
    const blockedPath = error.path ?? message
    const cause = new Error(`沙盒限制写入路径 ${blockedPath}`)
    throw new BmadError('E004', '文件写入失败（权限不足）', cause, [
      `手动创建并授权目标目录：mkdir -p ~/.happycapy/agents/bmad-expert`,
      `确认路径权限后重新执行：npx bmad-expert install`,
    ])
  }
  throw new BmadError('E001', message, error)
}
```

> **注意**：
> - Node.js 文件系统错误对象有 `.path` 属性（string），直接指向发生错误的路径
> - E004 的 `cause` 不再直接传 OS error，而是包装为人类/AI 可读的描述。原始 OS error 丢弃——这在调试时可考虑日志，但架构约束禁止在 lib 直接 console，保持简洁
> - E001 分支行为不变，仍传原始 error 和 message

### `test/errors.test.js` 新增测试

在已有测试之后追加（不修改现有测试）：

```javascript
describe('BmadError fixSteps', () => {
  it('传入 fixSteps 数组时正确保存', () => {
    const fixSteps = ['步骤一：执行 X', '步骤二：执行 Y']
    const err = new BmadError('E004', '权限不足', null, fixSteps)
    expect(err.fixSteps).toEqual(fixSteps)
  })

  it('不传第四参数时 fixSteps 默认为空数组', () => {
    const err = new BmadError('E004', '权限不足', null)
    expect(err.fixSteps).toEqual([])
  })

  it('传入非数组时 fixSteps 被规范化为空数组', () => {
    const err = new BmadError('E004', '权限不足', null, '无效')
    expect(err.fixSteps).toEqual([])
  })

  it('E004 retryable=true 且 fixSteps 独立（互不影响）', () => {
    const err = new BmadError('E004', '权限不足', null, ['步骤A'])
    expect(err.retryable).toBe(true)
    expect(err.fixSteps).toEqual(['步骤A'])
  })
})
```

### `test/output.test.js` 新增测试

在 `describe('printError', ...)` 块末尾追加：

```javascript
it('BmadError 含 fixSteps 时将步骤写入 stderr', () => {
  const err = new BmadError('E004', '文件写入失败（权限不足）', new Error('EACCES'), [
    '手动创建目标目录：mkdir -p ~/.happycapy/agents/bmad-expert',
    '确认权限后重新执行：npx bmad-expert install',
  ])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('手动创建目标目录')
  expect(written).toContain('确认权限后重新执行')
})

it('BmadError 无 fixSteps（空数组）时输出默认步骤', () => {
  const err = new BmadError('E001', '通用错误', null)
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('检查错误原因并重试')
})

it('stderr 包含"修复步骤："字段', () => {
  const err = new BmadError('E004', '权限错误', null, ['步骤一'])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('修复步骤：')
})

it('E004 完整 Schema 格式验证', () => {
  const err = new BmadError('E004', '文件写入失败（权限不足）', new Error('沙盒限制写入路径 /path'), [
    '手动创建并授权目标目录：mkdir -p ~/.happycapy/agents/bmad-expert',
    '确认路径权限后重新执行：npx bmad-expert install',
  ])
  printError(err)
  const written = stderrSpy.mock.calls.map(c => c[0]).join('')
  expect(written).toContain('ERROR [E004]')
  expect(written).toContain('文件写入失败（权限不足）')
  expect(written).toContain('原因：')
  expect(written).toContain('修复步骤：')
  expect(written).toContain('可重试：是')
  expect(stdoutSpy).not.toHaveBeenCalled()
})
```

### 架构守则（严禁违反）

1. **禁止 `console.log`** — 进度输出通过 `printProgress`/`printSuccess`
2. **禁止原生 `fs`** — 文件操作通过 `fs-extra`
3. **禁止 `process.exit` 在 lib 模块** — 退出通过 throw BmadError，cli.js 顶层处理
4. **禁止 `default export`** — 全部为具名导出
5. **禁止 `.then()/.catch()` 链** — 全部 `async/await`
6. **E006 特殊处理保持不变** — cli.js 顶层 catch 中 E006 不调用 printError，此逻辑不改

### Exit Code 验证（已由 cli.js 处理，无需修改）

`cli.js` 顶层 catch 中已有：
```javascript
const CODE_TO_EXIT = {
  E004: EXIT_CODES.PERMISSION_DENIED,  // → exit code 4
  ...
}
```
E004 → exit code 4 的映射**已实现**，本 Story 不需要修改 `cli.js`。

### 依赖版本（精确锁定，不可更改）

```json
{
  "chalk": "5.6.2",
  "vitest": "4.1.1"
}
```

### 不修改的文件

- `cli.js` — E004 exit code 映射已存在
- `lib/exit-codes.js` — EXIT_CODES.PERMISSION_DENIED 已有
- `lib/platform.js`、`lib/adapters/` — 无需修改
- `test/exit-codes.test.js`、`test/platform.test.js`、`test/installer.test.js`、`test/integration/happycapy.test.js`

### Project Structure Notes

本 Story 修改的文件：

```
bmad-expert/
├── lib/
│   ├── errors.js           ✏️  BmadError 构造函数添加 fixSteps 第四参数
│   ├── output.js           ✏️  printError 动态输出 fixSteps
│   └── installer.js        ✏️  wrapFileError EACCES 分支增加 fixSteps
└── test/
    ├── errors.test.js      ✏️  追加 fixSteps 相关测试（4条）
    └── output.test.js      ✏️  追加 fixSteps 输出验证测试（4条）
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] — 验收标准与 FR14-FR17 覆盖要求
- [Source: _bmad-output/planning-artifacts/architecture.md#AI 可读错误 Schema] — 错误输出格式规范
- [Source: _bmad-output/planning-artifacts/architecture.md#错误处理模式] — BmadError + 顶层捕获模式
- [Source: lib/errors.js] — BmadError 现有实现
- [Source: lib/output.js] — printError 现有实现
- [Source: lib/installer.js#wrapFileError] — 当前权限错误处理
- [Source: cli.js#CODE_TO_EXIT] — E004 → exit code 4 映射已实现

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `BmadError` 构造函数新增可选第四参数 `fixSteps = []`，向后兼容，所有现有调用无需修改
- `printError` 现在动态输出 `err.fixSteps`；无 fixSteps 时回退默认步骤，输出格式不变
- `wrapFileError` 对 EACCES/EPERM 错误：message 标准化为 "文件写入失败（权限不足）"，cause 包含路径信息，fixSteps 含两条可执行修复指令
- 两个已有 installer 测试（检查 `cause: permissionError`）更新为检查 `message: '文件写入失败（权限不足）'` 和 `retryable: true`，符合新行为意图
- `wrapFileError` EPERM 无 `.path` 属性时 cause 消息使用 `（路径未知）` 占位，避免路径显示为字符串描述
- `output.test.js` E004 Schema 验证测试新增 `沙盒限制写入路径` 断言，确保 cause 行格式符合 AC1 规范
- 全部 98 个测试通过（6 个测试文件），含 8 条新增测试，0 回归

### File List

- `lib/errors.js` — BmadError 构造函数新增 fixSteps 第四参数
- `lib/output.js` — printError 动态输出 fixSteps 数组
- `lib/installer.js` — wrapFileError EACCES/EPERM 分支增加标准化 message 与 fixSteps
- `test/errors.test.js` — 新增 4 条 BmadError fixSteps 测试
- `test/output.test.js` — 新增 4 条 printError fixSteps 输出验证测试
- `test/installer.test.js` — 更新 2 条 E004 测试以匹配新 cause 行为
