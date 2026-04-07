# Story 8.2: OpenClaw 平台适配器

Status: done

## Story

As a OpenClaw 用户（通过 AI 代劳）,
I want 在 OpenClaw 平台触发安装时，bmad-expert 自动检测 OpenClaw 环境并完成平台注册契约,
so that 我无需了解平台差异，获得与 HappyCapy 用户一致的 BMAD 安装体验。

## Acceptance Criteria

1. **Given** 执行环境为 OpenClaw（`OPENCLAW_SESSION_ID` 环境变量存在，或 `[cwd]/.openclaw/` 目录存在）
   **When** 适配器 `detect()` 执行
   **Then** 返回 `true`，`detectConfidence()` ≥ 0.9（FR47）

2. **Given** OpenClaw 适配器 `getInstallPath('bmad-expert')` 被调用
   **When** 调用返回
   **Then** 返回 `[cwd]/.openclaw/agents/bmad-expert` 绝对路径，路径在白名单范围内，不含 `..`（NFR12）

3. **Given** 安装参数已构建，适配器 `install(files, options)` 执行
   **When** OpenClaw 平台注册流程运行
   **Then** 将 `{ "[agentId]": { "installedAt": "<ISO>" } }` 键值对合并写入 `[cwd]/.openclaw/agents-registry.json`（文件不存在则创建，已存在则合并）；若写入失败，输出手动注册步骤（降级路径）

4. **Given** OpenClaw 适配器 `getToolsParam()` 被调用
   **When** 调用返回
   **Then** 返回 `null`（OpenClaw 不需要传 `--tools` 参数，与 HappyCapy 一致）

5. **Given** `test/integration/openclaw.test.js` 使用 mock 环境和 mock fs-extra
   **When** 运行 `npm test`
   **Then** OpenClaw 完整安装流程集成测试通过（NFR5、NFR8）；包含成功安装、幂等安装、降级安装三个测试用例；所有既有测试无回归

## Tasks / Subtasks

- [x] 实现 `lib/adapters/openclaw.js` 完整适配器（AC: #1-#4）
  - [x] 保留并确认现有 `detectConfidence()` 和 `detect()` 方法（Story 8-1 已实现，无需修改）
  - [x] 实现 `getInstallPath(agentId)`：返回 `path.resolve(process.cwd(), '.openclaw', 'agents', agentId)`；agentId 安全验证（非空、无 `..`、无路径分隔符）；路径白名单验证（必须以 `[cwd]/.openclaw/` 开头）
  - [x] 实现 `check(agentId)`：检查安装路径是否存在且包含 `AGENTS.md`；返回 `'not_installed'` | `'installed'` | `'corrupted'`
  - [x] 实现 `install(files, options)`：向 `[cwd]/.openclaw/agents-registry.json` 写入 `{ agentId, installedAt }` 注册记录；JSON 读取-合并-写入（fs-extra）；失败时降级输出手动注册步骤
  - [x] 实现 `getToolsParam()`：返回 `null`

- [x] 新建 `test/integration/openclaw.test.js`（AC: #5）
  - [x] 成功安装测试：mock `OPENCLAW_SESSION_ID` + mock fs-extra（路径不存在） → `install()` 成功调用，写入 5 个文件 + 写入 registry
  - [x] 幂等安装测试：mock 目标路径已存在 + `AGENTS.md` 存在 → `check()` 返回 `'installed'` → 安装流程跳过
  - [x] 降级安装测试：mock `fs-extra.outputJson` 失败 → registry 写入抛异常 → 不 throw，输出手动注册步骤，安装正常完成
  - [x] `getToolsParam()` 返回 `null` 测试

- [x] 确认 `test/platform.test.js` 中 openclaw 相关探针测试仍通过（无需修改，保护回归）

## Dev Notes

### 平台预研结论（Story 8-2 确定）

OpenClaw 是项目级（CWD-based）平台，与 Claude Code 模式相同：

| 维度 | 结论 |
|------|------|
| 环境变量特征 | `OPENCLAW_SESSION_ID`（置信度 1.0，已在 8-1 确定） |
| 文件系统特征 | `[cwd]/.openclaw/` 目录（置信度 0.9，已在 8-1 确定） |
| agent 文件路径 | `[cwd]/.openclaw/agents/[agentId]/`（项目级） |
| 注册机制 | 文件注册：写入 `[cwd]/.openclaw/agents-registry.json` |
| 降级路径 | 输出手动注册步骤（无外部 CLI） |
| `--tools` 参数 | `null`（不传，与 HappyCapy 一致） |

