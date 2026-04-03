---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
classification:
  projectType: 'cli_tool+developer_tool'
  domain: 'developer-tooling'
  complexity: 'medium'
  projectContext: 'greenfield'
inputDocuments:
  - '_bmad-output/planning-artifacts/research/cli-installer-implementation-guide.md'
  - '_bmad-output/planning-artifacts/research/cli-installer-integration-patterns-research.md'
  - '_bmad-output/planning-artifacts/research/cli-patterns-quick-reference.md'
  - '_bmad-output/planning-artifacts/research/technical-agent-install-and-bmad-extension-research-2026-03-23.md'
  - '_bmad-output/planning-artifacts/research/README.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-23-0930.md'
  - '_bmad-output/implementation-artifacts/bmm-retrospective-2026-04-02.md'
workflowType: 'prd'
workflow: 'edit'
briefCount: 0
researchCount: 5
brainstormingCount: 1
projectDocsCount: 0
lastEdited: '2026-04-02'
editHistory:
  - date: '2026-04-02'
    changes: 'Phase 2 扩展：安装编排重构（委托 bmad-method install）、多平台扩展（OpenClaw/Claude Code/Codex）、自动检测、智能参数构建。新增 FR41-FR50、NFR14-15、Journey 6、Innovation 第5项。路线图重构：Phase 1/1.5 标为已完成，新 Phase 2 合并原 Phase 1.5 + 安装重构 + 自动检测。'
---

# Product Requirements Document - bmad-expert

**Author:** （用户）
**Date:** 2026-03-23

## Executive Summary

bmad-expert 是一个以 npm 包形式分发的 BMAD 智能安装编排器。它面向在 HappyCapy、OpenClaw、Claude Code、Codex 等 AI 平台上使用 BMAD 方法论的用户，解决"想用 BMAD 但不会装、装了不会用"的核心痛点。产品承诺三件事：开箱即用、不出错、高质量产出。

目标用户为非技术背景或不熟悉 CLI 操作的 AI 工具使用者，他们因 OpenClaw 等平台爆火而接触到专业 AI 工作流，但缺乏能力或意愿手动配置复杂工具链。

核心交付物：通过 `npx bmad-expert install` 一条命令完成跨平台 BMAD 安装，通过 `npx bmad-expert update` 安全更新而不丢失用户状态；同时内置新手引导能力，降低 BMAD 方法论的首次使用门槛。bmad-expert 作为 BMAD 官方安装器（`npx bmad-method install`）的智能前端，根据目标平台和项目上下文自动构建最优安装参数，委托官方安装器执行核心安装，确保安装结果始终对齐 BMAD 最新版本。

### What Makes This Special

现有 BMAD 安装流程依赖 terminal 熟练度，与 HappyCapy、OpenClaw 等"零 terminal"使用场景天然不兼容。bmad-expert 的核心洞察是：**安装即产品**——安装过程本身必须是零失败的产品级体验，而非技术操作。

差异化来自四点：
1. **智能安装编排**：不自行复制文件，而是根据平台和项目上下文智能构建参数，委托 `npx bmad-method install` 执行，动态获取 BMAD 最新版本
2. **多平台感知安装**：自动检测目标平台（HappyCapy / OpenClaw / Claude Code / Codex），感知注册机制并完成完整安装契约，无需用户指定 `--platform`
3. **install/update 分离**：保护用户积累的记忆与个性化配置，更新不破坏现有状态
4. **新手教练内核**：不替代 bmad-help，不做路由器，专注降低 BMAD 方法论的认知门槛

## Project Classification

- **项目类型**：CLI 工具 + 开发者工具（npm 包）
- **领域**：AI 开发者工具链
- **复杂度**：中等
- **项目上下文**：绿地项目（Greenfield）

## Success Criteria

### User Success

- **安装速度**：`npx bmad-expert install` 全流程在 60 秒内完成
- **零摩擦启动**：安装完成后，用户一句话即可激活 agent 并进入 BMAD 工作流
- **一句话完整初始化**：切换到 bmad-expert agent 后，一句话完成项目初始化 + BMAD 环境配置 + 进入 bmad-help 开始工作
- **自愈能力**：即便安装出错，输出的错误信息必须是 AI 可读的、包含 fix 步骤的说明，支持 AI 自主修复
- **情感性确认**：安装完成后主动展示引导信息，明确告知用户"现在可以做什么"，将功能完成转化为用户信心

