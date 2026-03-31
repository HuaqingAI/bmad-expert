# Story 2.5: 安装完成情感性确认与操作引导

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 安装成功后看到明确的确认信息和下一步操作列表，
so that 我清楚地知道"装好了"且"现在能做什么"，将功能完成转化为使用信心。

## Acceptance Criteria

1. **Given** 安装全部步骤成功完成
   **When** `output.js` 输出安装后引导信息
   **Then** stdout 包含情感性确认语句（"bmad-expert 已就绪"）
   **And** stdout 包含至少两个明确的可执行操作选项（FR21），包含进入 bmad-help 的引导（FR22）
   **And** 格式符合架构文档中定义的安装后引导模板（含 ① ② 编号选项）
   **And** 安装耗时（秒数）包含在确认信息中（格式：`安装完成（用时 Xs）`）

2. **Given** `--yes` 参数被传入（非交互模式，FR30）
   **When** 执行安装
   **Then** 安装完成后仍输出引导信息（不因 `--yes` 而跳过）

## Tasks / Subtasks

- [x] 修复 `lib/installer.js` 中的安装完成消息格式（AC: #1）
  - [x] 将 `printSuccess()` 调用参数改为符合架构文档模板的顺序：`安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  - [x] 当前代码（错误顺序）：`bmad-expert 已就绪。安装完成（用时 ${duration}s）\n\n现在你可以：...`
  - [x] 正确顺序（架构文档 architecture.md 第 227-231 行）：`安装完成（用时 {N}s）` 在前，`bmad-expert 已就绪。现在你可以：` 在后

- [x] 在 `test/output.test.js` 添加安装后引导格式专项测试（AC: #1，FR20-22）
  - [x] 测试 `printSuccess` 接收引导消息时 stdout 包含 "bmad-expert 已就绪"
  - [x] 测试 stdout 包含 "①" 和 "②" 编号选项
  - [x] 测试 stdout 包含 "bmad-help" 关键字（FR22）
  - [x] 测试 stdout 包含 "安装完成（用时" 耗时格式

- [x] 在 `test/integration/happycapy.test.js` 验证 printSuccess 消息内容 + `--yes` 模式（AC: #1, #2）
  - [x] 正常安装测试：验证 `printSuccess` 被调用且参数包含 "bmad-expert 已就绪"、"①"、"bmad-help"
  - [x] `--yes` 模式测试：`install({ yes: true })` 完成后 `printSuccess` 仍被调用

- [x] 验证所有测试通过（AC: #1, #2）
  - [x] `npm test`：所有已有测试文件（errors/exit-codes/output/platform/installer/integration）无回归

## Dev Notes

### 问题根因：消息格式与架构模板不符

`lib/installer.js` 第 121–123 行，当前实现为：

```javascript
printSuccess(
  `bmad-expert 已就绪。安装完成（用时 ${duration}s）\n\n现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
)
```

**问题**：消息顺序与架构文档不符——架构要求"安装完成（用时 Xs）"在前，"bmad-expert 已就绪"在后。

**正确格式**（来源：`architecture.md` 第 227–231 行）：

```
安装完成（用时 {N}s）

bmad-expert 已就绪。现在你可以：
  ① 说"初始化这个项目"开始使用
  ② 说"进入 bmad-help"了解工作流
```

### 修改内容

**唯一需要修改的生产代码**：`lib/installer.js` 第 120–123 行。仅调换消息内容顺序：

```javascript
// 当前（错误）
const duration = Math.round((Date.now() - startTime) / 1000)
printSuccess(
  `bmad-expert 已就绪。安装完成（用时 ${duration}s）\n\n现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
)

