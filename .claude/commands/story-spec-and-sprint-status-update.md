---
name: story-spec-and-sprint-status-update
description: Workflow command scaffold for story-spec-and-sprint-status-update in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /story-spec-and-sprint-status-update

Use this workflow when working on **story-spec-and-sprint-status-update** in `bmad-expert`.

## Goal

Adds or updates a story specification and synchronizes sprint status metadata.

## Common Files

- `_bmad-output/implementation-artifacts/*-story-*.md`
- `_bmad-output/implementation-artifacts/*-output-*.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update a story spec markdown file (e.g., 1-2-*.md, 1-3-*.md) in implementation-artifacts.
- Update sprint-status.yaml to reflect current status.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.