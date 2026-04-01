```markdown
# bmad-expert Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns, coding conventions, and workflow automation used in the `bmad-expert` JavaScript codebase. The repository is focused on modular CLI tooling, agent templates, robust error handling, and traceable implementation artifacts. It emphasizes traceability, test coverage, and structured workflow for features, CI/CD, and sprint tracking.

## Coding Conventions

- **File Naming:**  
  Use `kebab-case` for all file names.  
  _Example:_  
  ```
  lib/installer.js
  test/errors.test.js
  ```

- **Import Style:**  
  Use **relative imports** for internal modules.  
  _Example:_  
  ```js
  import { installAgent } from './installer.js';
  ```

- **Export Style:**  
  Use **named exports** for all modules.  
  _Example:_  
  ```js
  // lib/errors.js
  export function BmadError(message) { ... }
  export const ERROR_CODES = { ... };
  ```

- **Commit Messages:**  
  Use prefixes: `feat`, `chore`, `fix`, `docs`.  
  _Example:_  
  ```
  feat: add agent template variable replacement logic
  fix: correct error output for missing agent config
  ```

## Workflows

### Implement Story Feature with Traceable Artifacts & Tests
**Trigger:** When implementing a new story or feature (e.g., error handling, install flow, agent logic)  
**Command:** `/implement-story-feature`

1. Create or update `_bmad-output/implementation-artifacts/{story}.md` to record the implementation details.
2. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to reflect the story's progress.
3. Modify or add core logic files (e.g., `lib/installer.js`, `lib/errors.js`, `lib/platform.js`, `cli.js`).
4. Update or add corresponding test files (e.g., `test/errors.test.js`, `test/installer.test.js`, `test/output.test.js`, `test/platform.test.js`, `test/integration/happycapy.test.js`).

_Example:_
```js
// lib/installer.js
export function installAgent(config) {
  // implementation
}
```
```yaml
# _bmad-output/implementation-artifacts/sprint-status.yaml
- story: agent-install
  status: in-progress
```

---

### Agent Template and Boilerplate Expansion
**Trigger:** When adding new agent templates or updating template handling logic  
**Command:** `/add-agent-template`

1. Create or update agent template files (e.g., `agent/AGENTS.md`, `agent/BOOTSTRAP.md`, `agent/IDENTITY.md`, `agent/SOUL.md`, `agent/bmad-project-init.md`).
2. Update `lib/installer.js` to handle new templates or template variable replacement.
3. Update or add tests in `test/installer.test.js` or `test/integration/happycapy.test.js` to cover template logic.

_Example:_
```js
// lib/installer.js
export function applyTemplate(template, variables) {
  // Replace variables in template
}
```

---

### CI/CD Pipeline Update
**Trigger:** When setting up or modifying CI/CD pipelines  
**Command:** `/update-ci-cd`

1. Create or update `.github/workflows/ci.yml` and `.github/workflows/publish.yml`.
2. Update `package.json` or `README.md` with CI/CD-related info.
3. Document changes in `_bmad-output/implementation-artifacts/{story}.md` and `sprint-status.yaml`.

_Example:_
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
```

---

### Sprint Status and Story Spec Tracking
**Trigger:** When marking a story as done, in-progress, or reviewed, or adding new story specs  
**Command:** `/update-sprint-status`

1. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` with new status.
2. Add or update `_bmad-output/implementation-artifacts/{story}.md` for story spec or review.
3. Optionally, update planning artifacts (e.g., `_bmad-output/planning-artifacts/epics.md`).

_Example:_
```yaml
# _bmad-output/implementation-artifacts/sprint-status.yaml
- story: error-handling
  status: done
```

---

### Error Handling Module Expansion
**Trigger:** When adding new error types, exit codes, or error output logic  
**Command:** `/add-error-handling`

1. Update or create `lib/errors.js` and/or `lib/exit-codes.js` with new error logic.
2. Update `cli.js` and/or `lib/output.js` to integrate new error handling.
3. Add or update tests in `test/errors.test.js`, `test/output.test.js`, or `test/exit-codes.test.js`.
4. Document changes in `_bmad-output/implementation-artifacts/{story}.md` and `sprint-status.yaml`.

_Example:_
```js
// lib/errors.js
export class AgentConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.code = 'AGENT_CONFIG_ERROR';
  }
}
```

## Testing Patterns

- **Framework:** [vitest](https://vitest.dev/)
- **Test File Pattern:** All test files are named with the `.test.js` suffix and use kebab-case.
  _Example:_  
  ```
  test/errors.test.js
  test/installer.test.js
  test/integration/happycapy.test.js
  ```
- **Test Example:**
  ```js
  // test/errors.test.js
  import { AgentConfigError } from '../lib/errors.js';
  import { describe, it, expect } from 'vitest';

  describe('AgentConfigError', () => {
    it('should set the correct error code', () => {
      const err = new AgentConfigError('Missing config');
      expect(err.code).toBe('AGENT_CONFIG_ERROR');
    });
  });
  ```

## Commands

| Command                 | Purpose                                                        |
|-------------------------|----------------------------------------------------------------|
| /implement-story-feature| Implement a new feature/story with traceable artifacts & tests |
| /add-agent-template     | Add or update agent templates and template logic               |
| /update-ci-cd           | Add or update CI/CD pipeline files and metadata               |
| /update-sprint-status   | Update sprint status and story specification artifacts         |
| /add-error-handling     | Implement or extend error handling modules and tests           |
```
