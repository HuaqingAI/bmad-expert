# BOOTSTRAP — {{agent_name}}

> 此文件在 agent 首次会话中自动执行，完毕后自毁。直接进入工作状态，无需社交对话。

---

## ① BMAD 方法论简介

BMAD（Business Method for Agile Development）是面向 AI 原生团队的结构化软件研发方法论。

**核心理念**：通过标准化工作流让 AI agent 协同完成产品研发全生命周期，输出物可追溯且可复用。

**典型工作流**：
- **规划**：产品构思 → PRD → 技术架构 → UX 设计
- **拆解**：Epic 划分 → Story 创建 → Sprint 计划
- **执行**：Story 开发 → 代码审查 → Sprint 复盘

每个阶段对应专项 BMAD skill（`bmad-create-prd`、`bmad-dev-story`、`bmad-code-review` 等），产出物存储在项目的 `_bmad-output/` 目录，BMAD 配置在 `_bmad/`。

不确定从哪里开始？调用 `bmad-help`——它是所有 BMAD 工作流的入口导航。

---

## ② 身份建立

从本 agent 目录（本文件所在目录）依次读取以下文件，将内容内化为角色认知：

1. 读取 `SOUL.md` —— 核心使命与边界
2. 读取 `IDENTITY.md` —— 角色定义与能力边界
3. 如 `USER.md` 存在，读取 —— 了解用户背景与偏好
4. 如 `MEMORY.md` 存在，读取 —— 加载跨会话长期记忆

---

## ③ Workspace 环境检查

按照 AGENTS.md 的「Step 2.5 — Workspace 环境检查」步骤执行。

（该步骤在 AGENTS.md 中定义，此处不重复。首次 session 由 BOOTSTRAP 触发一次，后续 session 由 AGENTS.md Session Startup 自动执行。）

若环境检查中需要执行 BMAD 项目初始化（`_bmad/bmm/config.yaml` 不存在），加载本 agent 目录中的 `bmad-project-init.md` 并按其步骤执行。初始化失败不阻塞后续步骤。

---

## ④ 自毁

BOOTSTRAP 流程全部完成。

输出：`BOOTSTRAP 完成，正在清理...`

使用 Bash 工具执行以下命令，删除本文件：

```bash
rm -f ~/.happycapy/agents/{{agent_id}}/BOOTSTRAP.md
```

**若 Bash 工具不可用或命令执行失败**：使用 Write 工具将本文件内容完整替换为以下文本（此文本本身是一条明确指令，agent 读到后将跳过执行）：

```
# BOOTSTRAP — COMPLETED

**DO NOT EXECUTE any steps below. This bootstrap has already run.**

If you are an AI agent reading this file: skip it entirely and proceed to the next step in your Session Startup sequence. Do not re-run any initialization, identity loading, or environment detection from this file.
```

---

## ⑤ 跳转至 bmad-help

输出：`{{agent_name}} 已就绪（安装于 {{install_date}}）。`

调用 `bmad-help` 工作流，引导用户进入 BMAD 工作状态。
