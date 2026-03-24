# Story 1.3: 输出格式化模块（output.js）

Status: review

## Story

As a 开发者（AI agent）,
I want `lib/output.js` 提供统一的进度输出、成功确认输出、错误格式化输出三个函数,
so that 所有模块通过单一出口路由输出，stdout/stderr 分离规则在整个代码库中自动保证，AI caller 可可靠解析输出。

## Acceptance Criteria

1. **Given** `lib/output.js` 已实现 `printProgress(message)`、`printSuccess(message)`、`printError(bmadError)` 三个具名导出函数
   **When** 调用 `printProgress('正在检测平台...')`，随后操作完成后调用 `printProgress('正在检测平台...', true)`（标记完成）
   **Then** stdout 依次输出 `正在检测平台...` 和 ` ✓\n`，格式符合架构文档中的进度输出模式

2. **Given** 调用 `printError(new BmadError('E004', '文件写入失败', cause))`
   **When** 输出被路由
   **Then** 内容写入 stderr（非 stdout）
   **And** 格式符合 `ERROR [E004] 文件写入失败\n原因：...\n修复步骤：\n  1. ...\n可重试：是` 的 AI 可读 Schema
   **And** stdout 无任何内容输出

3. **Given** `test/output.test.js` 已实现，使用 vitest spy 捕获 process.stdout.write 和 process.stderr.write
   **When** 运行 `npm test`
   **Then** 所有输出路由测试通过

## Tasks / Subtasks

