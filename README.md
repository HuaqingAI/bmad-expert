# BMAD Expert — HappyCapy & OpenClaw Agent

[![npm version](https://img.shields.io/npm/v/bmad-expert)](https://www.npmjs.com/package/bmad-expert)
[![CI](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml)

A [HappyCapy](https://happycapy.ai) and [OpenClaw](https://openclaw.ai) agent (*agent: an AI assistant configuration that runs on an AI platform*) specialized in **BMAD** (*BMAD: an AI-assisted product development workflow methodology*) guidance and execution.

## Quick Start

Install BMAD Expert in one step — no terminal required.

### HappyCapy

Copy the sentence below and paste it into your HappyCapy chat window. The AI will run the installation automatically.

```
Please run npx bmad-expert install to install BMAD Expert
```

> **Where to paste:** Open any HappyCapy chat (or create a new desktop), paste the sentence above, and send it.
>
> **What happens next:** The AI will execute `npx bmad-expert install` (*npx: a Node.js tool runner — no global installation needed*) on your behalf. Installation takes about 60 seconds. When complete, you'll see BMAD Expert in your agent list and can say *"enter bmad-help"* to get started.

### OpenClaw

Copy the sentence below and paste it into your OpenClaw (*OpenClaw: an AI-assisted coding platform*) chat panel. The AI will run the installation automatically in your project directory.

```
Please run npx bmad-expert install to install BMAD Expert
```

> **Where to paste:** Open any OpenClaw chat session in your project, paste the sentence above, and send it.
>
> **What happens next:** The AI will execute `npx bmad-expert install` on your behalf. The agent files will be installed in `.openclaw/agents/bmad-expert/` inside your project directory. Installation takes about 60 seconds. When complete, say *"enter bmad-help"* to get started.

### Claude Code *(coming soon)*

### Codex *(coming soon)*

---

## Commands

### install

Install BMAD Expert on the current platform.

```bash
npx bmad-expert install
```

**Common options:**

```bash
# Specify platform explicitly (skip auto-detection)
npx bmad-expert install --platform happycapy

# Non-interactive mode (skip all confirmation prompts)
npx bmad-expert install --yes

# Output structured JSON for AI callers
npx bmad-expert install --json
```

**JSON success response:**

```json
{
  "success": true,
  "platform": "happycapy",
  "agentId": "bmad-expert",
  "installPath": "/home/user/.happycapy/agents/bmad-expert",
  "duration": 38
}
```

> `duration` is in seconds.

**JSON failure response:**

```json
{
  "success": false,
  "errorCode": "E004",
  "errorMessage": "文件写入失败（权限不足）",
  "fixSteps": ["检查目标目录权限", "授权后重试"],
  "retryable": true
}
```

---

### update

Safely upgrade BMAD Expert framework files while preserving all your data.

```bash
npx bmad-expert update
```

**What gets updated:** Framework files (`SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `BOOTSTRAP.md`) are replaced with the latest version.

**What is never touched:** Your personal data — `MEMORY.md`, `USER.md`, and the `memory/` directory — is always preserved, regardless of the update outcome. A backup is created automatically before any changes are made; if the update fails, your data is restored from backup.

```bash
# Output structured JSON for AI callers
npx bmad-expert update --json
```

**JSON success response:**

```json
{
  "success": true,
  "version": "1.3.0",
  "message": "已更新至 v1.3.0，用户配置和 memory 完整保留。"
}
```

---

### status

Check the health of the current BMAD Expert installation.

```bash
npx bmad-expert status
```

**Human-readable output:**

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

#### AI Caller Mode: `status --json`

For programmatic use — returns a machine-readable JSON object on stdout with no other output.

```bash
npx bmad-expert status --json
```

**JSON response — healthy installation:**

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

**JSON response — not installed:**

```json
{
  "success": false,
  "errorCode": "E001",
  "errorMessage": "安装状态检查：bmad-expert 未安装",
  "fixSteps": ["运行 npx bmad-expert install 完成安装"],
  "retryable": false
}
```

**JSON response — corrupted (partial installation):**

```json
{
  "success": false,
  "errorCode": "E001",
  "errorMessage": "安装状态检查：bmad-expert 安装损坏（缺失 BOOTSTRAP.md）",
  "fixSteps": ["运行 npx bmad-expert install 重新安装"],
  "retryable": false
}
```

**Exit codes:** `0` = healthy, `1` = not installed or corrupted.

---

## Parameters Reference

| Parameter | Commands | Default | Description |
|-----------|----------|---------|-------------|
| `--platform <name>` | install / update / status | auto-detect | Override platform auto-detection. Values: `happycapy`, `openclaw` |
| `--yes` | install | false | Non-interactive mode — skip all confirmation prompts |
| `--json` | install / update / status | false | Output structured JSON to stdout. Designed for AI callers; all output (including errors) is JSON on stdout, stderr is empty |
| `--modules <modules>` | install | `bmm` (inferred) | Override BMAD module selection, e.g. `bmm` or `bmm,bmb` |
| `--tools <tools>` | install | inferred by platform | Override BMAD toolchain, e.g. `claude-code` |
| `--communication-language <lang>` | install | system locale | Override BMAD communication language |
| `--output-folder <path>` | install | inferred by platform | Override BMAD output directory |
| `--agent-id <id>` | install / update / status | `bmad-expert` | Agent identifier (advanced use) |

**Parameter priority for `install`:** explicit CLI flag > auto-inferred from context > built-in default.

---

## What is BMAD Expert?

BMAD Expert is a workflow coach that helps you leverage the [BMAD-METHOD](https://bmad-method.org) across the full product lifecycle — from ideation and planning to development and delivery.

It assumes you've already decided to use BMAD. Its job is to help you use it well.

## Capabilities

| Category | Examples |
|----------|---------|
| Planning | Product brief, PRD, Epics & Stories, Brainstorming |
| Architecture & Design | Technical architecture, UX design, Quick spec |
| Development | Dev story, Quick dev |
| Review | Code review, Adversarial review, Implementation readiness |
| QA | E2E test generation |
| Research | Domain, market, and technical research |
| Project Management | Sprint planning, Sprint status, Retrospectives |
| Documentation | Project context, Index docs |

## File Structure

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and values |
| `IDENTITY.md` | Role definition and working style |
| `AGENTS.md` | Operational manual — routing rules, BMAD environment setup |
| `BOOTSTRAP.md` | First-run initialization guide |
| `USER.md` | User preferences (populated at runtime) |
| `MEMORY.md` | Long-term memory (populated at runtime) |
| `story-dev-workflow.md` | Detailed story development workflow from creation to merge |

## BMAD Environment Setup

BMAD Expert will automatically detect whether BMAD is installed in your repository and guide you through installation if needed. It uses the [BMAD non-interactive CLI](https://docs.bmad-method.org/how-to/non-interactive-installation/):

```bash
npx bmad-method install --directory /path/to/repo --modules bmm --tools claude-code \
  --user-name "Your Name" --communication-language "Chinese" \
  --document-output-language "Chinese" --yes
```

## Workflow Overview

```
Product Brief → PRD → Architecture/UX → Epics & Stories → Sprint Planning → Dev → Review & QA
```

BMAD Expert guides you through each step and suggests the next logical action after every task.

## License

MIT
