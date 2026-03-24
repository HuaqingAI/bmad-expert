---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-23'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/research/technical-agent-install-and-bmad-extension-research-2026-03-23.md'
  - '_bmad-output/planning-artifacts/research/cli-installer-integration-patterns-research.md'
  - '_bmad-output/planning-artifacts/research/cli-installer-implementation-guide.md'
  - '_bmad-output/planning-artifacts/research/cli-patterns-quick-reference.md'
workflowType: 'architecture'
project_name: 'bmad-expert'
user_name: ''
date: '2026-03-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## 项目上下文分析

### 需求概览

**功能需求（40 项）：**

| 分类 | 数量 | 核心架构含义 |
|------|------|------------|
| 安装执行（FR1-5） | 5 | CLI 入口、进度输出、文件写入与注册 |
| 平台感知与注册（FR6-9） | 4 | 平台适配器模式，HappyCapy 需 CLI 注册 |
| 幂等性与环境检测（FR10-13） | 4 | 状态检测层，所有操作必须可重复 |
| 错误处理与 AI 自愈（FR14-19） | 6 | 结构化错误输出，受众为 AI 而非人类 |
| 安装后引导（FR20-22） | 3 | 输出层：情感性确认 + 操作引导 |
| BOOTSTRAP 初始化（FR23-27） | 5 | agent 文件预填充、持久配置写入、一次性 BOOTSTRAP 文件 |
| CLI 接口（FR28-34） | 7 | 命令结构、参数解析、非交互模式支持 |
| 版本与状态管理（FR35-40） | 6 | Growth 阶段，update 命令与用户数据保护 |

MVP 范围：FR1-FR34（34 项）
Growth 范围：FR35-FR40（6 项）

**非功能需求：**

| 类别 | 关键约束 | 架构影响 |
|------|---------|--------|
| 性能 | 全流程 ≤60s，每步进度 ≤2s | 异步执行，禁止阻塞等待 |
| 兼容性 | Node.js 18+，3 个平台 | 平台检测层 + 适配器隔离 |
| 可靠性 | ≥99% 成功率，100% 错误有结构化输出 | 每平台独立集成测试，失败路径全覆盖 |
| 安全 | 仅写预定义合法路径，依赖版本锁定 | 路径白名单验证，`package-lock.json` 强制 |

**规模与复杂度：**

- 主要域：npm CLI 工具 + 文件系统操作 + 外部 CLI 调用
- 复杂度级别：中等
- 估计架构组件数：5-7 个（CLI 层、平台检测、适配器×3、模板引擎、输出格式化、错误结构化）

### 技术约束与依赖

- **运行时：** Node.js 18+（目标 22+），通过 npx 零全局安装执行
- **分发：** npm 公开注册表（不需要认证 token）
- **模板分发：** git clone 而非 npm install（agent 文件需个性化变量替换）
- **平台依赖：** `happycapy-cli` 必须有降级路径（CLI 不存在时输出手动命令）
- **执行上下文：** AI 平台沙盒环境，路径写入权限边界未知，需运行时探测

### 横切关注点

1. **幂等性**：安装、检测、update 所有操作必须可重复执行无副作用
2. **平台感知**：每条执行路径都依赖平台类型，必须在最早阶段确定
3. **AI 可读输出**：所有输出（进度、成功、错误）必须对 AI caller 可解析
4. **错误结构一致性**：错误格式（错误码 + 原因 + fix 步骤）必须跨所有失败场景统一
5. **文件分层契约**：框架文件 vs 用户数据的边界必须在设计阶段固化，不可在运行时猜测

## 启动模板评估

### 主要技术域

CLI 工具（npm 包），基于项目需求分析确定。无 Web UI，无数据库，核心是文件系统操作 + 外部 CLI 调用 + 跨平台兼容。

### 评估的启动方案

| 方案 | 结论 | 原因 |
|------|------|------|
| create-node-cli | 不采用 | 过度封装，降低对执行流程的控制力 |
| oclif | 不采用 | 仅 1-3 个命令，功能过重 |
| 手动 npm init + 定义结构 | **采用** | 结构已由研究明确，Commander.js 无需生成器 |