### 核心变更范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/adapters/openclaw.js` | 完整实现 | 填充 Story 8-1 留下的 3 个 stub 方法 + 新增 `getToolsParam()` |
| `test/integration/openclaw.test.js` | 新建 | OpenClaw 集成测试（成功/幂等/降级） |
| `test/platform.test.js` | 不变 | 已覆盖探针逻辑，无需修改 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | 更新 | 8-2 → ready-for-dev |

### openclaw.js 完整实现设计

**文件头注释更新**：将 `// Story 8.1` 改为 `// Story 8.1/8.2`，并更新接口说明（所有方法已实现）。

**`getInstallPath(agentId)` 实现**：

```javascript
const OPENCLAW_BASE_PATH = () => path.join(process.cwd(), '.openclaw', 'agents')

export function getInstallPath(agentId) {
  if (!agentId || agentId === '.' || agentId === '..'
      || agentId.includes('/') || agentId.includes('\\')) {
    throw new BmadError(
      'E004',
      `非法 agentId：'${agentId}' 不是有效的单段标识符`,
      new Error('agentId 不得为空、"."、".." 或包含路径分隔符')
    )
  }
  const basePath = OPENCLAW_BASE_PATH()
  const targetPath = path.join(basePath, agentId)
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError(
      'E004',
      '非法安装路径：路径遍历被拒绝',
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${basePath}'`)
    )
  }
  return resolvedTarget
}
```

> ⚠️ **关键**：`OPENCLAW_BASE_PATH` 必须是函数（每次调用 `process.cwd()`），不能是模块级常量——原因：`process.cwd()` 可能在测试中通过 mock 变化，模块加载时固定的常量会导致测试失败（对比 happycapy.js 用 `os.homedir()` 可以是常量）。

**`check(agentId)` 实现**：

```javascript
export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  const exists = await fs.pathExists(installPath)
  if (!exists) return 'not_installed'
  const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
  return agentsMdExists ? 'installed' : 'corrupted'
}
```

**`install(files, options)` 实现**（文件写入已由 installer.js 完成，此处仅做平台注册）：

```javascript
export async function install(files, options = {}) {
  void files
  const agentId = options.agentId ?? 'bmad-expert'
  const registryPath = path.join(process.cwd(), '.openclaw', 'agents-registry.json')

  try {
    // 读取已有 registry（不存在则为 {}）
    let registry = {}
    if (await fs.pathExists(registryPath)) {
      registry = await fs.readJson(registryPath)
    }
    // 合并写入当前 agentId
    registry[agentId] = { installedAt: new Date().toISOString() }
    await fs.outputJson(registryPath, registry, { spaces: 2 })
  } catch {
    // 降级路径：registry 写入失败 → 输出手动步骤，不 throw
    printSuccess(
      `\n无法写入 OpenClaw 注册文件，请手动注册：\n  在 [项目根]/.openclaw/agents-registry.json 中添加：\n  { "${agentId}": { "installedAt": "${new Date().toISOString()}" } }\n`
    )
  }
}
```

**`getToolsParam()` 实现**：

```javascript
export function getToolsParam() {
  return null
}
```

### 集成测试设计（test/integration/openclaw.test.js）

参考 `test/integration/happycapy.test.js` 的结构，OpenClaw 无 execa 调用，mock 仅需 fs-extra 和 output.js。

```javascript
// Mock 策略
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
    readJson: vi.fn().mockResolvedValue({}),         // 新增：registry 读取
    outputJson: vi.fn().mockResolvedValue(undefined), // 新增：registry 写入
  },
}))

