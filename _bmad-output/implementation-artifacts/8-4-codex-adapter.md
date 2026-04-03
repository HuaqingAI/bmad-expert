# Story 8.4: Codex 平台适配器

Status: ready-for-dev

## Story

As a Codex（OpenAI）用户（通过 AI 代劳）,
I want 在 Codex 平台触发安装时，bmad-expert 自动检测 Codex 环境并完成平台注册契约，
so that 我可以在 Codex 中获得与其他平台一致的 BMAD 安装体验。

## Acceptance Criteria

1. **Given** 执行环境为 Codex（`CODEX_RUNTIME` 环境变量存在）
   **When** 适配器 `detect()` 执行
   **Then** 返回 `true`，`detectConfidence()` 返回 `1.0`（FR47、FR48）

2. **Given** `.codex/` 目录存在于 cwd 中（无 `CODEX_RUNTIME`）
   **When** 适配器 `detect()` 执行
   **Then** 返回 `true`，`detectConfidence()` 返回 `0.9`

3. **Given** 无任何 Codex 特征信号
   **When** `detectConfidence()` 执行
   **Then** 返回 `0`，`detect()` 返回 `false`

4. **Given** Codex 适配器 `getInstallPath('bmad-expert')` 被调用
   **When** 执行
   **Then** 返回 `[cwd]/.codex/` 的绝对路径，路径在白名单范围内（NFR12）
   **And** 路径不含 `..` 路径遍历段

5. **Given** 非法 agentId（空串、`..`、含路径分隔符）
   **When** `getInstallPath()` 被调用
   **Then** 抛出 `BmadError('E004', ...)`

6. **Given** 适配器 `check('bmad-expert')` 被调用，目标路径不存在
   **When** 执行
   **Then** 返回 `'not_installed'`

7. **Given** 目标路径存在且含 `AGENTS.md`
   **When** `check()` 执行
   **Then** 返回 `'installed'`

8. **Given** 目标路径存在但缺少 `AGENTS.md`
   **When** `check()` 执行
   **Then** 返回 `'corrupted'`

9. **Given** `install(files, options)` 执行（Codex 注册契约）
   **When** 执行
   **Then** 完成 Codex 注册契约（无需外部 CLI，仅文件系统操作）
   **And** 若目标目录不存在则自动创建，进程以 exit code 0 退出

10. **Given** `test/integration/codex.test.js` 已实现
    **When** 运行 `npm test`
    **Then** Codex 完整安装流程集成测试通过（NFR5、NFR8）

## Tasks / Subtasks