### Business Success

- **内部采用率**：团队 8 人中 6 人在第一个月内主动使用（可根据实际团队规模调整比例）
- **7 天留存**：安装后 7 天内，用户成功完成至少一个完整 BMAD 工作流的比例 ≥ 70%
- **优先平台覆盖**：HappyCapy、OpenClaw、Claude Code、Codex 四个平台均支持且体验一致

### Technical Success

- **安装成功率**：≥ 99%
- **错误可恢复性**：100% 的错误场景提供结构化、AI 可执行的 fix 说明
- **平台感知**：自动识别目标平台并完成对应注册机制
- **平台独立集成测试**：每个支持平台有独立的集成测试覆盖，保证 99% 不是空头数字
- **BOOTSTRAP 零追问标准**：BOOTSTRAP 流程必须能引导用户完成全部初始化步骤，不依赖任何追加问答
- **安装参数智能构建**：系统根据平台和项目上下文自动构建 BMAD 官方安装器参数，安装结果对齐 BMAD 最新版本

### Measurable Outcomes

| 指标 | 目标值 |
|---|---|
| 安装完成时间 | ≤ 60 秒 |
| 安装成功率 | ≥ 99% |
| 首次工作流启动步骤 | 1 句话 |
| 支持平台数（Phase 1 MVP） | 1（HappyCapy） |
| 支持平台数（Phase 2） | +3（OpenClaw、Claude Code、Codex） |
| 7 天工作流完成率 | ≥ 70% |
| 内部团队月度使用率 | ≥ 75%（6/8 人） |

## Product Scope

### MVP - Minimum Viable Product

- `npx bmad-expert install`：平台感知安装，Phase 1 专注 HappyCapy，Phase 2 扩展至 OpenClaw、Claude Code、Codex
- 一句话激活 + 一句话初始化项目 + 进入 bmad-help
- 结构化错误信息（AI 可自主 fix）
- BOOTSTRAP 流程：零追问完成项目 + BMAD 环境初始化
- 安装完成引导确认信息（情感性确认）
- 每平台独立集成测试

### Phase 1.5 Growth（已完成）

- `npx bmad-expert update`：安全更新，保留用户状态与个性化配置
- `status` 命令：检查安装健康度
- `--json` 输出：支持 AI caller 可编程调用

### Phase 2 -- 多平台扩展与安装编排升级

- 安装流程重构：从自行文件复制升级为委托 `npx bmad-method install` 执行，bmad-expert 作为智能编排前端
- 智能参数构建：根据目标平台和项目上下文自动确定 `--modules`、`--tools`、`--communication-language`、`--output-folder` 等参数
- 动态版本获取：安装时动态调用 BMAD 官方安装器最新版本，不再内置固定模板文件
- 多平台自动检测：无需用户指定 `--platform` 参数，自动识别宿主平台
- OpenClaw 平台适配器（优先）
- Claude Code 平台适配器
- Codex（OpenAI）平台适配器
- 每平台独立集成测试 + 跨平台一致性验证
- 回顾清债：README 覆盖全部命令、`status --json` 完整实现、FRAMEWORK_FILES 一致性校验

### Vision（Future）

- 完整的 BMAD 新手教练流程
- 卸载命令与回滚机制
- 全局 agent 多项目内存隔离

## User Journeys

### Journey 0：发现与第一步（Onboarding 路径）

**人物：** 任意新用户，听同事提到 BMAD，想尝试。

**开场：** 用户在团队群里看到"用 bmad-expert 一句话就装好了"，点进 README，看到一句安装命令和简短说明，明确写着"在 HappyCapy/OpenClaw/Claude Code 的对话框里说这句话"。

**过程：** 用户打开自己的 AI 平台，照着说。没有任何需要理解的背景知识。

**结局：** 用户完成了从"听说"到"装好"的完整路径，全程不需要打开文档第二次。

**揭示的能力需求：** 清晰的 README / onboarding 文档、单句触发命令、零背景知识启动。

---

### Journey 1：小林的第一次（HappyCapy 主线成功）

**人物：** 小林，产品经理，HappyCapy 用户，从未用过 terminal。

**开场：** 小林在 HappyCapy 聊天窗口输入一句话启动安装。

