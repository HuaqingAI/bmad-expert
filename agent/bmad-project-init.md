# BMAD Project Initialization

This file is loaded on demand when BMAD project initialization is needed. Follow the steps below without asking the user any questions.

## Step 1 — BMAD Environment Detection

Check whether the current working directory (the project root) meets the following conditions:

- **Case A — 完全就绪：** `_bmad/bmm/config.yaml` 存在 AND workspace CLAUDE.md 包含完整 `<!-- bmad-workspace-config -->` … `<!-- /bmad-workspace-config -->` 标记对
  → 跳过初始化。直接执行用户请求或运行 `bmad-help`。

- **Case B — BMAD 已安装，workspace 未配置：** `_bmad/bmm/config.yaml` 存在 BUT workspace CLAUDE.md 不存在、或缺少完整 bmad 标记对
  → 跳过 Step 2/3（无需安装），直接进入 **Step 3.5** 执行 workspace init。

- **Case C — 需要安装：** `_bmad/` 不存在、或 `_bmad/bmm/config.yaml` 缺失/不可读
  → 进入 Step 2 执行完整安装流程。

## Step 2 — Install BMAD via Official Installer

Run the following command in the current working directory:

```bash
npx bmad-method install --modules bmm --yes
```

This installs the BMAD Master Module (bmm) non-interactively, creating the complete `_bmad/` directory structure with all agents, workflows, checklists, and configuration files.

Wait for the command to complete. If it exits with code 0, installation succeeded.

## Step 3 — Verify Installation

After the command completes, check that `_bmad/bmm/config.yaml` exists and is readable. If it does not exist, the installation failed.

## Step 3.5 — Workspace 初始化

`_bmad/bmm/config.yaml` 已存在时（无论经由 Step 2 安装还是 Case B 直接跳入），执行 workspace 初始化：

```bash
npx bmad-expert init --yes
```

- 成功 → 输出 `Workspace BMAD 配置已就绪。`
- 失败 → 输出 `Workspace 配置未完成，可稍后执行 npx bmad-expert init 完成配置。`

无论成功或失败，都继续进入 Step 4。

## Step 4 — Announce and Redirect

- **Case B（仅 init）：** init 成功 → 输出 `Workspace BMAD 配置已补全。` 然后返回调用方（Step 2.5 或用户请求）。init 失败 → 输出错误提示，不阻塞。
- **Case C（install + init）：** install 成功 → 输出 `BMAD 环境已初始化。正在进入 bmad-help 工作流...` → 调用 `bmad-help`。install 失败 → 输出错误 + `BMAD 初始化失败：请检查网络连接和目录写入权限。` → 停止。
