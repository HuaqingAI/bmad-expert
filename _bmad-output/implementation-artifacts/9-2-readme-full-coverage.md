# Story 9.2：README 全命令覆盖与多平台文档更新

Status: review

## Story

**As a** 新用户（无 BMAD 背景）或 AI 调用方，
**I want** README 覆盖 install、update、status、`--json` 全部命令，且以 AI 调用场景为主要说明角度，
**So that** 新平台用户可通过 README 独立完成安装触发，AI 调用方可直接参考 README 进行编程集成。

---

## Acceptance Criteria

**AC1 — install 章节：HappyCapy + OpenClaw 双平台触发命令**
**Given** README.md install 章节已更新
**When** 阅读
**Then** 包含 HappyCapy、OpenClaw 两个平台的单句触发命令示例，每平台附简短平台说明；注明 Claude Code / Codex 平台支持计划中（待后续 Phase 实现后更新）（FR50、FR33）

**AC2 — update 章节**
**Given** README update 章节
**When** 阅读
**Then** 包含 `npx bmad-expert update` 使用说明及用户数据安全保证说明（FR38 摘要）

**AC3 — status 章节（含 --json 说明）**
**Given** README status 章节
**When** 阅读
**Then** 包含 `npx bmad-expert status` 和 `npx bmad-expert status --json` 的使用说明，`--json` 部分以 AI 调用场景为主要说明角度，附 JSON 响应格式示例（FR49-50、FR40）（FR50）

**AC4 — 参数参考章节**
**Given** README 参数参考章节
**When** 阅读
**Then** 覆盖 `--platform`、`--yes`、`--json`、`--modules`、`--tools`、`--communication-language`、`--output-folder` 所有参数的说明

**AC5 — 零背景可用性**
**Given** 无 BMAD 背景的新平台（如 OpenClaw）用户按 README 操作
**When** 按步骤执行
**Then** 触发操作步骤不超过 1 步，所有专业术语首次出现时附带简明说明（FR34 标准）（FR50）

---

## Tasks / Subtasks

- [x] Task 1: 更新 README.md — install 章节（AC1、AC5）
  - [x] 1.1 保留 HappyCapy 触发命令（现有内容，检查是否需微调措辞）
  - [x] 1.2 补充 OpenClaw 平台触发命令段落（仿照 HappyCapy 格式，含"在哪里输入"说明）
  - [x] 1.3 将 "Claude Code *(coming soon)*" 和 "OpenClaw *(coming soon)*" 中的 OpenClaw 部分替换为实际内容；Claude Code / Codex 保留 coming soon
  - [x] 1.4 确认所有专业术语（BMAD、agent、npx、OpenClaw）首次出现时附带简明说明

- [x] Task 2: 新增 README.md — update 命令章节（AC2）
  - [x] 2.1 说明 `npx bmad-expert update` 的用途和触发方式
  - [x] 2.2 注明用户数据（MEMORY.md、USER.md、memory/）永不覆盖，框架文件自动更新
  - [x] 2.3 （可选）说明 --json 输出模式

- [x] Task 3: 新增 README.md — status 命令章节（AC3）
  - [x] 3.1 说明 `npx bmad-expert status` 的用途（检查安装健康度）
  - [x] 3.2 附上人类可读输出示例
  - [x] 3.3 说明 `npx bmad-expert status --json` 的 AI 调用场景
  - [x] 3.4 附上 JSON 响应格式示例（healthy / not_installed / corrupted 三种状态）

- [x] Task 4: 新增 README.md — 参数参考章节（AC4）
  - [x] 4.1 列出所有参数：--platform、--yes、--json、--modules、--tools、--communication-language、--output-folder
  - [x] 4.2 每个参数：名称、适用命令、默认值、简短说明

- [x] Task 5: 验证 README 整体结构与可读性（AC5）
  - [x] 5.1 通读全文，确认无 BMAD 背景用户可在 ≤1 步内触发安装
  - [x] 5.2 确认无遗漏的专业术语缺少解释

---

## Dev Notes