**过程：** AI 调用 `npx bmad-expert install`，工具自动检测 HappyCapy 平台，智能构建安装参数后委托 BMAD 官方安装器执行。全程输出实时进度：
```
正在检测平台... HappyCapy ✓
正在分析项目上下文... ✓
正在构建安装参数... modules=bmm, tools=none, language=Chinese ✓
正在执行 BMAD 安装... ✓
正在写入 bmad-expert agent 文件... ✓
正在注册 agent... ✓
安装完成（用时 42 秒）
```
安装完成后，自动展示引导："bmad-expert 已就绪。现在你可以：① 初始化新项目  ② 进入 bmad-help 开始工作。"

**高潮：** 小林说一句"初始化这个项目并进入 BMAD 工作流"，BOOTSTRAP 零追问完成所有步骤，进入 bmad-help。

**结局：** 小林感受到的是"我会用 BMAD 了"，而不是"我装了个工具"。

**揭示的能力需求：** 平台感知安装、智能参数构建、委托 BMAD 官方安装器执行、实时进度输出、HappyCapy 注册机制、BOOTSTRAP 零追问、安装后引导确认。

---

### Journey 2：小林的倒霉日（安装出错，AI 自愈）

**人物：** 同一个小林，这次遇到权限拒绝或网络中断。

**开场：** 安装中途失败——可能是 HappyCapy 沙盒的文件写入权限被拒，可能是模块下载超时。

**过程：** bmad-expert 输出结构化错误：
```
错误：文件写入失败（权限不足）
原因：HappyCapy 沙盒限制写入路径 /xxx
修复步骤：
  1. [具体备选路径命令]
  2. 若仍失败，执行 [fallback 方案]
```
AI 读取信息，自动执行修复步骤，无需小林介入。

**结局：** 安装成功。小林不知道出过错，也不需要知道。

**揭示的能力需求：** 权限错误场景处理、沙盒环境兼容、结构化 AI 可读错误、分步 fix 说明、幂等安装。

---

### Journey 3：重复安装（幂等场景）

**人物：** 小明，不确定自己之前装没装成功，又执行了一次 install。

**过程：** bmad-expert 检测到已有安装，输出："检测到已有安装（版本 v1.0），跳过重复安装，当前状态正常。"

**结局：** 不产生重复文件、冲突配置或损坏状态。

**揭示的能力需求：** 幂等安装、安装状态检测、防重复保护。

---

### Journey 4：晓雯加入团队（OpenClaw，已有项目）

**人物：** 晓雯，设计师，OpenClaw 用户，被团队拉进一个已在用 BMAD 的项目。

**发现触点：** 团队 lead 在群里发了一句触发命令。

**过程：** 晓雯执行命令，bmad-expert 自动检测到 OpenClaw 平台（无需指定 `--platform`），发现项目中已有 BMAD 配置，跳过重复安装，直接引导进入 bmad-help 并加载已有项目上下文。

**结局：** 5 分钟内融入团队工作节奏。

**揭示的能力需求：** 多平台自动检测、环境检测（已有/全新自适应）、OpenClaw 平台支持、已有项目快速接入。

---

### Journey 5：阿明的升级日（Claude Code，update 场景）

**人物：** 阿明，开发者，Claude Code 用户。

**发现触点：** bmad-expert 在初始化时检查版本，提示"发现新版本 v1.2，执行 `npx bmad-expert update` 升级"。

**过程：** 阿明执行 update，工具自动备份 memory 和个性化配置，只更新框架文件。完成后显示："已更新至 v1.2，用户配置和 memory 完整保留。"

**结局：** 新功能到手，积累的上下文一条没丢。

**揭示的能力需求：** 版本检查机制、install/update 分离、用户状态保护。（Growth）

---

### Journey 6：小杰的新平台（Codex，首次安装）

**人物：** 小杰，全栈开发者，使用 OpenAI Codex 平台。

**发现触点：** 在技术社区看到 BMAD 方法论的介绍文章，想在 Codex 中使用。

**过程：** 小杰在 Codex 中触发安装，bmad-expert 自动检测到 Codex 平台，根据 Codex 环境特性构建安装参数（modules=bmm, tools 根据 Codex 环境自动选择），委托 BMAD 官方安装器完成核心安装，随后写入 bmad-expert 补充 agent 文件并完成 Codex 平台注册。

