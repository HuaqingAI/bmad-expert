---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['outputs/bmad-expert-brainstorm.md']
session_topic: 'BMAD Expert Agent 产品设计 -- 可分发模板的项目结构、安装机制、多工具适配、工作流通用化'
session_goals: '在已有方案基础上发现盲区、挑战假设、系统优化，产出可落地的完整产品设计方案'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'Assumption Reversal', 'SCAMPER Method']
ideas_generated: ['Design #1 平台注册感知', 'Design #2 Agent自带CLI安装器', 'Design #3 双模式安装', 'Design #4 install vs update分离', 'Design #5 扩展模块机制', 'Design #6 AI安装完整契约', 'Design #7 三层文件架构', 'Design #8 砍掉路由表', 'Design #9 两级判断机制(修正版)', 'Design #10 轻量化首次体验', 'Design #11 砍掉USER.md.template']
context_file: 'outputs/bmad-expert-brainstorm.md'
expert_review: completed
---

# Brainstorming Session Results

**Date:** 2026-03-23

## Session Overview

**Topic:** BMAD Expert Agent 产品设计 -- 作为可分发模板，如何设计项目结构、安装机制、多工具适配，以及核心工作流的通用化方案
**Goals:** 在已有头脑风暴初稿基础上，通过多角色视角、假设反转和 SCAMPER 系统扫描，找到盲区和改进点

### Context Guidance

基于已有 brainstorm 文档，当前方案已覆盖：项目定位（可分发模板）、agent/ 独立目录结构、story-dev-workflow 通用化方向、install.sh 安装机制、砍掉 agent.yaml 和 runtime/ 目录。需要进一步深挖的方向包括用户视角盲区、核心假设验证、以及系统性优化。

### Session Setup

**Approach:** AI-Recommended Techniques
**Recommended Techniques:**
- **Role Playing:** 从不同用户画像审视方案，发现未覆盖的场景和需求
- **Assumption Reversal:** 挑战已形成的共识，找到被忽略的替代路径
- **SCAMPER Method:** 对已有方案做 7 维度系统性改进扫描

**AI Rationale:** 方案已有初步框架，需要的不是从零发散，而是换视角找盲区 -> 挑战假设找替代 -> 系统优化现有方案

---

## Technique Execution Results

### Phase 1: Role Playing -- 多角色视角审视

从 3 个角色（BMAD 新手、团队 Tech Lead、AI Agent）审视方案，发现 6 个关键设计点：

