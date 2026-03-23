---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'AI Coding Tools Agent 安装初始化机制与 BMAD 扩展架构'
research_goals: '1. 调研各主流 AI 编程工具（HappyCapy、Cursor、OpenCW 等）的 agent 安装和初始化机制；2. 研究 BMAD 模块/扩展机制，确定 story-dev-workflow 的最佳打包方式；3. 为 bmad-expert CLI 安装器的实现提供技术依据'
user_name: ''
date: '2026-03-23'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-03-23
**Research Type:** technical

---

## Research Overview

本调研针对 bmad-expert CLI 安装器的设计需求，系统研究了 5 个主流 AI 编程工具的 agent 安装/初始化机制，以及 BMAD-METHOD 的模块扩展架构。核心发现：所有工具均以 Markdown 文件为主要格式，但注册机制存在根本差异——绝大多数工具采用文件路径约定自动发现，HappyCapy 是唯一需要显式 CLI 注册的平台。这一差异直接决定了 CLI 安装器的架构设计。

针对 story-dev-workflow 的打包问题，调研评估了 4 个方案，推荐短期采用 Agent 内置 Skill（方案 C），随代码模板分发，零额外安装步骤；长期视社区复用需求决定是否提取为独立 BMAD npm 模块（方案 A）。CLI 安装器技术选型明确：Node.js 22 + Commander.js + execa + fs-extra，分发模式为 git clone 模板（而非 npm install），提供 `--json` 和语义化 exit codes 满足 AI agent 调用需求。

详细执行摘要见下方 Technical Research Synthesis 节。

## Technical Research Scope Confirmation

**Research Topic:** AI Coding Tools Agent 安装初始化机制与 BMAD 扩展架构
**Research Goals:** 1. 调研各主流 AI 编程工具（HappyCapy、Cursor、OpenCW 等）的 agent 安装和初始化机制；2. 研究 BMAD 模块/扩展机制，确定 story-dev-workflow 的最佳打包方式；3. 为 bmad-expert CLI 安装器的实现提供技术依据

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-23

---

<!-- Content will be appended sequentially through research workflow steps -->

## Technology Stack Analysis

### 各平台 Agent 安装/初始化机制

#### Cursor IDE

**配置文件与目录结构：**
- `.cursor/rules/` — 项目级 rules 目录，包含多个 markdown 文件（新规范）
- `.cursorrules` — 单文件配置（旧版/社区用法）
- `AGENTS.md` — 项目根目录的通用指令文件

**注册机制：**
- **无需显式注册** — 按文件位置自动发现（convention over configuration）
- 规则按优先级叠加：Team Rules → Project Rules → User Rules
- 每次对话开始时自动注入到 model context
- Skills 系统（`.cursor/skills/`）支持 `/命令` 按需加载

**配置格式：** Markdown，无强制 frontmatter

**安装方式：** 无独立安装 CLI，规则文件与代码一起提交 Git

_来源: https://cursor.com/docs/rules, https://cursor.com/learn/customizing-agents_

---

#### Continue.dev

**配置文件与目录结构：**
```
.continue/
├── checks/      # PR 检查定义（Markdown + YAML frontmatter）
├── agents/
├── prompts/
└── rules/
```

**注册机制：**
- 自动发现 `.continue/checks/` 下的所有文件
- Check 在 PR 创建时自动触发，作为 GitHub status checks 运行

**配置格式：** Markdown + YAML frontmatter
```yaml
---
name: Security Audit
description: Security review
---
[AI 指令内容]
```

**安装方式：**
```bash
npm i -g @continuedev/cli    # npm 全局安装
curl -fsSL [url] | bash      # shell script
```

_来源: https://docs.continue.dev/_

---

#### Claude Code

**配置文件：** 项目根目录下的 `CLAUDE.md`

**注册机制：**
- 自动发现，无需注册命令
- Claude Code 启动时自动读取最近的 `CLAUDE.md`
- 目录树向上搜索，最近的文件优先

**配置格式：** 自由 Markdown

_来源: Anthropic Claude Code 文档_

---

#### GitHub Copilot

**配置文件：**
- `.github/copilot-instructions.md` — 项目级指令
- `.github/instructions/NAME.instructions.md` — 路径指定指令（支持 frontmatter）