### 选定方案：手动 npm 包初始化

**选择理由：**
研究已明确定义了所有组件结构，Commander.js 轻量可控，对平台适配器和 AI 可读输出的精确控制需要从零构建而非继承生成器假设。

**初始化命令：**

```bash
mkdir bmad-expert && cd bmad-expert
npm init -y
npm install commander@14.0.3 execa@9.6.1 fs-extra@11.3.4 chalk@5.6.2
npm install --save-dev vitest@4.1.1 eslint prettier
```

**项目结构：**

```
bmad-expert/
├── package.json          # name: "bmad-expert", bin: {"bmad-expert": "./cli.js"}
├── cli.js                # Commander CLI 入口
├── lib/
│   ├── installer.js      # git clone + 变量替换
│   ├── platform.js       # 平台检测 + happycapy-cli 调用
│   ├── output.js         # 双模式输出（human/json）
│   └── exit-codes.js     # 语义化 exit codes
├── agent/                # Agent 模板文件（随包分发）
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── AGENTS.md
│   └── BOOTSTRAP.md
└── README.md
```

**启动方案确立的架构决策：**

- **语言/运行时：** Node.js 24 LTS（目标），最低兼容 Node.js 18+；纯 JavaScript ESM
- **CLI 框架：** Commander.js v14（BMAD 官方在用，成熟稳定）
- **进程执行：** execa v9（Promise-based，跨平台，优于原生 exec）
- **文件操作：** fs-extra v11（跨平台路径处理，含 ensureDir/copy/remove）
- **输出着色：** chalk v5（ESM 原生）
- **测试框架：** vitest v4（ESM 原生，快）
- **模块系统：** ESM（`"type": "module"` in package.json）
- **代码质量：** ESLint + Prettier（与 BMAD 模块标准对齐）

**注：** 项目初始化（npm init + 目录结构创建）应作为第一个实现故事交付。

## 核心架构决策

### 决策优先级分析

**关键决策（阻塞实现）：**
- 平台检测策略：顺序探针 + `--platform` 覆盖
- AI 可读错误 Schema：嵌套结构（人类+机器双可读）
- Exit Code 语义化表：7 个明确分类码
- Agent 模板来源：打包在 npm 包内

**重要决策（塑造架构）：**
- 文件分层契约：框架文件 vs 用户数据硬编码白名单
- 平台适配器接口：统一接口，各平台独立实现
- CI/CD 策略：GitHub Actions + npm 自动发布

**延后决策（Post-MVP）：**
- 多平台自动检测（无需 `--platform`）：Phase 3
- `--json` 输出模式：Growth 阶段
- 模块扩展机制：Growth 阶段

### 数据架构

**无传统数据库**。持久化层为文件系统。

**安装状态检测（幂等判断）：**
- 检测目标路径下是否存在 `AGENTS.md`（HappyCapy）或对应平台标记文件
- 检测结果：`not_installed` | `installed` | `corrupted`
- 检测必须在 3 秒内完成（NFR3）

**Agent 模板文件（打包在 npm 包 `agent/` 目录内）：**
- 随 npm 包版本锁定，无运行时网络依赖
- 模板变量格式：`{{variable_name}}`，安装时替换

**变量替换映射：**
| 模板变量 | 来源 |
|---------|------|
| `{{agent_id}}` | `--agent-id` 参数或默认值 |
| `{{agent_name}}` | `--name` 参数或默认值 |
| `{{model}}` | `--model` 参数或默认值 |
| `{{install_date}}` | 安装时系统时间 |

### 安全架构

**路径白名单（NFR12）：**
- HappyCapy：`~/.happycapy/agents/[agent-id]/`
- Claude Code：`[cwd]/.claude/`
- Cursor：`[cwd]/.cursor/`
- 写入前验证路径在白名单范围内，拒绝任何 `..` 路径遍历

