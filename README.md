# BMAD Expert — HappyCapy Agent

[![npm version](https://img.shields.io/npm/v/bmad-expert)](https://www.npmjs.com/package/bmad-expert)
[![CI](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml)

A [HappyCapy](https://happycapy.ai) agent specialized in **BMAD-METHOD** workflow guidance and execution.

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

## npm 包发布说明

> **重要：** 发布前需确认 `bmad-expert` 包名在 npm 公开注册表中可用。
> 执行 `npm view bmad-expert` 检查，若已被占用请提前选定备用包名并更新 `package.json`、`bin` 字段及文档中所有引用。

## Installation

1. Make sure you have [HappyCapy](https://happycapy.ai) set up.
2. Clone this repository into your HappyCapy agents directory:

```bash
git clone https://github.com/HuaqingAI/bmad-expert ~/.happycapy/agents/bmad-expert
```

3. The agent will appear in your HappyCapy agent list. Select **BMAD Expert** when creating a new desktop.

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
