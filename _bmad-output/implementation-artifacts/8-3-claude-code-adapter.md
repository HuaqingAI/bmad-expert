# Story 8.3：Claude Code 平台适配器（完整实现）

Status: review

## Story

As a Claude Code 用户（通过 AI 代劳）,
I want 在 Claude Code 环境触发安装时，bmad-expert 自动检测 Claude Code 特征并完成 `.claude/` 目录写入，
So that 我无需了解平台差异，获得与其他平台用户一致的 BMAD 安装体验。

## Acceptance Criteria

1. **Given** 执行环境为 Claude Code（存在 `.claude/` 目录或 `CLAUDE_*`/`ANTHROPIC_API_KEY` 环境变量）
   **When** 适配器 `detect()` 执行
   **Then** 返回 `true`，`detectConfidence()` ≥ 0.9（FR47）

2. **Given** Claude Code 适配器 `getInstallPath('bmad-expert')`
   **When** 调用
   **Then** 返回 `[cwd]/.claude` 绝对路径，在白名单范围内（NFR12）

3. **Given** param-builder 为 Claude Code 确定 `--tools 'claude-code'`
   **When** 透传至 orchestrator.executeInstall()
   **Then** `npx bmad-method install --tools claude-code --yes [...]` 被执行（FR42）

4. **Given** Claude Code 适配器 `install()` 执行
   **When** 平台注册流程运行
   **Then** 完成 CLAUDE.md 写入或追加（Claude Code 注册契约），无需额外 CLI 工具，进程以 exit code 0 退出

5. **Given** `test/integration/claude-code.test.js`
   **When** 运行 `npm test`
   **Then** Claude Code 完整安装流程集成测试通过（NFR5、NFR7、NFR8）

## Tasks / Subtasks

- [x] 完善 `lib/adapters/claude-code.js`（填充 Story 8.1 的三个占位桩）
  - [x] 实现 `getInstallPath(agentId)` — 返回 `[cwd]/.claude` 绝对路径，路径白名单验证（AC: #2）
  - [x] 实现 `check(agentId)` — 检测 `.claude/AGENTS.md` 存在性（AC: #5）
  - [x] 实现 `install(files, options)` — 追加 CLAUDE.md 注册标记（AC: #4）
  - [x] 新增 `getToolsParam()` — 返回 `'claude-code'`（FR42，配合 param-builder.js）

- [x] 新建 `test/integration/claude-code.test.js`（AC: #5）
  - [x] 正常安装场景：`.claude/` 不存在时完整流程通过
  - [x] 幂等安装场景：AGENTS.md 已存在时 `check()` 返回 `'installed'`，installer throw E006
  - [x] CLAUDE.md 注册：`install()` 在 CLAUDE.md 不存在时创建，已存在时追加（幂等）
  - [x] 路径安全测试：非法 agentId 或路径越界时 throw BmadError E004

## Dev Notes

### 边界说明（Story 8.1 已完成，本 Story 接力）

Story 8.1 已实现：
- `detect()` → `(await detectConfidence()) > 0`
- `detectConfidence()` → `CLAUDE_API_KEY` 或 `ANTHROPIC_API_KEY` 存在 → 1.0；`.claude/` 存在 → 0.9；否则 → 0

本 Story（8.3）**只填充**以下三个桩方法（当前抛 `BmadError('E002', '...尚未完整实现...')`）：
- `getInstallPath(agentId)` — 行 46
- `install(files, options)` — 行 57
- `check(agentId)` — 行 69

同时新增第四个方法：`getToolsParam()`。

**禁止修改** `detect()` 和 `detectConfidence()`——已有测试覆盖，改动会造成回归。

### getInstallPath(agentId) 实现规范

**安装路径：** `path.join(process.cwd(), '.claude')`
**注意：** Claude Code 无 per-agent 子目录，所有 agent 文件统一放入 `[cwd]/.claude/`，agentId 不作为路径段，但仍需基本验证（防注入）。

```javascript
export function getInstallPath(agentId) {
  // agentId 基本验证（防注入，Claude Code 不用 agentId 作路径）
  if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
    throw new BmadError('E004', `非法 agentId：'${agentId}'`, new Error('agentId 不得为空'))
  }
  const targetPath = path.join(process.cwd(), '.claude')
  // 路径白名单验证（NFR12）：必须严格在 [cwd]/.claude 内
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(process.cwd())
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError('E004', '非法安装路径：路径越界', new Error(`路径超出 cwd 范围`))
  }
  return resolvedTarget
}
```

