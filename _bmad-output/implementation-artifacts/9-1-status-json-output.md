# Story 9.1：`status --json` 完整结构化输出实现

Status: done

## Story

As a AI（自动化调用方）,
I want `npx bmad-expert status --json` 返回包含健康度、逐文件检查结果和版本信息的完整结构化 JSON，
so that 我可以通过编程方式精确判断安装状态、执行条件逻辑，而不依赖文本解析。

## Acceptance Criteria

**AC1 — healthy 完整 JSON 输出**
Given bmad-expert 已正确安装
When 执行 `npx bmad-expert status --json`
Then stdout 输出单个合法 JSON 对象：
`{"success": true, "status": "healthy", "version": "X.X.X", "platform": "...", "installPath": "...", "files": [{"name": "SOUL.md", "exists": true}, ...]}`（FR49）
And 进程以 exit code 0 退出
And stderr 无任何内容

**AC2 — not_installed 完整 JSON 输出**
Given bmad-expert 未安装（installPath 不存在）
When 执行 `npx bmad-expert status --json`
Then stdout 输出 `{"success": false, "status": "not_installed", "version": null, "platform": "...", "installPath": "...", "files": []}`
And 进程以非零 exit code 退出（FR49）
And stderr 无任何内容

**AC3 — corrupted 完整 JSON 输出**
Given 部分 frameworkFile 缺失（corrupted 状态）
When 执行 `npx bmad-expert status --json`
Then stdout 输出 `{"success": false, "status": "corrupted", "version": "X.X.X", "platform": "...", "installPath": "...", "files": [...], "fixSuggestion": "运行 npx bmad-expert install 重新安装"}`
And `files` 数组中缺失文件的 `"exists": false`
And 进程以非零 exit code 退出

**AC4 — JSON 模式 stderr 完全空白**
Given `--json` 模式执行
When 任何结果输出（healthy / not_installed / corrupted）
Then stderr 无任何内容，所有输出均通过 stdout JSON 格式输出（与 FR40 规范一致）

**AC5 — files 字段使用 `name` 键**
Given 执行 `npx bmad-expert status --json`（任意安装状态）
When 解析 JSON 输出中的 files 数组
Then 每个元素含 `"name"` 字段（字符串，如 "SOUL.md"）和 `"exists"` 字段（boolean）

**AC6 — 测试覆盖三种状态**
Given `test/checker.test.js` 更新覆盖 `status --json` 完整输出结构
When 运行 `npm test`
Then 所有 `status --json` 输出格式、字段完整性（success/status/version/platform/installPath/files）测试通过，零回归

## Tasks / Subtasks

