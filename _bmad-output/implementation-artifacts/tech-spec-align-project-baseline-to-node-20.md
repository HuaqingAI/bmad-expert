---
title: 'Align project baseline to Node 20'
type: 'bugfix'
created: '2026-03-24'
status: 'done'
baseline_commit: '08e3f96931dd49089b35da36c65bc1297a46397a'
context:
  - '_bmad-output/implementation-artifacts/1-1-npm-package-init.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

# Align project baseline to Node 20

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The project claims Node 18 compatibility while locked runtime and test dependencies require Node 20 or newer. This makes package metadata and story acceptance text internally inconsistent.

**Approach:** Raise the documented and declared baseline to Node 20, then update the story and planning artifacts that still promise Node 18 behavior so the repo expresses one consistent support contract.

## Boundaries & Constraints

**Always:** Keep the change scoped to Node-version contract alignment. Update both code metadata and BMAD artifacts that explicitly mention the old baseline. Preserve existing dependency versions.

**Ask First:** Any change that widens scope beyond baseline alignment, including dependency replacement, CI matrix redesign, or changes to unrelated stories/epics.

**Never:** Rework CLI behavior, implement deferred commands, or change package dependency versions as part of this fix.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Metadata alignment | Project metadata and docs mention mixed Node baselines | `package.json` and referenced story/planning docs all state Node 20 baseline consistently | N/A |
| Old baseline references | Repo still contains explicit Node 18 support text in scoped files | Those references are updated or removed so they no longer contradict Node 20 support | Leave unrelated historical references untouched |

</frozen-after-approval>

## Code Map

- `package.json` -- declares public Node engine support contract
- `package-lock.json` -- reflects root package engine metadata
- `_bmad-output/implementation-artifacts/1-1-npm-package-init.md` -- story AC and notes currently state Node 18 baseline
- `_bmad-output/planning-artifacts/epics.md` -- planning artifact still contains Node 18 wording in user-facing error text and CI matrix notes

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- raise `engines.node` to a Node 20 baseline consistent with locked dependencies -- removes false compatibility claim
- [x] `package-lock.json` -- refresh root package engine metadata after the engine change -- keeps lockfile aligned with published package metadata
- [x] `_bmad-output/implementation-artifacts/1-1-npm-package-init.md` -- update acceptance text, examples, and notes that still promise Node 18/Node 18+ -- keeps story contract consistent with implementation
- [x] `_bmad-output/planning-artifacts/epics.md` -- update scoped Node-version wording that contradicts the new baseline -- keeps downstream planning artifacts consistent

**Acceptance Criteria:**
- Given the repo after this change, when a reader checks package metadata and the scoped BMAD artifacts, then they see a consistent Node 20 support baseline instead of mixed Node 18 and Node 20 claims.
- Given the existing locked dependency versions remain unchanged, when the engine contract is reviewed, then it no longer promises support below the strictest relevant runtime/tooling requirement.

## Spec Change Log

## Verification

**Commands:**
- `rg -n "18\\.0\\.0|Node 18|18\\.x|>=18" package.json _bmad-output/implementation-artifacts/1-1-npm-package-init.md _bmad-output/planning-artifacts/epics.md` -- expected: no remaining scoped references that contradict the new Node 20 baseline
- `npm test` -- expected: succeeds under the project-supported Node 20 environment