**结局：** 小杰在 Codex 中获得与 HappyCapy 用户一致的 BMAD 体验。

**揭示的能力需求：** Codex 平台适配器、多平台自动检测、智能参数构建、跨平台体验一致性。

---

### Journey Requirements Summary

| 能力 | 来源旅程 | Phase |
|---|---|---|
| 清晰 README / 单句触发 onboarding | Journey 0 | Phase 1 MVP |
| HappyCapy 平台感知安装 | Journey 1 | Phase 1 MVP |
| 实时进度输出（非沉默等待） | Journey 1 | Phase 1 MVP |
| BOOTSTRAP 零追问初始化 | Journey 1 | Phase 1 MVP |
| 安装后情感性确认引导 | Journey 1 | Phase 1 MVP |
| 权限/沙盒错误处理 + 结构化 fix | Journey 2 | Phase 1 MVP |
| 幂等安装 + 防重复保护 | Journey 3 | Phase 1 MVP |
| 环境检测（已有/全新自适应） | Journey 4 | Phase 1 MVP |
| 版本检查机制 | Journey 5 | Phase 1.5 Growth |
| install/update 分离 + 用户状态保护 | Journey 5 | Phase 1.5 Growth |
| 智能参数构建 + 委托 BMAD 官方安装器 | Journey 1, 6 | Phase 2 |
| 多平台自动检测（无需 --platform） | Journey 4, 6 | Phase 2 |
| OpenClaw / Claude Code / Codex 平台适配 | Journey 4, 6 | Phase 2 |
| 跨平台体验一致性 | Journey 6 | Phase 2 |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. 安装即产品（Installation as Product）**
传统工具视安装为前置步骤，用户体验从安装后才开始。bmad-expert 颠覆这一假设：安装过程本身被设计为产品级体验——有进度、有确认、有情感反馈。安装的质量直接等于产品的质量。

**2. 自然语言触发 CLI（Natural Language CLI）**
用户从不直接输入命令行——他们用自然语言描述意图，AI 作为中间执行层调用 CLI。这将"命令行工具的用户"从"会用 terminal 的人"扩展到"会说话的人"，是对 CLI 工具受众边界的根本性突破。

**3. AI 优先的错误设计（AI-First Error Design）**
错误信息的目标读者不是用户，而是负责修复的 AI。错误输出被设计为结构化、机器可读、包含明确 fix 步骤的格式——这是针对 AI-mediated 使用场景的全新错误设计范式，与传统"人类可读错误信息"完全不同。

**4. 无 terminal 平台的 CLI 工具（CLI for No-Terminal Environments）**
专为 HappyCapy、OpenClaw 等没有 terminal 直接访问权限的 AI 平台设计 CLI 工具。这挑战了"CLI 工具需要 terminal 用户"的基本假设。

**5. 智能安装编排（Smart Install Orchestration）**
bmad-expert 不自行执行安装的核心逻辑，而是作为 BMAD 官方安装器的智能前端：感知目标平台、分析项目上下文、动态构建最优安装参数，然后委托 `npx bmad-method install` 执行。这一模式确保安装结果始终对齐 BMAD 最新版本，避免了内置固定模板导致的版本滞后；同时将"理解用户需要什么参数"的智能从用户侧转移到工具侧，实现零配置安装。

### Market Context & Competitive Landscape

- 现有 BMAD 安装方式依赖手动 terminal 操作，与 AI 平台的聊天界面范式不兼容
- AI 平台（HappyCapy、OpenClaw、Codex）用户群体快速扩大，但开发者工具生态尚未适配这一范式
- 没有已知竞品专门解决"AI 平台上的工具安装体验"这一问题
- OpenClaw 等平台的爆发式增长创造了时间窗口：先行者可以定义这一品类的标准

### Validation Approach

- **MVP 验证**：在 HappyCapy 内测试安装全流程，记录成功率和耗时，目标 ≥ 99% 成功率、≤ 60 秒
- **AI 自愈验证**：构造典型错误场景（权限拒绝、网络中断），验证 AI 是否能通过结构化错误输出自主修复
- **自然语言触发验证**：测试不同表述的触发命令是否都能正确激活安装流程

### Risk Mitigation

