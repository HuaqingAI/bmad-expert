# Story 4.1：持久配置文件写入 BMAD 会话启动检测逻辑

**Status:** review

## Story

As a 用户（通过 AI 代劳）,
I want 安装完成后 agent 持久配置文件（AGENTS.md）包含会话启动时自动执行的 BMAD 环境检测逻辑，
so that 每次在 HappyCapy 开启新会话时，agent 自动判断是否需要初始化，已初始化则直接就绪，未初始化则引导完成配置，无需用户手动触发。

## Acceptance Criteria

1. **Given** `installer.js` 写入 agent 文件至 `~/.happycapy/agents/bmad-expert/`
   **When** 写入 `AGENTS.md` 模板（含会话启动检测逻辑）
   **Then** `AGENTS.md` 包含 BMAD 环境检测指令区块，指令检查项目根目录是否存在 `_bmad/` 或等效标记文件（FR23）
   **And** 检测逻辑条件分支：已初始化 → 跳过，直接进入工作状态；未初始化 → 执行 BMAD 配置引导（FR24）
   **And** 整个检测和引导流程不向用户发起任何追问，一句话触发即可完成全部步骤（FR25）
   **And** 初始化完成后最终状态为：用户直接进入 bmad-help 工作流（FR26）

2. **Given** `agent/AGENTS.md` 模板已设计完成
   **When** 人工审阅模板内容
   **Then** 会话启动检测逻辑清晰，无歧义，任何 AI agent 按指令执行均可完成全部初始化步骤

## Tasks / Subtasks

- [x] 设计并实现 `agent/SOUL.md` 模板内容（替换占位符，含 {{agent_id}}、{{agent_name}}、{{install_date}} 变量）
- [x] 设计并实现 `agent/IDENTITY.md` 模板内容（替换占位符，含 {{agent_id}}、{{agent_name}}、{{install_date}} 变量）
- [x] 设计并实现 `agent/AGENTS.md` 模板内容（**主交付物**）：
  - [x] Session Startup 区块：读取 SOUL.md、IDENTITY.md、USER.md、MEMORY.md
  - [x] BOOTSTRAP.md 检测：若存在则优先执行（为 Story 4.2 预留）
  - [x] BMAD 环境检测：检查 cwd 下 `_bmad/` 是否存在
  - [x] 已初始化分支：直接进入工作状态（输出就绪信息）
  - [x] 未初始化分支：零追问自动执行初始化，然后 invoke bmad-help
  - [x] Memory 管理区块
  - [x] Red Lines 区块

## Dev Notes

### 本故事性质：内容设计，非代码实现

Story 4.1 **不需要修改任何 `.js` 文件**。`installer.js` 已在 Story 2.4 完整实现，会将 `agent/` 目录下所有四个模板文件原样（替换变量后）写入 `~/.happycapy/agents/bmad-expert/`。本故事的唯一任务是：**设计这三个模板文件的实际内容**（BOOTSTRAP.md 由 Story 4.2 设计）。

### 模板变量（installer.js 中已实现的替换）

```javascript
// lib/installer.js:replaceTemplateVars() 中处理的变量：
{{agent_id}}     → 'bmad-expert'（默认值）
{{agent_name}}   → 'bmad-expert'（默认值）
{{model}}        → ''（预留，暂为空）
{{install_date}} → 安装当日日期 YYYY-MM-DD
```

**重要：** 模板中只允许使用上述四个变量，其他任何 `{{...}}` 格式的内容在安装后会原样保留。AGENTS.md 中的指令内容不应包含 `{{...}}` 格式（否则会被误替换）。

### AGENTS.md 模板设计要求（FR23-FR26）

**核心检测逻辑必须满足的条件：**

1. **检测标记**：`_bmad/` 目录（在用户当前工作目录 cwd 下）
   - 替代标记：`_bmad-output/` 目录（旧项目可能用此目录结构）
   - 两者之一存在 → BMAD 已初始化

2. **已初始化分支（FR24 已初始化路径）：**
   - 不执行任何额外步骤
   - 直接进入工作就绪状态
   - 响应用户请求，或自动运行 `bmad-help`

3. **未初始化分支（FR24-FR26 零追问路径）：**
   - **不询问用户任何问题**
   - 自动推断项目信息（从目录名或 package.json）
   - 创建 `_bmad/` 目录结构和 `_bmad/bmm/config.yaml`
   - 完成后输出提示并 invoke `bmad-help`

4. **零追问（FR25）实现方式：**
   - 项目名从 `package.json` 的 `name` 字段读取，若不存在则用当前目录名
   - 其他配置使用默认值（communication_language: Chinese, user_skill_level: intermediate 等）
   - 整个过程中 agent 只输出进度信息，不等待用户确认

### BMAD 初始化时创建的 `_bmad/bmm/config.yaml` 内容

