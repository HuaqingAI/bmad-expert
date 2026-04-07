# Sprint Change Proposal -- 2026-04-07

**状态：已批准并执行**

## 1. 问题摘要

**触发 Stories：** Story 8-3（Claude Code 适配器）、Story 8-4（Codex 适配器）

**问题类型：** 技术限制（开发验证发现架构不兼容）

**问题陈述：**
Claude Code 和 Codex 平台不原生支持本项目的 agent 注册架构（`adapter.detect()` + `adapter.install()` + 文件写入路径 + 注册契约模型）。这两个平台通常依赖 skills + 项目配置文件（CLAUDE.md / AGENTS.md）或 plugins 机制实现 agent 集成，与当前适配器接口设计不兼容，且最优实现方案尚未确定。

**发现时机：** Epic 8 开发阶段，Story 8-1 实现过程中完成的调研验证。

## 2. 影响分析

### Epic 影响

| Epic | 影响 |
|------|------|
| **Epic 8** | 核心受影响：Story 8-3、8-4 取消；Story 8-5 范围缩减；标题和描述更新 |
| Epic 9 | Story 9-2 README 范围微调（不覆盖 Claude Code/Codex 安装命令） |
| Epic 7 | 无影响（已完成，param-builder 中 claude-code tools 参数逻辑保留） |
| Epic 1-6 | 无影响（均已完成） |

### Story 影响

| Story | 变化 |
|-------|------|
| 8-3 claude-code-adapter | 取消，延期 |
| 8-4 codex-adapter | 取消，延期 |
| 8-5 cross-platform-validation | 范围缩减：覆盖 2 平台（HappyCapy + OpenClaw），非 4 平台 |
| 9-2 readme-full-coverage | 范围微调：Phase 2 README 仅覆盖 HappyCapy + OpenClaw 安装命令 |

### 制品影响

| 制品 | 影响 |
|------|------|
| PRD Phase 2 路线图 | Claude Code、Codex 适配器移出 Phase 2，注为延期 |
| PRD FR47 | 范围收窄：Phase 2 仅实现 OpenClaw 自动检测 |
| PRD FR48 | 整体延期 |
| PRD NFR5 | 支持平台数：Phase 2 为 2 个（HappyCapy + OpenClaw） |
| Epics.md Epic 8 | 标题、描述、FR 覆盖更新 |
| sprint-status.yaml | 移除 8-3、8-4 条目 |

## 3. 推荐方案

**选择：直接调整（Direct Adjustment）**

**理由：**
1. 变更范围清晰，仅涉及文档和状态文件，无代码改动
2. Epic 8 实际交付范围减少，加速完成
3. param-builder 中现有的 claude-code 参数逻辑保留，未来重新设计时成本更低
4. 将延期信息结构化记录，防止遗忘

## 4. 已执行变更

1. **epics.md** -- Epic 8 标题/描述/FR覆盖更新；Story 8-3、8-4 标为取消（含延期原因）；Story 8-5 验收标准缩减为 2 平台；Story 9-2 范围注释；探针链描述更新
2. **prd.md** -- Phase 2 路线图移除 Claude Code/Codex 适配器并添加延期记录；FR47/FR48/NFR5 更新；Measurable Outcomes 调整；风险矩阵更新；编辑历史记录
3. **sprint-status.yaml** -- 移除 8-3、8-4 条目；Epic 8 标题更新；添加变更注释
