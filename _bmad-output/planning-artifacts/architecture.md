---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-23'
lastEdited: '2026-04-02'
editHistory:
  - date: '2026-04-02'
    changes: 'Phase 2 架构更新：安装编排重构（orchestrator.js + param-builder.js）、多平台自动检测探针链、4 平台适配器（+OpenClaw +Codex）、CLI 命令树扩展、FR41-FR50 映射、数据流图更新'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/research/technical-agent-install-and-bmad-extension-research-2026-03-23.md'
  - '_bmad-output/planning-artifacts/research/cli-installer-integration-patterns-research.md'
  - '_bmad-output/planning-artifacts/research/cli-installer-implementation-guide.md'
  - '_bmad-output/planning-artifacts/research/cli-patterns-quick-reference.md'
  - '_bmad-output/implementation-artifacts/bmm-retrospective-2026-04-02.md'
workflowType: 'architecture'
project_name: 'bmad-expert'
user_name: ''
date: '2026-03-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## 项目上下文分析

### 需求概览

**功能需求（50 项）：**

| 分类 | 数量 | 核心架构含义 |
|------|------|------------|
| 安装执行（FR1-5） | 5 | CLI 入口、进度输出、文件写入与注册 |
| 平台感知与注册（FR6-9） | 4 | 平台适配器模式，HappyCapy 需 CLI 注册 |
| 幂等性与环境检测（FR10-13） | 4 | 状态检测层，所有操作必须可重复 |
| 错误处理与 AI 自愈（FR14-19） | 6 | 结构化错误输出，受众为 AI 而非人类 |
| 安装后引导（FR20-22） | 3 | 输出层：情感性确认 + 操作引导 |
| BOOTSTRAP 初始化（FR23-27） | 5 | agent 文件预填充、持久配置写入、一次性 BOOTSTRAP 文件 |
| CLI 接口（FR28-34） | 7 | 命令结构、参数解析、非交互模式支持 |
| 版本与状态管理（FR35-40） | 6 | Growth 阶段（已完成），update 命令与用户数据保护 |
| 安装编排与智能参数构建（FR41-46） | 6 | Phase 2：委托 BMAD 官方安装器、智能参数推断、动态版本获取 |
| 多平台自动检测（FR47-48） | 2 | Phase 2：无需 --platform 的环境自动探测 |
| 回顾清债（FR49-50） | 2 | Phase 2：status --json 完整实现、README 全覆盖 |

Phase 1 MVP 范围：FR1-FR34（34 项）✅ 已完成
Phase 1.5 Growth 范围：FR35-FR40（6 项）✅ 已完成
Phase 2 范围：FR41-FR50（10 项）

**非功能需求：**

| 类别 | 关键约束 | 架构影响 |
|------|---------|--------|
| 性能 | 全流程 ≤60s，每步进度 ≤2s | 异步执行，禁止阻塞等待 |
| 兼容性 | Node.js 18+，4 个平台 | 平台检测层 + 适配器隔离 |
| 可靠性 | ≥99% 成功率，100% 错误有结构化输出 | 每平台独立集成测试，失败路径全覆盖 |
| 安全 | 仅写预定义合法路径，依赖版本锁定 | 路径白名单验证，`package-lock.json` 强制 |

**规模与复杂度：**

- 主要域：npm CLI 工具 + 文件系统操作 + 外部 CLI 调用
- 复杂度级别：中等
- 估计架构组件数：8-10 个（CLI 层、平台检测、适配器×4、安装编排器、智能参数构建、输出格式化、错误结构化）

### 技术约束与依赖