| 风险 | 缓解策略 |
|---|---|
| 各平台 AI 对 CLI 输出的解析能力差异 | 建立平台特定的输出格式测试用例 |
| 自然语言触发命令不够稳定 | 提供标准触发语句，README 明确推荐用语 |
| AI 自愈误判错误类型 | 结构化错误码 + 错误分类，降低 AI 误解概率 |
| 安装路径在沙盒环境中受限 | 预研各平台沙盒权限边界，提供经过验证的安装路径 |

## CLI 工具 & 开发者工具 — 技术需求

### Project-Type Overview

bmad-expert 是一个 npm 包形式的 CLI 工具，专为 AI 平台中介执行场景设计。命令入口通过 `npx` 调用，无需全局安装。用户（AI）通过自然语言触发，底层执行标准 CLI 命令。

### 命令结构

| 命令 | Phase | 说明 |
|---|---|---|
| `npx bmad-expert install` | Phase 1 MVP | 平台感知完整安装 |
| `npx bmad-expert update` | Phase 1.5 Growth | 安全更新，保护用户状态 |
| `npx bmad-expert status` | Phase 1.5 Growth | 检查安装健康度 |
| `--platform <name>` | Phase 1 MVP | 指定目标平台（覆盖自动检测） |
| `--yes` | Phase 1 MVP | 非交互模式，跳过确认提示 |
| `--json` | Phase 1.5 Growth | 结构化 JSON 输出供 AI caller 使用 |
| `--modules <modules>` | Phase 2 | 透传至 BMAD 官方安装器的模块选择参数（默认智能推断） |
| `--tools <tools>` | Phase 2 | 透传至 BMAD 官方安装器的工具/IDE 参数（默认根据平台自动选择） |
| `--communication-language <lang>` | Phase 2 | 透传至 BMAD 官方安装器的交互语言参数（默认智能推断） |
| `--output-folder <path>` | Phase 2 | 透传至 BMAD 官方安装器的产出目录参数（默认智能推断） |
| `--user-name <name>` | Phase 2 | 透传至 BMAD 官方安装器的用户名参数（默认使用平台用户标识） |
| `--action <type>` | Phase 2 | 透传至 BMAD 官方安装器的执行模式（install/update/quick-update，默认根据命令自动确定） |

### 输出格式

- **标准输出（MVP）**：人类可读 + AI 可解析的混合格式，含实时进度、完成确认、错误结构
- **JSON 输出（Growth）**：`--json` flag 启用，返回机器可读的结构化结果，含 exit code、状态码、错误分类

### 配置机制

- **平台自动检测**：运行时检测宿主环境（HappyCapy / OpenClaw / Claude Code / Codex），无需用户指定
- **`--platform` 覆盖**：用户或 AI 可显式指定平台，绕过自动检测
- **智能参数推断**：根据目标平台和项目上下文（已有 BMAD 配置、项目语言偏好等）自动构建 BMAD 官方安装器参数
- **参数透传与覆盖**：用户可通过 `--modules`、`--tools` 等参数显式覆盖智能推断结果
- **无持久化配置文件**：安装行为由运行时参数驱动，不依赖 config file 维护状态

### 运行时环境

- **运行时**：Node.js（建议 18+，尽量兼容低版本，具体版本在实现阶段确定）
- **包管理器**：npm（通过 `npx` 零安装执行）
- **发布渠道**：npm 公开注册表（MVP）；GitHub Packages 保留用于内部分发场景（Growth）

### 安装方法

- 主要方式：`npx bmad-expert install`（零全局安装，最低摩擦）
- 支持平台：HappyCapy（Phase 1 MVP）；OpenClaw、Claude Code、Codex（Phase 2）

### 脚本化支持

- `--yes` flag：非交互模式，AI caller 可无确认执行
- 确定性 exit code：0 = 成功，非 0 = 失败（含错误分类码）
- 幂等性：重复执行安全，不破坏已有状态

### Implementation Considerations

- MVP 使用 npm 公开注册表分发，需提前注册 `bmad-expert` 包名并确认可用性
- npx 执行依赖 Node.js 环境存在于 AI 平台执行上下文中——需验证 HappyCapy / OpenClaw 的 Node.js 可用性
- BOOTSTRAP 零追问要求 agent 文件预填充所有初始化所需信息，不依赖运行时用户输入

## 项目范围规划 & 分阶段开发路线图

### MVP 策略与理念

