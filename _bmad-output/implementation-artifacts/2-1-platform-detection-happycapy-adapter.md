# Story 2.1: 平台检测模块（platform.js）与 HappyCapy 适配器骨架

Status: ready-for-dev

## Story

As a 开发者（AI agent）,
I want `lib/platform.js` 实现平台自动检测逻辑，以及 `lib/adapters/happycapy.js` 实现完整适配器接口，
so that 安装流程在最早阶段确定目标平台，后续所有路径计算和注册操作通过适配器统一执行。

## Acceptance Criteria

1. **Given** 当前执行环境为 HappyCapy（存在 `happycapy-cli` 可执行文件或 `CAPY_USER_ID` 等特定环境变量）
   **When** 调用 `detectPlatform()`
   **Then** 返回字符串 `'happycapy'`，检测耗时不超过 3 秒（NFR3）

2. **Given** 执行 `detectPlatform()` 且无法自动检测到任何已知平台
   **When** 用户通过 `--platform happycapy` 显式指定（即 `detectPlatform('happycapy')` 传入 override）
   **Then** 返回 `'happycapy'`，覆盖自动检测结果（FR7）

3. **Given** `lib/adapters/happycapy.js` 已实现四个接口方法
   **When** 调用 `getInstallPath('bmad-expert')`
   **Then** 返回 `~/.happycapy/agents/bmad-expert/` 对应的绝对路径（路径在白名单内，无 `..` 遍历）

4. **Given** `test/platform.test.js` 使用 mock 环境变量测试各分支
   **When** 运行 `npm test`
   **Then** 平台检测和适配器接口测试全部通过

## Tasks / Subtasks