- **运行时：** Node.js 18+（目标 22+），通过 npx 零全局安装执行
- **分发：** npm 公开注册表（不需要认证 token）
- **模板分发：** Phase 1 通过 npm 包内嵌模板；Phase 2 核心 BMAD 文件由 `npx bmad-method install` 动态安装，bmad-expert 仅分发补充 agent 文件
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
- ~~多平台自动检测（无需 `--platform`）：Phase 3~~ → **Phase 2 实现**（FR47）
- ~~`--json` 输出模式：Growth 阶段~~ → **Phase 1.5 已完成**（FR40）
- ~~模块扩展机制：Growth 阶段~~ → **Phase 2 实现**（FR41-46，委托 BMAD 官方安装器）

**Phase 2 新增关键决策：**
- 安装编排策略：委托 `npx bmad-method install` 而非自行文件复制
- 智能参数构建引擎：根据平台 + 项目上下文自动推断安装参数
- 多平台自动检测：环境变量 + 文件系统特征探针链
- 新平台适配器：OpenClaw、Codex（Claude Code 已有占位）

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
- OpenClaw：待预研（Phase 2 开发前确定）
- Claude Code：`[cwd]/.claude/`
- Codex：待预研（Phase 2 开发前确定）
- 写入前验证路径在白名单范围内，拒绝任何 `..` 路径遍历

**依赖锁定（NFR13）：**
- `package-lock.json` 强制提交，所有依赖固定精确版本
- CI 使用 `npm ci`（而非 `npm install`）确保可复现构建
- 无 `postinstall` 钩子（安全风险）

### CLI 接口与通信模式

**命令树（Commander.js）：**
```
bmad-expert
├── install                              # 主命令（Phase 2：委托 BMAD 官方安装器）
│   ├── --platform <name>                # 覆盖自动检测（happycapy/openclaw/claude-code/codex）
│   ├── --agent-id <id>                  # agent 标识符（默认 "bmad-expert"）
│   ├── --yes                            # 非交互模式
│   ├── --modules <modules>              # Phase 2：透传至 BMAD 安装器（覆盖智能推断）
│   ├── --tools <tools>                  # Phase 2：透传至 BMAD 安装器（覆盖智能推断）
│   ├── --communication-language <lang>  # Phase 2：透传至 BMAD 安装器（覆盖智能推断）
│   ├── --output-folder <path>           # Phase 2：透传至 BMAD 安装器（覆盖智能推断）
│   ├── --user-name <name>               # Phase 2：透传至 BMAD 安装器（覆盖智能推断）
│   └── --action <type>                  # Phase 2：透传至 BMAD 安装器（默认 install）
├── update                               # Growth（已完成）：安全更新框架文件
├── status                               # Growth（已完成）：安装健康度检查
│   └── --json                           # 结构化 JSON 输出（Phase 2：完整实现）
└── --json                               # 全局：结构化 JSON 输出供 AI caller 使用
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

**各平台适配器特殊处理：**

| 平台 | 注册机制 | 降级路径 | Phase |
|------|---------|---------|-------|
| HappyCapy | `happycapy-cli add` | CLI 不存在时输出手动命令 | Phase 1 ✅ |
| OpenClaw | 待预研（环境变量 / 文件系统约定） | 输出手动注册步骤 | Phase 2（优先） |
| Claude Code | `.claude/` 目录 + CLAUDE.md 写入 | 无需额外注册 | Phase 2 |
| Codex | 待预研（OpenAI agent 注册机制） | 输出手动注册步骤 | Phase 2 |

**适配器接口扩展（Phase 2）：**
```javascript
{
  detect(): boolean,                // 是否检测到本平台
  detectConfidence(): number,       // Phase 2 新增：探针置信度（0-1）
  getInstallPath(agentId): string,  // 返回目标安装路径
  install(files, options): Promise<void>,  // 执行文件写入 + 平台注册
  check(agentId): status,           // 检测安装状态
  getToolsParam(): string | null,   // Phase 2 新增：返回该平台对应的 --tools 参数值
}
```

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

### 安装编排架构（Phase 2）

**架构转变：** Phase 1 的 installer.js 直接复制 agent/ 模板文件到目标路径。Phase 2 重构为两阶段安装：

```
阶段 1：委托 BMAD 官方安装器（核心安装）
  npx bmad-method install --modules bmm --yes [智能推断的参数...]