**依赖锁定（NFR13）：**
- `package-lock.json` 强制提交，所有依赖固定精确版本
- CI 使用 `npm ci`（而非 `npm install`）确保可复现构建
- 无 `postinstall` 钩子（安全风险）

### CLI 接口与通信模式

**命令树（Commander.js）：**
```
bmad-expert
├── install                    # MVP 主命令
│   ├── --platform <name>      # 覆盖自动检测（happycapy/cursor/claude-code）
│   ├── --agent-id <id>        # agent 标识符（默认 "bmad-expert"）
│   └── --yes                  # 非交互模式
├── update                     # Growth：安全更新框架文件
└── status                     # Growth：安装健康度检查
```

**AI 可读错误 Schema（嵌套结构）：**
```
ERROR [E{code}] {简短错误标题}
原因：{具体错误说明，含路径/参数等上下文}
修复步骤：
  1. {可直接执行的命令或操作}
  2. {fallback 方案（如有）}
可重试：{是/否}
```

**语义化 Exit Code 表：**
| Code | 含义 | 场景 |
|------|------|------|
| 0 | 成功 | 安装完成 |
| 1 | 通用错误 | 未分类异常 |
| 2 | 参数无效 | `--platform` 值不合法 |
| 3 | 依赖缺失 | Node.js/npm 版本不足 |
| 4 | 权限被拒 | 沙盒路径写入失败 |
| 5 | 网络错误 | （预留，当前 npm 包内嵌模板无需网络） |
| 6 | 已存在 | 幂等检测到已有安装，跳过 |

**进度输出格式（标准输出）：**
```
正在检测平台... {platform} ✓
正在复制 agent 文件... ✓
正在替换模板变量... ✓
正在注册 agent... ✓
安装完成（用时 {N}s）

bmad-expert 已就绪。现在你可以：
  ① 说"初始化这个项目"开始使用
  ② 说"进入 bmad-help"了解工作流
```

### 平台适配器架构

**适配器接口契约（每个平台实现此接口）：**
```javascript
// 每个适配器必须实现
{
  detect(): boolean,           // 是否检测到本平台
  getInstallPath(agentId),     // 返回目标安装路径
  install(files, options),     // 执行文件写入 + 平台注册
  check(agentId): status,      // 检测安装状态
}
```

**HappyCapy 适配器特殊处理：**
- 调用 `happycapy-cli add` 完成注册
- 必须处理 `happycapy-cli` 不存在的降级路径（输出手动命令）

### 文件分层契约

硬编码在 `package.json` 的 `bmadExpert.frameworkFiles` 字段：

```json
{
  "bmadExpert": {
    "frameworkFiles": ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md"],
    "userDataPaths": ["MEMORY.md", "USER.md", "memory/"]
  }
}
```

- **框架文件**：`update` 命令可覆盖，无需用户确认
- **用户数据**：`update` 命令永不接触，无论任何情况
- **用户自添加文件**：非白名单文件一律视为用户数据，永不覆盖

### 基础设施与部署

**CI/CD（GitHub Actions）：**
```
push to main      → 运行测试（vitest）
git tag v*.*.*    → npm publish（自动发布至公开注册表）
prerelease tag    → npm publish --tag next
```

**版本策略：**
- `npx bmad-expert@latest install`：稳定版（用户默认）
- `npx bmad-expert@next install`：预览版（内部测试）
- 语义化版本，与 BMAD 官方版本号独立

**npm 包名：** 需提前注册 `bmad-expert`，确认可用性（风险缓解）

### 决策影响分析

**实现顺序（依赖关系）：**
1. `exit-codes.js`（无依赖，被所有模块引用）
2. `output.js`（依赖 chalk，被所有模块引用）
3. `platform.js`（依赖 exit-codes、output）
4. `installer.js`（依赖 platform、output、fs-extra）
5. `cli.js`（依赖全部 lib 模块）
6. `agent/` 模板文件（与代码平行开发）
7. GitHub Actions 配置（最后配置）