**MVP 类型：** 体验型 MVP（Experience MVP）

**判断标准：** 一句话触发 → 60 秒内完成 → 无报错或 AI 自愈 → 一句话进入 bmad-help。用户感受到"装好了、能用了"即为成功。

**发布渠道调整（党模式修订）：** MVP 阶段改用 **npm 公开注册表**（而非 GitHub Packages），消除认证 token 这一零摩擦安装的致命障碍。GitHub Packages 保留用于 Growth 阶段的内部分发场景。

**资源配置：** 1 名开发者 + 1 个平台测试环境（Phase 1 先聚焦 HappyCapy）

---

### Phase 1 -- MVP（HappyCapy 专注版）✅ 已完成

**核心用户旅程覆盖：** Journey 0（发现与第一步）、Journey 1（HappyCapy 主线成功）、Journey 2（AI 自愈）、Journey 3（幂等安装）

**交付顺序（按依赖关系排列）：**

1. 清晰 README + 单句触发命令文档（onboarding 入口，优先交付）
2. `npx bmad-expert install` 核心安装逻辑（HappyCapy 平台感知，npm 公开注册表）
3. 实时进度输出 + 安装后情感性确认引导
4. 结构化 AI 可读错误 + 分步 fix 说明（权限/沙盒/网络错误场景）
5. 幂等安装 + 防重复保护 + 环境检测（已有/全新自适应）
6. BOOTSTRAP 零追问内容制作
7. `--platform` 参数 + `--yes` 非交互模式
8. HappyCapy 平台独立集成测试

---

### Phase 1.5 -- Growth ✅ 已完成

- `npx bmad-expert update`：安全更新 + 用户状态保护（Journey 5 覆盖）
- 版本检查机制（启动时提示新版本）
- `npx bmad-expert status`：安装健康度检查
- `--json` 输出：AI caller 可编程调用

---

### Phase 2 -- 多平台扩展与安装编排升级

**核心用户旅程覆盖：** Journey 1（更新：智能编排体验）、Journey 4（晓雯 / OpenClaw + 自动检测）、Journey 6（小杰 / Codex 首次安装）

**交付内容（按依赖关系排列）：**

**安装编排重构（基础，先于平台扩展）：**

1. 安装流程重构：从自行文件复制升级为委托 `npx bmad-method install` 执行
2. 智能参数构建引擎：根据目标平台和项目上下文自动确定 `--modules`、`--tools`、`--communication-language`、`--output-folder` 等参数
3. 动态版本获取：安装时调用 BMAD 官方安装器最新版本，移除内置固定模板文件
4. bmad-expert 补充 agent 文件（SOUL.md、IDENTITY.md 等）在 BMAD 官方安装完成后作为补充层写入
5. 参数透传与覆盖机制：用户可通过 CLI 参数显式覆盖智能推断结果

**多平台扩展（依赖安装重构完成）：**

6. 多平台自动检测机制（无需用户指定 `--platform` 参数）
7. OpenClaw 平台适配器（感知机制 + 注册契约）-- 优先
8. Claude Code 平台适配器
9. Codex（OpenAI）平台适配器
10. 每平台独立集成测试 + 跨平台一致性验证

**回顾清债（穿插完成）：**

11. README 更新：覆盖 `install`/`update`/`status`/`--json` 全部命令
12. `status --json` 完整结构化输出实现
13. FRAMEWORK_FILES 单一数据源或 CI 一致性校验

---

### Phase 3 -- Vision

- 完整的 BMAD 新手教练流程
- 卸载命令与回滚机制
- 全局 agent 多项目内存隔离

---

### 风险缓解矩阵

| 风险 | 严重度 | 缓解策略 |
|---|---|---|
| HappyCapy 沙盒权限边界未知 | 高（已验证） | MVP 已验证 HappyCapy 沙盒写入权限 |
| npm 公开注册表名称抢占 | 中（已解决） | 包名 `bmad-expert` 已注册 |
| npx 执行 Node.js 不可用 | 高（已验证） | HappyCapy 环境 Node.js 可用性已确认 |
| BMAD 官方安装器版本兼容性 | 高 | Phase 2 安装重构需验证 `npx bmad-method install` 各版本参数兼容性，建立版本约束范围 |
| Codex 平台环境约束未知 | 中 | Phase 2 开发前预研 Codex 执行环境的文件系统权限、Node.js 版本、agent 注册机制 |
| OpenClaw 平台注册机制未知 | 中 | Phase 2 开发前预研 OpenClaw 的 agent 注册 API 或文件系统约定 |
| 平台接口更新导致适配失效 | 中 | 每平台独立集成测试 + 监控平台更新公告 |
| 4 平台并行测试资源不足 | 中 | Phase 2 按优先级串行开发（OpenClaw → Claude Code → Codex），降低并行压力 |
| 智能参数推断与用户预期不符 | 低 | 提供参数透传覆盖机制，用户可显式指定任何参数 |

