# Story 8.1: 多平台自动检测探针链（platform.js 扩展）

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert install` 时无需指定 `--platform` 参数，系统通过探针链自动识别当前宿主平台,
so that 任何平台的用户都可以直接执行同一条命令，不需要了解自己在使用哪个平台。

## Acceptance Criteria

1. **Given** `--platform` 未指定，执行环境为 HappyCapy（`CAPY_USER_ID` 存在或 `happycapy-cli` 可调用）
   **When** `detectPlatform()` 执行
   **Then** 返回 `'happycapy'`，`detectConfidence('happycapy')` ≥ 0.9，总检测耗时 ≤ 1 秒（NFR15）（FR47）

2. **Given** 多个平台探针同时命中（冲突场景，如同时检测到 HappyCapy 和 Claude Code）
   **When** 探针链执行
   **Then** 返回 `detectConfidence()` 最高的平台，不产生歧义

3. **Given** 所有探针均未命中（未知环境）
   **When** `detectPlatform()` 执行
   **Then** 抛出 `BmadError('E002', '无法自动检测平台，请通过 --platform 手动指定')`，提示支持的平台列表（FR47）

4. **Given** `--platform happycapy` 显式传入
   **When** `detectPlatform('happycapy')` 执行
   **Then** 直接返回 `'happycapy'`，跳过探针链（FR7 保持不变）

5. **Given** `test/platform.test.js` 扩展覆盖探针链的 4 平台场景
   **When** 运行 `npm test`
   **Then** 所有探针逻辑、置信度计算、冲突处理测试通过；既有测试无回归

## Tasks / Subtasks

- [x] 为 4 个适配器添加 `detectConfidence()` 方法（AC: #1, #2）
  - [x] `lib/adapters/happycapy.js`：添加 `detectConfidence()`，CAPY_USER_ID 在 → 1.0，happycapy-cli 可用 → 0.9，否则 → 0
  - [x] `lib/adapters/claude-code.js`：实现 `detect()` + `detectConfidence()`（`.claude/` 目录 → 0.9，`CLAUDE_*` env → 1.0，否则 → 0）
  - [x] `lib/adapters/openclaw.js`：添加基础 `detect()` + `detectConfidence()` 骨架（`OPENCLAW_*` env → 0.9，否则 → 0）
  - [x] `lib/adapters/codex.js`：新建文件，实现 `detect()` + `detectConfidence()`（`CODEX_*` env → 1.0，否则 → 0）

- [x] 重构 `lib/platform.js` 为置信度探针链（AC: #1, #2, #3, #4）
  - [x] 注册 4 个平台适配器到 `PLATFORM_DETECTORS`
  - [x] 更新 `SUPPORTED_PLATFORMS` 包含 `'openclaw'`、`'codex'`
  - [x] `detectPlatform()` 改为：并发调用所有探针 → 收集置信度 → 取最高置信度平台（≥ 阈值 0.5）
  - [x] 冲突处理：多个平台置信度相同时按注册顺序取第一个（deterministic）
  - [x] 未命中时 throw `BmadError('E002', '无法自动检测平台，请通过 --platform 手动指定')`，消息中列出所有 SUPPORTED_PLATFORMS
  - [x] 导出辅助函数 `detectConfidence(platformName)` → 返回指定平台当前环境的置信度

- [x] 更新 `test/platform.test.js` 覆盖 4 平台探针场景（AC: #5）
  - [x] 更新 SUPPORTED_PLATFORMS 断言（新增 openclaw、codex）
  - [x] 为每个新平台添加：detect() 成功、detect() 失败、detectConfidence() 返回正确值的测试
  - [x] 添加冲突场景测试（两个探针同时命中 → 高置信度优先）
  - [x] 添加全部未命中场景测试（→ BmadError E002）
  - [x] 更新 `platformOverride` 测试：claude-code 现已实现，不再抛 E002

## Dev Notes

### 核心变更范围

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/platform.js` | 重构 | 顺序检测 → 并发置信度探针链 |
| `lib/adapters/happycapy.js` | 扩展 | 新增 `detectConfidence()` 方法 |
| `lib/adapters/claude-code.js` | 实现 | 从占位骨架升级为实际探针（仅 detect + detectConfidence，full adapter 在 8-3） |
| `lib/adapters/openclaw.js` | 新建 | 基础探针骨架（full adapter 在 8-2） |
| `lib/adapters/codex.js` | 新建 | 基础探针（full adapter 在 8-4） |
| `test/platform.test.js` | 扩展 | 覆盖 4 平台 + 冲突 + 未命中场景 |

**Story 8-1 的边界**：只实现探针链（detect + detectConfidence）。`getInstallPath`、`install`、`check`、`getToolsParam` 等方法由后续 Stories 8-2/8-3/8-4 填充完整实现。openclaw.js / codex.js 的 `getInstallPath` / `install` / `check` 在本 Story 可作占位骨架。

### 适配器接口扩展（architecture.md §平台适配器边界）

Phase 2 适配器接口完整定义（本 Story 只实现带 ✅ 的两个方法）：

```javascript
{
  detect(): Promise<boolean>,              // ✅ 本 Story 实现
  detectConfidence(): Promise<number>,     // ✅ 本 Story 实现（0-1）
  getInstallPath(agentId): string,         // ⏳ 8-2/8-3/8-4 实现
  install(files, options): Promise<void>,  // ⏳ 8-2/8-3/8-4 实现
  check(agentId): Promise<string>,         // ⏳ 8-2/8-3/8-4 实现
  getToolsParam(): string | null,          // ⏳ 8-2/8-3/8-4 实现
}
```

### platform.js 重构设计