**关键差异（vs HappyCapy）：**
- HappyCapy：`~/.happycapy/agents/<agentId>/`（全局，含 agentId 子目录）
- Claude Code：`[cwd]/.claude/`（项目级，无 agentId 子目录）

### check(agentId) 实现规范

使用 `AGENTS.md` 作为完整安装的标记文件（与 HappyCapy 保持一致）：

```javascript
export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  const exists = await fs.pathExists(installPath)
  if (!exists) return 'not_installed'
  const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
  return agentsMdExists ? 'installed' : 'corrupted'
}
```

**返回值类型：** `'not_installed' | 'installed' | 'corrupted'`（与所有其他适配器一致）

### install(files, options) 实现规范

Claude Code 的注册契约 = **向 `[cwd]/CLAUDE.md` 追加 BMAD 引用**。
无需调用任何外部 CLI（不用 execa）。

**CLAUDE.md 路径：** `path.join(process.cwd(), 'CLAUDE.md')`（项目根，非 `.claude/CLAUDE.md`）

**幂等标记：** 追加前检查是否已含 `BMAD Expert Agent` 字符串，已含则跳过。

**追加内容：**
```markdown

# BMAD Expert Agent
Agent files installed in `.claude/`. See `.claude/AGENTS.md` for session startup instructions.
```

**实现骨架：**
```javascript
export async function install(_files, options = {}) {
  void _files // 文件由 orchestrator.writeSupplementFiles() 已写入，此处仅注册
  const agentId = options.agentId ?? 'bmad-expert'
  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md')
  const marker = 'BMAD Expert Agent'

  try {
    let existing = ''
    if (await fs.pathExists(claudeMdPath)) {
      existing = await fs.readFile(claudeMdPath, 'utf8')
    }
    if (!existing.includes(marker)) {
      const appendContent = `\n# ${marker}\nAgent files installed in \`.claude/\`. See \`.claude/AGENTS.md\` for session startup instructions.\n`
      await fs.appendFile(claudeMdPath, appendContent, 'utf8')
    }
    // 幂等：已含 marker 时静默跳过，不输出任何提示
  } catch (err) {
    const isPermission = err?.code === 'EACCES' || err?.code === 'EPERM'
    if (isPermission) {
      throw new BmadError('E004', 'CLAUDE.md 写入失败（权限不足）', err, [
        '检查项目根目录权限后重试',
        '重新执行安装命令：npx bmad-expert install',
      ])
    }
    throw new BmadError('E001', 'CLAUDE.md 注册失败', err)
  }
}
```

**注意：** `fs.appendFile` 在 fs-extra 中对应 `fs.appendFile`（fs-extra 是 fs 的超集，直接可用）。

### getToolsParam() 实现规范

FR42 要求适配器声明自己需要的 `--tools` 值：

```javascript
export function getToolsParam() {
  return 'claude-code'
}
```

**注意：** `param-builder.js` 的 `PLATFORM_TOOLS_MAP` 已独立处理此映射（不依赖适配器方法），两者并存以满足架构接口完整性。

### 完整 imports（claude-code.js 顶部不变，仅追加 path）

当前已有：
```javascript
import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'
```

**无需新增任何 import**（不用 execa，纯文件系统操作）。

### 集成测试文件规范（test/integration/claude-code.test.js）

**参考**：`test/integration/happycapy.test.js` 结构，但有以下差异：
- 不需要 mock execa（Claude Code 无 CLI 调用）
- Mock `fs-extra`：`pathExists`、`readFile`、`appendFile`
- Mock `output.js`：`printProgress`、`printSuccess`、`printError`
- 通过 `CLAUDE_API_KEY` 或 `ANTHROPIC_API_KEY` 环境变量触发 detect()

**关键测试场景：**

```javascript
// 1. 正常安装：.claude/AGENTS.md 不存在 → 安装流程完成，CLAUDE.md 被追加
// 2. 幂等保护：.claude/AGENTS.md 已存在 → install() throw BmadError E006（由 installer.js checkInstallStatus 触发）
// 3. CLAUDE.md 已含 marker → install() 不追加（幂等）
// 4. CLAUDE.md 不存在 → install() 创建并追加内容
```

**Platform 环境变量设置（在 beforeEach）：**
```javascript
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123')  // 触发 detectConfidence() → 1.0
```

**pathExists mock 策略（注意双重调用）：**
```javascript
// check() 调用 pathExists 两次：①目录存在？ ②AGENTS.md 存在？
// 正常安装场景（not_installed）：两次均返回 false
fsExtra.pathExists
  .mockResolvedValueOnce(false)  // 目录不存在
