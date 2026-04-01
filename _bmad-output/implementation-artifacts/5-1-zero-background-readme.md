# Story 5-1：面向零 BMAD 背景用户的 README

## 元数据

- **Story ID:** 5-1
- **Epic:** Epic 5 — Onboarding 文档与平台可发现性
- **Status:** ready-for-dev
- **分支:** story/5-1-zero-background-readme
- **WORKTREE_MODE:** true
- **BACKEND_ROOT_ABS:** /home/node/a0/workspace/dcc96039-7b2f-4692-b690-4265c469169d/workspace/worktrees/story/5-1-zero-background-readme

---

## 用户故事

**As a** 新用户（无 BMAD 使用经验）,
**I want** README 提供针对各支持平台的单句触发命令，配以简明说明，
**So that** 我不需要查阅任何其他文档，打开 README 后一步完成安装触发，所有专业术语均有就地解释。

---

## 验收标准（BDD）

**Given** 用户打开 README.md
**When** 阅读 "快速开始" 章节
**Then:**
- 包含针对 HappyCapy 平台的单句触发命令（可直接粘贴到聊天界面的自然语言句子）（FR33）
- 触发命令下方有简短的平台说明（该命令在哪里输入、输入后会发生什么）
- 首次出现的专业术语（BMAD、agent、npx）均附带不超过 1 句话的简明说明（FR34）
- 从打开 README 到完成安装触发，用户需要执行的步骤不超过 1 步（FR34）

**Given** README 中的触发命令
**When** 被无 BMAD 背景的首次用户按步骤操作
**Then** 该用户无需打开第二份文档，无需理解 BMAD 方法论背景，即可完成安装触发

**Given** README 已包含 HappyCapy 触发命令
**When** Phase 1.5 扩展 OpenClaw 和 Claude Code 支持后
**Then** README 结构支持追加新平台的触发命令示例，无需重构现有内容

---

## 实现范围

### 交付物

**唯一交付物：重写 `README.md`**（项目根目录，即 `$BACKEND_ROOT/README.md`）

不需要修改任何 `.js` 代码文件、测试文件或配置文件。

### 当前 README 问题分析

当前 `README.md` 存在以下问题：
1. 安装方式为 `git clone`，需要技术背景
2. 无"快速开始"章节，用户找不到第一步操作
3. 无对 BMAD、agent、npx 的就地术语解释
4. 以功能列表开篇，缺乏对新用户的引导感
5. 有一个奇怪的 npm 发布说明放在中间，与用户无关

---

## 技术实现指引

### README.md 重写规范

#### 整体结构要求

README 必须按以下顺序组织：

```
1. 标题 + 一句话介绍
2. 【核心】快速开始（Quick Start）—— 放在最顶部，用户第一眼看到
3. 这是什么（What is BMAD Expert）
4. 能做什么（Capabilities）
5. 文件结构说明（File Structure）
6. BMAD 环境配置（BMAD Environment Setup）
7. 工作流概览
8. License
```

#### 快速开始章节规范

这是最关键的章节，必须满足：

1. **章节标题**：`## 快速开始` 或 `## Quick Start`（建议用英文，与 GitHub/npm 惯例一致）

2. **触发命令（HappyCapy 平台）**：
   - 必须是**可直接粘贴到 HappyCapy 聊天界面的自然语言句子**（不是 shell 命令）
   - FR32 明确：用户通过自然语言触发，AI 代劳执行 `npx bmad-expert install`
   - 示例格式（可调整措辞，核心是自然语言）：
     ```
     帮我用 npx bmad-expert install 安装 BMAD Expert
     ```
   - 或英文版：
     ```
     Please run npx bmad-expert install to install BMAD Expert
     ```

3. **平台说明**（触发命令正下方）：
   - 说明在哪里输入：在 HappyCapy 的聊天框中粘贴上面的句子
   - 说明会发生什么：AI 会自动执行安装命令，约 60 秒完成

4. **术语就地解释**（首次出现时，括号内或脚注形式）：
   - `BMAD`：一套 AI 辅助的产品开发工作流方法论
   - `agent`：HappyCapy 上运行的 AI 助手配置
   - `npx`：Node.js 的命令行工具执行器，无需安装即可运行 npm 包

5. **平台扩展结构**：使用如下格式，便于未来添加 OpenClaw、Claude Code 等平台：

```markdown
### HappyCapy

> HappyCapy（[happycapy.ai](https://happycapy.ai)）是一个 AI 平台，上面运行的 AI 助手称为 **agent**。

在 HappyCapy 聊天框中粘贴以下句子，AI 会自动完成安装：

```
帮我用 npx bmad-expert install 安装 BMAD Expert
```

安装完成后，你将在 agent 列表中看到 **BMAD Expert**。

### Claude Code（即将支持）

### OpenClaw（即将支持）
```