vi.mock('../../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

// 平台特征：stubEnv('OPENCLAW_SESSION_ID', 'test-session-xyz')
// 三个测试用例：成功安装 / 幂等安装 / registry 写入降级
```

**成功安装断言要点**：
- `fsExtra.outputFile` 调用次数 = 5（框架文件数）
- `fsExtra.outputJson` 被调用（registry 写入）

**幂等安装断言要点**：
- `fsExtra.pathExists` 模拟返回 `true`（安装路径存在）且 `AGENTS.md` 存在
- `check('bmad-expert')` 返回 `'installed'`
- `install()` 中的文件写入不被调用（由 installer.js 在外层跳过）

**降级安装断言要点**：
- `fsExtra.outputJson` 抛出异常
- `install()` 不 throw，流程正常完成
- `printSuccess` 被调用（输出手动步骤提示）

### 架构约束（严格遵守）

1. **禁止 default export** — 所有导出使用 Named Export
2. **禁止直接 `throw new Error()`** — 统一使用 `BmadError`（`lib/errors.js`）
3. **文件操作必须使用 `fs-extra`**，禁止原生 `fs`
4. **禁止直接 `console.error` 或 `process.exit`** — 错误通过 `BmadError` 向上抛出，由 cli.js 统一处理
5. **降级路径输出使用 `printSuccess`**（与 happycapy.js 一致，非错误，只是提示）
6. **`OPENCLAW_BASE_PATH` 必须是函数**（见上方注释说明），不能是模块加载时固定的常量

### 与 installer.js 的协作边界

`adapter.install(files, options)` 在安装流程中的位置（Phase 2 调用链）：
```
platform.js（自动检测）
  → adapter.check()（幂等判断）
  → param-builder.buildParams()（智能参数构建）
  → orchestrator.executeInstall()（npx bmad-method install）
  → orchestrator.writeSupplementFiles()（写入补充文件）
  → adapter.install()  ← 本 Story 实现此方法
  → output.js（最终输出）
```

因此 `install(files, options)` **不需要**写入 agent 文件（由 orchestrator.writeSupplementFiles 完成），只负责 OpenClaw 平台注册（即 registry 写入）。

### Project Structure Notes

- 修改文件：`lib/adapters/openclaw.js`（填充 stub 方法）
- 新建文件：`test/integration/openclaw.test.js`
- 不修改：`lib/platform.js`、`test/platform.test.js`（探针链已在 8-1 完整实现）
- 不修改：`lib/installer.js`、`lib/orchestrator.js`（适配器接口已满足调用方契约）

### References

- Story 8.2 用户故事与 AC：`_bmad-output/planning-artifacts/epics.md` §Story 8.2
- 适配器接口契约：`_bmad-output/planning-artifacts/architecture.md` 第 261-290 行
- 路径白名单设计：`_bmad-output/planning-artifacts/architecture.md` 第 191-196 行
- `--tools` 参数推断表：`_bmad-output/planning-artifacts/architecture.md` 第 328 行
- 现有 openclaw.js（探针层）：`lib/adapters/openclaw.js`
- 参考实现（HappyCapy）：`lib/adapters/happycapy.js`
- 上一 Story 实现笔记：`_bmad-output/implementation-artifacts/8-1-multi-platform-detection.md`
- 集成测试参考：`test/integration/happycapy.test.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- vitest 未在 worktree 默认 node_modules 中，需 `npm install --include=dev` 补装开发依赖
- 两个适配器单元测试初始失败原因：第二个 describe 块缺少 `vi.clearAllMocks()`，导致跨块 mock 调用计数污染；已修复（在 `describe('lib/adapters/openclaw.js')` 中添加 `beforeEach(() => { vi.clearAllMocks() })`）

### Completion Notes List

- `lib/adapters/openclaw.js` 完整实现：填充 Story 8-1 留下的 3 个 stub 方法（getInstallPath、check、install）并新增 `getToolsParam()`；`detectConfidence` / `detect` 保持不变
- 关键设计：`openclawBasePath()` 实现为**函数**（非模块级常量），确保 process.cwd() mock 在测试中生效
- `test/integration/openclaw.test.js` 新建：21 个测试（3 个集成测试 + 18 个适配器单元测试），覆盖成功安装、幂等安装、降级安装、getInstallPath 路径安全、check 状态三分支、install 合并 registry、getToolsParam 全场景
- 全套 319 测试（12 文件）100% 通过，无回归

### File List

- lib/adapters/openclaw.js
- test/integration/openclaw.test.js
- _bmad-output/implementation-artifacts/8-2-openclaw-adapter.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