**[Design #1]: 平台注册感知**
_概念_: install 不仅是文件复制，还需感知目标平台的 agent 注册机制（如写入 agents.json），或调用平台 CLI 完成注册。
_差异点_: 现有方案完全没考虑"复制文件 ≠ 安装完成"这个事实。

**[Design #2]: Agent 自带 CLI 安装器**
_概念_: `npx bmad-expert install` -- 交互模式引导用户选平台、配置参数；非交互模式供 AI agent 自主调用。项目性质从"文件模板仓库"变为"带 CLI 的 npm 包"。
_差异点_: 安装主动权在 agent 自身，不依赖平台 CLI 是否支持。

**[Design #3]: 双模式安装**
_概念_: 交互式（引导选平台、确认配置）+ CLI 非交互式（`--platform`, `--yes` 等参数），类似 BMAD-METHOD 自身的安装模式。
_差异点_: 同时覆盖人类用户和 AI agent 两种安装场景。

**[Design #4]: CLI 双模式 -- install vs update**
_概念_: `npx bmad-expert install` 全新安装；`npx bmad-expert update` 只更新框架文件，保留运行时状态和用户定制。
_差异点_: 避免更新时丢失用户积累的记忆和个性化配置。

**[Design #5]: 扩展模块机制**
_概念_: 核心 agent 是基础包，定制化内容通过扩展模块追加。对齐 BMAD 的 `--modules` 模式，定制化是"加法"不是"覆盖"。
_差异点_: 不需要 base/custom 分层，跟 BMAD 模块机制对齐。

**[Design #6]: AI 自主安装的完整契约**
_概念_: 非交互模式的机器可读契约：exit code、`--json` 输出、`--help` 自描述、npm 版本锁定、`status` 命令。
_差异点_: 不只是"能跑"，而是给 AI caller 提供完整的可编程接口。

### Phase 2: Assumption Reversal -- 假设反转

挑战了 4 个核心假设：

| 被挑战的假设 | 结论 |
|---|---|
| Agent 文件应该用 Markdown | 成立。但明确了三层文件架构（md/yaml/脚本）各司其职 |
| AGENTS.md 需要详细路由表 | **不需要**。路由是平台 skill 机制（SKILL.md description）的职责。但保留轻量能力概述用于 LLM 快速判断 |
| BOOTSTRAP 需要"认识彼此"对话 | **不需要**。工具型 agent 应开箱即用，不做 companion agent 的社交破冰 |
| 用 bmad-help 做唯一入口 | **太重**。bmad-help 初始化大量上下文，成本高。改为两级判断：轻量概述做第一道筛选 |

**[Design #7]: 三层文件架构**
_概念_: LLM 上下文（md）、状态管理（yaml）、固定逻辑（脚本），各司其职。
_差异点_: 之前只想到 md 文件，作为 npm 包需要明确三层边界。

**[Design #8]: 砍掉 AGENTS.md 中的路由表**
_概念_: 路由是平台职责，agent 只保留一段精简能力概述 + bmad-help 兜底规则。
_差异点_: 大幅简化 AGENTS.md，消除维护负担。

**[Design #9]: 两级判断机制（修正版）**
_概念_: 第一级用 AGENTS.md 精简概述做轻量判断；第二级在确认 BMAD 相关后调用 bmad-help。避免每次都付出 bmad-help 的初始化代价。
_差异点_: 平衡了判断准确性和资源消耗。

**[Design #10]: 轻量化首次体验**
_概念_: 砍掉 BOOTSTRAP 的对话流程，首次运行直接进入工作状态。
_差异点_: 工具型 agent 开箱即用。

### Phase 3: SCAMPER -- 系统性优化

- **Substitute**: USER.md.template 不需要，平台 CLI 自己初始化 -> **[Design #11]**
- **Combine**: SOUL.md 和 IDENTITY.md 不能合并（平台规范要求两个文件都存在）
- **Adapt**: agent/ 目录确认只包含 4 个核心文件（AGENTS.md、SOUL.md、IDENTITY.md、BOOTSTRAP.md）
- **Modify**: AGENTS.md 需大幅改造（砍路由表、砍安装流程、砍下一步建议）
- **Eliminate**: 明确了 6 项砍掉的内容（agent.yaml、runtime/、USER.md.template、路由表、社交破冰、项目特定硬编码）
- **Rearrange**: 最终项目结构确定为 npm 包形式（package.json + bin/ + src/ + agent/ + docs/）

---

## Expert Review Results

### 评审 A: 产品设计视角

**核心结论**: 设计方向正确，但实施细节密度不够。

关键风险：
- CLI 错误处理和回滚机制完全空白
- 更新时用户手动修改可能被覆盖
- 扩展命名空间冲突未定义
- 卸载命令缺失
- 全局 agent 多项目内存隔离问题

**处置**: 这些是技术规范阶段的问题，头脑风暴阶段记录为风险即可。

### 评审 B: BMAD 方法论视角

**核心结论**: bmad-expert 的原始设计存在定位问题 -- 试图成为 BMAD 生态的中央调度器，但 BMAD 自身的 skill 机制和 bmad-help 已覆盖这些功能。

关键质疑：
- 路由表与平台 skill description 机制重复
- "下一步建议"是 bmad-help 的劣化版
- story-dev-workflow 混淆了"方法论引导"和"项目自动化"
- 与 BMAD 内置 agents（pm, dev, architect 等）角色重叠

**处置**: 重新定位 bmad-expert 为 **BMAD 新手教练**（而非中央调度器），并根据评审意见修订方案。

---

## Idea Organization -- 最终方案

评审后的完整设计方案已整理为独立文档，见：

**`outputs/bmad-expert-brainstorm-final.md`**

核心变化：
1. **定位修正**: 从"BMAD 工作流引导者 + 路由器" -> "BMAD 新手教练"
2. **明确边界**: 不做路由、不替代 bmad-help、不替代内置角色、不做自动化 pipeline
3. **story-dev-workflow 移除**: 从 agent 模板移除，原始意图作为 BMAD 模块独立 research
4. **保留核心**: npm 包 + CLI 架构、平台适配、扩展模块、精简后的 agent 文件

---

## Creative Facilitation Narrative

本次会话从一份已有的头脑风暴初稿出发，通过三阶段技术（角色扮演 -> 假设反转 -> SCAMPER）系统性深挖，最终经过两轮专家评审（产品设计 + BMAD 方法论），在定位层面产生了重大修正。

**关键突破时刻：**
- 角色扮演阶段发现"复制文件 ≠ 安装完成"，推动项目从文件模板变为 npm 包
- 假设反转阶段发现路由表与平台 skill 机制重复，大幅简化 AGENTS.md
- BMAD 方法论评审揭示了"中央调度器"定位与 BMAD 模块化哲学的冲突，导致核心定位修正