**注册机制：** 自动发现，无需注册

**配置格式：** Markdown（可选 YAML frontmatter 指定作用路径）

_来源: https://docs.github.com/en/copilot_

---

#### HappyCapy

**目录结构（来自当前系统上下文）：**
```
~/.happycapy/agents/[agent-id]/
├── SOUL.md        # 核心身份
├── IDENTITY.md    # 角色定义
├── AGENTS.md      # 操作手册
├── MEMORY.md      # 长期记忆
├── USER.md        # 用户偏好
├── BOOTSTRAP.md   # 首次初始化（首次运行后删除）
└── memory/        # 每日记忆文件
```

**注册机制：**
- 通过 `happycapy-cli add "agent-id" "Name" "model"` 注册
- 注册后出现在 agent 列表，用户在创建 desktop 时选择
- CLI 命令：`happycapy-cli list/add/get/update/remove/config`

**配置格式：** Markdown 文件集合（SOUL.md、IDENTITY.md 等）

**安装方式（分发场景）：**
```bash
git clone [repo] ~/.happycapy/agents/[agent-id]
happycapy-cli add "agent-id" "Name" "model"
```

_来源: 当前系统上下文及 README.md_

---

#### OpenCW / Amazon Q Developer (原 CodeWhisperer)

**注：** "OpenCW" 可能指 Amazon CodeWhisperer（现已更名为 Amazon Q Developer）或其他工具，以下基于 Amazon Q Developer：

- 配置通过 AWS CLI profile 管理
- 无独立 agent 文件目录结构
- 功能通过 IDE 插件（VS Code、JetBrains）提供
- Agent 功能以 `/dev` 命令触发

_可信度：中（需进一步确认具体工具名称）_

---

### 各平台安装机制对比总结

| 工具 | 主要配置文件 | 格式 | 位置 | 注册方式 | 分发方式 |
|------|------------|------|------|--------|--------|
| Cursor | `.cursor/rules/*.md` | Markdown | 项目目录 | 自动发现 | Git 提交 |
| Continue.dev | `.continue/checks/*.md` | MD + YAML frontmatter | 项目目录 | 自动发现 | npm CLI |
| Claude Code | `CLAUDE.md` | Markdown | 项目根目录 | 自动发现 | Git 提交 |
| GitHub Copilot | `.github/copilot-instructions.md` | Markdown | `.github/` | 自动发现 | Git 提交 |
| HappyCapy | `~/.happycapy/agents/[id]/*.md` | Markdown 文件集合 | 用户主目录 | CLI 注册 | git clone + CLI |

**核心规律：**
1. **Markdown 是主流格式** — 所有工具均采用人类可读、可版本控制的 Markdown
2. **Convention over configuration** — 无需显式注册，按文件路径/名称自动发现
3. **HappyCapy 是特例** — 需要 CLI 注册（`happycapy-cli add`），其他工具均为纯文件发现
4. **分发方式两类** — Git 提交随代码走（Cursor/Claude Code）vs. 用户目录 + CLI 注册（HappyCapy）

_来源: cursor.com/docs, docs.continue.dev, docs.github.com/copilot, 当前系统上下文_

---

### BMAD 模块/扩展架构

#### 模块目录结构

```
_bmad/
├── _config/           # 全局配置
│   ├── manifest.yaml  # 安装元数据
│   └── bmad-help.csv  # 工作流目录
├── core/              # 核心模块
├── bmm/               # BMM 模块
│   ├── config.yaml    # 模块配置
│   ├── agents/        # Agent 定义
│   ├── workflows/     # 工作流定义
│   └── skills/        # 技能实现
└── cis/               # CIS 模块（外部，npm 包）
```

#### npm 模块结构（外部模块）

```
bmad-module-[name]/
├── src/
│   ├── module.yaml    # 模块元数据和安装配置
│   ├── module-help.csv
│   ├── agents/
│   ├── workflows/
│   ├── skills/
│   │   └── [skill-name]/
│   │       └── SKILL.md
│   └── tools/
├── package.json       # name: "bmad-module-[name]"
└── README.md
```

