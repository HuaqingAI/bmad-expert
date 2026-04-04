# Story 7.3: 安装流程重构 — installer.js 接入两阶段编排架构

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert install` 时安装流程采用两阶段编排架构（param-builder → orchestrator），而非直接复制模板文件,
so that 我获得始终对齐最新 BMAD 版本的安装结果，同时保留 CLI 参数覆盖能力。

## Acceptance Criteria

1. **Given** Phase 2 安装流程执行（HappyCapy 平台）
   **When** 执行 `npx bmad-expert install`
   **Then** 调用链为：`platform.js`（检测）→ `param-builder.buildParams()`（智能参数构建）→ `orchestrator.executeInstall()`（官方安装器）→ `orchestrator.writeSupplementFiles()`（补充文件）→ `adapter.install()`（平台注册）（FR41）

2. **Given** 安装进行中
   **When** 每个阶段完成
   **Then** stdout 依次输出：`正在构建安装参数... ✓`、`正在执行 BMAD 安装... ✓`（由 orchestrator 内部输出）、`正在写入补充文件... ✓`（由 orchestrator 内部输出）、`正在注册 agent... ✓`（NFR2）
   **And** 每步输出间隔不超过 2 秒，全流程在 60 秒内完成（NFR1、NFR14）

3. **Given** `agent/` 目录在 Phase 2 版本中
   **When** 检查目录内容
   **Then** 仅包含 bmad-expert 补充文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md），不包含旧的完整 BMAD 核心模板（FR41）
   **Note**: `bmad-project-init.md` 在 Phase 2 不再由 `install` 命令写入；`installer.js` 中 `FRAMEWORK_FILES` 数组不含 `bmad-project-init.md`

4. **Given** 用户传入 `--modules bmb --tools custom-tool`
   **When** 安装执行
   **Then** 用户参数透传至 `npx bmad-method install --modules bmb --tools custom-tool --yes`，覆盖智能推断（FR46）

5. **Given** `test/integration/happycapy.test.js` 已更新覆盖 Phase 2 两阶段调用链
   **When** 运行 `npm test`
   **Then** 端到端安装流程集成测试通过（NFR14：全流程 ≤ 60s）

## Tasks / Subtasks

- [x] 修改 `lib/installer.js`：`install()` 函数接入两阶段调用链 (AC: #1, #2, #4)
  - [x] 在文件顶部新增 import：`import { buildParams } from './param-builder.js'` 和 `import { executeInstall, writeSupplementFiles } from './orchestrator.js'`
  - [x] 在 `install()` 中：幂等检测通过后，调用 `buildParams(platformName, { projectRoot: process.cwd(), userOverrides: { modules, tools, communicationLanguage, outputFolder, userName, action } })`，其中 options 参数从函数签名解构
  - [x] 在 `install()` 中：删除原有「复制 agent 文件」和「替换模板变量」步骤，替换为 `await executeInstall(params.toArgs())`
  - [x] 在 `install()` 中：调用 `await writeSupplementFiles(targetDir, { agentId, agentName: agentId })`（在 executeInstall 之后）
  - [x] 在 `install()` 中：新增 `printProgress('正在构建安装参数...')` + `printProgress('', true)` 包裹 buildParams 调用
  - [x] 保留 `ensureDir`、`readFile`、`outputFile` import（仍被 `writeAgentFiles` 使用，不可删除）；`FRAMEWORK_FILES` 同样保留

- [x] 修改 `lib/installer.js`：更新 `install()` 函数签名以接收 Phase 2 选项 (AC: #4)
  - [x] `install()` 参数解构新增：`modules = null, tools = null, communicationLanguage = null, outputFolder = null, userName = null, action = null`
  - [x] 确保这些参数被正确传入 `buildParams()` 的 `userOverrides`

- [x] 更新 `test/integration/happycapy.test.js`：覆盖 Phase 2 两阶段调用链 (AC: #5)
  - [x] 新增 `vi.mock('../../lib/orchestrator.js', ...)` 模拟 `executeInstall` 和 `writeSupplementFiles`
  - [x] 新增 `vi.mock('../../lib/param-builder.js', ...)` 模拟 `buildParams`（返回含 `toArgs()` 的 mock 对象）
  - [x] 更新「正常安装」测试：验证 `executeInstall` 被调用（而非 5 次 outputFile）
  - [x] 新增测试：验证 `writeSupplementFiles` 以 targetDir 调用
  - [x] 新增测试：验证 `buildParams` 以正确 platform 和 userOverrides 调用
  - [x] 新增测试：验证用户显式 `--modules/--tools` 参数透传（FR46）
  - [x] 保留/更新幂等检测和 E006 测试（逻辑不变）

## Dev Notes

### 关键架构约束（必须遵守，违反则破坏架构一致性）

1. **具名导出**：不修改现有导出，`install()` 和 `checkInstallStatus()` 保持导出（有测试依赖）
2. **不修改 orchestrator.js 和 param-builder.js**：本 Story 只修改 `installer.js` 和集成测试
3. **保留 replaceTemplateVars、writeAgentFiles、checkInstallStatus、wrapNetworkError 导出**：`test/installer.test.js` 中有针对这些函数的单元测试，不得删除或重命名
4. **进度输出规则**：Phase 2 `install()` 自己只输出「正在构建安装参数...」步骤；「正在执行 BMAD 安装...」和「正在写入补充文件...」由 orchestrator 内部输出（已实现）；「正在注册 agent...」由 installer 保留
5. **错误处理路径**：`orchestrator.executeInstall()` 和 `orchestrator.writeSupplementFiles()` 抛出的 `BmadError` 直接传播至 `cli.js` 顶层（不在 `install()` 中二次包装）
6. **幂等检测逻辑不变**：`checkInstallStatus()` 调用在 buildParams 之前，Phase 2 不改变幂等行为

### Phase 2 `install()` 函数实现规范

**目标函数签名：**

```javascript
export async function install(options = {}) {
  const {
    platform: platformOverride = null,
    agentId = 'bmad-expert',
    // Phase 2 参数（来自 cli.js，由 Story 7.1 传入）
    modules = null,
    tools = null,
    communicationLanguage = null,
    outputFolder = null,
    userName = null,
    action = null,
  } = options
  const startTime = Date.now()

  // ── Step 1: 平台检测 ──────────────────────────────────────────────────────
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  printProgress('', true)

  // ── Step 2: 幂等检测 ──────────────────────────────────────────────────────
  await checkInstallStatus(adapter, agentId)

  const targetDir = adapter.getInstallPath(agentId)

  // ── Step 3: 智能参数构建 ─────────────────────────────────────────────────
  printProgress('正在构建安装参数...')
  const params = buildParams(platformName, {
    projectRoot: process.cwd(),
    userOverrides: { modules, tools, communicationLanguage, outputFolder, userName, action },
  })
  printProgress('', true)

  // ── Step 4: 执行 BMAD 官方安装器 ─────────────────────────────────────────
  // orchestrator 内部输出「正在执行 BMAD 安装... ✓」
  await executeInstall(params.toArgs())

  // ── Step 5: 写入 bmad-expert 补充文件 ────────────────────────────────────
  // orchestrator 内部输出「正在写入补充文件... ✓」
  await writeSupplementFiles(targetDir, { agentId, agentName: agentId })

  // ── Step 6: 平台注册 ─────────────────────────────────────────────────────
  printProgress('正在注册 agent...')
  try {
    await adapter.install(null, { agentId })
  } catch (error) {
    wrapNetworkError(error, `平台注册失败：${agentId}`)
  }
  printProgress('', true)

  // ── 安装完成引导 ──────────────────────────────────────────────────────────
  const duration = Math.round((Date.now() - startTime) / 1000)
  printSuccess(
    `安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  )

  return { platform: platformName, agentId, installPath: targetDir, duration }
}
```

**需要新增的 import：**

```javascript
import { buildParams } from './param-builder.js'
import { executeInstall, writeSupplementFiles } from './orchestrator.js'
```

**需要移除的 import（不再被 install() 使用）：**

```javascript
// 以下 fs-extra 导入在 install() 中不再使用（但 writeAgentFiles 中仍使用）
// 检查 writeAgentFiles 是否仍需要，若保留则保持 import；若只保留单元测试覆盖，保持原样
```

**注意**：`writeAgentFiles` 函数自身用到了 `ensureDir`、`readFile`、`outputFile`，这些 import 不能移除。只有当 `writeAgentFiles` 本身被删除时才能移除相关 import。建议**保留 `writeAgentFiles`**（单元测试已覆盖，删除它会破坏测试）。

### `test/integration/happycapy.test.js` 更新要点

Phase 2 后，`install()` 不再直接调用 `fs-extra.outputFile` 5 次。集成测试必须改为验证编排器调用链：

```javascript
// 新增 mock（在文件顶部与其他 vi.mock 同级）
vi.mock('../../lib/orchestrator.js', () => ({
  executeInstall: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  writeSupplementFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/param-builder.js', () => ({
  buildParams: vi.fn().mockReturnValue({
    toArgs: vi.fn().mockReturnValue(['--modules', 'bmm', '--yes']),
  }),
}))
```

**关键测试用例调整：**

- 「正常安装：写入 5 个文件并调用 happycapy-cli add」→ 改为验证 `executeInstall` 和 `writeSupplementFiles` 被调用
- 新增：验证 `buildParams` 以 `platformName` 和含 `userOverrides` 的 context 调用
- 新增：验证 `writeSupplementFiles` 以 `targetDir` 作为第一个参数调用
- 新增：用户显式 `--tools custom-tool` 时，`buildParams` 的 `context.userOverrides.tools` 为 `'custom-tool'`
- 保留：幂等检测（E006）逻辑不变，此测试不需修改

**Phase 2 后 fsExtra.outputFile 不再被直接调用**（由 orchestrator mock 覆盖），「写入 5 个文件」相关断言改为验证 orchestrator 调用。

### 与 Story 7-1/7-2 的边界

| Story | 已完成内容 | 本 Story (7.3) 依赖 |
|-------|-----------|---------------------|
| 7.1 | `lib/param-builder.js`（buildParams + toArgs）、`cli.js` Phase 2 选项 | `buildParams()` 直接调用 |
| 7.2 | `lib/orchestrator.js`（executeInstall + writeSupplementFiles） | 直接调用两个函数 |
| **7.3（本）** | `lib/installer.js` 重构接入上述两模块；集成测试更新 | — |

### 回归风险点（必须验证）

1. **`test/installer.test.js` 回归**：该文件测试 `replaceTemplateVars`、`writeAgentFiles`、`checkInstallStatus`、`wrapNetworkError`，这些函数**不修改**，回归必须 100% 通过
2. **`test/integration/happycapy.test.js` 更新**：Phase 2 后原有 `outputFile` 调用次数断言失效，需更新为验证 orchestrator mock
3. **幂等检测不受影响**：`checkInstallStatus()` 调用在 `buildParams()` 之前，E006 行为不变
4. **`--json` 模式返回值不变**：`install()` 返回 `{ platform, agentId, installPath, duration }`，cli.js 使用此值，不得更改

### 现有代码参考（勿重造轮子）

- `lib/orchestrator.js`：已实现 `executeInstall` 和 `writeSupplementFiles`，进度输出在内部，直接调用即可
- `lib/param-builder.js`：已实现 `buildParams`，返回含 `toArgs()` 的对象
- `lib/installer.js`：当前 Phase 1 实现，Steps 3-4（文件复制 + 变量替换）替换为 Steps 3-5（buildParams + executeInstall + writeSupplementFiles）
- 进度输出模式：`printProgress('正在...'); ...执行...; printProgress('', true)` — 与 Phase 1 保持一致

### References

- FR41（委托 npx bmad-method install）: `_bmad-output/planning-artifacts/epics.md` → Story 7.3 AC
- FR46（用户显式覆盖）: `_bmad-output/planning-artifacts/epics.md` → Story 7.3 AC#4
- NFR1（全流程 ≤60s）、NFR2（每步 ≤2s）、NFR14（编排全流程 ≤60s）: `_bmad-output/planning-artifacts/architecture.md` → 非功能需求
- Phase 2 调用链定义: `_bmad-output/planning-artifacts/architecture.md` → "安装编排边界" 与 "内部数据流（Phase 2）"
- 进度输出格式: `_bmad-output/planning-artifacts/architecture.md` → "进度输出格式（标准输出）"
- 执行规范（6 条强制规则）: `_bmad-output/planning-artifacts/architecture.md` → "执行规范"
- Story 7.1 完成状态 + `buildParams` 实现: `_bmad-output/implementation-artifacts/7-1-param-builder.md`
- Story 7.2 完成状态 + `orchestrator.js` 实现: `_bmad-output/implementation-artifacts/7-2-orchestrator.md`
- 当前 `install()` Phase 1 实现: `lib/installer.js`
- 集成测试当前状态: `test/integration/happycapy.test.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 测试运行：11 files, 301 tests, 0 failures（含全回归）
- Red-Green-Refactor：先更新集成测试（红），再修改 installer.js（绿），全量 301 测试通过

### Completion Notes List

- `lib/installer.js` `install()` 已接入 Phase 2 两阶段调用链：`buildParams → executeInstall → writeSupplementFiles → adapter.install()`
- `install()` 函数签名新增 Phase 2 选项（modules/tools/communicationLanguage/outputFolder/userName/action），透传至 `buildParams()`
- 保留了 `replaceTemplateVars`、`writeAgentFiles`、`checkInstallStatus`、`wrapNetworkError` 导出（单元测试覆盖，updater.js 依赖）
- `test/integration/happycapy.test.js` 完全重写为 Phase 2 版本：mock orchestrator 和 param-builder，验证调用链、参数透传、幂等检测
- 测试从 5 个文件内容验证改为验证编排层调用（executeInstall、writeSupplementFiles 被调用、buildParams 参数正确）
- 全量 301 个测试通过，0 回归

### File List

- lib/installer.js（修改：install() 接入两阶段调用链，新增 Phase 2 import）
- test/integration/happycapy.test.js（修改：全面更新为 Phase 2 两阶段调用链测试）
- _bmad-output/implementation-artifacts/7-3-installer-two-phase-refactor.md（本文件）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改：7-3 状态更新）
