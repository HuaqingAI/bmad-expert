# Story 1.2: 语义化 Exit Code 常量与 BmadError 类

Status: review

## Story

As a 开发者（AI agent）,
I want `lib/exit-codes.js` 中定义 7 个语义化 exit code 常量，以及 `lib/errors.js` 中的 BmadError 类,
so that 所有模块抛出错误时使用统一的对象结构，CLI 入口可通过错误类型决定退出码，消除硬编码数字。

## Acceptance Criteria

1. **Given** `lib/exit-codes.js` 已实现
   **When** 导入 EXIT_CODES
   **Then** 包含 7 个常量：SUCCESS(0)、GENERAL_ERROR(1)、INVALID_ARGS(2)、MISSING_DEPENDENCY(3)、PERMISSION_DENIED(4)、NETWORK_ERROR(5)、ALREADY_INSTALLED(6)
   **And** 全部使用 UPPER_SNAKE_CASE 命名，通过具名导出（Named Export）

2. **Given** `lib/errors.js` 已实现
   **When** 执行 `new BmadError('E004', '文件写入失败', originalError)`
   **Then** 返回的实例包含 `bmadCode: 'E004'`、`message: '文件写入失败'`、`cause: originalError`
   **And** `retryable` 属性对 E004、E005 为 true，其余为 false
   **And** BmadError 继承自 Error，`instanceof Error` 为 true

3. **Given** `test/errors.test.js` 和 `test/exit-codes.test.js` 已实现
   **When** 运行 `npm test`
   **Then** 所有测试通过，覆盖上述所有属性断言

## Tasks / Subtasks