- [ ] 实现 `lib/platform.js` — detectPlatform 函数 (AC: #1, #2)
  - [ ] 替换占位内容，实现完整 `detectPlatform(platformOverride = null)` 函数
  - [ ] 支持 `SUPPORTED_PLATFORMS = ['happycapy', 'cursor', 'claude-code']` 验证
  - [ ] platformOverride 非 null 时：验证值在白名单内，否则 throw BmadError('E002', ...)，合法则直接返回
  - [ ] 无 override 时：按顺序调用 `happycapyAdapter.detect()`，返回第一个匹配平台名
  - [ ] 所有平台均未检测到时：throw BmadError('E002', '无法自动检测到支持的平台，请使用 --platform 参数指定')
  - [ ] 导出 `getAdapter(platformName)` 工厂函数，返回对应适配器对象（仅 happycapy 本 sprint 实现）
  - [ ] 具名导出，禁止 default export

- [ ] 实现 `lib/adapters/happycapy.js` — detect() (AC: #1)
  - [ ] 替换占位内容，实现完整适配器
  - [ ] `detect()` 方法：先检查 `process.env.CAPY_USER_ID`（非 undefined 即 HappyCapy），再尝试 execa 执行 `happycapy-cli --version`（timeout: 3000ms）
  - [ ] 任一条件满足返回 `true`，两者均失败返回 `false`
  - [ ] 检测总耗时 ≤3 秒（先 env var，execa 设置 timeout）

- [ ] 实现 `lib/adapters/happycapy.js` — getInstallPath() (AC: #3)
  - [ ] `getInstallPath(agentId)` 使用 `os.homedir()` 构建路径，不可硬编码
  - [ ] 路径格式：`path.join(os.homedir(), '.happycapy', 'agents', agentId)`
  - [ ] 路径安全验证：断言路径以 `path.join(os.homedir(), '.happycapy', 'agents')` 开头，不包含 `..`
  - [ ] 违规路径 throw BmadError('E004', '非法安装路径：路径遍历被拒绝')

- [ ] 实现 `lib/adapters/happycapy.js` — check() (AC: 为 Story 2.3 铺路)
  - [ ] `check(agentId)` 使用 fs-extra（不是原生 fs）检查安装状态
  - [ ] 目标路径不存在 → 返回 `'not_installed'`
  - [ ] 目标路径存在且包含 `AGENTS.md` → 返回 `'installed'`
  - [ ] 目标路径存在但缺少 `AGENTS.md` → 返回 `'corrupted'`
  - [ ] 检测耗时 ≤3 秒（NFR3）

- [ ] 实现 `lib/adapters/happycapy.js` — install() 接口骨架 (为 Story 2.4 预留)
  - [ ] `install(files, options)` 方法：当前 story 实现为占位骨架
  - [ ] 签名：`async install(files, options = {})` 其中 files 为文件内容映射对象，options 含 agentId
  - [ ] 骨架注释注明：完整实现由 Story 2.4 填充（文件写入 + happycapy-cli add 注册）
  - [ ] 确保函数可被调用（不 throw），但 Story 2.4 前实际为空实现

- [ ] 创建 `test/platform.test.js` (AC: #4)
  - [ ] 测试 `detectPlatform()` 无 override 时，mock `CAPY_USER_ID` 环境变量为非 undefined 值，返回 `'happycapy'`
  - [ ] 测试 `detectPlatform('happycapy')` override，返回 `'happycapy'`
  - [ ] 测试 `detectPlatform('invalid-platform')` throw BmadError，bmadCode 为 `'E002'`
  - [ ] 测试 `getInstallPath('bmad-expert')` 返回路径包含 `.happycapy/agents/bmad-expert`
  - [ ] 测试 `getInstallPath` 使用 `..` 非法 agentId 时 throw BmadError('E004')
  - [ ] 测试 `detect()` — mock `CAPY_USER_ID` 设为非 undefined，返回 true
  - [ ] 测试 `detect()` — unset `CAPY_USER_ID` 且 mock execa 调用失败，返回 false
  - [ ] 测试 `check()` — mock fs-extra，不存在时返回 `'not_installed'`，完整时返回 `'installed'`，缺文件时返回 `'corrupted'`
  - [ ] 所有 mock 使用 vitest 的 `vi.stubEnv()` / `vi.spyOn()` / `vi.mock()`，afterEach 恢复

- [ ] 验证所有测试通过 (AC: #4)
  - [ ] 执行 `npm test`，platform.test.js 全部通过
  - [ ] 已有测试（errors.test.js、exit-codes.test.js、output.test.js）无回归

## Dev Notes

### 基础模块现状（本故事可直接使用）

Epic 1 已完成以下模块，**本故事直接导入，不重新实现**：

```javascript
// lib/errors.js — 已实现，BmadError 类
export class BmadError extends Error {
  constructor(code, message, cause) { ... }
  // .bmadCode: 'E001'~'E006'
  // .cause: 原始错误
  // .retryable: E004/E005 为 true
}

// lib/exit-codes.js — 已实现，EXIT_CODES 常量
export const EXIT_CODES = { SUCCESS: 0, GENERAL_ERROR: 1, INVALID_ARGS: 2, ..., ALREADY_INSTALLED: 6 }

// lib/output.js — 已实现，三个具名导出
export function printProgress(message, done = false) { ... }  // stdout
export function printSuccess(message) { ... }                  // stdout
export function printError(err) { ... }                        // stderr, BmadError 感知
```

### lib/platform.js 完整实现

```javascript
// lib/platform.js
// 平台检测模块与适配器工厂 — Story 2.1
//
// 架构约束：
// - 具名导出，禁止 default export
// - 路径计算必须通过适配器的 getInstallPath()，禁止硬编码路径
// - 检测耗时 ≤3 秒（NFR3）
// - 错误使用 BmadError，禁止直接 throw new Error()

import { BmadError } from './errors.js'
import * as happycapyAdapter from './adapters/happycapy.js'

export const SUPPORTED_PLATFORMS = ['happycapy', 'cursor', 'claude-code']

// 当前 sprint 仅实现 happycapy；cursor/claude-code 为 Phase 1.5 占位
const PLATFORM_DETECTORS = [
  { name: 'happycapy', adapter: happycapyAdapter },
]

/**
 * 检测当前平台，支持显式覆盖
 * @param {string|null} platformOverride - --platform 参数值，null 表示自动检测
 * @returns {Promise<string>} 平台名称（'happycapy' | 'cursor' | 'claude-code'）
 * @throws {BmadError} E002 — 无效平台参数或无法自动检测
 */
export async function detectPlatform(platformOverride = null) {
  if (platformOverride !== null) {
    if (!SUPPORTED_PLATFORMS.includes(platformOverride)) {
      throw new BmadError(
        'E002',
        `无效参数: --platform 值 '${platformOverride}' 不被支持`,
        new Error(`支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`)
      )
    }
    return platformOverride
  }

  for (const { name, adapter } of PLATFORM_DETECTORS) {
    if (await adapter.detect()) {
      return name
    }
  }

  throw new BmadError(
    'E002',
    '无法自动检测到支持的平台，请使用 --platform 参数指定',
    new Error(`已尝试检测：${PLATFORM_DETECTORS.map(p => p.name).join(', ')}`)
  )
}

/**
 * 根据平台名称返回对应适配器对象
 * @param {string} platformName - 平台名称
 * @returns {object} 适配器对象（含 detect, getInstallPath, install, check 四个方法）
 * @throws {BmadError} E002 — 不支持的平台
 */
export function getAdapter(platformName) {
  const found = PLATFORM_DETECTORS.find(p => p.name === platformName)
  if (!found) {
    throw new BmadError(
      'E002',
      `不支持的平台：${platformName}`,
      new Error(`已注册平台：${PLATFORM_DETECTORS.map(p => p.name).join(', ')}`)
    )
  }
  return found.adapter
}
```

### lib/adapters/happycapy.js 完整实现

```javascript
// lib/adapters/happycapy.js
// HappyCapy 平台适配器 — Story 2.1
//
// 接口契约（必须实现四个方法）：
//   detect()                 → Promise<boolean>
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>（Story 2.4 填充完整实现）
//   check(agentId)           → Promise<'not_installed'|'installed'|'corrupted'>
//
// 特殊处理：
// - detect: 优先检查 CAPY_USER_ID 环境变量，再尝试 happycapy-cli --version
// - 路径白名单：~/.happycapy/agents/[agent-id]/，拒绝 .. 路径遍历
// - 文件操作必须使用 fs-extra，禁止原生 fs

import os from 'os'
import path from 'path'
import { execa } from 'execa'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'

const HAPPYCAPY_BASE_PATH = path.join(os.homedir(), '.happycapy', 'agents')

/**
 * 检测当前环境是否为 HappyCapy 平台
 * 检测策略（按优先级）：
 *   1. process.env.CAPY_USER_ID 存在（HappyCapy session 特征环境变量，最快）
 *   2. happycapy-cli --version 可执行（timeout: 3000ms，满足 NFR3）
 * @returns {Promise<boolean>}
 */
export async function detect() {
  // 优先环境变量（无 I/O，最快）
  if (process.env.CAPY_USER_ID !== undefined) {
    return true
  }
  // fallback：检查 CLI 是否在 PATH 中
  try {
    await execa('happycapy-cli', ['--version'], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * 返回指定 agent 的安装路径（绝对路径）
 * @param {string} agentId - agent 标识符（如 'bmad-expert'）
 * @returns {string} 绝对路径，如 /home/user/.happycapy/agents/bmad-expert
 * @throws {BmadError} E004 — 路径遍历攻击或越界路径
 */
export function getInstallPath(agentId) {
  const targetPath = path.join(HAPPYCAPY_BASE_PATH, agentId)
  // 路径安全验证（NFR12）：必须在白名单目录下，禁止 .. 遍历
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(HAPPYCAPY_BASE_PATH)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new BmadError(
      'E004',
      `非法安装路径：路径遍历被拒绝`,
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${HAPPYCAPY_BASE_PATH}'`)
    )
  }
  return resolvedTarget
}

/**
 * 检测指定 agent 的安装状态（幂等检测，NFR3: ≤3s）
 * @param {string} agentId - agent 标识符
 * @returns {Promise<'not_installed'|'installed'|'corrupted'>}
 */
export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  const exists = await fs.pathExists(installPath)
  if (!exists) return 'not_installed'
  // 以 AGENTS.md 作为完整安装的标记文件
  const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
  return agentsMdExists ? 'installed' : 'corrupted'
}