## Functional Requirements

### 安装执行

- FR1: AI 可通过调用 `npx bmad-expert install` 触发完整 BMAD 安装流程
- FR2: 系统可在 60 秒内完成完整安装流程
- FR3: 安装过程向执行上下文实时输出逐步进度状态
- FR4: 系统可在目标平台完成 agent 文件的写入与注册
- FR5: 用户无需全局安装包即可通过 npx 执行安装命令

### 平台感知与注册

- FR6: 系统可自动识别当前宿主平台（HappyCapy / OpenClaw / Claude Code / Codex）
- FR7: 用户（AI）可通过 `--platform` 参数显式指定目标平台覆盖自动检测
- FR8: 系统可感知目标平台的文件写入权限边界并选择有效安装路径
- FR9: 系统可识别目标平台的 agent 注册机制并完成对应注册契约

### 幂等性与环境检测

- FR10: 系统可在安装前检测目标环境是否已存在 BMAD 安装
- FR11: 重复执行安装命令不产生重复文件、冲突配置或状态损坏
- FR12: 系统可检测目标项目中是否已有 BMAD 配置文件
- FR13: 在已有 BMAD 配置的项目中，系统可跳过重复安装并引导用户接入已有上下文

### 错误处理与 AI 自愈

- FR14: 安装失败时系统输出包含错误原因的结构化信息
- FR15: 错误信息包含 AI 可直接执行的分步修复指令
- FR16: 错误信息包含错误分类码，使 AI 能区分不同错误类型
- FR17: 系统对沙盒权限拒绝场景提供经过验证的备选安装路径方案
- FR18: 系统对网络中断场景提供重试或 fallback 安装方案
- FR19: 安装支持幂等执行，出错后重新运行不产生副作用

### 安装后引导

- FR20: 安装完成后系统向执行环境输出情感性确认信息
- FR21: 安装完成后系统明确列出用户当前可执行的操作选项
- FR22: 安装完成后系统提供进入 bmad-help 工作流的明确引导路径

### BOOTSTRAP 与持久会话初始化

- FR23: bmad-expert 安装时向 agent 持久配置文件（AGENTS.md / CLAUDE.md）写入 BMAD 会话启动检测逻辑
- FR24: agent 每次会话启动时自动执行 BMAD 环境检测，已初始化则跳过，未初始化则引导完成配置
- FR25: BMAD 环境检测与初始化流程无需向用户追问，用户一句话触发即可完成全部初始化
- FR26: 初始化完成后用户直接进入 bmad-help 工作流，无需额外操作
- FR27: bmad-expert 安装时同时创建一次性 BOOTSTRAP 文件，用于首次 agent onboarding（解释 BMAD、建立 agent 身份），完成后自毁；BOOTSTRAP 内容不包含社交破冰对话流程——工具型 agent 首次运行直接进入工作状态

### CLI 接口与可发现性

- FR28: 系统提供 `install` 子命令执行完整平台感知安装
- FR29: 系统支持 `--platform <name>` 参数覆盖平台自动检测
- FR30: 系统支持 `--yes` 参数启用非交互模式，跳过所有确认提示
- FR31: 安装命令返回确定性 exit code（0 = 成功，非 0 = 失败含分类码）
- FR32: 用户可在 AI 平台聊天界面通过自然语言触发安装，无需直接操作 terminal
- FR33: README 包含适用于各支持平台的单句触发命令示例
- FR34: README 可被无 BMAD 背景的首次用户独立完成安装触发，无需查阅额外文档；衡量标准：触发操作步骤不超过 1 步，所有专业术语首次出现时附带简明说明

### 版本与状态管理（Growth Phase）