// 修正后
const duration = Math.round((Date.now() - startTime) / 1000)
printSuccess(
  `安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
)
```

### `--yes` 模式说明（FR30）

`cli.js` 已通过 `options.yes ?? false` 传入 `install()`。当前安装流程无交互式确认提示（全自动），`yes` 参数保留作为扩展点但不影响现有输出。Story 2-5 需验证 `--yes` 模式下 `printSuccess` 仍被调用（安装完成引导不因 `yes: true` 跳过）。

### 新增测试说明

#### `test/output.test.js` — 追加到现有 `printSuccess` describe 块

```javascript
it('安装后引导消息包含情感性确认（FR20）', () => {
  const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  printSuccess(msg)
  const written = stdoutSpy.mock.calls[0][0]
  expect(written).toContain('bmad-expert 已就绪')
})

it('安装后引导消息包含两个编号操作选项（FR21）', () => {
  const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  printSuccess(msg)
  const written = stdoutSpy.mock.calls[0][0]
  expect(written).toContain('①')
  expect(written).toContain('②')
})

it('安装后引导消息包含 bmad-help 引导（FR22）', () => {
  const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  printSuccess(msg)
  const written = stdoutSpy.mock.calls[0][0]
  expect(written).toContain('bmad-help')
})

it('安装后引导消息包含安装耗时信息', () => {
  const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  printSuccess(msg)
  const written = stdoutSpy.mock.calls[0][0]
  expect(written).toContain('安装完成（用时')
})
```

#### `test/integration/happycapy.test.js` — 追加到现有 describe 块

```javascript
it('正常安装：printSuccess 被调用且消息符合引导模板（AC1）', async () => {
  await install({ platform: null, agentId: 'bmad-expert', yes: false })

  const { printSuccess } = await import('../../lib/output.js')
  expect(printSuccess).toHaveBeenCalled()
  const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
  expect(msg).toContain('bmad-expert 已就绪')
  expect(msg).toContain('①')
  expect(msg).toContain('bmad-help')
  expect(msg).toContain('安装完成（用时')
})

it('--yes 模式：安装完成后仍输出引导信息（FR30 + AC2）', async () => {
  await install({ platform: null, agentId: 'bmad-expert', yes: true })

  const { printSuccess } = await import('../../lib/output.js')
  expect(printSuccess).toHaveBeenCalled()
  const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
  expect(msg).toContain('bmad-expert 已就绪')
})
```

### 架构守则（来自项目规范，严禁违反）

1. **禁止 `console.log`** — 所有输出通过 `printProgress`/`printSuccess`/`printError`
2. **禁止 `process.exit` 在 lib 模块** — 退出通过 throw BmadError，cli.js 顶层处理
3. **禁止 `default export`** — 全部为具名导出
4. **禁止 `.then()/.catch()` 链** — 全部 `async/await`
5. **禁止重复实现** — 直接修改 `install()` 中已有的 `printSuccess()` 调用

### 不修改的文件（严禁改动）

- `lib/output.js` — `printSuccess()` 实现正确，无需改动
- `lib/errors.js`、`lib/exit-codes.js`、`lib/platform.js`
- `lib/adapters/happycapy.js`、`lib/adapters/cursor.js`、`lib/adapters/claude-code.js`
- `cli.js` — `--yes` 透传逻辑已正确实现
- `test/errors.test.js`、`test/exit-codes.test.js`、`test/platform.test.js`、`test/installer.test.js`

### Project Structure Notes

本故事修改的文件：

```
bmad-expert/
├── lib/
│   └── installer.js             ✏️  仅修改 install() 末尾 printSuccess 调用的消息字符串
└── test/
    ├── output.test.js            ✏️  在 printSuccess describe 块中追加 4 个测试
    └── integration/
        └── happycapy.test.js    ✏️  在现有 describe 块中追加 2 个测试
```

### References

- 架构模板：`architecture.md` 第 221-232 行（进度输出格式）
- FR20-22：`prd.md` 第 429-431 行（安装后引导需求）
- FR30：`prd.md` 第 445 行（`--yes` 非交互模式）
- 当前实现：`lib/installer.js` 第 119-123 行（`printSuccess` 调用）
- 架构测试归属：`architecture.md` 第 559 行（FR20-22 → `test/output.test.js`）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `lib/installer.js`：将 `printSuccess()` 消息顺序从"bmad-expert 已就绪。安装完成..."改为符合架构模板的"安装完成（用时 Xs）\n\nbmad-expert 已就绪..."
- `test/output.test.js`：新增 4 个 FR20-22 专项测试，覆盖情感性确认、编号选项、bmad-help 引导、耗时格式
- `test/integration/happycapy.test.js`：新增 2 个集成测试，验证 printSuccess 消息内容 + `--yes` 模式不跳过引导
- 全部 96 个测试通过，6 个测试文件均无回归

### File List

- `lib/installer.js`
- `test/output.test.js`
- `test/integration/happycapy.test.js`
- `_bmad-output/implementation-artifacts/2-5-install-success-confirmation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