**module.yaml 格式：**
```yaml
code: cis                      # 模块标识符（安装时使用）
name: "BMad Creative Suite"    # 显示名称
description: "..."
default_selected: false

module_questions:             # 安装时的用户提问
  variable_name:
    prompt: "选择..."
    default: "default-value"
    single-select:
      - value: "option1"
        label: "选项说明"

directories:                  # 安装时创建的目录
  - "{output_folder}/subdir"
```

#### 安装方式

```bash
# 通过 BMAD CLI（推荐）
npx bmad-method install --modules bmm,cis --yes

# 可组合安装多个模块
npx bmad-method install \
  --directory /path/to/repo \
  --modules bmm,cis,tea \
  --tools claude-code \
  --user-name "用户名" \
  --communication-language "Chinese" \
  --yes
```

**模块命名规范：**
- 官方内置：`bmm`, `core`, `tea`, `gds`, `cis`
- 外部 npm 包：`bmad-module-{purpose}`（如 `bmad-creative-intelligence-suite`）
- 工具扩展：`bmad-method-{functionality}`

#### story-dev-workflow 独立模块方案分析

**现状：** `story-dev-workflow.md` 当前存在于 bmad-expert agent 目录中，定义了故事开发的完整工作流。

**可选方案：**

**方案 A：BMAD 独立模块（npm 包）**
- 打包为 `bmad-module-story-dev-workflow`
- 通过 `npx bmad-method install --modules sdw` 安装
- 优点：标准 BMAD 生态，与 bmm/cis 对齐
- 缺点：需要维护独立 npm 包，发布流程复杂

**方案 B：BMAD 自定义内容（--custom-content）**
- 通过 `npx bmad-method install --custom-content ./sdw` 注入
- 无需发布 npm 包，本地路径即可
- 适合项目内定制，不适合分发

**方案 C：Agent 内置 Skills**
- 作为 bmad-expert agent 的 `.claude/skills/` 中的一个 skill 存在
- 随 agent 模板一起分发（git clone）
- 优点：简单，零额外安装步骤
- 缺点：与 BMAD 生态解耦，不能被其他 BMAD 项目复用

**方案 D：BMAD 模块 + Agent Skill 双轨**
- 核心工作流逻辑打包为 BMAD 模块
- Agent skill 作为调用入口
- 最灵活，但维护成本最高

_来源: https://github.com/bmad-code-org/bmad-module-template, https://docs.bmad-method.org/reference/modules/_

---

## Integration Patterns Analysis

### CLI 安装器核心集成模式

#### 模式 1：调用平台 CLI（Platform API Integration）

**推荐方案：** 使用 `execa` 调用外部 CLI，先检测存在性，再执行

```javascript
const { execa } = require('execa');

async function registerAgent(agentId, name, model) {
  const hasHappyCapy = await checkCLIExists('happycapy-cli');
  if (!hasHappyCapy) {
    // 优雅降级：输出手动命令
    return { registered: false, manualCommand: `happycapy-cli add "${agentId}" "${name}" "${model}"` };
  }
  await execa('happycapy-cli', ['add', agentId, name, model]);
  return { registered: true };
}
```

**关键点：**
- 优先使用 `execa`（promise-based，跨平台），避免 `exec()`
- 所有平台 CLI 调用必须有降级路径（输出手动命令）
- HappyCapy 需要显式 `happycapy-cli add`；其他平台（Cursor、Claude Code）只需文件复制

_来源: npm execa 文档, cli-installer-integration-patterns-research.md_

---

#### 模式 2：npm bin + npx 分发（Distribution Pattern）

**推荐方案：** `bin` 入口 + npx 调用，不依赖全局安装

```json
{
  "name": "bmad-expert",
  "bin": { "bmad-expert": "./cli.js" }
}
```

```bash
# 用户使用（无需 global install）
npx bmad-expert install
npx bmad-expert install --agent-id my-agent --yes --json
```

**关键决策：**
- 避免 `postinstall` 钩子 — 在 CI 环境中行为不可预测
- `npx` 模式适合 AI agent 调用（非交互式、可版本锁定）
- 支持 `--yes` 跳过所有确认提示

_来源: npm 官方文档, cli-installer-integration-patterns-research.md_

---

#### 模式 3：Git Clone 作为模板分发（Template Distribution）

**推荐方案：** git clone + 变量替换，非 npm 包（模板文件需个性化）