**跨组件依赖：**
- 错误 Schema 必须在 `output.js` 中统一实现，所有模块通过它输出错误
- 平台检测结果在 `install` 命令最早阶段确定，后续所有步骤依赖此结果
- 文件分层白名单在 `package.json` 定义，`installer.js` 读取，`update` 命令遵循

## 实现模式与一致性规则

### 识别的潜在冲突点

共 6 个领域，AI agent 可能做出不同选择：命名规范、测试结构、错误传播方式、stdout/stderr 使用、模块导出风格、异步模式

### 命名规范

**文件命名：kebab-case.js**
```
✅ exit-codes.js / platform.js / installer.js
❌ exitCodes.js / Platform.js
```

**函数与变量命名：camelCase**
```javascript
✅ async function detectPlatform() {}
✅ const installPath = getInstallPath(agentId)
❌ function detect_platform() {}
❌ const install_path = ...
```

**常量命名：UPPER_SNAKE_CASE**
```javascript
✅ export const EXIT_CODES = { SUCCESS: 0, PERMISSION_DENIED: 4 }
❌ export const exitCodes = { success: 0 }
```

### 结构规范

**测试文件：集中在 `test/` 目录，文件名 `*.test.js`**
```
✅ test/platform.test.js
✅ test/installer.test.js
❌ lib/platform.test.js（不 co-locate）
❌ __tests__/platform.js
```

**模块导出：具名导出（Named Exports），禁止 default export**
```javascript
✅ export function detectPlatform() {}
✅ export const EXIT_CODES = {}
❌ export default function detectPlatform() {}
❌ module.exports = { detectPlatform }
```

**每个 lib 模块职责单一：**
- `exit-codes.js`：仅定义常量，无逻辑
- `output.js`：仅处理输出格式化，不做业务判断
- `platform.js`：仅做平台检测与适配器选择，不做文件操作
- `installer.js`：协调安装流程，调用其他模块，不直接输出

### 格式规范

**stdout vs stderr 使用规则（AI caller 依赖此规则）：**
```
stdout：进度信息、成功确认、--json 输出、安装后引导
stderr：错误信息（ERROR [E{code}] 格式）
```

**进度输出模式（固定格式，AI 可解析）：**
```javascript
// 每步：先输出"正在..."，完成后同行追加 ✓
process.stdout.write('正在检测平台...')
// ... 执行 ...
process.stdout.write(' ✓\n')
```

**JSON 输出结构（--json flag，Growth 阶段）：**

成功时：
```json
{
  "success": true,
  "platform": "happycapy",
  "agentId": "bmad-expert",
  "installPath": "/home/user/.happycapy/agents/bmad-expert",
  "duration": 38
}
```

失败时：
```json
{
  "success": false,
  "errorCode": "E004",
  "errorMessage": "权限被拒绝",
  "fixSteps": ["命令1", "命令2"],
  "retryable": true
}
```

### 错误处理模式

**错误传播：throw BmadError + cli.js 顶层统一捕获**
```javascript
// ✅ 正确：在 lib 中 throw
async function writeAgentFiles(targetPath, files) {
  try {
    await fs.copy(srcPath, targetPath)
  } catch (err) {
    throw new BmadError('E004', '文件写入失败', err)
  }
}

// ✅ 正确：在 cli.js 顶层统一捕获并格式化输出
const CODE_TO_EXIT = {
  E001: EXIT_CODES.GENERAL_ERROR,
  E002: EXIT_CODES.INVALID_ARGS,
  E003: EXIT_CODES.MISSING_DEPENDENCY,
  E004: EXIT_CODES.PERMISSION_DENIED,
  E005: EXIT_CODES.NETWORK_ERROR,
  E006: EXIT_CODES.ALREADY_INSTALLED,
}

program.parseAsync().catch(err => {
  printError(err)
  process.exit(
    err instanceof BmadError
      ? (CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
      : EXIT_CODES.GENERAL_ERROR
  )
})

// ❌ 错误：在 lib 中直接 console.error 并 process.exit
```