- FR35: 系统可检测当前安装版本并在有新版本时向用户提示
- FR36: 系统提供 `update` 命令执行安全版本升级
- FR37: `update` 执行过程中自动备份用户 memory 与个性化配置
- FR38: `update` 完成后用户配置与 memory 完整保留，不丢失任何个性化状态
- FR39: 系统提供 `status` 命令检查当前安装健康度
- FR40: 系统支持 `--json` 参数以结构化 JSON 格式输出执行结果供 AI 调用方解析

### 安装编排与智能参数构建（Phase 2）

- FR41: 系统通过调用 `npx bmad-method install` 委托 BMAD 官方安装器执行核心安装流程，而非自行复制模板文件
- FR42: 系统根据目标平台自动确定 `--tools` 参数值（如 HappyCapy 不传 tools，Claude Code 传 `claude-code`）
- FR43: 系统根据项目上下文（已有 BMAD 配置文件、用户语言偏好、项目目录结构）智能构建 `--modules`、`--communication-language`、`--document-output-language`、`--output-folder` 参数
- FR44: 系统在安装时动态获取 BMAD 官方安装器最新版本执行，不内置固定版本的 BMAD 模板文件
- FR45: bmad-expert 自身的 agent 补充文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）在 BMAD 官方安装完成后作为补充层写入目标目录
- FR46: 用户可通过 `--modules`、`--tools`、`--communication-language`、`--output-folder` 参数显式覆盖系统的智能推断结果

### 多平台自动检测（Phase 2）

- FR47: 系统在无 `--platform` 参数时通过环境变量、文件系统特征等信号自动检测当前宿主平台，检测失败时提示用户手动指定
- FR48: 系统支持 Codex（OpenAI）平台的环境检测、agent 文件写入路径确定与平台注册契约完成

### 回顾清债（Phase 2）

- FR49: `status --json` 输出完整的结构化安装状态数据，包含健康度（healthy/not_installed/corrupted）、逐文件完整性检查结果、当前安装版本信息
- FR50: README 覆盖 `install`、`update`、`status`、`--json` 全部命令的使用说明，`--json` 模式以 AI 调用场景为主要说明角度

## Non-Functional Requirements

### 性能

- NFR1: `npx bmad-expert install` 完整流程在 60 秒内完成（正常网络环境）
- NFR2: 安装过程每个主要步骤完成时在 2 秒内输出进度状态，不出现无响应的沉默等待
- NFR3: 安装状态检测（幂等判断）在 3 秒内完成，不阻塞主流程

### 兼容性

- NFR4: 支持 Node.js 18+ 作为推荐版本；尽量兼容 Node.js 16+，具体下限在实现阶段测试确认
- NFR5: 在 HappyCapy、OpenClaw、Claude Code、Codex 四个平台的 Node.js 执行环境下，安装可成功完成（agent 文件写入 + 注册契约完成 + exit code 0），无运行时报错
- NFR6: 包通过 npm 公开注册表分发，无需用户配置额外认证 token 即可执行 npx
- NFR7: 安装产生的文件操作在所有支持平台上成功执行，不因路径格式差异产生文件写入错误

### 可靠性

- NFR8: 安装成功率目标 ≥ 99%（在支持平台的正常执行环境下）；通过每平台独立集成测试验证：每平台执行 ≥ 100 次安装测试，成功次数 / 总次数 ≥ 99%
- NFR9: 100% 的失败场景输出结构化错误信息，不出现无信息的静默失败
- NFR10: 重复执行安装命令（幂等场景）不引入副作用，系统状态保持一致
- NFR11: 安装中断后重新执行可恢复至正确状态，不残留损坏的中间状态文件

### 安全

- NFR12: 写入目标平台文件系统时，仅写入预定义的合法路径范围，不越界写入系统级目录
- NFR13: 发布包所有直接依赖和间接依赖版本固定，无浮动版本范围（如 `^`、`~`），供应链依赖可通过锁定文件完整还原

### 安装编排性能（Phase 2）

- NFR14: 安装编排调用 `npx bmad-method install` 的完整流程（含参数构建 + 官方安装器执行 + bmad-expert 补充文件写入）在 60 秒内完成（正常网络环境），不因委托调用引入显著延迟
- NFR15: 多平台自动检测在 1 秒内完成，不阻塞安装主流程；检测结果在安装进度中明确展示