初始化时 agent 应创建此文件（dev agent 将此内容嵌入 AGENTS.md 的指令中）：

```yaml
project_name: (从 package.json name 字段获取，或用当前目录名)
communication_language: Chinese
document_output_language: Chinese
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
```

### SOUL.md 模板设计要求

SOUL.md 定义 bmad-expert agent 的核心身份，需包含：
- Core Truths：角色是 BMAD 专家，帮助用户通过 BMAD 方法论进行产品开发
- 使用 `{{agent_name}}`、`{{agent_id}}`、`{{install_date}}` 变量
- 工作精神：高效直接、零追问完成复杂初始化、自主执行多步流程

### IDENTITY.md 模板设计要求

IDENTITY.md 定义角色和个性：
- 角色：BMAD 方法论实现专家
- 能力：初始化 BMAD 环境、PRD/架构/Epic 规划、开发工作流执行
- 工作风格：直接高效，遵循 BMAD 工作流，不做不必要的社交对话

### 参考：HappyCapy AGENTS.md 格式

现有 `~/.happycapy/agents/capy-default/AGENTS.md` 的结构（作为格式参考）：

```markdown
# AGENTS.md - Your Agent Files

## Session Startup
[分步读取指令]

## Memory
[记忆管理规则]

## Red Lines
[禁止行为]

## External vs Internal
[安全边界]
```

bmad-expert 的 AGENTS.md 需在此基础上**增加 BMAD 环境检测专属区块**。

### 与 Story 4.2 的边界

- Story 4.1（本故事）：设计 AGENTS.md 的会话启动检测逻辑 + SOUL.md + IDENTITY.md 内容
- Story 4.2（下一故事）：设计 BOOTSTRAP.md 的首次 onboarding 流程和自毁机制

AGENTS.md 中需要包含 BOOTSTRAP.md 的检测逻辑（若 BOOTSTRAP.md 存在则执行），但 BOOTSTRAP.md 本身的内容由 Story 4.2 完成。AGENTS.md 的 Session Startup 区块必须有：
```
若 BOOTSTRAP.md 存在于 agent 目录 → 先执行 BOOTSTRAP.md 中的指令
```

### 不修改的文件（严禁改动）

- `lib/installer.js` — 已完整实现，无需改动
- `lib/adapters/happycapy.js` — 已完整实现
- `cli.js` — 已完整实现
- `test/` 目录下任何文件 — 本故事无自动化测试
- `agent/BOOTSTRAP.md` — 由 Story 4.2 设计

### 本故事修改的文件

```
bmad-expert/
└── agent/
    ├── SOUL.md        ✏️  替换占位内容，写入完整 agent soul 定义
    ├── IDENTITY.md    ✏️  替换占位内容，写入完整 agent 角色定义
    └── AGENTS.md      ✏️  替换占位内容，写入完整 BMAD 会话检测逻辑（主交付物）
```

### 架构守则

- **零代码改动**：本故事 100% 是 Markdown 内容设计，无 `.js` 文件修改
- **模板变量格式**：`{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`，其他内容不使用 `{{...}}` 格式
- **内容独立性**：AGENTS.md 内容应为 AI agent 可独立理解和执行的指令，不依赖外部文档
- **最小追问原则**：检测和初始化逻辑中不得出现"询问用户"步骤，所有信息自动推断
- **与 installer.js 无耦合**：模板文件是纯内容，installer.js 只做变量替换后写入，不解析内容

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- 设计并实现 `agent/SOUL.md`：含 Core Truths（BMAD 专家身份）、Boundaries、Vibe、Continuity 四个区块；使用 `{{agent_name}}`、`{{agent_id}}`、`{{install_date}}` 模板变量
- 设计并实现 `agent/IDENTITY.md`：含 Role Definition（BMAD 方法论专家）、Core Capabilities（5项）、Working Style（4条原则）、Specializations（按任务类型映射到对应 BMAD 技能）
- 设计并实现 `agent/AGENTS.md`（主交付物）：
  - Session Startup（Step 1-3）：读取身份文件 → BOOTSTRAP.md 检测 → BMAD 环境检测
  - BMAD 零追问初始化流程（Step A-D）：推断项目名 → 创建 `_bmad/bmm/` 结构 → 写入 config.yaml → invoke bmad-help
  - Memory 管理区块：日记与长期记忆规则
  - Red Lines 区块：数据保护与危险操作约束
  - Communication Style 区块
- 全部三个文件仅使用合法模板变量（`{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`），无误替换风险
- 无 .js 文件改动；本故事 100% 为 Markdown 内容设计

### File List

- `agent/SOUL.md`
- `agent/IDENTITY.md`
- `agent/AGENTS.md`
- `_bmad-output/implementation-artifacts/4-1-persistent-config-session-detection.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
