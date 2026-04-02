# Story 7.1: 智能参数构建引擎（param-builder.js）

Status: done

## Story

As a 用户（通过 AI 代劳）,
I want `lib/param-builder.js` 根据目标平台和项目上下文自动推断 BMAD 官方安装器所需的全部参数,
so that 安装时无需了解或指定复杂的 BMAD 安装参数，系统自动构建最优配置，降低安装门槛。

## Acceptance Criteria

1. **Given** `lib/param-builder.js` 已实现，传入 `platform='happycapy'`
   **When** 调用 `buildParams(platform, context)`
   **Then** 返回对象的 `tools` 字段为 `null`（不传），符合 HappyCapy 平台约定（FR42）

2. **Given** 传入 `platform='claude-code'`
   **When** 调用 `buildParams(platform, context)`
   **Then** 返回对象的 `tools` 字段值为 `'claude-code'`（FR42）

3. **Given** 传入 `platform='openclaw'` 或 `platform='codex'`
   **When** 调用 `buildParams(platform, context)`
   **Then** 返回对象的 `tools` 字段为 `null`（FR42）

4. **Given** 项目目录中已有 BMAD 配置（存在 `_bmad/bmm/config.yaml`）且包含 `communication-language` 设置
   **When** 调用 `buildParams(platform, context)`（context.projectRoot 指向项目目录）
   **Then** 返回的 `communicationLanguage` 字段反映已有配置语言；若未检测到，fallback 为系统 locale（FR43）

5. **Given** 用户未显式指定 `--modules`（context.userOverrides.modules 为 null）
   **When** 调用 `buildParams(platform, context)`
   **Then** 返回 `modules` 字段默认为 `'bmm'`；检测到项目中已有 bmb 配置时追加返回 `'bmm,bmb'`（FR43）

6. **Given** 用户通过 CLI 传入 `--tools 'custom-tool'`（context.userOverrides.tools = 'custom-tool'）
   **When** 调用 `buildParams(platform, context)`
   **Then** 返回的 `tools` 字段值为 `'custom-tool'`，覆盖自动推断结果（FR46）
   **And** 参数优先级：用户显式 > 智能推断 > 默认值

7. **Given** `cli.js` 的 `install` 命令
   **When** 用户传入 `--modules`, `--tools`, `--communication-language`, `--output-folder` 等 Phase 2 参数
   **Then** 这些参数被正确解析并传入 `install()` 的 options 对象（占位实现，供 Story 7.3 连线）

8. **Given** `test/param-builder.test.js` 覆盖各平台 + 各 context 场景
   **When** 运行 `npm test`
   **Then** 所有参数推断逻辑测试通过，包含覆盖场景断言（AC1-6 全覆盖）

## Tasks / Subtasks