/**
 * 执行文件写入与平台注册（Story 2.4 填充完整实现）
 * @param {Object} files - 文件内容映射 { 'AGENTS.md': '内容...', ... }
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert', yes: false }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  // TODO(Story 2.4): 实现完整安装流程
  // 1. 通过 getInstallPath(options.agentId) 获取目标路径
  // 2. 使用 fs.ensureDir + fs.writeFile 写入 files 中的每个文件
  // 3. 通过 execa('happycapy-cli', ['add', options.agentId]) 完成注册
  // 4. happycapy-cli 不存在时输出手动注册命令（降级路径）
}
```

### test/platform.test.js 完整测试实现

```javascript
// test/platform.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import { detectPlatform, getAdapter, SUPPORTED_PLATFORMS } from '../lib/platform.js'
import { detect, getInstallPath, check } from '../lib/adapters/happycapy.js'
import { BmadError } from '../lib/errors.js'

// mock execa 模块（用于 detect() 中的 happycapy-cli 调用）
vi.mock('execa', () => ({
  execa: vi.fn(),
}))
// mock fs-extra（用于 check() 中的文件系统操作）
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
  },
}))

describe('lib/platform.js', () => {
  describe('detectPlatform()', () => {
    beforeEach(() => {
      // 确保 CAPY_USER_ID 未设置，让自动检测逻辑可测
      vi.stubEnv('CAPY_USER_ID', undefined)
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('platformOverride 合法时直接返回该平台名', async () => {
      const result = await detectPlatform('happycapy')
      expect(result).toBe('happycapy')
    })

    it('platformOverride 非法时 throw BmadError(E002)', async () => {
      await expect(detectPlatform('unknown-platform')).rejects.toMatchObject({
        bmadCode: 'E002',
      })
    })

    it('自动检测：CAPY_USER_ID 存在时返回 happycapy', async () => {
      vi.stubEnv('CAPY_USER_ID', 'test-user-id')
      const result = await detectPlatform()
      expect(result).toBe('happycapy')
    })

    it('自动检测：无任何平台特征时 throw BmadError(E002)', async () => {
      // CAPY_USER_ID 未设置，execa 调用失败
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      await expect(detectPlatform()).rejects.toMatchObject({ bmadCode: 'E002' })
    })
  })

  describe('getAdapter()', () => {
    it('happycapy 返回适配器对象（含四个接口方法）', () => {
      const adapter = getAdapter('happycapy')
      expect(typeof adapter.detect).toBe('function')
      expect(typeof adapter.getInstallPath).toBe('function')
      expect(typeof adapter.check).toBe('function')
      expect(typeof adapter.install).toBe('function')
    })

    it('不支持的平台 throw BmadError(E002)', () => {
      expect(() => getAdapter('unknown')).toThrow(BmadError)
    })
  })
})

describe('lib/adapters/happycapy.js', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('detect()', () => {
    it('CAPY_USER_ID 存在时返回 true（无需调用 CLI）', async () => {
      vi.stubEnv('CAPY_USER_ID', 'test-user-123')
      const result = await detect()
      expect(result).toBe(true)
    })

    it('CAPY_USER_ID 不存在，execa 成功时返回 true', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValue({ exitCode: 0 })
      const result = await detect()
      expect(result).toBe(true)
    })

    it('CAPY_USER_ID 不存在，execa 失败时返回 false', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('not found'))
      const result = await detect()
      expect(result).toBe(false)
    })
  })

  describe('getInstallPath()', () => {
    it('返回正确的绝对路径', () => {
      const result = getInstallPath('bmad-expert')
      const expected = path.join(os.homedir(), '.happycapy', 'agents', 'bmad-expert')
      expect(result).toBe(path.resolve(expected))
    })

    it('路径包含 .. 时 throw BmadError(E004)', () => {
      expect(() => getInstallPath('../evil')).toThrow(BmadError)
      expect(() => getInstallPath('../evil')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })
  })

  describe('check()', () => {
    it('目标路径不存在时返回 not_installed', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      const result = await check('bmad-expert')
      expect(result).toBe('not_installed')
    })

    it('目标路径存在且含 AGENTS.md 时返回 installed', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists
        .mockResolvedValueOnce(true)   // installPath exists
        .mockResolvedValueOnce(true)   // AGENTS.md exists
      const result = await check('bmad-expert')
      expect(result).toBe('installed')
    })

    it('目标路径存在但缺 AGENTS.md 时返回 corrupted', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists
        .mockResolvedValueOnce(true)   // installPath exists
        .mockResolvedValueOnce(false)  // AGENTS.md missing
      const result = await check('bmad-expert')
      expect(result).toBe('corrupted')
    })
  })
})
```

### 关键架构约束（开发者必须遵守）

**六条强制规则（来自 architecture.md）：**
1. 新增错误场景使用 `BmadError`，禁止 `throw new Error()`
2. 所有进度输出通过 `output.js` 函数，禁止 `console.log`
3. 平台路径计算通过 `platform.js` 的 `getInstallPath()`，禁止硬编码路径
4. 退出码使用 `EXIT_CODES` 常量，禁止数字字面量
5. 文件操作使用 `fs-extra`，禁止原生 `fs`
6. 外部进程调用使用 `execa`，禁止 `child_process.exec`

**本故事涉及的反模式（禁止）：**
```javascript
// ❌ 硬编码路径
const installPath = `${os.homedir()}/.happycapy/agents/${agentId}`

// ❌ 使用原生 fs
import fs from 'fs'
await fs.promises.mkdir(path, { recursive: true })

// ❌ 使用 child_process
import { exec } from 'child_process'
exec('happycapy-cli --version')

// ❌ 直接 console.error
console.error('检测失败')

// ❌ 硬编码数字退出码
process.exit(4)
```

**正确用法示例：**
```javascript
// ✅ 路径通过 os.homedir() + path.join 构建
const basePath = path.join(os.homedir(), '.happycapy', 'agents', agentId)

// ✅ 文件操作用 fs-extra
import fs from 'fs-extra'
const exists = await fs.pathExists(targetPath)

// ✅ 外部 CLI 用 execa
import { execa } from 'execa'
await execa('happycapy-cli', ['--version'], { timeout: 3000 })

// ✅ 错误用 BmadError
throw new BmadError('E002', '平台检测失败', originalError)
```

### 关于 cursor.js 和 claude-code.js 占位适配器

本故事**不修改** `lib/adapters/cursor.js` 和 `lib/adapters/claude-code.js`——它们是 Phase 1.5 的占位文件，暂不导出任何内容。

`platform.js` 的 `PLATFORM_DETECTORS` 数组目前**只注册 happycapy**，Phase 1.5 实现后再追加其他适配器。`SUPPORTED_PLATFORMS` 数组保留 `'cursor'` 和 `'claude-code'` 条目是为了让 `--platform` 参数验证允许这些值（虽然 `getAdapter()` 此时只能返回 happycapy 适配器）。

### 来自 Epic 1 各 Story 的关键经验

**Story 1.1 经验：**
- **ESLint flat config**：项目使用 `eslint.config.js`（非 `.eslintrc.js`），必须保持兼容
- **ESM only**：所有导入使用 `import`/`export`，禁止 `require()`/`module.exports`
- **vitest passWithNoTests**：已配置，新增测试文件会自动被识别

**Story 1.2 经验：**
- **具名导出一致性**：`export function xxx` / `export const XXX`，禁止 `export default`
- **BmadError 接口确认**：`.bmadCode`、`.message`、`.cause`、`.retryable` 均已实现

**Story 1.3 经验（output.js）：**
- **chalk 输出影响测试**：spy 测试时使用 `toContain()` 而非严格相等，避免 ANSI 转义码干扰
- **vitest spy 的 mockImplementation**：`process.stdout.write` 的 spy 需 `.mockImplementation(() => true)`
- **afterEach vi.restoreAllMocks()**：确保 spy 不跨测试污染

**Story 1.4 经验（CI/CD）：**
- **package.json 已有 bmadExpert 字段**：`frameworkFiles` 和 `userDataPaths` 已硬编码，本故事不修改 package.json

### 依赖版本（精确锁定，不可更改）

```json
{
  "dependencies": {
    "chalk": "5.6.2",
    "commander": "14.0.3",
    "execa": "9.6.1",
    "fs-extra": "11.3.4"
  },
  "devDependencies": {
    "vitest": "4.1.1"
  }
}
```

**execa v9 使用方式（ESM）：**
```javascript
import { execa } from 'execa'  // 具名导入
// 禁止：import execa from 'execa'（非默认导出）
```

**fs-extra v11 使用方式（ESM）：**
```javascript
import fs from 'fs-extra'  // 默认导入
await fs.pathExists(targetPath)   // 返回 Promise<boolean>
await fs.ensureDir(targetPath)    // 确保目录存在（含父目录）
await fs.copy(src, dest)          // 复制文件/目录
await fs.writeFile(filePath, content)
```

### vitest mock 技术要点

**vi.mock() 模块 mock（在测试文件顶层）：**
```javascript
// 注意：vi.mock() 会被 hoisted 到文件顶部，必须在 import 之前或 describe 外
vi.mock('execa', () => ({
  execa: vi.fn(),
}))
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
  },
}))
```

**vi.stubEnv 环境变量 mock：**
```javascript
// 设置环境变量（test scope）
vi.stubEnv('CAPY_USER_ID', 'test-value')

// 清除（在 afterEach 中）
vi.unstubAllEnvs()

// 注意：vi.stubEnv('KEY', undefined) 等同于删除该变量
```

**获取 mock 后的模块引用：**
```javascript
// 在测试函数内动态获取 mock 对象
const { execa } = await import('execa')
execa.mockResolvedValue({ exitCode: 0 })
execa.mockRejectedValue(new Error('not found'))
```

### Project Structure Notes

**本故事修改/新建文件：**
- 修改 `lib/platform.js`：替换占位内容，实现完整平台检测与适配器工厂
- 修改 `lib/adapters/happycapy.js`：替换占位内容，实现完整 HappyCapy 适配器
- 新建 `test/platform.test.js`：平台检测与适配器接口测试

**本故事不修改的文件：**
- `lib/errors.js`、`lib/exit-codes.js`、`lib/output.js`（Epic 1 已完成）
- `lib/installer.js`（Story 2.4 填充）
- `lib/adapters/cursor.js`、`lib/adapters/claude-code.js`（Phase 1.5）
- `cli.js`（当前已有骨架，Story 2.4 接入 install 命令时修改）
- `package.json`（已有完整配置，不需修改）

**关注回归测试：**
- `test/errors.test.js`、`test/exit-codes.test.js`、`test/output.test.js` 不应有任何回归

### References

- Story 2.1 验收标准：[Source: _bmad-output/planning-artifacts/epics.md#Story-2.1]
- 架构文档 平台适配器架构：[Source: _bmad-output/planning-artifacts/architecture.md#平台适配器架构]
- 架构文档 安全架构（路径白名单）：[Source: _bmad-output/planning-artifacts/architecture.md#安全架构]
- 架构文档 实现模式：[Source: _bmad-output/planning-artifacts/architecture.md#实现模式与一致性规则]
- 架构文档 错误处理模式：[Source: _bmad-output/planning-artifacts/architecture.md#错误处理模式]
- 架构文档 异步模式：[Source: _bmad-output/planning-artifacts/architecture.md#异步模式]
- Epic 2 Overview：[Source: _bmad-output/planning-artifacts/epics.md#Epic-2]
- Story 1.1 经验（项目结构/ESLint）：[Source: _bmad-output/implementation-artifacts/1-1-npm-package-init.md]
- Story 1.2 经验（BmadError 接口）：[Source: _bmad-output/implementation-artifacts/1-2-exit-codes-and-errors.md]
- Story 1.3 经验（vitest spy/chalk）：[Source: _bmad-output/implementation-artifacts/1-3-output-module.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