### 这是一个纯文档 Story — 仅修改 README.md，无代码改动

**唯一需要修改的文件：** `README.md`（项目根目录）

---

### 现有 README.md 内容（需在此基础上修改）

当前 README.md 结构（`/README.md`）：

```
# BMAD Expert — HappyCapy Agent
badges（npm version + CI）

Quick Start
  HappyCapy 触发命令 + 说明
  Claude Code *(coming soon)*
  OpenClaw *(coming soon)*

What is BMAD Expert?

Capabilities 表格

File Structure 表格

BMAD Environment Setup（含 npx bmad-method install 示例）

Workflow Overview

License
```

**需要的改动：**
1. Quick Start → 补充 OpenClaw 完整安装触发段落（删除 "coming soon" 占位）
2. 新增 Commands 章节（或在 Quick Start 后插入），覆盖 install / update / status
3. 新增 Parameters Reference 章节
4. Claude Code 和 Codex 保留 "coming soon"（范围调整说明见下文）

---

### 范围约束（Sprint Change 2026-04-07）

- README **仅覆盖 HappyCapy + OpenClaw** 安装命令
- Claude Code / Codex 保留 "coming soon" 注记，并说明"支持计划中，待后续 Phase 实现"
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-07.md`]

---

### OpenClaw 平台信息（来自 lib/adapters/openclaw.js）

**OpenClaw 安装路径：** `[cwd]/.openclaw/agents/bmad-expert/`（项目级，非全局）

**OpenClaw 平台特征：**
- 环境变量 `OPENCLAW_SESSION_ID` 存在 → 平台确认（置信度 1.0）
- `[cwd]/.openclaw/` 目录存在 → 高置信（0.9）

**触发方式：** 与 HappyCapy 一致，在 OpenClaw 聊天窗口中粘贴自然语言触发命令即可：
```
Please run npx bmad-expert install to install BMAD Expert
```

**注册机制：** 写入 `[cwd]/.openclaw/agents-registry.json`（无需外部 CLI）

---

### update 命令行为（来自 lib/updater.js）

- 覆盖框架文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）至最新版本
- **永不覆盖**用户数据路径（MEMORY.md、USER.md、memory/）
- 更新前自动备份用户数据至系统临时目录
- 异常时自动从备份恢复，不残留损坏状态
- 成功输出：`已更新至 vX.X.X，用户配置和 memory 完整保留。`
- 支持 `--json` 输出模式

---

### status 命令行为与 --json 输出（来自 lib/checker.js + cli.js）

**人类可读输出（正常 status）：**
```
bmad-expert 安装状态
版本：v1.2.0
安装路径：/home/user/.happycapy/agents/bmad-expert

文件完整性检查：
  ✓ SOUL.md
  ✓ IDENTITY.md
  ✓ AGENTS.md
  ✓ BOOTSTRAP.md

