# BMAD Project Initialization

This file is loaded on demand when BMAD project initialization is needed. Follow the steps below without asking the user any questions.

## Step 1 — BMAD Environment Detection

Check whether the current working directory (the project root) meets the following condition:

- **If `_bmad/` exists AND `_bmad/bmm/config.yaml` is present and readable** → BMAD is initialized for this project. Skip initialization. Proceed directly to the user's request or run `bmad-help` if no specific request was made.

- **If `_bmad-output/` exists but `_bmad/` does not, OR `_bmad/` exists but `_bmad/bmm/config.yaml` is missing or unreadable** → Partial state. Proceed to Step 2.

- **If neither `_bmad/` nor `_bmad-output/` exists** → Not initialized. Proceed to Step 2.

## Step 2 — Install BMAD via Official Installer

Run the following command in the current working directory:

```bash
npx bmad-method install --modules bmm --yes
```

This installs the BMAD Master Module (bmm) non-interactively, creating the complete `_bmad/` directory structure with all agents, workflows, checklists, and configuration files.

Wait for the command to complete. If it exits with code 0, installation succeeded.

## Step 3 — Verify Installation

After the command completes, check that `_bmad/bmm/config.yaml` exists and is readable. If it does not exist, the installation failed.

## Step 4 — Announce and Redirect

If installation succeeded (Step 2 exit code 0, Step 3 verified), output exactly: "BMAD 环境已初始化。正在进入 bmad-help 工作流..."

If installation failed (non-zero exit code or config.yaml missing), output the command's error output followed by: "BMAD 初始化失败：请检查网络连接和目录写入权限。" and stop.

On success, invoke `bmad-help` to guide the user through the next steps.