// 或：
  .mockResolvedValueOnce(true)   // 目录存在
  .mockResolvedValueOnce(false)  // AGENTS.md 不存在
```

**不需要引入 installer.js 做完整流程**——集成测试直接调用适配器方法（getInstallPath, check, install），与 happycapy.test.js 引入 installer 不同，因为 Claude Code 没有外部 CLI 依赖，适配器本身已是最小测试单元。

### 架构规则（速查）

| 规则 | 说明 |
|------|------|
| 禁止 `throw new Error()` | 统一使用 `BmadError`（`lib/errors.js`） |
| 禁止 default export | 全部 named exports |
| 文件操作使用 `fs-extra` | 禁止原生 `fs`（已 import） |
| 禁止 `execa` | Claude Code 无外部 CLI，纯文件操作 |
| 禁止 `console.log/error` | 输出通过 `output.js`，但此适配器 install() 静默注册无输出 |
| 错误码约定 | E004=路径/权限，E001=通用I/O，E002=未实现（已替换） |

### 变更范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/adapters/claude-code.js` | 扩展 | 填充 getInstallPath / check / install 三桩，新增 getToolsParam |
| `test/integration/claude-code.test.js` | 新建 | Claude Code 完整安装流程集成测试 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | 更新 | 8-3 → in-progress → done |

### 不得修改的文件

- `lib/platform.js`（8.1 已完成探针链）
- `lib/adapters/happycapy.js`（8.1 已完成）
- `lib/adapters/openclaw.js`（8.2 的范围）
- `lib/adapters/codex.js`（8.4 的范围）
- `lib/param-builder.js`（7.1 已完成，PLATFORM_TOOLS_MAP 含 claude-code 映射）
- `test/platform.test.js`（8.1 已覆盖，8.3 不改）

### 既有测试回归风险

无回归风险：
- `test/platform.test.js` 的 claude-code 相关测试仅测试 `detect()` 和 `detectConfidence()`，本 Story 不修改这两个方法
- `getInstallPath`/`install`/`check` 在 8.1 测试中未被覆盖（8.1 明确排除了这三个方法）

### References

- Epic 8 故事定义：`_bmad-output/planning-artifacts/epics.md` §Story 8.3
- 架构 §平台适配器边界：`_bmad-output/planning-artifacts/architecture.md`（adapter 接口契约）
- 架构 §多平台自动检测：`_bmad-output/planning-artifacts/architecture.md`（路径白名单规则）
- Story 8.1 开发笔记：`_bmad-output/implementation-artifacts/8-1-multi-platform-detection.md`
- 现有 HappyCapy 适配器参考：`lib/adapters/happycapy.js`（getInstallPath/check/install 实现模式）
- 现有集成测试参考：`test/integration/happycapy.test.js`
- 待实现文件：`lib/adapters/claude-code.js`（当前仅 detect + detectConfidence）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无（无需调试，首次实现通过）

### Completion Notes List

- `lib/adapters/claude-code.js` 三个占位桩全部替换为真实实现：`getInstallPath`（返回 `[cwd]/.claude` 绝对路径）、`check`（以 AGENTS.md 为安装标记）、`install`（幂等追加 CLAUDE.md 注册段落）
- 新增 `getToolsParam()` 返回 `'claude-code'`，完成 Phase 2 适配器接口契约
- 集成测试 `test/integration/claude-code.test.js` 共 23 个测试用例，覆盖所有 AC
- 测试修复：`beforeEach` 显式重置 `appendFile.mockResolvedValue(undefined)` 防止跨测试 mock 污染
- 全套 321 个测试全部通过，零回归

### File List

- lib/adapters/claude-code.js
- test/integration/claude-code.test.js
- _bmad-output/implementation-artifacts/8-3-claude-code-adapter.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
