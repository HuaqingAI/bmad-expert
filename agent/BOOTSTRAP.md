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

## ③ BMAD 环境检测

检查**当前工作目录（cwd）**是否已有 BMAD 环境：

**情况 A — `_bmad/bmm/config.yaml` 存在且可读：**

→ 输出：`检测到 BMAD 环境已就绪，跳过初始化。`
→ 进入步骤 ④

**情况 B — 上述文件不存在（全新项目，或仅有 `_bmad-output/` 的旧项目）：**

→ 加载本 agent 目录中的 `bmad-project-init.md` 并按其全部步骤执行
→ 若初始化**成功**（`_bmad/bmm/config.yaml` 现在存在）：进入步骤 ④
→ 若初始化**失败**（命令非零退出或 config.yaml 仍不存在）：输出 `BMAD 初始化失败，BOOTSTRAP 中止。请检查网络和目录写入权限后重新启动会话。` 然后 **HALT**，不执行步骤 ④（保留本文件，允许下次重试）

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
