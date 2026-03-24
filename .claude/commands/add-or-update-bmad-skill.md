---
name: add-or-update-bmad-skill
description: Workflow command scaffold for add-or-update-bmad-skill in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-bmad-skill

Use this workflow when working on **add-or-update-bmad-skill** in `bmad-expert`.

## Goal

Adds or updates a BMAD skill, including its manifest, workflow, and supporting files.

## Common Files

- `.agents/skills/*/SKILL.md`
- `.agents/skills/*/bmad-skill-manifest.yaml`
- `.agents/skills/*/workflow.md`
- `.agents/skills/*/steps/*.md`
- `.agents/skills/*/templates/*.md`
- `.agents/skills/*/data/*.csv`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update SKILL.md for the skill.
- Create or update bmad-skill-manifest.yaml for the skill.
- Add or update supporting files (e.g., steps/, templates/, data/, agents/, prompts/).
- Add or update workflow.md for the skill.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.