- [ ] 更新 `lib/adapters/codex.js`：完整实现 Codex 适配器 (AC: #1-9)
  - [ ] 更新 `detectConfidence()`：新增 `.codex/` 目录探针（返回 0.9）
  - [ ] 更新 `detect()`：委托 `detectConfidence()` 判断
  - [ ] 实现 `getInstallPath(agentId)`：返回 `[cwd]/.codex/` 绝对路径（白名单验证）
  - [ ] 实现 `check(agentId)`：检测安装状态（not_installed/installed/corrupted）
  - [ ] 实现 `install(files, options)`：Codex 注册契约（文件系统操作，无需 CLI）

- [ ] 新建 `test/integration/codex.test.js`：Codex 完整安装流程集成测试 (AC: #10)
  - [ ] 成功安装场景（CODEX_RUNTIME 存在）
  - [ ] 幂等安装场景（already_installed）
  - [ ] 错误场景（权限拒绝）
  - [ ] 跨平台行为一致性验证

- [ ] 更新 `test/platform.test.js`：补充 Codex 适配器完整接口测试
  - [ ] `getInstallPath()` 正确性与路径安全性测试
  - [ ] `check()` 三种状态测试
  - [ ] `install()` 注册契约测试

## Dev Notes

### 关键架构约束（必须遵守）

1. **具名导出**：所有函数均为具名导出，禁止 default export
2. **fs-extra**：文件操作使用 `fs-extra`，禁止原生 `fs`（`pathExists`、`ensureDir`、`outputFile` 等）
3. **BmadError**：所有错误场景抛出 `BmadError`，禁止 `throw new Error()`
4. **禁止 process.exit()**：lib 模块内禁止直接退出，错误向上抛出至 `cli.js` 顶层
5. **路径白名单（NFR12）**：写入路径必须是 `[cwd]/.codex/[agentId]/`，拒绝任何 `..` 路径遍历
6. **output.js 单点输出**：所有进度/成功/错误输出通过 `output.js`，禁止直接 `console.log`

### Codex 平台预研结论（实现依据）

**探针信号（来自架构文档 + 实际分析）：**
- `CODEX_RUNTIME` 环境变量 → 置信度 `1.0`（Codex 沙盒专属变量，Story 8-1 已定义）
- `[cwd]/.codex/` 目录存在 → 置信度 `0.9`（Codex 项目配置目录特征）
- 无上述信号 → `0`

**安装路径：**
- `[cwd]/.codex/[agentId]/`（例：`/project/.codex/bmad-expert/`）
- 类比 Claude Code 的 `[cwd]/.claude/`，Codex 用 `.codex/` 目录存放 agent 文件

**注册契约：**
- Codex 平台无需外部注册 CLI（类比 Claude Code 的无 CLI 注册方式）
- 注册完成 = 将 agent 文件写入 `[cwd]/.codex/[agentId]/`
- `install()` 的职责：确保目标目录存在即可（文件由 `installer.js` 已写入文件系统）
- 降级路径：若目录创建失败（权限问题），输出手动步骤而非抛出异常（与 HappyCapy 一致）

**文件系统权限：**
- Codex 沙盒允许写入 cwd 及其子目录（类比 Claude Code），`.codex/` 在可写范围内
- 路径白名单：`[cwd]/.codex/agents/` 子目录，拒绝 `..` 遍历

### `lib/adapters/codex.js` 实现规范

**完整实现参考 HappyCapy 和 Claude Code 适配器模式：**

```javascript
// lib/adapters/codex.js
import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'

// 白名单基础路径：[cwd]/.codex/（运行时确定）
function getCodexBaseDir() {
  return path.join(process.cwd(), '.codex')
}

export async function detectConfidence() {
  // 信号 1：CODEX_RUNTIME 专属环境变量 → 1.0
  if (process.env.CODEX_RUNTIME) return 1.0
  // 信号 2：.codex/ 目录存在 → 0.9
  const codexDir = path.join(process.cwd(), '.codex')
  if (await fs.pathExists(codexDir)) return 0.9
  return 0
}

export async function detect() {
  return (await detectConfidence()) > 0
}

export function getInstallPath(agentId) {
  // agentId 合法性检查（与 happycapy 适配器相同规则）
  if (!agentId || agentId === '.' || agentId === '..' ||
      agentId.includes('/') || agentId.includes('\\')) {
    throw new BmadError('E004', `非法 agentId：'${agentId}'`, new Error('...'))
  }
  const baseDir = getCodexBaseDir()
  const targetPath = path.join(baseDir, agentId)
  // 路径安全验证
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(baseDir)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError('E004', '非法安装路径：路径遍历被拒绝', new Error('...'))
  }
  return resolvedTarget
}

export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  const exists = await fs.pathExists(installPath)
  if (!exists) return 'not_installed'
  const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
  return agentsMdExists ? 'installed' : 'corrupted'
}

export async function install(files, options = {}) {
  void files  // 文件已由 installer.js 写入，此处仅确保目录存在
  const agentId = options.agentId ?? 'bmad-expert'
  const installPath = getInstallPath(agentId)
  try {
    await fs.ensureDir(installPath)
  } catch {
    // 降级路径：输出手动步骤，不 throw
    const { printSuccess } = await import('../output.js')
    printSuccess(`\n目录创建失败，请手动执行：\n  mkdir -p ${installPath}\n`)
  }
}
```

**注意与 HappyCapy 的关键差异：**
- HappyCapy 路径基于 `~/.happycapy/agents/`（home 目录）
- Codex 路径基于 `[cwd]/.codex/`（工作目录，动态，需 `process.cwd()` 运行时确定）
- Codex `install()` 无 execa 调用（Claude Code 也无，HappyCapy 有）

### 测试规范

**`test/integration/codex.test.js` 骨架：**

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { install } from '../../lib/installer.js'

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('../../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

describe('Codex 完整安装流程（集成测试）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('CODEX_RUNTIME', 'true')  // Codex 平台特征
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)  // 默认 not_installed
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('成功安装：exit code 0，AGENTS.md 写入目标路径', async () => {
    const result = await install({ platform: 'codex', agentId: 'bmad-expert' })
    expect(result).toMatchObject({ platform: 'codex' })
  })

  it('幂等安装：已安装时跳过，返回 ALREADY_INSTALLED', async () => {
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists
      .mockResolvedValueOnce(true)  // installPath 存在
      .mockResolvedValueOnce(true)  // AGENTS.md 存在
    await expect(install({ platform: 'codex', agentId: 'bmad-expert' }))
      .rejects.toMatchObject({ bmadCode: 'E006' })
  })
})
```

**`test/platform.test.js` 补充测试（追加到现有 codex 探针测试之后）：**

追加以下测试：
- `getInstallPath()` 返回含 `.codex/bmad-expert` 的绝对路径
- `getInstallPath()` 非法 agentId 抛出 E004
- `check()` 三种状态（not_installed/installed/corrupted）
- `install()` 正常执行不 throw

### 现有代码模式参考

1. **happycapy.js**：完整适配器参考实现（`getInstallPath` / `check` / `install` 模式完全一致，路径基础不同）
2. **claude-code.js（探针层）**：路径基于 cwd 的方式参考
3. **platform.test.js 现有 codex 探针测试**：`detectConfidence` / `detect` 测试已存在，新增方法测试追加其后
4. **test/integration/happycapy.test.js**：集成测试 mock 模式完全参考（vi.mock 顺序、stubEnv 用法）
5. **lib/installer.js**：`install()` 函数调用 `adapter.check()` + `adapter.getInstallPath()` + `adapter.install()` 的链路，Codex 适配器需与之兼容

### 与其他 Story 的边界

| Story | 边界 |
|-------|------|
| Story 8-1（已完成） | Codex 探针层（detect + detectConfidence）已实现，本 Story 完善剩余方法 |
| Story 8-4（本 Story） | 补全 getInstallPath / check / install；新增集成测试 |
| Story 8-5 | 跨平台一致性验证，依赖本 Story 完成 |

### 前序 Story 关键 Learnings（来自 7-1、7-2、8-1）

- **ESM + 具名导出**：所有 lib 模块均为 `export function`，测试文件用 `import { xxx } from '...'`
- **vitest `vi.stubEnv`**：环境变量 mock 必须在 `afterEach` 用 `vi.unstubAllEnvs()` 清理，否则污染其他测试
- **`fs-extra` mock 路径**：mock 时用 `(await import('fs-extra')).default`（因为 fs-extra 是 default export）
- **动态 cwd 路径**：`process.cwd()` 在测试中返回项目根目录，`getInstallPath('bmad-expert')` 应包含 `.codex/bmad-expert`
- **测试 `getInstallPath`**：路径断言用 `toContain('.codex')` + `toContain('bmad-expert')`，不要硬编码绝对路径

### References

- FR47（多平台自动检测）：`_bmad-output/planning-artifacts/epics.md` → Story 8.1 AC
- FR48（Codex 平台支持）：`_bmad-output/planning-artifacts/epics.md` → Story 8.4 AC
- NFR12（路径白名单）：`_bmad-output/planning-artifacts/architecture.md` → "路径白名单（NFR12）"
- NFR5（4 平台安装成功）：`_bmad-output/planning-artifacts/architecture.md` → "非功能需求"
- Codex 注册机制：`_bmad-output/planning-artifacts/architecture.md` → "适配器注册机制" 表格
- 适配器接口：`_bmad-output/planning-artifacts/architecture.md` → "适配器接口扩展（Phase 2）"
- 现有 Codex 探针实现：`lib/adapters/codex.js`（Story 8-1 完成的探针层）
- HappyCapy 完整适配器参考：`lib/adapters/happycapy.js`
- Claude Code 适配器参考（cwd 路径）：`lib/adapters/claude-code.js`
- 集成测试参考：`test/integration/happycapy.test.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- 所有 AC（#1-9）均已实现，312 项测试通过（12 个测试文件）
- `detectConfidence()` 重构为调用 `getCodexBaseDir()` 辅助函数，消除重复表达式（代码审查 patch 修复）
- 集成测试降级路径需要对 ensureDir 进行两次独立 mock：第一次（installer.js Step 3）成功，第二次（adapter Step 5）失败；已在注释中明确说明调用顺序

### File List

- `lib/adapters/codex.js`（完整实现 Story 8.4 所有接口）
- `test/integration/codex.test.js`（新建，Codex 完整安装流程集成测试）
- `test/platform.test.js`（追加 getInstallPath / check / install 适配器测试；fs-extra mock 补充 ensureDir）
