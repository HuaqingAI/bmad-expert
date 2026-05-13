---
name: implement-feature-with-story-tracking
description: Workflow command scaffold for implement-feature-with-story-tracking in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /implement-feature-with-story-tracking

Use this workflow when working on **implement-feature-with-story-tracking** in `bmad-expert`.

## Goal

Implements a new feature or story, with traceable documentation, code, and tests.

## Common Files

- `_bmad-output/implementation-artifacts/{story-id}-{story-name}.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `cli.js`
- `lib/*.js`
- `agent/*.md`
- `test/*.test.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update implementation artifact markdown for the story in _bmad-output/implementation-artifacts/{story-id}-{story-name}.md
- Update sprint status in _bmad-output/implementation-artifacts/sprint-status.yaml
- Implement or update main logic in one or more source files (e.g., cli.js, lib/*.js, agent/*.md)
- Add or update corresponding test files (test/*.test.js, test/integration/*.test.js)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.