6. **关于 npm 发布说明**：
   - 现有 README 中有一段 "npm 包发布说明" 写给开发者看的内容（提醒检查包名可用性）
   - **删除**这段内容：它是开发时的临时提醒，不应出现在面向用户的 README 中

#### 术语使用规范

| 术语 | 首次出现方式示例 |
|------|-------------|
| BMAD | `BMAD（一套 AI 辅助的产品开发工作流方法论）` |
| agent | `agent（HappyCapy 上运行的 AI 助手配置）` |
| npx | 在触发命令说明旁加一行：`*npx 是 Node.js 工具执行器，无需全局安装。*` |

### 关键限制

- **不要更改 badge 区域**（npm version、CI 徽章）——保留在顶部
- **不要修改任何代码文件**，本 story 只改 `README.md`
- **不要创建新文件**
- **保留现有的 `## Capabilities` 表格**（该内容对用户有价值）
- **保留 `## File Structure` 表格**
- **保留 `## BMAD Environment Setup` 章节**（含 BMAD 安装命令说明）
- **保留 `## Workflow Overview` 章节**

---

## 项目上下文

### 产品定位

`bmad-expert` 是一个 npm 包（通过 `npx bmad-expert install` 执行），在 AI 平台上安装 BMAD 工作流 agent。

### 目标平台（当前 MVP）

- **HappyCapy**：主要平台（FR1-FR13 均针对此平台）
  - 安装路径：`~/.happycapy/agents/bmad-expert/`
  - 注册方式：调用 `happycapy-cli add`
  - 触发方式：用户在聊天框说自然语言，AI 代劳执行 `npx bmad-expert install`

### 已实现功能（截至本 Story）

- Epic 1（项目脚手架）：完成
- Epic 2（HappyCapy 安装流程）：完成
  - 包括：平台检测、agent 文件写入、幂等检测、进度输出、安装完成确认
  - 安装成功后输出：`bmad-expert 已就绪。现在你可以：① 说"初始化这个项目"开始使用 ② 说"进入 bmad-help"了解工作流`
- Epic 3（错误处理）：Story 3-1 完成（权限拒绝错误）
- Epic 4（BOOTSTRAP 初始化）：Story 4-1 完成

### 安装完成后用户体验

安装后，用户在 HappyCapy 聊天框中可以：
- 说 "初始化这个项目" 开始使用 BMAD Expert
- 说 "进入 bmad-help" 了解所有工作流

---

## 实现检查清单

以下是实现完成的判断标准：

- [x] `README.md` 顶部（badge 之后）有 `## Quick Start` 或 `## 快速开始` 章节
- [x] 快速开始章节中有 HappyCapy 平台小节，包含可粘贴的自然语言触发句子
- [x] HappyCapy 小节下有说明：在哪里输入、输入后会发生什么
- [x] `BMAD`、`agent`、`npx` 三个术语在首次出现时均有就地解释（1 句话以内）
- [x] 从快速开始到完成触发：用户操作步骤 ≤ 1 步（粘贴并发送）
- [x] 快速开始章节结构支持追加新平台（如 Claude Code、OpenClaw）
- [x] 已删除原 README 中 "npm 包发布说明" 的开发者临时提醒内容
- [x] 保留 badge 区域、Capabilities 表格、File Structure、BMAD Environment Setup、Workflow Overview、License

---

## 注意事项

**这是文档 Story，不涉及代码实现**：

- 只改 `README.md`，其他文件不动
- 不需要运行编译或单元测试（但工作流中配置了编译验证和单元测试，可运行确认 README 改动不影响现有测试通过）
- 核心判断标准：一个无 BMAD 背景的新用户，打开 README，能在 1 步内完成安装触发

---

## Dev Agent Record

### Implementation Notes

- 重写 `README.md`，在 badge 区域之后立即添加 `## Quick Start` 章节
- 三个术语就地解释位置：`agent` 和 `BMAD` 在第一段 intro 句内（括号形式），`npx` 在 Quick Start blockquote 说明内
- HappyCapy 触发命令采用英文自然语言句（与 README 整体语言风格一致）：`Please run npx bmad-expert install to install BMAD Expert`
- 预留 Claude Code 和 OpenClaw 作为 coming soon 子章节，结构直接可追加
- 删除了开发者内部提醒章节 `## npm 包发布说明`，同时替换了 `## Installation`（git clone 方式）为 `## Quick Start`（自然语言 AI 触发方式）
- 所有原有章节（Capabilities、File Structure、BMAD Environment Setup、Workflow Overview、License）完整保留

### File List

- `README.md` — 重写，添加 Quick Start 章节，删除 npm 发布说明，替换 Installation 为 AI 触发安装方式

### Change Log

- 2026-03-31: 重写 README.md，添加面向零 BMAD 背景用户的 Quick Start 章节（Story 5-1）

## 完成状态

- **Status:** review
- **Notes:** 综合上下文分析完成，README.md 已重写，所有验收标准满足