- [x] 实现 `lib/exit-codes.js` (AC: #1)
  - [x] 替换当前占位内容（`export const EXIT_CODES = {}`）
  - [x] 定义 7 个 UPPER_SNAKE_CASE 常量：SUCCESS=0、GENERAL_ERROR=1、INVALID_ARGS=2、MISSING_DEPENDENCY=3、PERMISSION_DENIED=4、NETWORK_ERROR=5、ALREADY_INSTALLED=6
  - [x] 保持具名导出，无 default export

- [x] 实现 `lib/errors.js` (AC: #2)
  - [x] 替换当前占位内容（`export class BmadError extends Error {}`）
  - [x] 实现构造函数 `constructor(code, message, cause)`：调用 `super(message)`，设置 `this.bmadCode = code`、`this.cause = cause`、`this.name = 'BmadError'`
  - [x] 实现 `retryable` 属性：`this.retryable = ['E004', 'E005'].includes(code)`

- [x] 创建 `test/exit-codes.test.js` (AC: #3)
  - [x] 测试 EXIT_CODES 包含全部 7 个常量及正确值
  - [x] 测试每个常量值为整数类型
  - [x] 测试 SUCCESS=0、PERMISSION_DENIED=4、NETWORK_ERROR=5（边界值）

- [x] 创建 `test/errors.test.js` (AC: #3)
  - [x] 测试 `new BmadError('E004', 'msg', cause)` 的 bmadCode、message、cause 属性
  - [x] 测试 `instanceof Error` 为 true、`instanceof BmadError` 为 true
  - [x] 测试 `this.name === 'BmadError'`
  - [x] 测试 retryable：E004=true、E005=true、E001=false、E002=false、E003=false、E006=false
  - [x] 测试 cause 为 undefined 时不报错（无 originalError 场景）

- [x] 验证 (AC: #3)
  - [x] 执行 `npm test`，确认所有新测试通过，0 failures

## Dev Notes

### 关键实现细节

**lib/exit-codes.js 完整实现**

```javascript
// lib/exit-codes.js
// Exit Code 常量表 - Story 1.2 实现
// 约束：所有模块通过此常量引用退出码，禁止硬编码数字

export const EXIT_CODES = {
  SUCCESS: 0,           // 安装完成
  GENERAL_ERROR: 1,     // 未分类异常
  INVALID_ARGS: 2,      // --platform 值不合法
  MISSING_DEPENDENCY: 3,// Node.js/npm 版本不足
  PERMISSION_DENIED: 4, // 沙盒路径写入失败（可重试）
  NETWORK_ERROR: 5,     // 网络错误（预留，可重试）
  ALREADY_INSTALLED: 6, // 幂等检测：已有安装，跳过
}
```

**lib/errors.js 完整实现**

```javascript
// lib/errors.js
// BmadError 类 - Story 1.2 实现
// 约束：所有错误场景必须使用 BmadError，禁止直接 throw new Error()

export class BmadError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'BmadError'
    this.bmadCode = code                              // 'E001'~'E006'
    this.cause = cause                                // 原始错误对象（可 undefined）
    this.retryable = ['E004', 'E005'].includes(code)  // PERMISSION_DENIED / NETWORK_ERROR
  }
}
```

**BmadError 错误码对照表（bmadCode → EXIT_CODES key）**

| bmadCode | EXIT_CODES key     | 退出码 | retryable | 典型场景 |
|----------|-------------------|--------|-----------|--------|
| E001     | GENERAL_ERROR     | 1      | false     | 未分类异常 |
| E002     | INVALID_ARGS      | 2      | false     | 参数无效 |
| E003     | MISSING_DEPENDENCY| 3      | false     | Node 版本不足 |
| E004     | PERMISSION_DENIED | 4      | **true**  | 文件写入权限被拒 |
| E005     | NETWORK_ERROR     | 5      | **true**  | 网络中断（预留） |
| E006     | ALREADY_INSTALLED | 6      | false     | 幂等检测跳过 |

> 注意：cli.js 将在 Story 1.3 使用以上映射关系：`process.exit(EXIT_CODES[bmadCodeToExitKey(err.bmadCode)])`

### 架构守则（必须遵守）

- **ESM Only**：使用 `export const` / `export class`，禁止 `module.exports`
- **具名导出**：禁止 `export default`
- **单一职责**：`exit-codes.js` 仅定义常量，无逻辑；`errors.js` 仅定义错误类，不做输出或 process.exit
- **禁止在 lib 内 console.error 或 process.exit**：错误处理统一在 cli.js 顶层

### 测试模式（vitest）

```javascript
// test/exit-codes.test.js 示例
import { describe, it, expect } from 'vitest'
import { EXIT_CODES } from '../lib/exit-codes.js'

describe('EXIT_CODES', () => {
  it('contains all 7 constants with correct values', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0)
    expect(EXIT_CODES.PERMISSION_DENIED).toBe(4)
    expect(EXIT_CODES.NETWORK_ERROR).toBe(5)
  })
})

// test/errors.test.js 示例
import { describe, it, expect } from 'vitest'
import { BmadError } from '../lib/errors.js'

describe('BmadError', () => {
  it('sets all properties correctly', () => {
    const cause = new Error('original')
    const err = new BmadError('E004', '文件写入失败', cause)
    expect(err.bmadCode).toBe('E004')
    expect(err.message).toBe('文件写入失败')
    expect(err.cause).toBe(cause)
    expect(err.retryable).toBe(true)
    expect(err.name).toBe('BmadError')
    expect(err instanceof Error).toBe(true)
  })

  it('retryable is false for non-retryable codes', () => {
    expect(new BmadError('E001', 'msg').retryable).toBe(false)
    expect(new BmadError('E006', 'msg').retryable).toBe(false)
  })
})
```

### 来自 Story 1.1 的关键经验

- **vitest 配置**：`vitest.config.js` 已配置 `passWithNoTests: true` 和 `include: ['test/**/*.test.js']`，新增测试文件会自动被 vitest 识别，无需修改 vitest.config.js
- **ESLint flat config**：项目使用 `eslint.config.js`（非 `.eslintrc.js`），新文件遵循 `no-unused-vars` 规则，构造函数参数如果不用请用 `_` 前缀
- **lib/ 占位文件**：当前 `lib/exit-codes.js` 和 `lib/errors.js` 已存在且为占位内容，直接**替换文件内容**，不要新建文件

### Project Structure Notes

- 修改文件：`lib/exit-codes.js`（替换占位）、`lib/errors.js`（替换占位）
- 新建文件：`test/exit-codes.test.js`、`test/errors.test.js`
- 不修改：`cli.js`（cli.js 的 EXIT_CODES 集成在 Story 1.3 完成，配合 output.js）
- 不修改：`package.json`、`vitest.config.js`（1.1 已配置完毕，本故事无需变更）
- test/ 目录已存在（Story 1.1 创建），直接在其中创建 .test.js 文件

### References

- Story 1.2 验收标准：[Source: _bmad-output/planning-artifacts/epics.md#Story-1.2]
- Exit Code 表：[Source: _bmad-output/planning-artifacts/architecture.md#语义化-Exit-Code-表]
- BmadError 类定义：[Source: _bmad-output/planning-artifacts/architecture.md#错误传播]
- 模块职责单一原则：[Source: _bmad-output/planning-artifacts/architecture.md#每个-lib-模块职责单一]
- 架构守则（禁止直接 console.error）：[Source: _bmad-output/planning-artifacts/architecture.md#所有-AI-agents-必须遵守]
- Story 1.1 经验：[Source: _bmad-output/implementation-artifacts/1-1-npm-package-init.md#Debug-Log-References]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 全项目 lint 存在 4 个预存错误（lib/installer.js、lib/output.js），均为 Story 1.1 占位文件中的 unused vars，非本故事引入。Story 1.2 相关文件（lib/exit-codes.js、lib/errors.js、test/exit-codes.test.js、test/errors.test.js）零 lint 错误。

### Completion Notes List

- ✅ AC#1: EXIT_CODES 已实现 7 个 UPPER_SNAKE_CASE 常量（SUCCESS=0 至 ALREADY_INSTALLED=6），具名导出
- ✅ AC#2: BmadError 继承 Error，包含 name/bmadCode/cause/retryable 属性；E004、E005 retryable=true，其余 false
- ✅ AC#3: test/exit-codes.test.js（6 个测试）、test/errors.test.js（12 个测试）全部通过，18/18 pass，0 failures
- 遵循架构守则：ESM only，具名导出，单一职责，无 console.error/process.exit

### File List

- lib/exit-codes.js（修改：替换占位，实现 EXIT_CODES 常量）
- lib/errors.js（修改：替换占位，实现 BmadError 类）
- test/exit-codes.test.js（新建：EXIT_CODES 单元测试，6 个 test case）
- test/errors.test.js（新建：BmadError 单元测试，12 个 test case）