阶段 2：bmad-expert 补充层写入
  写入 SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 等 bmad-expert 专属文件
```

**智能参数构建引擎（lib/param-builder.js）：**

根据目标平台和项目上下文自动确定 BMAD 官方安装器参数：

| 参数 | 推断逻辑 |
|------|---------|
| `--modules` | 默认 `bmm`；检测到已有 bmb 配置时加入 `bmb` |
| `--tools` | HappyCapy/OpenClaw: 不传；Claude Code: `claude-code`；Codex: 不传 |
| `--communication-language` | 检测项目中已有 BMAD 配置的语言设置；fallback 为系统 locale |
| `--output-folder` | 根据平台适配器返回的安装路径推断 |
| `--user-name` | 使用平台用户标识（如 HappyCapy agent name） |
| `--action` | install 命令传 `install`，update 命令传 `update` |
| `--yes` | 始终传入（非交互模式） |

**参数优先级：用户显式参数 > 智能推断 > 默认值**

用户通过 CLI 参数（如 `--modules bmb`）显式覆盖智能推断结果。

**BMAD 官方安装器调用（lib/orchestrator.js）：**

```javascript
// orchestrator.js 职责：
{
  buildParams(platform, context): string[],  // 智能参数构建
  executeInstall(params): Promise<result>,    // 调用 npx bmad-method install
  writeSupplementFiles(targetPath): Promise<void>,  // 写入 bmad-expert 补充文件
}
```

- 通过 `execa` 调用 `npx bmad-method install`，捕获 stdout/stderr
- 动态获取最新版本（npx 默认行为）
- 安装失败时将 BMAD 官方安装器的错误输出包装为 BmadError

**agent/ 目录角色变化：**
- Phase 1：包含完整 BMAD agent 模板（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md、bmad-project-init.md）
- Phase 2：仅包含 bmad-expert 专属补充文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md），核心 BMAD 文件由官方安装器动态安装

### 多平台自动检测架构（Phase 2）

**探针链策略（lib/platform.js 扩展）：**

```
检测顺序（短路评估，第一个命中即返回）：
1. --platform 显式参数 → 直接使用
2. HappyCapy 探针：检测 ~/.happycapy/ 目录 或 HAPPYCAPY_* 环境变量
3. OpenClaw 探针：检测 OpenClaw 特征环境变量或文件系统标记
4. Claude Code 探针：检测 .claude/ 目录 或 CLAUDE_* 环境变量
5. Codex 探针：检测 CODEX_* 或 OPENAI_* 环境变量
6. 全部未命中 → 输出结构化错误，提示用户手动指定 --platform
```

**每个探针实现在对应适配器中：**
- 适配器接口新增探针权重：`detectConfidence(): number`（0-1）
- 多个探针命中时选择置信度最高的平台
- 探针执行总时间 ≤ 1 秒（NFR15）

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
│   ├── platform.js            # 平台检测（含自动探针链），适配器工厂
│   ├── installer.js           # 安装编排，幂等检测（Phase 2：调用 orchestrator）
│   ├── updater.js             # update 命令逻辑（Phase 1.5 已完成）
│   ├── checker.js             # status 命令逻辑（Phase 1.5 已完成）
│   ├── orchestrator.js        # Phase 2 新增：BMAD 官方安装器调用 + 补充文件写入
│   ├── param-builder.js       # Phase 2 新增：智能参数构建引擎
│   └── adapters/
│       ├── happycapy.js       # HappyCapy 适配器：路径 + happycapy-cli add ✅
│       ├── claude-code.js     # Claude Code 适配器：.claude/ + CLAUDE.md（Phase 2）
│       ├── openclaw.js        # Phase 2 新增：OpenClaw 适配器
│       └── codex.js           # Phase 2 新增：Codex（OpenAI）适配器
├── agent/                     # bmad-expert 补充 agent 文件（Phase 2：仅补充层）
│   ├── SOUL.md                # 含 {{agent_id}}、{{agent_name}} 变量
│   ├── IDENTITY.md            # 含 {{agent_id}} 变量
│   ├── AGENTS.md              # 含 {{agent_id}}、{{install_date}} 变量
│   ├── BOOTSTRAP.md           # 一次性初始化，首次运行后自毁
│   └── bmad-project-init.md   # BMAD 项目初始化引导
├── test/
│   ├── fixtures/
│   │   └── mock-agent/        # 测试用 mock agent 目录
│   ├── platform.test.js       # 平台检测 + 适配器选择 + 自动探针
│   ├── installer.test.js      # 安装流程、幂等性、变量替换
│   ├── orchestrator.test.js   # Phase 2 新增：编排器测试
│   ├── param-builder.test.js  # Phase 2 新增：参数构建测试
│   ├── updater.test.js        # update 命令测试
│   ├── checker.test.js        # status 命令测试
│   ├── output.test.js         # 输出格式验证
│   ├── errors.test.js         # BmadError 类测试
│   ├── json-mode.test.js      # JSON 输出模式测试
│   └── integration/
│       ├── happycapy.test.js  # HappyCapy 端到端安装测试 ✅
│       ├── openclaw.test.js   # Phase 2：OpenClaw 集成测试
│       ├── claude-code.test.js # Phase 2：Claude Code 集成测试
│       └── codex.test.js      # Phase 2：Codex 集成测试
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

**安装编排边界（lib/installer.js + lib/orchestrator.js）：**
- 输入：`{ platform, agentId, agentName, model, yes, modules, tools, communicationLanguage, outputFolder, userName, action }`
- 输出：`{ success, platform, installPath, duration }`
- Phase 1 调用链：`platform.js` → `adapter.check()` → 文件复制 + 变量替换 → `adapter.install()` → `output.js`
- Phase 2 调用链：`platform.js`（自动检测）→ `adapter.check()`（幂等判断）→ `param-builder.js`（智能参数构建）→ `orchestrator.js`（调用 `npx bmad-method install`）→ `orchestrator.js`（写入补充文件 + 变量替换）→ `adapter.install()`（平台注册）→ `output.js`（输出）

**平台适配器边界（lib/adapters/*.js）：**
```
统一接口：
  detect()                 → boolean
  detectConfidence()       → number（0-1，Phase 2 新增）
  getInstallPath(agentId)  → string（绝对路径）
  install(files, options)  → Promise<void>
  check(agentId)           → 'not_installed' | 'installed' | 'corrupted'
  getToolsParam()          → string | null（Phase 2 新增）