**BmadError 类（统一错误对象，定义在 `lib/errors.js`）：**
```javascript
export class BmadError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.bmadCode = code      // 'E004'
    this.cause = cause
    this.retryable = ['E004', 'E005'].includes(code)
  }
}
```

### 异步模式

**全部使用 async/await，禁止 .then()/.catch() 链式调用**
```javascript
✅ const result = await detectPlatform()
✅ try { await install() } catch (err) { ... }
❌ detectPlatform().then(r => ...).catch(e => ...)
```

**并发操作使用 Promise.all**
```javascript
✅ const [exists, perms] = await Promise.all([checkExists(), checkPermissions()])
❌ const exists = await checkExists(); const perms = await checkPermissions()
```

### 执行规范

**所有 AI agents 必须遵守：**
1. 新增错误场景必须使用 `BmadError` 类，不可直接 `throw new Error()`
2. 所有进度输出必须通过 `output.js` 的函数，不可直接 `console.log`
3. 平台路径计算必须通过 `platform.js` 的 `getInstallPath()`，不可硬编码路径
4. 退出码必须使用 `EXIT_CODES` 常量，不可使用数字字面量
5. 文件操作必须使用 `fs-extra`，不可使用原生 `fs`
6. 外部进程调用必须使用 `execa`，不可使用 `child_process.exec`

**反模式（禁止）：**
```javascript
// ❌ 直接输出（绕过 output.js）
console.log('正在安装...')
console.error('安装失败')

// ❌ 硬编码退出码
process.exit(4)

// ❌ 硬编码路径
const installPath = `${os.homedir()}/.happycapy/agents/${agentId}`

// ❌ 使用原生 fs
import fs from 'fs'
await fs.promises.mkdir(path, { recursive: true })
```

## 项目结构与边界

### 完整项目目录结构

```
bmad-expert/
├── package.json               # name, bin, dependencies, bmadExpert 文件分层配置
├── package-lock.json          # 依赖版本锁定（必须提交）
├── cli.js                     # Commander 入口，顶层错误捕获
├── lib/
│   ├── errors.js              # BmadError 类定义
│   ├── exit-codes.js          # EXIT_CODES 常量（E000-E006）
│   ├── output.js              # 进度/成功/错误格式化，stdout/stderr 路由
│   ├── platform.js            # 平台检测，适配器工厂
│   ├── installer.js           # 安装编排，幂等检测，模板变量替换
│   └── adapters/
│       ├── happycapy.js       # HappyCapy 适配器：路径 + happycapy-cli add
│       ├── cursor.js          # Cursor 适配器：.cursor/rules/ 文件复制
│       └── claude-code.js     # Claude Code 适配器：.claude/ + CLAUDE.md
├── agent/                     # Agent 模板文件（随 npm 包分发）
│   ├── SOUL.md                # 含 {{agent_id}}、{{agent_name}} 变量
│   ├── IDENTITY.md            # 含 {{agent_id}} 变量
│   ├── AGENTS.md              # 含 {{agent_id}}、{{install_date}} 变量
│   └── BOOTSTRAP.md           # 一次性初始化，首次运行后自毁
├── test/
│   ├── fixtures/
│   │   └── mock-agent/        # 测试用 mock agent 目录
│   ├── platform.test.js       # 平台检测 + 适配器选择
│   ├── installer.test.js      # 安装流程、幂等性、变量替换
│   ├── output.test.js         # 输出格式验证
│   ├── errors.test.js         # BmadError 类测试
│   └── integration/
│       └── happycapy.test.js  # HappyCapy 端到端安装测试
├── .github/
│   └── workflows/
│       ├── ci.yml             # push to main → 运行测试
│       └── publish.yml        # git tag v*.*.* → npm publish
├── .eslintrc.js
├── .prettierrc
├── vitest.config.js
├── .gitignore
└── README.md                  # 每平台单句触发命令
```

### 架构边界