```javascript
// 浅克隆（无历史记录，速度快）
await execa('git', ['clone', '--depth', '1', repoUrl, installPath]);
await fs.remove(path.join(installPath, '.git')); // 解除版本跟踪
await replaceTemplateVariables(installPath, { agentId, userName, model });
```

**为什么不用 npm install？**
- Agent 模板文件（SOUL.md、IDENTITY.md 等）需要定制化内容
- 模板是"代码生成器"，不是"库"
- Git clone 后删除 `.git` → 用户可以在自己的 repo 中提交这些文件

_来源: degit 模式, Yeoman generator 模式_

---

#### 模式 4：跨平台路径适配（Cross-Platform Registration）

```javascript
function getInstallPath(platform, agentId) {
  const home = os.homedir();
  switch (platform) {
    case 'happycapy': return path.join(home, '.happycapy', 'agents', agentId);
    case 'cursor':    return path.join(process.cwd(), '.cursor');
    case 'claude-code': return path.join(process.cwd(), '.claude');
    default: throw new Error(`Unknown platform: ${platform}`);
  }
}
```

**平台检测逻辑：**
1. 检测 `happycapy-cli` 是否存在 → HappyCapy 模式
2. 检测 `.cursor/` 目录 → Cursor 模式
3. 检测 `CLAUDE.md` 或 `.claude/` → Claude Code 模式
4. 未检测到 → 询问用户或输出通用结构

---

#### 模式 5：AI Caller 友好的 CLI 契约（Machine-Readable Output）

```javascript
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  DEPENDENCY_MISSING: 3,
  ALREADY_EXISTS: 6,
};

// 双模式输出
if (options.json) {
  console.log(JSON.stringify({ success: true, agentId, installPath }));
  process.exit(EXIT_CODES.SUCCESS);
} else {
  console.log(`Agent "${agentId}" installed at ${installPath}`);
}
```

**AI Caller 契约要素：**
- `--json` 标志 → 结构化 JSON 输出
- `--yes` 标志 → 跳过所有交互提示
- 语义化 exit code（0=成功，非零=具体错误类型）
- `check` 子命令 → 前置依赖检查（可机器解析）

_来源: CLI 设计最佳实践, cli-installer-integration-patterns-research.md_

---

### 推荐 CLI 架构

```
bmad-expert/                   # npm 包 / git 仓库
├── package.json               # bin: "bmad-expert"
├── cli.js                     # Commander CLI 入口
├── lib/
│   ├── installer.js           # git clone + 变量替换
│   ├── platform.js            # 平台检测 + happycapy-cli 调用
│   ├── output.js              # 双模式输出（human/json）
│   └── exit-codes.js          # 语义化 exit codes
├── agent/                     # Agent 模板文件
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── AGENTS.md
│   └── BOOTSTRAP.md
└── README.md
```

**完整安装流程：**
```
1. 平台检测（happycapy-cli / .cursor / CLAUDE.md）
2. git clone 模板到目标路径（--depth 1）
3. 删除 .git，替换模板变量
4. 调用平台 CLI 注册（happycapy-cli add，或仅文件复制）
5. 输出结果（JSON if --json）
```

_详细实现见: cli-installer-implementation-guide.md, cli-patterns-quick-reference.md_

---

## Architectural Patterns and Design

### System Architecture Patterns

**CLI 工具架构：Commander.js 命令树**

```
bmad-expert
├── install          # 主安装命令
│   ├── --platform   # 目标平台（happycapy/cursor/claude-code）
│   ├── --agent-id   # agent 标识符
│   ├── --model      # 使用的模型
│   ├── --yes        # 跳过所有确认
│   └── --json       # 机器可读输出
├── update           # 更新框架文件（保留用户数据）
├── check            # 前置依赖检查
└── uninstall        # 卸载（需确认）
```

**三层关注点分离：**
1. **CLI 层** — 用户交互、参数解析（`cli.js`）
2. **业务逻辑层** — 安装流程、平台适配（`lib/installer.js`, `lib/platform.js`）
3. **模板层** — Agent 文件（`agent/` 目录）

_来源: Commander.js 文档, cli-installer-implementation-guide.md_

---

### Design Principles and Best Practices

**install vs update 分离原则**

```
install: 全新安装，创建所有文件
update:  只更新框架文件（AGENTS.md, SOUL.md, IDENTITY.md）
         保留: MEMORY.md, USER.md, memory/ 目录, 用户定制内容
```