- [x] Task 1: 重构 `lib/checker.js` — 始终返回结构化对象，不再对状态性失败抛出 (AC: #1-5)
  - [x] 1.1 修改 `fileChecks` 映射：`{file, exists}` → `{name, exists}`（`name` 代替 `file`）
  - [x] 1.2 新增 `platform` 字段：`const platformName = await detectPlatform(platformOverride)` 结果放入所有返回对象
  - [x] 1.3 `not_installed` 路径：移除 `throw new BmadError`，改为 `return { success: false, status: 'not_installed', version: null, platform: platformName, installPath, files: [] }`（printSuccess 文本报告保留，用于非 JSON 模式）
  - [x] 1.4 `corrupted` 路径：移除 `throw new BmadError`，改为 `return { success: false, status: 'corrupted', version, platform: platformName, installPath, files: fileChecks, fixSuggestion: '运行 npx bmad-expert install 重新安装' }`
  - [x] 1.5 `healthy` 路径：返回 `{ success: true, status: 'healthy', version, platform: platformName, installPath, files: fileChecks }`

- [x] Task 2: 修改 `cli.js` status action — 处理非成功返回值 (AC: #1-4)
  - [x] 2.1 JSON 模式：`printJSON(result)` 覆盖所有三种状态（移除原 `{ success: true, ...result }` 包装，因 `success` 已在 result 中）
  - [x] 2.2 JSON 模式非成功：`if (!result.success) process.exit(EXIT_CODES.GENERAL_ERROR)` — 确保非零退出
  - [x] 2.3 非 JSON 模式非成功：`if (!result.success) process.exit(EXIT_CODES.GENERAL_ERROR)` — 维持原有非零退出语义（原来靠 throw 触发，现在直接退出）

- [x] Task 3: 更新 `test/checker.test.js` — 适配新返回值契约 + 补充 JSON 结构断言 (AC: #6)
  - [x] 3.1 更新 `not_installed` 用例：原 `rejects.toMatchObject({ bmadCode: 'E001' })` → 改为断言返回对象含 `{ success: false, status: 'not_installed', version: null }`
  - [x] 3.2 更新 `corrupted` 用例：原 `rejects.toMatchObject(...)` → 改为断言返回对象含 `{ success: false, status: 'corrupted' }`
  - [x] 3.3 新增 `healthy` 断言：返回对象含 `{ success: true, status: 'healthy', version: '0.1.0', platform: 'happycapy', installPath: INSTALL_PATH }`
  - [x] 3.4 新增 files 结构断言（三种状态）：healthy 时 files 数组元素含 `name` 键（非 `file`）；`{ name: 'SOUL.md', exists: true }` 格式
  - [x] 3.5 新增 not_installed 时 `files: []` 断言
  - [x] 3.6 新增 corrupted 时 `fixSuggestion` 字段断言（含 'npx bmad-expert install'）
  - [x] 3.7 新增 platform 字段存在性断言（三种状态均含 `platform: 'happycapy'`）

- [x] Task 4: 运行测试，确认零回归
  - [x] 4.1 `npm test` 全量通过（含 checker.test.js 所有更新用例）
  - [x] 4.2 验证 json-mode.test.js 无回归（checker 变更不影响 json-mode 测试，因为 json-mode 测 install/update，不测 status）

## Dev Notes

### 关键架构约束（必须遵守）

参见 `lib/checker.js` 头部注释：
- 文件操作必须使用 `fs-extra`，禁止原生 `fs`
- 错误必须使用 `BmadError`，禁止 `throw new Error()`（注意：status 结果性失败不再 throw，真正的异常如 fs.readFile 失败仍 throw）
- 所有输出通过 `output.js` 路由，禁止 `console.log`
- 禁止 `process.exit()`（除 cli.js 顶层）
- 具名导出，禁止 default export

**重要**：`not_installed`/`corrupted` 是状态性结果，不是异常。重构后 `checkStatus()` 仅对真正异常（如文件读取失败）throw BmadError。状态性结果通过返回值传达。

### 现状 vs 目标对比

| 场景 | 当前行为 | 目标行为 |
|------|---------|---------|
| healthy JSON | `{ status: 'healthy', version, installPath, files: [{file, exists}] }` | `{ success: true, status, version, platform, installPath, files: [{name, exists}] }` |
| not_installed JSON | throw BmadError E001（cli catch 输出 errorCode JSON）| `{ success: false, status: 'not_installed', version: null, platform, installPath, files: [] }` |
| corrupted JSON | throw BmadError E001（cli catch 输出 errorCode JSON）| `{ success: false, status: 'corrupted', version, platform, installPath, files: [...], fixSuggestion }` |
| files 键名 | `file` | `name` |
| platform 字段 | 无 | 有 |
| success 字段 | 无 | 有 |

### cli.js status action 修改点

**当前实现（`cli.js:79-88`）：**
```javascript
.action(async (options) => {
  if (options.json) setJsonMode(true)
  const result = await checkStatus({
    platform: options.platform ?? null,
    agentId: options.agentId,
  })
  if (options.json) {
    printJSON({ success: true, ...result })  // ← 只处理成功 + 错误覆盖 success 字段
  }
})
```

**目标实现：**
```javascript
.action(async (options) => {
  if (options.json) setJsonMode(true)
  const result = await checkStatus({
    platform: options.platform ?? null,
    agentId: options.agentId,
  })
  if (options.json) {
    printJSON(result)                           // result 已含 success 字段，直接输出
    if (!result.success) {
      process.exit(EXIT_CODES.GENERAL_ERROR)   // 非零退出
    }
  } else if (!result.success) {
    process.exit(EXIT_CODES.GENERAL_ERROR)     // 非 JSON 模式：text 已由 checkStatus 输出，直接退出
  }
})
```

**注意：** 原来 not_installed/corrupted 靠 throw 触发 global catch → printError(stderr)。重构后非 JSON 模式无 stderr 错误信息（text 状态报告已通过 printSuccess 输出到 stdout），这是可接受的行为改进，不破坏 FR 规范。

### checker.js 核心修改实现参考

```javascript
// lib/checker.js — 修改点

// 1. fileChecks 映射：file → name
const fileChecks = await Promise.all(
  frameworkFiles.map(async (name) => ({
    name,                                              // ← 改为 name
    exists: await fs.pathExists(join(installPath, name)),
  }))
)

// 2. not_installed 路径（移除 throw）
if (!pathExists) {
  printSuccess([
    `bmad-expert 安装状态`,
    ``,
    `状态：not_installed`,
    `修复建议：运行 npx bmad-expert install 完成安装`,
  ].join('\n'))
  return {                                            // ← return 代替 throw
    success: false,
    status: 'not_installed',
    version: null,
    platform: platformName,
    installPath,
    files: [],
  }
}

// 3. corrupted 路径（移除 throw）
if (!isHealthy) {
  printSuccess([...].join('\n'))
  return {                                            // ← return 代替 throw
    success: false,
    status: 'corrupted',
    version,
    platform: platformName,
    installPath,
    files: fileChecks,
    fixSuggestion: '运行 npx bmad-expert install 重新安装',
  }
}

// 4. healthy 路径（新增 success/platform 字段）
printSuccess([...].join('\n'))
return {
  success: true,
  status: 'healthy',
  version,
  platform: platformName,
  installPath,
  files: fileChecks,
}
```

### checker.test.js 更新重点

**mock 不需要改动**（platform mock 已有 `detectPlatform.mockResolvedValue('happycapy')`）

**原有需要更新的用例（not_installed 块）：**
```javascript
// 原来：
it('installPath 不存在时抛出 BmadError E001', async () => {
  await expect(checkStatus()).rejects.toMatchObject({ bmadCode: 'E001' })
})
// 新：
it('installPath 不存在时返回 success:false / status:not_installed', async () => {
  const result = await checkStatus()
  expect(result).toMatchObject({ success: false, status: 'not_installed', version: null })
})
```

**原有需要更新的用例（corrupted 块）：**
```javascript
// 原来：
it('部分文件缺失时抛出 BmadError E001', async () => {
  await expect(checkStatus()).rejects.toMatchObject({ bmadCode: 'E001' })
})
// 新：
it('部分文件缺失时返回 success:false / status:corrupted', async () => {
  const result = await checkStatus()
  expect(result).toMatchObject({ success: false, status: 'corrupted' })
})
```

**新增断言（补充到各 describe 块）：**
```javascript
// healthy 块新增：
it('返回对象含 success:true / platform / version', async () => {
  const result = await checkStatus()
  expect(result.success).toBe(true)
  expect(result.platform).toBe('happycapy')
  expect(result.version).toBe('0.1.0')
})
it('files 数组使用 name 键（非 file 键）', async () => {
  const result = await checkStatus()
  expect(result.files[0]).toHaveProperty('name')
  expect(result.files[0]).not.toHaveProperty('file')
})

// not_installed 块新增：
it('返回对象含 platform / installPath / files:[]', async () => {
  const result = await checkStatus()
  expect(result.platform).toBe('happycapy')
  expect(result.files).toEqual([])
})

// corrupted 块新增：
it('返回对象含 fixSuggestion 字段', async () => {
  const result = await checkStatus()
  expect(result.fixSuggestion).toContain('npx bmad-expert install')
})
it('files 数组中缺失文件 exists:false', async () => {
  const result = await checkStatus()
  const identityFile = result.files.find(f => f.name === 'IDENTITY.md')
  expect(identityFile?.exists).toBe(false)
})
```

### 回归风险评估

| 文件 | 风险 | 说明 |
|------|------|------|
| `lib/checker.js` | 中 | 返回值结构变更；非 JSON 模式 stderr 行为改变（原有 printError 不再调用）|
| `cli.js` | 低 | status action 局部修改；global catch 不变 |
| `test/checker.test.js` | 中 | 需更新 4 个"rejects"用例 + 新增约 8 个断言 |
| `test/json-mode.test.js` | 无 | 不涉及 checker（测 install/update），无需修改 |
| 其他测试文件 | 无 | 无涉及 checker 的 mock 需要更新 |

### 关键文件位置

- `lib/checker.js` — 主要修改文件
- `cli.js:73-88` — status action 修改范围
- `test/checker.test.js` — 测试更新
- `package.json:46-54` — frameworkFiles 定义（只读参考，不改）
- `lib/output.js` — 不修改（printJSON/setJsonMode 已就位）

### Project Structure Notes

**修改文件：**
```
lib/checker.js           ← 主要：重构返回结构，移除状态性 throw
cli.js                   ← 局部：status action 处理非成功返回值
test/checker.test.js     ← 更新：适配新返回值契约 + 新增 JSON 结构断言
```

**不修改文件（避免回归）：**
```
lib/output.js            ← setJsonMode/printJSON 已就位，无需改动
lib/platform.js          ← 不变
lib/errors.js            ← 不变
lib/installer.js         ← 不变
lib/updater.js           ← 不变
test/json-mode.test.js   ← 不变（不测 status 命令）
test/integration/        ← 不变
```

### References

- Story 9.1 AC 权威定义：[Source: `_bmad-output/planning-artifacts/epics.md` → "Epic 9 → Story 9.1"]
- 架构文件映射：[Source: `_bmad-output/planning-artifacts/architecture.md:691` → "回顾清债(FR49-50) → lib/checker.js, test/checker.test.js"]
- 现有 checker.js 实现：[Source: `lib/checker.js`]
- 现有 cli.js status action：[Source: `cli.js:73-88`]
- JSON 模式规范（FR40）：[Source: `_bmad-output/implementation-artifacts/6-3-json-output-mode.md` → "关键约束"]
- printJSON/setJsonMode 接口：[Source: `lib/output.js:21-42`]
- 现有 checker 测试结构：[Source: `test/checker.test.js`]
- package.json frameworkFiles：[Source: `package.json:46-54`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 重构 `lib/checker.js`：`checkStatus()` 始终返回结构化对象（`{ success, status, version, platform, installPath, files, fixSuggestion? }`），移除 `not_installed`/`corrupted` 两种状态的 `throw BmadError`。`files` 数组键名从 `file` 改为 `name`，新增 `platform`（来自 `detectPlatform()` 结果）和 `success` 字段，满足 FR49 AC1-5。
- 修改 `cli.js` status action：JSON 模式直接 `printJSON(result)`（result 已含 `success` 字段，无需再包裹 `{ success: true, ...result }`），非成功时 `process.exit(EXIT_CODES.GENERAL_ERROR)` 确保非零退出。非 JSON 模式同样直接退出，避免之前靠 throw 触发 global catch 的间接机制。
- 更新 `test/checker.test.js`：替换 4 个基于 `rejects` 的旧用例，新增 30+ 断言覆盖三种状态的完整 JSON 结构（success/status/version/platform/installPath/files/fixSuggestion）及 `files` 键名正确性，新增 "JSON 输出结构完整性（FR49）" describe 块含 4 个集成级断言。全套 368 用例通过，零回归。
- 代码审查（Review 阶段）修复：（1）`not_installed` 路径补充 `fixSuggestion` 字段，与 `corrupted` 保持 schema 一致性；（2）`fixSuggestion` 测试断言改为精确字符串匹配；（3）`test/json-mode.test.js` 新增 `status --json` describe 块（8 个用例），覆盖三种状态 JSON 输出格式及非成功时退出语义。

### File List

- lib/checker.js（修改）
- cli.js（修改）
- test/checker.test.js（修改）
- test/json-mode.test.js（修改）
- _bmad-output/implementation-artifacts/9-1-status-json-output.md（新建）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）
