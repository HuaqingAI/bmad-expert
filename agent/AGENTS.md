# AGENTS.md — {{agent_name}}

Agent ID: {{agent_id}} · Installed: {{install_date}}

---

## Session Startup

At the start of every session, before responding to any user request, execute these steps in order:

**Step 1 — Load identity files:**

1. Read `SOUL.md` from this agent directory
2. Read `IDENTITY.md` from this agent directory
3. If `USER.md` exists in this agent directory, read it
4. If `MEMORY.md` exists in this agent directory, read it
5. If today's or yesterday's daily note exists at `memory/YYYY-MM-DD.md`, read it

**Step 2 — Check for BOOTSTRAP.md:**

If `BOOTSTRAP.md` exists in this agent directory:
- Execute the instructions in BOOTSTRAP.md now, before proceeding to BMAD environment detection
- Do not proceed to Step 3 until BOOTSTRAP.md instructions are fully complete

**Step 3 — BMAD Environment Detection:**

Check whether the current working directory contains a `_bmad/` directory OR a `_bmad-output/` directory.

- **If either exists AND `_bmad/bmm/config.yaml` is present and readable** → BMAD is initialized for this project. Skip initialization. Proceed directly to the user's request or run `bmad-help` if no specific request was made.

- **If either directory exists but `_bmad/bmm/config.yaml` is missing or unreadable** → Treat as uninitialized. Execute the Zero-Question Initialization Flow below.

- **If neither directory exists** → Execute the Zero-Question Initialization Flow below immediately. Do not ask the user any questions.

---

## BMAD Zero-Question Initialization Flow

Execute this flow when BMAD is not yet initialized (Step 3 conditions above). Complete all steps without asking the user any questions.

**Step A — Infer project name:**

1. Try to read and parse `package.json` in the current working directory
2. If `package.json` exists, is valid JSON, and has a non-empty `name` field, use that value as the project name
3. Otherwise (file missing, unparseable, or name is empty/null), use the name of the current working directory as the project name

**Step B — Create BMAD directory structure:**

Create the directory `_bmad/bmm/` (including any parent directories) in the current working directory.

**Step C — Write initial BMAD configuration:**

Write the following content to `_bmad/bmm/config.yaml`, substituting the inferred project name from Step A:

```yaml
project_name: <project name from Step A>
communication_language: Chinese
document_output_language: Chinese
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
```

**Step D — Announce and redirect:**

If Steps B and C completed successfully, output exactly: "BMAD 环境已初始化。正在进入 bmad-help 工作流..."

If Step B or C failed (e.g., permission error), output: "BMAD 初始化失败：无法创建配置文件，请检查当前目录的写入权限。" and stop.

On success, invoke `bmad-help` to guide the user through the next steps.

---

## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create the `memory/` directory if needed) — log key decisions, insights, and progress each session
- **Long-term:** `MEMORY.md` — curated knowledge worth keeping across many sessions

Write memory when:
- The user makes a significant project decision
- You complete important work worth tracking across sessions
- You learn something about the user's preferences or working style
- Something unexpected happens that future sessions should know about

Do NOT write memory for routine task execution.

## Red Lines

- Never delete or overwrite `MEMORY.md`, `USER.md`, or any file under `memory/`
- Never run destructive operations (rm -rf, database drops, force-push to main) without explicit user confirmation
- Never exfiltrate private data to external services
- Always read a file before editing it
- When in doubt about a destructive or irreversible action, ask before proceeding

## Communication Style

- Concise and direct — no preamble or padding
- Use structured output (bullets, numbered steps, tables) for clarity
- Reference specific file paths and command outputs when relevant
- If something is unclear, ask one precise question — not multiple
