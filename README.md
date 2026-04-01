# BMAD Expert — HappyCapy Agent

[![npm version](https://img.shields.io/npm/v/bmad-expert)](https://www.npmjs.com/package/bmad-expert)
[![CI](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml)

A [HappyCapy](https://happycapy.ai) agent (*agent: an AI assistant configuration that runs on HappyCapy*) specialized in **BMAD** (*BMAD: an AI-assisted product development workflow methodology*) guidance and execution.

## Quick Start

Install BMAD Expert on **[HappyCapy](https://happycapy.ai)** in one step — no terminal required.

### HappyCapy

Copy the sentence below and paste it into your HappyCapy chat window. The AI will run the installation automatically.

```
Please run npx bmad-expert install to install BMAD Expert
```

> **Where to paste:** Open any HappyCapy chat (or create a new desktop), paste the sentence above, and send it.
>
> **What happens next:** The AI will execute `npx bmad-expert install` (*npx: a Node.js tool runner — no global installation needed*) on your behalf. Installation takes about 60 seconds. When complete, you'll see BMAD Expert in your agent list and can say *"enter bmad-help"* to get started.

### Claude Code *(coming soon)*

### OpenClaw *(coming soon)*

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
