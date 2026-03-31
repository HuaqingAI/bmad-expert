# Story 4.2：一次性 BOOTSTRAP 文件设计与自毁机制

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 首次激活 bmad-expert agent 时，BOOTSTRAP 文件引导完成 BMAD 工具介绍、agent 身份建立和环境配置，完成后文件自毁，再次激活时直接进入工作状态，
so that 新用户获得结构化的首次上手体验，而不是面对一个无任何上下文的空白 agent；老用户再次使用时不会被重复的 onboarding 流程打断。

## Acceptance Criteria

1. **Given** `agent/BOOTSTRAP.md` 模板文件已设计完成
   **When** 人工审阅模板内容
   **Then** 包含以下内容区块（按执行顺序）：
   - ① BMAD 方法论简明说明（不超过 200 字）
   - ② agent 身份建立指令（读取 SOUL.md、IDENTITY.md、USER.md）
   - ③ 环境检测与初始化（按需触发 bmad-project-init.md）
   - ④ 自毁指令（删除 BOOTSTRAP.md 本身）
   - ⑤ 跳转至 bmad-help 指令
   **And** 文件中不包含任何社交破冰对话流程或"介绍自己"类指令
   **And** 自毁机制在同一 agent 会话内执行，不依赖用户手动删除

2. **Given** BOOTSTRAP.md 已自毁（文件不存在）
   **When** agent 再次启动新会话
   **Then** AGENTS.md Step 2 检测 BOOTSTRAP.md 不存在，跳过，继续 Step 3（BMAD 按需加载）
   **And** 不再执行 BOOTSTRAP 流程

## Tasks / Subtasks

- [x] 设计并实现 `agent/BOOTSTRAP.md` 模板内容（唯一主交付物）（AC: #1）
  - [x] 区块①：BMAD 方法论简明说明（≤200 字，工具型介绍，不含社交话术）
  - [x] 区块②：身份建立指令（读取 SOUL.md / IDENTITY.md / USER.md，内化角色定位）
  - [x] 区块③：首次环境检测（检查 cwd 下 `_bmad/` 是否存在；不存在则加载 `bmad-project-init.md` 执行初始化）
  - [x] 区块④：自毁指令（使用 Bash/Write 工具删除 `BOOTSTRAP.md`；删除前输出"BOOTSTRAP 完成，正在清理..."）
  - [x] 区块⑤：跳转 bmad-help（输出就绪提示并 invoke `bmad-help`）
- [x] 验证模板变量合规：仅允许 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`（AC: #1）
- [x] 确认 BOOTSTRAP.md 已在 `lib/installer.js` FRAMEWORK_FILES 和 `package.json` 中（检查即可，无需修改）（AC: #1, #2）

## Dev Notes

### 本故事性质：纯内容设计，零代码改动

Story 4.2 **不修改任何 `.js` 文件**。`installer.js` 已在 Story 2.4 实现，Story 4.1 已确认 `BOOTSTRAP.md` 在 `FRAMEWORK_FILES` 中：

```javascript
// lib/installer.js:27
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md', 'bmad-project-init.md']
```

唯一交付物：替换 `agent/BOOTSTRAP.md` 的占位内容为完整 onboarding 指令。

### BOOTSTRAP.md 当前状态（占位符）

```markdown
<!-- PLACEHOLDER: Story 4.2 将替换此文件为完整的一次性 onboarding 文件（含自毁机制） -->
<!-- Template variables used during install: {{agent_id}}, {{agent_name}}, {{install_date}} -->
```

本故事将完整替换此占位内容。

### AGENTS.md 中的 BOOTSTRAP.md 调用机制（Story 4.1 已实现）

AGENTS.md Session Startup Step 2 已写入：

```markdown
**Step 2 — Check for BOOTSTRAP.md:**

If `BOOTSTRAP.md` exists in this agent directory:
- Execute the instructions in BOOTSTRAP.md now, before proceeding to BMAD environment detection
- Do not proceed to Step 3 until BOOTSTRAP.md instructions are fully complete
```

BOOTSTRAP.md 的设计必须与此调用约定兼容：执行完所有区块后，AGENTS.md 的 Step 3 会接管后续（BMAD 按需初始化）。因此 BOOTSTRAP.md **区块③** 中的环境检测逻辑与 AGENTS.md Step 3 有轻微重叠——这是设计意图：首次运行时 BOOTSTRAP.md 主动检测一次，后续由 AGENTS.md Step 3 的按需触发机制接管。

### 模板变量约束（严格执行）

安装时 `installer.js` 对所有 FRAMEWORK_FILES 执行变量替换：

```javascript
// lib/installer.js:replaceTemplateVars()
{{agent_id}}     → 'bmad-expert'（安装时替换）
{{agent_name}}   → 'bmad-expert'（安装时替换）
{{model}}        → ''（预留，暂为空）
{{install_date}} → 安装当日日期 YYYY-MM-DD（安装时替换）
```

**BOOTSTRAP.md 内容不能包含任何其他 `{{...}}` 格式**（会被 replaceTemplateVars 误替换为空字符串）。所有 BMAD 工作流指令必须写为纯文本，不使用 `{{...}}` 占位符格式。

### 自毁机制实现要求

自毁必须满足：
1. **同会话内执行**：agent 执行 BOOTSTRAP.md 的指令时，在指令末尾调用文件删除操作
2. **使用 agent 工具**：agent 应使用其可用的文件操作工具（Bash `rm` 命令，或 Write 工具将文件清空/标记为 completed）
3. **推荐实现**：指令中明确要求 agent 执行 `rm {agent_dir}/BOOTSTRAP.md`（其中 `{agent_dir}` 为 agent 文件所在目录的路径）
4. **降级**：若无法删除，将文件内容替换为单行 `# BOOTSTRAP COMPLETED` 标记，并在 AGENTS.md Step 2 检测时认为 "存在且已完成" 即跳过重新执行——但 AGENTS.md 当前实现是"存在即执行"，因此**首选删除**

