---
name: story-implementation-with-artifact-and-test
description: Workflow command scaffold for story-implementation-with-artifact-and-test in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /story-implementation-with-artifact-and-test

Use this workflow when working on **story-implementation-with-artifact-and-test** in `bmad-expert`.

## Goal

Implements a new story/feature, updating implementation artifact, code, and tests.

## Common Files

- `_bmad-output/implementation-artifacts/{story-id}.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `lib/*.js`
- `cli.js`
- `agent/*.md`
- `test/*.test.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update _bmad-output/implementation-artifacts/{story-id}.md to document the implementation.
- Update _bmad-output/implementation-artifacts/sprint-status.yaml to reflect story progress.
- Modify or add code files (e.g., cli.js, lib/*.js, agent/*.md) to implement the feature.
- Update or add corresponding test files (test/*.test.js, test/integration/*.test.js) to cover the new logic.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.