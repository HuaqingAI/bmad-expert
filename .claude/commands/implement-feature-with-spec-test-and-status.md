---
name: implement-feature-with-spec-test-and-status
description: Workflow command scaffold for implement-feature-with-spec-test-and-status in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /implement-feature-with-spec-test-and-status

Use this workflow when working on **implement-feature-with-spec-test-and-status** in `bmad-expert`.

## Goal

Implements a new feature or error handling improvement, with a linked story spec, code changes, tests, and sprint status update.

## Common Files

- `_bmad-output/implementation-artifacts/{story-id}*.md`
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

- Create or update implementation artifact markdown for the story in _bmad-output/implementation-artifacts/
- Update or create relevant source files (e.g., cli.js, lib/*.js, agent/*.md)
- Add or update corresponding test files (test/*.test.js, test/integration/*.test.js)
- Update _bmad-output/implementation-artifacts/sprint-status.yaml to reflect story progress

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.