### 不修改的文件（严禁改动）

- `lib/installer.js` — BOOTSTRAP.md 已在 FRAMEWORK_FILES，无需改动
- `package.json` — `bmadExpert.frameworkFiles` 已包含，无需改动
- `agent/AGENTS.md` — Story 4.1 已设计完成，无需改动
- `agent/SOUL.md` — Story 4.1 已设计完成，无需改动
- `agent/IDENTITY.md` — Story 4.1 已设计完成，无需改动
- `agent/bmad-project-init.md` — Story 4.1 已设计完成，BOOTSTRAP.md 将引用（加载）它

### 本故事修改的文件

```
bmad-expert/
└── agent/
    └── BOOTSTRAP.md    ✏️  替换占位内容为完整一次性 onboarding 指令（主交付物）
```

### 设计参考：与 Story 4.1 产物的协作关系

```
AGENTS.md（4.1 产物）
  └── Session Startup Step 2
        └── 检测 BOOTSTRAP.md 是否存在
              ├── 存在 → 执行 BOOTSTRAP.md 全部指令 ← Story 4.2 设计此内容
              │     └── 执行完毕后继续 Step 3
              └── 不存在 → 直接进入 Step 3

BOOTSTRAP.md（4.2 产物）
  ├── 区块①：BMAD 简介（≤200 字，工具型）
  ├── 区块②：读取身份文件（SOUL.md, IDENTITY.md, USER.md）
  ├── 区块③：首次 BMAD 环境检测（若无 _bmad/ → 加载 bmad-project-init.md）
  ├── 区块④：自毁（删除本文件）
  └── 区块⑤：就绪输出 + invoke bmad-help
```

### 内容原则（FR27）

- **工具型 agent 直接进入工作状态**：不包含"你好，我是..."之类的自我介绍
- **零追问**：整个 BOOTSTRAP 流程不等待用户确认，自动执行到 bmad-help
- **简明**：BMAD 方法论说明 ≤200 字，点到为止，不是完整教程
- **可靠自毁**：优先删除文件；若工具限制无法删除，写入 completed 标记

### 架构守则

- **零代码改动**：100% Markdown 内容设计
- **模板变量格式**：仅使用 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}`
- **内容独立性**：指令清晰，agent 无需查阅外部文档即可按步执行
- **单次执行语义**：整个 BOOTSTRAP 是幂等的（首次运行后文件消失，不会重复执行）

### Project Structure Notes

- `agent/BOOTSTRAP.md` 为模板文件，安装后写入 `~/.happycapy/agents/bmad-expert/BOOTSTRAP.md`
- 安装路径由 `lib/adapters/happycapy.js` 的 `getInstallPath('bmad-expert')` 决定：`~/.happycapy/agents/bmad-expert/`
- 路径白名单：`~/.happycapy/agents/[agent-id]/`，自毁时需在此路径内操作

### References

- Epic 4 Story 4.2 规格：`_bmad-output/planning-artifacts/epics.md#Story-4.2`
- Story 4.1 产物（AGENTS.md 调用机制）：`_bmad-output/implementation-artifacts/4-1-persistent-config-session-detection.md#与-Story-4.2-的边界`
- AGENTS.md 模板：`agent/AGENTS.md`（Session Startup Step 2）
- BOOTSTRAP.md 占位文件：`agent/BOOTSTRAP.md`
- bmad-project-init.md：`agent/bmad-project-init.md`（区块③中引用）
- installer.js FRAMEWORK_FILES：`lib/installer.js:27`
- FR27（一次性 BOOTSTRAP 文件）：`_bmad-output/planning-artifacts/epics.md#功能需求`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 设计并实现 `agent/BOOTSTRAP.md` 完整一次性 onboarding 文件，替换原占位符内容
- 区块①：BMAD 方法论简介，约 120 字，工具型说明，不含社交话术
- 区块②：身份建立，依次读取 SOUL.md / IDENTITY.md / USER.md / MEMORY.md
- 区块③：BMAD 环境检测，已有 `_bmad/bmm/config.yaml` 则跳过，否则加载 `bmad-project-init.md` 执行初始化
- 区块④：自毁指令，优先使用 `rm ~/.happycapy/agents/{{agent_id}}/BOOTSTRAP.md`；降级时使用 Write 工具写入 completed 标记（降级说明附注）
- 区块⑤：输出就绪信息并调用 `bmad-help`
- 模板变量验证：仅使用 `{{agent_name}}`、`{{agent_id}}`、`{{install_date}}` 三个合法变量，无其他 `{{...}}` 格式
- FRAMEWORK_FILES 确认：`lib/installer.js:27` 和 `package.json:41` 均已包含 BOOTSTRAP.md，无需修改

### File List

- `agent/BOOTSTRAP.md`
- `_bmad-output/implementation-artifacts/4-2-bootstrap-file-self-destruct.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