**为什么必须分离：**
- `install` 覆盖所有文件 → 破坏用户积累的记忆和定制
- `update` 需要精确知道哪些文件是"框架文件"，哪些是"用户数据"
- 文件分类需在设计时明确（非运行时猜测）

**平台适配器模式（Adapter Pattern）：**

```
PlatformAdapter
├── HappyCapyAdapter    → git clone ~/.happycapy/agents/[id] + happycapy-cli add
├── CursorAdapter       → 复制到 .cursor/rules/
├── ClaudeCodeAdapter   → 复制到 .claude/skills/ + CLAUDE.md
└── GenericAdapter      → 输出到当前目录
```

每个适配器实现相同接口：`install()`, `update()`, `uninstall()`, `check()`

---

### Scalability and Performance Patterns

**BMAD 模块扩展架构对比**

| 方案 | 复用性 | 安装复杂度 | 维护成本 | 与 BMAD 生态对齐 |
|------|--------|----------|--------|--------------|
| A: 独立 npm 模块 | 高（跨项目） | 高（需 npx bmad-method） | 高（独立发布） | 完全对齐 |
| B: --custom-content | 低（本地路径） | 中 | 低 | 部分对齐 |
| C: Agent 内置 Skill | 中（随 agent 走） | 低（git clone 即得） | 低 | 不对齐 |
| D: 模块+Skill 双轨 | 高 | 高 | 最高 | 完全对齐 |

**推荐：方案 C（短期）→ 方案 A（长期）**
- 短期：先作为 agent 内置 skill 交付价值
- 长期：如果社区有复用需求，再提取为独立 BMAD 模块

---

### Security Architecture Patterns

**CLI 安全设计要点：**
- **危险操作保护** — `uninstall` 默认要求确认，`--yes` 不覆盖破坏性操作
- **路径遍历防护** — 安装路径限制在用户主目录或当前项目目录内
- **无 postinstall 执行** — 避免 `npm install` 时自动执行脚本（安全风险）
- **git clone 信任** — 只从已知官方仓库克隆，URL 硬编码或用户显式指定

---

### Data Architecture Patterns

**Agent 文件系统层级（HappyCapy 模型）：**

```
框架文件（update 可覆盖）：
├── SOUL.md         — 核心身份
├── IDENTITY.md     — 角色定义
├── AGENTS.md       — 操作手册
└── BOOTSTRAP.md    — 首次运行后删除

用户数据（永不覆盖）：
├── MEMORY.md       — 长期记忆（运行时写入）
├── USER.md         — 用户偏好（运行时写入）
└── memory/         — 每日记忆文件
```

**此分层决定了 `update` 命令的行为边界。**

---

### Deployment and Operations Architecture

**发布流程（基于 BMAD 模块经验）：**

```
GitHub Actions
├── push to main → CI 测试
├── git tag v*.*.* → npm publish（自动）
└── prerelease tag → npm publish --tag next
```

**版本策略：**
- `npx bmad-expert@latest install` — 稳定版
- `npx bmad-expert@next install` — 预览版
- 与 BMAD 官方版本号解耦（独立版本周期）

_来源: bmad-module-template GitHub Actions 配置, npm 语义化版本规范_

---

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

**分阶段交付策略（渐进式发布）：**

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| MVP | HappyCapy 单平台可用 | `npx bmad-expert install`，仅支持 HappyCapy |
| v1.0 | 多平台支持 | 增加 Cursor、Claude Code 适配器 |
| v1.x | 完整 CLI 契约 | `--json`、语义化 exit codes、`check` 命令 |
| v2.0 | story-dev-workflow | 作为内置 Skill 交付（方案 C），视需求提取模块 |

**技术选型最终建议：**
- **运行时：** Node.js 22+（LTS），与 BMAD 要求一致
- **CLI 框架：** Commander.js（成熟稳定，BMAD 自身使用）
- **进程执行：** `execa`（跨平台、promise-based）
- **文件操作：** `fs-extra`（fs 增强，含 copy/remove/ensureDir）
- **模板分发：** git clone（非 npm install）

_来源: cli-installer-implementation-guide.md, BMAD package.json 分析_

---

### Development Workflows and Tooling