- [x] 新建 `lib/param-builder.js`：智能参数构建引擎 (AC: #1-6)
  - [x] 定义 `buildParams(platform, context = {})` 具名导出函数
  - [x] 实现 `--tools` 平台映射逻辑：claude-code → `'claude-code'`；其余 → `null`
  - [x] 实现 `--modules` 推断：默认 `'bmm'`；检测到 bmb 配置时追加 `'bmm,bmb'`
  - [x] 实现 `--communication-language` 推断：读 `_bmad/bmm/config.yaml`；fallback 系统 locale
  - [x] 实现参数优先级合并：`userOverrides` > 智能推断 > 默认值
  - [x] 返回结构化参数对象 + `toArgs()` 转换方法

- [x] 修改 `cli.js`：`install` 命令新增 Phase 2 选项 (AC: #7)
  - [x] 新增 `--modules <modules>`
  - [x] 新增 `--tools <tools>`
  - [x] 新增 `--communication-language <lang>`
  - [x] 新增 `--output-folder <path>`
  - [x] 新增 `--user-name <name>`
  - [x] 新增 `--action <type>`
  - [x] 将上述参数传入 `install()` options（install() 函数签名接收但暂不使用，供 Story 7.3 消费）

- [x] 新建 `test/param-builder.test.js`：参数构建逻辑完整测试 (AC: #8)
  - [x] platform=happycapy → tools=null
  - [x] platform=claude-code → tools='claude-code'
  - [x] platform=openclaw → tools=null
  - [x] platform=codex → tools=null
  - [x] 无 BMAD 配置 → modules='bmm'
  - [x] 有 bmb 配置 → modules='bmm,bmb'
  - [x] 有 communication-language 配置 → 返回对应语言
  - [x] 无配置 → fallback 系统 locale
  - [x] userOverrides.tools='custom' → 覆盖平台推断
  - [x] userOverrides.modules='bmb' → 覆盖默认值
  - [x] toArgs() 转换正确（null 字段不输出）

## Dev Notes

### 关键架构约束（必须遵守，违反则破坏架构一致性）

1. **具名导出**：`buildParams` 和 `detectBmadConfig` 均为具名导出，禁止 default export
2. **不引入新依赖**：`param-builder.js` 仅使用 Node.js 内置模块（`fs`/`path`/`os`）和已有 `fs-extra`，禁止安装新 npm 包
3. **不使用原生 fs**：文件读取使用 `fs-extra`（与整个项目约定一致，但读取 JSON/YAML 配置可用 Node.js `readFileSync`）
4. **错误处理**：配置文件不存在或解析失败时静默 fallback（不抛异常），param-builder 是推断引擎，不是硬性校验器
5. **Story 7.1 范围**：本 Story 仅创建 `param-builder.js` 并更新 `cli.js` 选项；`installer.js` 接入两阶段调用链为 Story 7.3 任务，本 Story 的 `install()` 函数签名接收新参数但不使用
6. **`toArgs()` 方法**：将参数对象转换为 `npx bmad-method install` 的 CLI 参数数组，供 Story 7.2 的 `orchestrator.js` 使用

### `lib/param-builder.js` 实现规范

**函数签名与返回值：**

```javascript
// lib/param-builder.js
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

/**
 * 构建 npx bmad-method install 所需参数
 * @param {string} platform - 目标平台（'happycapy'|'claude-code'|'openclaw'|'codex'）
 * @param {Object} [context={}] - 项目上下文
 * @param {string} [context.projectRoot] - 项目根目录绝对路径（扫描 BMAD 已有配置）
 * @param {Object} [context.userOverrides={}] - 用户 CLI 显式参数（最高优先级）
 * @returns {ParamResult} 结构化参数对象
 */
export function buildParams(platform, context = {}) {
  const { projectRoot = null, userOverrides = {} } = context

  // 1. --tools 平台映射
  const inferredTools = inferToolsParam(platform)

  // 2. --modules 推断
  const inferredModules = inferModulesParam(projectRoot)

  // 3. --communication-language 推断
  const inferredLanguage = inferLanguageParam(projectRoot)

  // 4. 优先级合并：用户显式 > 智能推断 > 默认值
  return {
    modules: userOverrides.modules ?? inferredModules,
    tools: userOverrides.tools !== undefined ? userOverrides.tools : inferredTools,
    communicationLanguage: userOverrides.communicationLanguage ?? inferredLanguage,
    outputFolder: userOverrides.outputFolder ?? null,
    userName: userOverrides.userName ?? null,
    action: userOverrides.action ?? 'install',
    yes: true, // 始终非交互模式

    /**
     * 转换为 CLI 参数数组（null 值不输出，供 orchestrator 使用）
     * @returns {string[]}
     */
    toArgs() {
      const args = []
      if (this.modules) args.push('--modules', this.modules)
      if (this.tools != null) args.push('--tools', this.tools)
      if (this.communicationLanguage) args.push('--communication-language', this.communicationLanguage)
      if (this.outputFolder) args.push('--output-folder', this.outputFolder)
      if (this.userName) args.push('--user-name', this.userName)
      if (this.action) args.push('--action', this.action)
      if (this.yes) args.push('--yes')
      return args
    },
  }
}
```

**平台 tools 映射：**

```javascript
const PLATFORM_TOOLS_MAP = {
  'happycapy': null,
  'openclaw': null,
  'claude-code': 'claude-code',
  'codex': null,
}

function inferToolsParam(platform) {
  // 有明确映射的平台直接返回（包括 null）；未知平台返回 null
  return Object.prototype.hasOwnProperty.call(PLATFORM_TOOLS_MAP, platform)
    ? PLATFORM_TOOLS_MAP[platform]
    : null
}
```

**modules 推断（检测 bmb 配置）：**

```javascript
function inferModulesParam(projectRoot) {
  if (!projectRoot) return 'bmm'

  // 检测项目中是否已有 bmb 配置
  const bmbMarkers = [
    join(projectRoot, '_bmad', 'bmb'),
    join(projectRoot, '_bmad-output', 'bmb'),
  ]
  const hasBmb = bmbMarkers.some(p => existsSync(p))
  return hasBmb ? 'bmm,bmb' : 'bmm'
}
```

**language 推断（读取已有 BMAD config）：**

```javascript
function inferLanguageParam(projectRoot) {
  // 1. 尝试从项目 BMAD config 读取
  if (projectRoot) {
    const configPath = join(projectRoot, '_bmad', 'bmm', 'config.yaml')
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8')
        const match = content.match(/communication_language\s*:\s*(.+)/)
        if (match) return match[1].trim().replace(/['"]/g, '')
      } catch {
        // 读取失败静默 fallback
      }
    }
  }

  // 2. Fallback：系统 locale（不含编码部分，如 'zh_CN.UTF-8' → 'zh_CN'）
  const locale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES
  if (locale && locale !== 'C' && locale !== 'POSIX') {
    return locale.split('.')[0]  // 'zh_CN.UTF-8' → 'zh_CN'
  }

  // 3. 最终 fallback
  return null
}
```

### `cli.js` 修改说明（最小改动）

只在 `install` 命令追加 Phase 2 选项，并将参数传入 `install()`。`install()` 函数签名已接收这些参数但暂不消费（Story 7.3 实现调用链）：

```javascript
program
  .command('install')
  .description('平台感知完整安装 BMAD agent')
  .option('--platform <name>', '指定目标平台（happycapy/openclaw/claude-code/codex）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '非交互模式，跳过所有确认提示')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  // Phase 2 参数（Story 7.1 新增，Story 7.3 消费）
  .option('--modules <modules>', 'BMAD 安装模块（覆盖智能推断，如 bmm 或 bmm,bmb）')
  .option('--tools <tools>', 'BMAD 工具链（覆盖智能推断，如 claude-code）')
  .option('--communication-language <lang>', 'BMAD 通讯语言（覆盖智能推断）')
  .option('--output-folder <path>', 'BMAD 输出目录（覆盖智能推断）')
  .option('--user-name <name>', '用户名称（传入 BMAD 安装器）')
  .option('--action <type>', 'BMAD 安装器动作（默认 install）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await install({
      platform: options.platform ?? null,
      agentId: options.agentId,
      yes: options.yes ?? false,
      // Phase 2 参数（Story 7.3 中 installer.js 会消费）
      modules: options.modules ?? null,
      tools: options.tools ?? null,
      communicationLanguage: options.communicationLanguage ?? null,
      outputFolder: options.outputFolder ?? null,
      userName: options.userName ?? null,
      action: options.action ?? null,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })
```

**注意**：`update` 和 `status` 命令本 Story 不修改（不涉及 param-builder）。

### `test/param-builder.test.js` 测试骨架

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildParams } from '../lib/param-builder.js'
import { existsSync, readFileSync } from 'fs'

// mock fs 模块（避免真实文件系统依赖）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(false)
  vi.mocked(readFileSync).mockReturnValue('')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('buildParams — tools 参数推断', () => {
  it('platform=happycapy → tools=null', () => {
    const result = buildParams('happycapy')
    expect(result.tools).toBeNull()
  })

  it('platform=claude-code → tools=claude-code', () => {
    const result = buildParams('claude-code')
    expect(result.tools).toBe('claude-code')
  })

  it('platform=openclaw → tools=null', () => {
    const result = buildParams('openclaw')
    expect(result.tools).toBeNull()
  })

  it('platform=codex → tools=null', () => {
    const result = buildParams('codex')
    expect(result.tools).toBeNull()
  })

  it('userOverrides.tools 覆盖平台推断', () => {
    const result = buildParams('happycapy', {
      userOverrides: { tools: 'custom-tool' }
    })
    expect(result.tools).toBe('custom-tool')
  })
})

describe('buildParams — modules 参数推断', () => {
  it('无 projectRoot → 默认 bmm', () => {
    const result = buildParams('happycapy')
    expect(result.modules).toBe('bmm')
  })

  it('项目中无 bmb 配置 → modules=bmm', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.modules).toBe('bmm')
  })

  it('项目中有 bmb 配置 → modules=bmm,bmb', () => {
    vi.mocked(existsSync).mockImplementation(p => p.includes('bmb'))
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.modules).toBe('bmm,bmb')
  })

  it('userOverrides.modules 覆盖推断', () => {
    const result = buildParams('happycapy', {
      userOverrides: { modules: 'bmb' }
    })
    expect(result.modules).toBe('bmb')
  })
})

