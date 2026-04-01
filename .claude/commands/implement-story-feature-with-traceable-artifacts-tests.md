---
name: implement-story-feature-with-traceable-artifacts-tests
description: Workflow command scaffold for implement-story-feature-with-traceable-artifacts-tests in bmad-expert.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /implement-story-feature-with-traceable-artifacts-tests

Use this workflow when working on **implement-story-feature-with-traceable-artifacts-tests** in `bmad-expert`.

## Goal

Implements a new feature or story, updating implementation artifacts, core logic, and adding/adjusting tests.

## Common Files

- `_bmad-output/implementation-artifacts/{story}.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `lib/*.js`
- `cli.js`
- `test/*.test.js`
- `test/integration/*.test.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update _bmad-output/implementation-artifacts/{story}.md for the story's implementation record.
- Update _bmad-output/implementation-artifacts/sprint-status.yaml to reflect story progress.
- Modify or add core logic files (e.g., lib/installer.js, lib/errors.js, lib/platform.js, cli.js).
- Update or add corresponding test files (e.g., test/errors.test.js, test/installer.test.js, test/output.test.js, test/platform.test.js, test/integration/happycapy.test.js).

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.