**CLI 边界（cli.js）：**
- 入口：`npx bmad-expert install [--platform X] [--agent-id Y] [--yes]`
- 出口：`process.exit(EXIT_CODES.SUCCESS)` 或非零分类码
- 职责范围：参数解析、调用 installer、顶层 BmadError 捕获

**安装编排边界（lib/installer.js）：**
- 输入：`{ platform, agentId, agentName, model, yes }`
- 输出：`{ success, platform, installPath, duration }`
- 调用链：`platform.js`（获取适配器）→ `adapter.check()`（幂等判断）→ 文件复制 + 变量替换 → `adapter.install()`（注册）→ `output.js`（输出）

**平台适配器边界（lib/adapters/*.js）：**
```
统一接口：
  detect()                 → boolean
  getInstallPath(agentId)  → string（绝对路径）
  install(files, options)  → Promise<void>
  check(agentId)           → 'not_installed' | 'installed' | 'corrupted'
```

**模板边界（agent/）：**
- 输入：含 `{{variable}}` 的原始 Markdown 模板
- 处理：`installer.js` 读取、替换、写入目标路径
- 不包含：用户数据（MEMORY.md、USER.md）——由 agent 运行时自行创建

### 需求到结构的映射

| FR 分类 | 主要文件 | 测试文件 |
|---------|---------|---------|
| 安装执行（FR1-5） | `cli.js`, `lib/installer.js` | `test/installer.test.js` |
| 平台感知（FR6-9） | `lib/platform.js`, `lib/adapters/` | `test/platform.test.js` |
| 幂等性（FR10-13） | `lib/installer.js`（check） | `test/installer.test.js` |
| 错误处理（FR14-19） | `lib/errors.js`, `lib/output.js` | `test/errors.test.js`, `test/output.test.js` |
| 安装后引导（FR20-22） | `lib/output.js` | `test/output.test.js` |
| BOOTSTRAP（FR23-27） | `agent/BOOTSTRAP.md`, `agent/AGENTS.md` | — |
| CLI 接口（FR28-34） | `cli.js` | `test/integration/happycapy.test.js` |
| 版本管理（FR35-40，Growth） | `cli.js`（update/status 命令占位） | — |

### 集成点

**内部数据流：**
```
自然语言触发 → AI 平台 → npx bmad-expert install
  → cli.js（参数解析）
  → installer.js（幂等检测）
  → platform.js（适配器选择）
  → adapter.getInstallPath()（目标路径）
  → installer.js（文件复制 + 变量替换）
  → adapter.install()（平台注册）
  → output.js（成功输出 → stdout）
  → process.exit(0)

失败路径：
  → throw BmadError
  → cli.js 顶层 catch
  → output.js（错误格式化 → stderr）
  → process.exit(非零码)
```

**外部集成：**
- `happycapy-cli add`：通过 execa 调用，必须有降级路径（CLI 不存在时输出手动命令）
- npm 公开注册表：发布目标，`npm publish` via GitHub Actions
- git（仅 CI/CD）：tag 触发发布流程

### 文件组织规范

| 目录 | 职责 | 规则 |
|------|------|------|
| `/`（根） | 配置文件 + 入口 | 仅 `cli.js`、`package.json` 和配置文件 |
| `lib/` | 业务逻辑 | 每文件单一职责，kebab-case 命名 |
| `lib/adapters/` | 平台适配器 | 每平台一个文件，仅实现适配器接口 |
| `agent/` | 模板文件 | 纯 Markdown，不含代码逻辑 |
| `test/` | 测试 | 镜像 `lib/` 结构，`integration/` 放端到端 |
| `.github/workflows/` | CI/CD | CI（测试）和 CD（发布）分离为两个文件 |

## 架构验证结果

### 一致性验证 ✅

**决策兼容性：**
所有技术版本（Commander.js v14、execa v9、fs-extra v11、chalk v5、vitest v4）均原生支持 ESM，与 `"type": "module"` 配置无冲突。错误传播路径（BmadError → cli.js → output.js）无循环依赖。

**模式一致性：**
async/await 模式与 execa v9 promise-based 接口完全对齐。所有输出通过 output.js 路由，stdout/stderr 分离规则可在整个代码库中一致执行。

**结构对齐：**
`lib/adapters/` 结构直接支持平台适配器接口契约。`test/` 镜像 `lib/` 结构，便于测试定位。`agent/` 与代码完全隔离，模板文件无代码逻辑。

### 需求覆盖验证 ✅

**功能需求（34 项 MVP）：**
全部 8 个 FR 分类均有对应架构组件，无缺口。FR35-40（Growth）已标记延后，有 cli.js 占位，设计时已预留扩展空间。

**非功能需求（13 项）：**
- 性能（NFR1-3）：async/await 全异步，进度输出在每步开始前，幂等检测为文件存在性检查
- 兼容性（NFR4-7）：package.json engines 字段、适配器隔离、npm 公开注册表、fs-extra 跨平台路径
- 可靠性（NFR8-11）：每平台独立集成测试、output.js 集中错误输出、幂等安装、中断后可恢复
- 安全（NFR12-13）：适配器内路径白名单验证、package-lock.json 提交 + npm ci

### 实现就绪度验证 ✅

**决策完整性：** 所有关键决策均有版本号，延后决策有明确的阶段标注
**结构完整性：** 完整目录树已定义，所有文件均有职责说明
**模式完整性：** 6 个冲突领域全部有规则 + 正例 + 反例

### 缺口分析

**轻微缺口（不阻塞，在第一个故事中处理）：**
- `vitest.config.js`、`.eslintrc.js`、`.prettierrc` 的具体配置内容
- `.gitignore` 内容

**已知延后（PRD 明确标注的非架构范围）：**
- BOOTSTRAP.md 具体内容：PRD FR27 将其列为显式内容制作交付物，独立故事

**无关键缺口**

### 架构完整性检查清单

**需求分析**
- [x] 项目上下文深度分析
- [x] 规模与复杂度评估
- [x] 技术约束识别
- [x] 横切关注点映射

**架构决策**
- [x] 关键决策含版本号
- [x] 技术栈完整定义
- [x] 平台适配器接口契约
- [x] 文件分层契约
- [x] 错误 Schema 与 Exit Code 表
- [x] CI/CD 策略

**实现模式**
- [x] 命名规范（文件/函数/常量）
- [x] 测试结构规范
- [x] stdout/stderr 使用规则
- [x] 错误传播模式
- [x] 异步模式规范
- [x] 6 条强制执行规则 + 反模式示例

**项目结构**
- [x] 完整目录树（含所有文件）
- [x] 组件边界定义
- [x] 需求到文件映射表
- [x] 完整数据流示意

### 架构就绪度评估

**总体状态：可进入实现阶段**

**信心等级：高**——技术选型有研究支撑，所有关键决策已明确，无悬而未决的技术风险

**架构优势：**
- 适配器模式使平台扩展只需新增一个文件，不改动现有代码
- BmadError + 顶层捕获模式确保错误处理一致性，AI agent 无法绕过
- output.js 单点输出控制，所有 AI agent 输出格式天然一致
- 文件分层契约在 package.json 中硬编码，无歧义

**未来增强点（Post-MVP）：**
- Growth 阶段的 `--json` 输出、`update`/`status` 命令有预留位置
- 平台适配器结构支持 Phase 3 多平台自动检测的扩展

### 实现交接

**AI Agent 使用指引：**
- 遵循架构决策文档中的所有技术选型，不自行引入新依赖
- 所有输出通过 `output.js`，所有错误使用 `BmadError`，所有路径通过适配器计算
- 参考需求到结构映射表确定每个 FR 的实现位置

**第一个实现故事：**
```bash
mkdir bmad-expert && cd bmad-expert
npm init -y
npm install commander@14.0.3 execa@9.6.1 fs-extra@11.3.4 chalk@5.6.2
npm install --save-dev vitest@4.1.1 eslint prettier
# 创建完整目录结构 + 配置文件
```