describe('buildParams — communicationLanguage 推断', () => {
  it('无配置文件 → null（无 LANG 环境变量时）', () => {
    delete process.env.LANG
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBeNull()
  })

  it('有 config.yaml 含 communication_language → 返回对应值', () => {
    vi.mocked(existsSync).mockImplementation(p => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('Chinese')
  })

  it('userOverrides.communicationLanguage 覆盖推断', () => {
    const result = buildParams('happycapy', {
      userOverrides: { communicationLanguage: 'English' }
    })
    expect(result.communicationLanguage).toBe('English')
  })
})

describe('buildParams — toArgs() 转换', () => {
  it('claude-code 平台 → toArgs() 含 --tools claude-code', () => {
    const result = buildParams('claude-code')
    const args = result.toArgs()
    expect(args).toContain('--tools')
    expect(args).toContain('claude-code')
  })

  it('happycapy 平台（tools=null）→ toArgs() 不含 --tools', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    expect(args).not.toContain('--tools')
  })

  it('toArgs() 始终含 --yes', () => {
    const result = buildParams('happycapy')
    expect(result.toArgs()).toContain('--yes')
  })

  it('toArgs() 含 --modules bmm', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    expect(args).toContain('--modules')
    expect(args).toContain('bmm')
  })
})
```

### 参数优先级总结

| 参数 | 用户显式（最高） | 智能推断 | 默认值 |
|------|----------------|---------|--------|
| `tools` | `userOverrides.tools` | 平台映射（claude-code→'claude-code'，其余→null） | null |
| `modules` | `userOverrides.modules` | bmb 配置检测 | `'bmm'` |
| `communicationLanguage` | `userOverrides.communicationLanguage` | 读 config.yaml → 系统 locale | null |
| `outputFolder` | `userOverrides.outputFolder` | （暂无推断） | null |
| `userName` | `userOverrides.userName` | （暂无推断） | null |
| `action` | `userOverrides.action` | — | `'install'` |
| `yes` | — | — | `true`（始终） |

### 与其他 Story 的边界

| Story | 边界 |
|-------|------|
| Story 7.1（本 Story） | 创建 `param-builder.js`；更新 `cli.js` 选项；不修改 `installer.js` 逻辑 |
| Story 7.2 | 创建 `orchestrator.js`，调用 `param-builder.buildParams()` + `npx bmad-method install` |
| Story 7.3 | 修改 `installer.js`，接入 `param-builder` + `orchestrator` 两阶段调用链 |

### 现有代码模式参考

基于前几个 Story 的实现模式：
- 所有具名导出，禁止 default export（来自 `lib/platform.js`）
- ESM（`import/export`），禁止 `require()`（来自 `package.json` `"type": "module"`）
- 错误使用 `BmadError`（但本模块为推断引擎，失败时 fallback 而非 throw）
- 测试文件：`test/param-builder.test.js`，镜像 `lib/param-builder.js`（来自架构文档测试结构规范）
- vitest mock 模式参考：`test/json-mode.test.js` 中的 `vi.mock` 使用方式

### References

- FR42（tools 参数平台映射）: `_bmad-output/planning-artifacts/epics.md` → Story 7.1 AC
- FR43（modules/language 智能推断）: `_bmad-output/planning-artifacts/epics.md` → Story 7.1 AC
- FR46（用户显式覆盖）: `_bmad-output/planning-artifacts/epics.md` → Story 7.1 AC
- Phase 2 架构：param-builder.js 职责定义: `_bmad-output/planning-artifacts/architecture.md` → "智能参数构建引擎（lib/param-builder.js）"
- Phase 2 调用链: `_bmad-output/planning-artifacts/architecture.md` → "安装编排架构（Phase 2）"
- Phase 2 CLI 命令树: `_bmad-output/planning-artifacts/architecture.md` → "CLI 接口与通信模式 → 命令树"
- 适配器接口扩展（getToolsParam）: `_bmad-output/planning-artifacts/architecture.md` → "适配器接口扩展（Phase 2）"
- 执行规范（6 条强制规则）: `_bmad-output/planning-artifacts/architecture.md` → "执行规范"
- 现有 platform.js 模式: `lib/platform.js`（具名导出、BmadError、async/await）
- 现有 cli.js 结构: `cli.js`（Commander 选项定义、JSON 模式控制）
- 测试 mock 模式: `test/json-mode.test.js`（vi.mock 用法、afterEach 重置）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 测试运行：10 files, 235 tests, 0 failures（含全回归）
- Red-Green-Refactor 顺序：先写 42 个测试（红），再实现 param-builder.js（绿），全量回归通过

### Completion Notes List

- `lib/param-builder.js` 已按规范实现：具名导出、ESM、仅内置 fs/path 模块、静默 fallback
- `test/param-builder.test.js` 共 42 个测试，覆盖 AC1-6 全部场景及边界条件
- `cli.js` install 命令追加 6 个 Phase 2 选项，传入 `install()` 供 Story 7.3 消费
- `toArgs()` 方法：null 值不输出，始终含 `--yes`，字符串数组格式正确
- 用户显式覆盖（包括 null 覆盖推断值）通过 `hasOwnProperty` 正确处理

### File List

- lib/param-builder.js（新建）
- cli.js（修改：install 命令新增 Phase 2 选项）
- test/param-builder.test.js（新建）
- _bmad-output/implementation-artifacts/7-1-param-builder.md（本文件）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）