现有逻辑（顺序 detect，命中第一个）→ 新逻辑（并发 detectConfidence，取最高分）：

```javascript
// 当前（Story 2.1 遗留）
for (const { name, adapter } of PLATFORM_DETECTORS) {
  if (await adapter.detect()) return name
}

// 新（Story 8-1）
const results = await Promise.all(
  PLATFORM_DETECTORS.map(async ({ name, adapter }) => ({
    name,
    confidence: await adapter.detectConfidence(),
  }))
)
const best = results.reduce((a, b) => (b.confidence > a.confidence ? b : a))
if (best.confidence >= CONFIDENCE_THRESHOLD) return best.name
throw new BmadError('E002', ...)
```

### 置信度设计规范

| 值 | 含义 | 场景 |
|---|-----|------|
| 1.0 | 确定命中 | 平台专属环境变量存在（如 `CAPY_USER_ID`、`CLAUDE_API_KEY`） |
| 0.9 | 高置信 | CLI 工具存在或配置目录存在 |
| 0.5 | 中等 | 弱信号（如通用 `OPENAI_API_KEY`） |
| 0.0 | 未命中 | 无任何信号 |

**阈值**：`CONFIDENCE_THRESHOLD = 0.5`（可作为模块内常量，不导出）

### 各平台探针逻辑

**HappyCapy**（在 happycapy.js 中）：
```javascript
export async function detectConfidence() {
  if (process.env.CAPY_USER_ID) return 1.0
  try {
    await execa('happycapy-cli', ['--version'], { timeout: 1000 })
    return 0.9
  } catch { return 0 }
}
```

**Claude Code**（在 claude-code.js 中，只实现 detect 层）：
```javascript
import fs from 'fs-extra'
import path from 'path'
export async function detectConfidence() {
  if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) return 1.0
  const claudeDir = path.join(process.cwd(), '.claude')
  if (await fs.pathExists(claudeDir)) return 0.9
  return 0
}
export async function detect() { return (await detectConfidence()) > 0 }
```

**OpenClaw**（新建 openclaw.js）：
- 信号：`OPENCLAW_*` 环境变量 → 1.0；`.openclaw/` 目录 → 0.9
- 注意：实际环境变量名在 8-2 预研后可能更新，本 Story 使用 `OPENCLAW_SESSION_ID` 作为占位符

**Codex**（新建 codex.js）：
- 信号：`CODEX_*` env → 1.0；`OPENAI_API_KEY` 不传 → 0（过于通用，不作为 Codex 特征信号）
- 注意：实际 Codex 特征在 8-4 预研后可能更新，本 Story 使用 `CODEX_RUNTIME` 作为占位符

### 架构规则（必须遵守）

1. **禁止直接 `throw new Error()`** — 统一使用 `BmadError`（`lib/errors.js`）
2. **禁止 default export** — 全部使用 Named Exports
3. **文件操作必须使用 `fs-extra`**，不用原生 `fs`
4. **外部进程调用必须使用 `execa`**，不用 `child_process.exec`
5. **并发操作使用 `Promise.all`**，不顺序 await
6. **新建 openclaw.js / codex.js** 占位方法中：`getInstallPath` / `install` / `check` 可 throw `BmadError('E002', '平台 X 适配器尚未完整实现')`（将在 8-2/8-4 填充）

### 对既有测试的影响

当前 `test/platform.test.js` 中两个测试会因本 Story 改变而**需要更新**：

```javascript
// 这两个测试在 8-1 完成后必须更新（claude-code 已实现，不再 throw E002）
it('platformOverride 为 claude-code 时 throw BmadError(E002)（Phase 1.5 未实现）', ...)
it('Phase 1.5 占位平台（cursor）throw BmadError(E002)', ...)
```

- `claude-code` 升为已实现，`platformOverride('claude-code')` 应成功返回（或如果 detect 未命中则走探针失败路径）
- `cursor` 仍在 SUPPORTED_PLATFORMS 但无探针，`detectPlatform('cursor')` 仍 throw（"平台尚未实现"）
- SUPPORTED_PLATFORMS 断言需加入 `'openclaw'` 和 `'codex'`

### NFR15：探针链 ≤ 1 秒

HappyCapy 的 `execa('happycapy-cli', ['--version'])` timeout 从当前的 3000ms 降至 **1000ms**，以满足总探针链 ≤ 1 秒要求。

### Project Structure Notes

- 新建文件：`lib/adapters/openclaw.js`，`lib/adapters/codex.js`
- 修改文件：`lib/platform.js`，`lib/adapters/happycapy.js`，`lib/adapters/claude-code.js`
- 测试文件：`test/platform.test.js`（扩展，不新建）
- 不新建集成测试文件（openclaw.test.js / claude-code.test.js / codex.test.js 在对应适配器 Story 创建）

### References

- Epic 8 故事定义：`_bmad-output/planning-artifacts/epics.md` §Story 8.1
- 架构 §多平台自动检测架构（Phase 2）：`_bmad-output/planning-artifacts/architecture.md` 第 358-376 行
- 架构 §平台适配器边界：`_bmad-output/planning-artifacts/architecture.md` 第 661-670 行
- 现有 platform.js：`lib/platform.js`（当前 Story 2.1 实现，顺序探针）
- 现有 happycapy.js：`lib/adapters/happycapy.js`（含 detect() 实现参考）
- 占位骨架：`lib/adapters/cursor.js`、`lib/adapters/claude-code.js`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- lib/platform.js
- lib/adapters/happycapy.js
- lib/adapters/claude-code.js
- lib/adapters/openclaw.js (新建)
- lib/adapters/codex.js (新建)
- test/platform.test.js
- _bmad-output/implementation-artifacts/sprint-status.yaml