```

**模板边界（agent/）：**
- Phase 1：含 `{{variable}}` 的完整 agent 模板，由 `installer.js` 读取、替换、写入
- Phase 2：仅 bmad-expert 补充文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md），核心 BMAD 文件由官方安装器动态安装；补充文件由 `orchestrator.js` 在官方安装完成后写入
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
| 版本管理（FR35-40） | `lib/updater.js`, `lib/checker.js` | `test/updater.test.js`, `test/checker.test.js` |
| 安装编排（FR41-46） | `lib/orchestrator.js`, `lib/param-builder.js` | `test/orchestrator.test.js`, `test/param-builder.test.js` |
| 多平台检测（FR47-48） | `lib/platform.js`, `lib/adapters/codex.js` | `test/platform.test.js`, `test/integration/codex.test.js` |
| 回顾清债（FR49-50） | `lib/checker.js`, `README.md` | `test/checker.test.js` |

### 集成点

**内部数据流（Phase 2）：**
```
自然语言触发 → AI 平台 → npx bmad-expert install
  → cli.js（参数解析）
  → installer.js（幂等检测）
  → platform.js（自动检测探针链 或 --platform 显式指定）
  → adapter.getInstallPath()（目标路径）
  → param-builder.js（智能参数构建：平台 + 项目上下文 → BMAD 安装参数）
  → orchestrator.js（调用 npx bmad-method install --modules X --tools Y --yes ...）
  → orchestrator.js（写入 bmad-expert 补充 agent 文件 + 变量替换）
  → adapter.install()（平台注册）
  → output.js（成功输出 → stdout）
  → process.exit(0)