- [ ] 实现 `lib/output.js` - printProgress (AC: #1)

  - [ ] 替换 Story 1.1 留下的占位内容
  - [ ] 导入 chalk（ESM：`import chalk from 'chalk'`）
  - [ ] 实现 `printProgress(message, done = false)`：
    - `done = false` 时：`process.stdout.write(message)`
    - `done = true` 时：`process.stdout.write(' ✓\n')`
  - [ ] 使用具名导出（Named Export）

- [ ] 实现 `lib/output.js` - printSuccess (AC: #1)

  - [ ] 实现 `printSuccess(message)`：输出到 stdout，格式为 `\n${message}\n`（或含 chalk 高亮）

- [ ] 实现 `lib/output.js` - printError (AC: #2)

  - [ ] 实现 `printError(bmadError)`：全部写入 stderr（`process.stderr.write`）
  - [ ] 格式化输出 AI 可读 Schema：
    ```
    ERROR [E{code}] {message}
    原因：{cause.message 或 '未知原因'}
    修复步骤：
      1. {step1}
      2. {step2（如有）}
    可重试：{retryable ? '是' : '否'}
    ```
  - [ ] 对非 BmadError 的普通 Error 也能安全处理（fallback 格式）

- [ ] 更新 `cli.js`，将顶层 catch 中的 console.error 替换为 printError (AC: #2)

  - [ ] 导入 `printError` from `'./lib/output.js'`
  - [ ] 将 `catch` 块中的 `console.error(...)` 替换为 `printError(err)`
  - [ ] Story 1.2 已添加的 EXIT_CODES 映射逻辑保持不变

- [ ] 创建 `test/output.test.js` (AC: #3)

  - [ ] 使用 `vi.spyOn(process.stdout, 'write')` 和 `vi.spyOn(process.stderr, 'write')` 捕获输出
  - [ ] 测试 `printProgress('正在检测平台...')` 写入 stdout，内容为 `'正在检测平台...'`
  - [ ] 测试 `printProgress('...', true)` 写入 stdout，内容包含 `✓`
  - [ ] 测试 `printSuccess('安装完成')` 写入 stdout
  - [ ] 测试 `printError(bmadError)` 写入 stderr，不写入 stdout
  - [ ] 测试 `printError` 输出包含 `ERROR [E004]`、`可重试：是` 等关键字段

- [ ] 验证所有测试通过 (AC: #3)
  - [ ] 执行 `npm test`，确认 `test/output.test.js` 全部通过，且已有测试无回归

## Dev Notes

### 关键实现规范

**lib/output.js 完整实现**

```javascript
// lib/output.js
// 统一输出模块 - Story 1.3 实现
// 约束：所有进度/成功/错误输出必须通过此模块，禁止直接 console.log/console.error
// stdout：进度信息、成功确认
// stderr：错误信息（ERROR [E{code}] 格式）

import chalk from 'chalk'
import { BmadError } from './errors.js'

/**
 * 进度输出 - 写入 stdout
 * 使用模式：
 *   printProgress('正在检测平台...')  // 先输出步骤描述（无换行）
 *   // ... 执行异步操作 ...
 *   printProgress('正在检测平台...', true)  // 完成后追加 ✓
 */
export function printProgress(message, done = false) {
  if (done) {
    process.stdout.write(chalk.green(' ✓') + '\n')
  } else {
    process.stdout.write(message)
  }
}

/**
 * 成功确认输出 - 写入 stdout
 */
export function printSuccess(message) {
  process.stdout.write('\n' + chalk.bold(message) + '\n')
}

/**
 * 错误格式化输出 - 写入 stderr（AI 可读 Schema）
 * 兼容 BmadError 和普通 Error
 */
export function printError(err) {
  if (err instanceof BmadError) {
    const retryableText = err.retryable ? '是' : '否'
    const causeMsg = err.cause?.message ?? '未知原因'
    const lines = [
      `ERROR [${err.bmadCode}] ${err.message}`,
      `原因：${causeMsg}`,
      `修复步骤：`,
      `  1. 检查错误原因并重试`,
      `可重试：${retryableText}`,
    ]
    process.stderr.write(lines.join('\n') + '\n')
  } else {
    process.stderr.write(`ERROR ${err.message}\n`)
  }
}
```

> **重要**：`修复步骤` 的具体内容在此基础实现中为占位文案。Story 3.x 会扩展每种 BmadError 代码的具体修复指令（E004 写权限拒绝的备选路径、E005 网络错误的重试命令等）。Story 1.3 的目标是建立正确的输出路由和格式结构，修复步骤的精细化是后续 Epic 3 的职责。

### 进度输出模式说明

架构文档定义的进度输出模式：

```
正在检测平台... {platform} ✓
正在复制 agent 文件... ✓
正在替换模板变量... ✓
正在注册 agent... ✓
安装完成（用时 {N}s）
```

`printProgress` 的双调用模式对应此格式：

```javascript
// Story 2.x 中的使用示例（本故事不实现，仅理解接口设计意图）
printProgress('正在检测平台...')
const platform = await detectPlatform()
printProgress(`正在检测平台...`, true) // 追加 ✓
```

**注意 chalk 的使用**：Story 1.3 的 AC 未规定颜色，实现中可选择性使用 chalk。若测试中 spy 输出内容，需注意 chalk 可能输出 ANSI 转义码。测试可用 `chalk.level = 0`（禁用颜色）或使用 `toContain('✓')` 而非严格相等来避免 ANSI 码干扰。

### 与 Story 1.2 的接口依赖

`printError(bmadError)` 访问 BmadError 的以下属性（Story 1.2 已保证）：

- `err.bmadCode`：输出 `ERROR [E{code}]` 前缀
- `err.message`：错误描述
- `err.cause`：原始错误（`err.cause?.message` 取原因描述）
- `err.retryable`：输出"可重试：是/否"
- `err instanceof BmadError`：区分 BmadError 和普通 Error

**Story 1.2 未实现时的处理**：若 Story 1.2 与 1.3 并行开发，`lib/errors.js` 可能仍是占位。此时 `printError` 实现中的 `instanceof BmadError` 判断会走 else 分支，输出普通格式。Story 1.2 完成后自动生效，无需修改 output.js。

### cli.js 更新要点

Story 1.2 已将 cli.js 的顶层 catch 更新为 BmadError 感知。本故事进一步将 `console.error` 替换为 `printError`：

```javascript
// cli.js 更新后（引入 output.js）
import { printError } from './lib/output.js'
import { EXIT_CODES } from './lib/exit-codes.js'
import { BmadError } from './lib/errors.js'

const CODE_TO_EXIT = {
  E001: EXIT_CODES.GENERAL_ERROR,
  E002: EXIT_CODES.INVALID_ARGS,
  E003: EXIT_CODES.MISSING_DEPENDENCY,
  E004: EXIT_CODES.PERMISSION_DENIED,
  E005: EXIT_CODES.NETWORK_ERROR,
  E006: EXIT_CODES.ALREADY_INSTALLED,
}

program.parseAsync().catch((err) => {
  printError(err) // 替换 console.error
  if (err instanceof BmadError) {
    process.exit(CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
  } else {
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
})
```

### 测试模式（vitest spy）

```javascript
// test/output.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printProgress, printSuccess, printError } from '../lib/output.js'
import { BmadError } from '../lib/errors.js'

describe('output.js', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('printProgress', () => {
    it('写入 stdout（非完成态）', () => {
      printProgress('正在检测平台...')
      expect(stdoutSpy).toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('正在检测平台...')
    })

    it('完成态写入 ✓ 到 stdout', () => {
      printProgress('正在检测平台...', true)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('✓')
    })
  })

  describe('printError', () => {
    it('将 BmadError 写入 stderr，不写 stdout', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      expect(stderrSpy).toHaveBeenCalled()
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('stderr 内容包含错误码和可重试信息', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      const written = stderrSpy.mock.calls.map((c) => c[0]).join('')
      expect(written).toContain('ERROR [E004]')
      expect(written).toContain('可重试：是')
    })

    it('非 BmadError 也写入 stderr', () => {
      printError(new Error('普通错误'))
      expect(stderrSpy).toHaveBeenCalled()
      expect(stdoutSpy).not.toHaveBeenCalled()
    })
  })
})
```

### 来自 Story 1.1 的关键经验

- **ESLint flat config（eslint.config.js）**：避免 lint 错误，导入需使用 ESM 语法
- **vitest passWithNoTests**：已配置，增加 output.test.js 后自动被识别
- **chalk v5 ESM**：需用 `import chalk from 'chalk'`（默认导入），**不是** `import { chalk }`

### 来自 Story 1.2 的关键经验

- **vitest spy 的 mockImplementation**：`process.stdout.write` 的 spy 需要 `.mockImplementation(() => true)` 防止实际输出干扰测试
- **afterEach vi.restoreAllMocks()**：确保 spy 不跨测试污染

### Project Structure Notes

- 修改文件：`lib/output.js`（替换占位）、`cli.js`（将 console.error 替换为 printError）
- 新建文件：`test/output.test.js`
- 不修改：`lib/exit-codes.js`、`lib/errors.js`（Story 1.2 实现）、`package.json`、`vitest.config.js`
- `lib/output.js` 导入 `BmadError`（来自 `lib/errors.js`），若 Story 1.2 未完成则进行占位兼容
- 完成后运行 `npm test`，确认新测试通过且 Story 1.1 引入的 vitest 基础配置无回归

### References

- Story 1.3 验收标准：[Source: _bmad-output/planning-artifacts/epics.md#Story-1.3]
- 架构文档 stdout/stderr 使用规则：[Source: _bmad-output/planning-artifacts/architecture.md#格式规范]
- 架构文档 进度输出模式：[Source: _bmad-output/planning-artifacts/architecture.md#进度输出模式]
- 架构文档 AI 可读错误 Schema：[Source: _bmad-output/planning-artifacts/architecture.md#AI-可读错误-Schema]
- 架构文档 output.js 单点输出职责：[Source: _bmad-output/planning-artifacts/architecture.md#每个-lib-模块职责单一]
- Story 1.1 经验（vitest/ESLint）：[Source: _bmad-output/implementation-artifacts/1-1-npm-package-init.md#Debug-Log-References]
- Story 1.2 BmadError 接口：[Source: _bmad-output/implementation-artifacts/1-2-exit-codes-and-errors.md#BmadError-错误码对照表]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