状态：healthy
```

**--json 输出（status --json，成功/healthy）：**
```json
{
  "success": true,
  "status": "healthy",
  "version": "1.2.0",
  "installPath": "/home/user/.happycapy/agents/bmad-expert",
  "files": [
    { "file": "SOUL.md", "exists": true },
    { "file": "IDENTITY.md", "exists": true },
    { "file": "AGENTS.md", "exists": true },
    { "file": "BOOTSTRAP.md", "exists": true }
  ]
}
```

**--json 输出（未安装）：**
```json
{
  "success": false,
  "errorCode": "E001",
  "errorMessage": "安装状态检查：bmad-expert 未安装",
  "fixSteps": ["运行 npx bmad-expert install 完成安装"],
  "retryable": false
}
```

**重要**：`status --json` 的错误路径（未安装/损坏）输出由 cli.js 顶层 catch 统一输出 JSON 错误格式，与 install/update 的错误 JSON 格式一致。

---

### 参数参考（来自 cli.js）

| 参数 | 适用命令 | 默认值 | 说明 |
|------|---------|-------|------|
| `--platform <name>` | install / update / status | 自动检测 | 覆盖平台自动检测，可选值：happycapy / openclaw |
| `--yes` | install | false | 非交互模式，跳过所有确认提示 |
| `--json` | install / update / status | false | 输出结构化 JSON 结果，AI 调用专用 |
| `--modules <modules>` | install | bmm（智能推断） | 覆盖 BMAD 安装模块，如 `bmm` 或 `bmm,bmb` |
| `--tools <tools>` | install | 按平台推断 | 覆盖 BMAD 工具链，如 `claude-code` |
| `--communication-language <lang>` | install | 系统 locale | 覆盖 BMAD 通讯语言 |
| `--output-folder <path>` | install | 按平台推断 | 覆盖 BMAD 输出目录 |
| `--agent-id <id>` | install / update / status | bmad-expert | Agent 标识符（高级用法） |

---

### README 写作规范（来自 Story 5-1 及 FR34）

- 触发步骤 **≤1 步**（用户只需复制粘贴一条消息）
- 所有专业术语首次出现时附带括号内简明说明，例如：
  - `agent`（AI 助手配置）
  - `npx`（Node.js 工具运行器，无需全局安装）
  - `BMAD`（AI 辅助产品开发工作流方法论）
  - `OpenClaw`（一款 AI 编程辅助平台）
- "在哪里输入"和"输入后会发生什么"必须在触发命令下方简要说明
- [Source: `_bmad-output/planning-artifacts/epics.md` Story 5.1 AC]

---

### 现有 README 参考写法（HappyCapy 段落结构，应沿用为 OpenClaw 模板）

```markdown
### HappyCapy

Copy the sentence below and paste it into your HappyCapy chat window. The AI will run the installation automatically.

```
Please run npx bmad-expert install to install BMAD Expert
```

> **Where to paste:** Open any HappyCapy chat (or create a new desktop), paste the sentence above, and send it.
>
> **What happens next:** The AI will execute `npx bmad-expert install` (*npx: a Node.js tool runner — no global installation needed*) on your behalf. Installation takes about 60 seconds. When complete, you'll see BMAD Expert in your agent list and can say *"enter bmad-help"* to get started.
```

OpenClaw 段落应沿用同一格式，替换平台名称和说明细节。

---

### 架构约束（本 Story 无需遵守，纯文档修改）

本 Story 仅修改 `README.md`，不涉及 `lib/`、`test/`、`cli.js`、`package.json` 等代码文件。

---

### 关联 Story 说明

- **Story 9-1（status-json-output）**：仍为 backlog 状态，尚未实现 status --json 完整结构化输出扩展。本 README 文档应基于 **当前已实现的行为**（lib/checker.js + cli.js）描述 status --json 输出格式，已满足 FR50 文档覆盖需求。

---

### Project Structure Notes

- 修改文件：`README.md`（唯一）
- 不涉及任何代码文件修改
- 无需执行 `npm test`（纯文档 Story，但工作流要求编译验证时仍应运行）

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Epic 9 Story 9.2 AC]
- [Source: `_bmad-output/planning-artifacts/architecture.md` CLI 命令树、参数参考]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-07.md` 范围调整]
- [Source: `lib/adapters/openclaw.js` OpenClaw 平台特征与注册机制]
- [Source: `lib/checker.js` status 命令输出格式]
- [Source: `lib/updater.js` update 命令行为]
- [Source: `cli.js` 全部命令参数定义]
- [Source: `README.md` 现有内容（需在此基础上修改）]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 纯文档 Story，唯一修改文件为 `README.md`
- 新增 OpenClaw 安装触发段落（沿用 HappyCapy 格式，含"在哪里输入"/"会发生什么"说明）
- 新增 Commands 章节，覆盖 install / update / status 三个命令，各附 JSON 响应示例
- 新增 Parameters Reference 表格，覆盖全部 7 个 CLI 参数
- 所有专业术语（BMAD、agent、npx、OpenClaw）在首次出现处附带括号内简明说明
- Claude Code / Codex 保留 coming soon 注记（符合 Sprint Change 2026-04-07 范围调整）
- 全部 335 个单元/集成测试通过（零回归）

### File List

- README.md