失败路径：
  → throw BmadError（含 BMAD 官方安装器错误的包装）
  → cli.js 顶层 catch
  → output.js（错误格式化 → stderr）
  → process.exit(非零码)
```

**外部集成：**
- `npx bmad-method install`：Phase 2 核心依赖，通过 execa 调用，动态获取最新版本
- `happycapy-cli add`：通过 execa 调用，必须有降级路径（CLI 不存在时输出手动命令）
- 各平台 CLI/注册机制：OpenClaw、Claude Code、Codex 各自的 agent 注册方式
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

**功能需求（50 项）：**
- FR1-FR34（Phase 1 MVP）：全部 8 个分类均有对应架构组件 ✅ 已实现
- FR35-FR40（Phase 1.5 Growth）：updater.js、checker.js、JSON 模式 ✅ 已实现
- FR41-FR46（安装编排）：orchestrator.js + param-builder.js 覆盖
- FR47-FR48（多平台检测）：platform.js 探针链 + 新适配器覆盖
- FR49-FR50（回顾清债）：checker.js 完善 + README 更新覆盖

**非功能需求（15 项）：**
- 性能（NFR1-3）：async/await 全异步，进度输出在每步开始前，幂等检测为文件存在性检查
- 兼容性（NFR4-7）：package.json engines 字段、适配器隔离、npm 公开注册表、fs-extra 跨平台路径
- 可靠性（NFR8-11）：每平台独立集成测试、output.js 集中错误输出、幂等安装、中断后可恢复
- 安全（NFR12-13）：适配器内路径白名单验证、package-lock.json 提交 + npm ci
- 编排性能（NFR14）：orchestrator.js 调用 BMAD 安装器 + 补充文件写入总时间 ≤ 60 秒
- 检测性能（NFR15）：platform.js 探针链总执行时间 ≤ 1 秒

### 实现就绪度验证 ✅

**决策完整性：** 所有关键决策均有版本号，延后决策有明确的阶段标注
**结构完整性：** 完整目录树已定义，所有文件均有职责说明
**模式完整性：** 6 个冲突领域全部有规则 + 正例 + 反例

### 缺口分析

**Phase 1/1.5 缺口（已在实现中解决）：**
- ~~`vitest.config.js`、`.eslintrc.js`、`.prettierrc` 的具体配置内容~~ ✅
- ~~`.gitignore` 内容~~ ✅
- ~~BOOTSTRAP.md 具体内容~~ ✅

**Phase 2 待确认项（不阻塞架构，在平台适配器 Story 中预研）：**
- OpenClaw 平台：agent 注册机制、文件系统约定、环境变量特征（需预研）
- Codex 平台：执行环境约束、Node.js 版本、agent 注册机制（需预研）
- BMAD 官方安装器版本兼容性：`npx bmad-method install` 参数在不同版本间的稳定性（需验证）

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

**已实现的增强点：**
- Phase 1.5 Growth：`--json` 输出、`update`/`status` 命令 ✅
- Phase 2 架构扩展：安装编排（orchestrator.js）、智能参数构建（param-builder.js）、多平台自动检测、4 平台适配器

**未来增强点（Phase 3 Vision）：**
- 完整的 BMAD 新手教练流程
- 卸载命令与回滚机制
- 全局 agent 多项目内存隔离

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