**推荐开发工具链（对齐 BMAD 模块标准）：**
```json
{
  "devDependencies": {
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "execa": "^9.0.0",
    "fs-extra": "^11.0.0",
    "chalk": "^5.0.0"
  }
}
```

**分支策略：**
- `main` → 稳定版（对应 npm latest tag）
- `next` → 预览版（对应 npm next tag）
- feature 分支 → PR → squash merge

---

### Testing and Quality Assurance

**CLI 测试策略：**

```
单元测试（vitest）：
├── lib/platform.js  → 平台检测逻辑
├── lib/installer.js → 变量替换逻辑
└── lib/output.js    → JSON/human 输出格式

集成测试（真实文件系统）：
├── 模拟 git clone（使用本地 fixture repo）
├── 验证 happycapy-cli 不存在时的降级路径
└── 验证 --json 输出格式正确

E2E 测试（可选）：
└── 在 CI 容器中跑完整 install 流程
```

---

### Deployment and Operations Practices

**npm 发布流程（GitHub Actions 自动化）：**

```yaml
# .github/workflows/publish.yml
on:
  push:
    tags: ['v*.*.*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm test
      - run: npm publish
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

**版本发布命令（本地）：**
```bash
npm run release:patch    # 1.0.0 → 1.0.1
npm run release:minor    # 1.0.0 → 1.1.0
npm run release:major    # 1.0.0 → 2.0.0
```

---

### Risk Assessment and Mitigation

| 风险 | 可能性 | 影响 | 缓解方案 |
|------|--------|------|--------|
| `happycapy-cli` API 变更 | 中 | 高 | 版本检测 + 降级路径 |
| git clone 网络超时 | 中 | 中 | 超时设置 + 重试逻辑 |
| 路径权限问题（Windows） | 中 | 中 | `fs-extra` 跨平台处理 |
| 模板变量未替换 | 低 | 高 | 安装完成后做完整性检查 |
| npm 包名冲突 | 低 | 中 | 提前注册 npm 包名 |
| `update` 误覆盖用户数据 | 低 | 高 | 白名单机制，只更新明确列出的文件 |

---

## Technical Research Recommendations

### Implementation Roadmap

**Phase 1（MVP，1-2 天）：**
1. 初始化 npm 包结构（package.json + cli.js + lib/）
2. 实现 HappyCapy 适配器（git clone + happycapy-cli add）
3. 实现基础 install 命令（`--yes` 支持）
4. 手动测试完整流程

**Phase 2（多平台 + 质量，3-5 天）：**
1. 添加 Cursor、Claude Code 适配器
2. 添加平台自动检测
3. 实现 `update` 命令（框架文件/用户数据分离）
4. 添加单元测试（vitest）
5. 接入 ESLint + Prettier

**Phase 3（生产就绪，1-2 天）：**
1. 实现 `--json` 输出 + 语义化 exit codes
2. 实现 `check` 子命令
3. 配置 GitHub Actions 自动发布
4. 完善 README

### Technology Stack Recommendations

```
核心：Node.js 22 + Commander.js + execa + fs-extra
测试：vitest
代码质量：ESLint + Prettier + husky
CI/CD：GitHub Actions
分发：npm (npx 调用) + git clone 模板
```

### Success Metrics and KPIs

- `npx bmad-expert install` 在 HappyCapy 环境一键成功率 > 95%
- 安装耗时 < 30 秒（包含 git clone）
- `--json` 输出格式稳定（无 breaking change 策略）
- `update` 命令零用户数据丢失事故

_来源: cli-installer-implementation-guide.md, npm 最佳实践_

---

## Related Research Documents

This research has been extended with detailed implementation guides:

1. **CLI Installer Integration Patterns Research** (`cli-installer-integration-patterns-research.md`)
   - Comprehensive patterns for calling platform CLIs from Node.js
   - npm package + bin + postinstall hook best practices
   - Cross-platform template generator patterns (Yeoman, create-react-app, degit)
   - Git clone as distribution mechanism with code examples
   - Machine-readable CLI output and exit code standards

2. **CLI Installer Implementation Guide** (`cli-installer-implementation-guide.md`)
   - Phase-by-phase implementation roadmap for `npx bmad-expert install`
   - Ready-to-use code snippets for each component
   - Testing strategy and examples
   - Common issues and solutions
   - Deployment checklist

**Recommended reading order:**
1. This document (overview and context)
2. Integration Patterns (deep dive on each pattern)
3. Implementation Guide (practical build steps)

---

## Technical Research Synthesis

### Executive Summary

本次技术调研历时一个工作日，覆盖 5 个主流 AI 编程工具的 agent 安装机制与 BMAD 扩展架构，产出 4 份技术文档（约 83KB）。以下为关键决策依据。

**核心技术发现：**

1. **平台注册机制存在根本分歧** — Cursor、Claude Code、GitHub Copilot 均通过文件路径约定自动发现 agent，无需任何注册命令。HappyCapy 是唯一例外，必须通过 `happycapy-cli add` 显式注册。这意味着 CLI 安装器中，HappyCapy 的注册步骤是刚需，其他平台只需正确复制文件到指定路径。

2. **模板分发的正确模式是 git clone，而非 npm install** — Agent 模板文件（SOUL.md、IDENTITY.md 等）需要个性化填写用户名、agent-id 等变量，本质上是"代码生成器"而非"库"。git clone + 删除 .git + 变量替换是该场景的标准模式（对齐 Yeoman、degit 等主流工具）。

3. **BMAD 外部模块体系成熟，可直接复用** — BMAD 提供官方模块模板仓库（`bmad-module-template`），npm 包名规范为 `bmad-module-*`，通过 `--modules` 参数安装。CIS 模块（`bmad-creative-intelligence-suite`）是可参照的完整外部模块实例。

4. **story-dev-workflow 短期走 Agent Skill，长期视需求再决定** — 方案 C（内置 skill）零额外安装步骤，随 agent 模板 git clone 即得，维护成本最低。若未来有跨项目复用需求，再按方案 A 提取为独立 BMAD 模块。

**技术选型决策：**

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js 22+ | 与 BMAD 要求一致 |
| CLI 框架 | Commander.js | BMAD 自身在用，成熟稳定 |
| 进程执行 | execa | Promise-based，跨平台，优于 exec() |
| 文件操作 | fs-extra | fs 增强，跨平台路径处理 |
| 模板分发 | git clone | 模板需个性化，非库分发 |
| 测试 | vitest | 快，ESM 原生支持 |

**实现路线图：**

- **Phase 1（MVP）：** HappyCapy 单平台 install，基础 `--yes` 支持
- **Phase 2：** 多平台适配器 + `update` 命令（框架文件/用户数据分离）
- **Phase 3：** `--json` + exit codes + `check` 命令 + CI/CD 自动发布

### Table of Contents

1. Technical Research Scope Confirmation
2. Technology Stack Analysis（各平台 Agent 安装/初始化机制 + BMAD 模块架构）
3. Integration Patterns Analysis（CLI 安装器集成模式）
4. Architectural Patterns and Design（CLI 架构 + 适配器模式 + 文件分层）
5. Implementation Approaches and Technology Adoption（技术选型 + 实现路线图 + 风险）
6. Technical Research Recommendations（实施路线图 + 成功指标）
7. Related Research Documents（详细实现文档索引）

### Strategic Technical Implications

**对 bmad-expert 项目的直接影响：**

- **项目性质确认：** bmad-expert 是一个带 CLI 的 npm 包（非纯文件模板仓库），agent 目录作为模板内嵌在包内
- **HappyCapy 特殊处理：** 安装流程必须处理 `happycapy-cli` 不存在的降级场景（输出手动命令）
- **update 命令的边界必须在设计阶段定义清楚：** MEMORY.md、USER.md、memory/ 目录永不覆盖
- **AI agent 可编程性是一等公民：** `--json` + `--yes` + 语义化 exit codes 不是可选功能，是核心契约

**调研局限性：**
- OpenCW 工具身份未完全确认（可信度中），如有特定集成需求需补充调研
- `happycapy-cli` 的完整 API 参数（如是否支持 `--json` 输出）需在实现阶段实测验证

---

**Technical Research Completion Date:** 2026-03-23
**Research Coverage:** 5 platforms + BMAD module system + CLI patterns
**Source Verification:** Multi-source, web-verified
**Confidence Level:** High (HappyCapy/Cursor/Claude Code/BMAD) | Medium (OpenCW)
