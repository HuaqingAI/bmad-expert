```markdown
# bmad-expert Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you how to contribute to the `bmad-expert` JavaScript codebase, which is organized around modular workflows for implementing features, managing agent templates, extending platform support, maintaining CI/CD pipelines, and tracking sprint progress. You'll learn the project's coding conventions, how to structure your contributions, and how to use suggested commands for common development tasks.

---

## Coding Conventions

**File Naming**
- Use kebab-case for file names.
  - Example: `my-feature.js`, `platform-adapter.js`

**Import Style**
- Use relative imports.
  ```js
  import { myFunc } from './utils/my-func.js';
  ```

**Export Style**
- Use named exports.
  ```js
  // lib/my-feature.js
  export function myFeature() { ... }
  ```

**Commit Messages**
- Prefix with `feat`, `fix`, `chore`, or `docs`.
- Keep messages concise (~60 characters).
  - Example: `feat: add HappyCapy platform adapter`

---

## Workflows

### Story Implementation with Artifact and Test
**Trigger:** When implementing a new story or feature (e.g., error handling, install flow, agent logic)  
**Command:** `/implement-story`

1. Create or update `_bmad-output/implementation-artifacts/{story-id}.md` to document the implementation.
2. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to reflect story progress.
3. Modify or add code files (e.g., `cli.js`, `lib/*.js`, `agent/*.md`) to implement the feature.
4. Update or add corresponding test files (`test/*.test.js`, `test/integration/*.test.js`) to cover the new logic.

**Example:**
```js
// lib/error-handler.js
export function handleError(err) {
  // error handling logic
}
```
```js
// test/error-handler.test.js
import { handleError } from '../lib/error-handler.js';
import { describe, it, expect } from 'vitest';

describe('handleError', () => {
  it('should process errors correctly', () => {
    // test logic
  });
});
```

---

### Agent Template and Installer Extension
**Trigger:** When adding or updating agent onboarding or template logic  
**Command:** `/add-agent-template`

1. Create or update agent template files (e.g., `agent/AGENTS.md`, `agent/BOOTSTRAP.md`, etc.).
2. Update `lib/installer.js` to handle new template logic or files.
3. Update `package.json` to include new files in deployment/config.
4. Update or add tests (`test/installer.test.js`, `test/integration/*.test.js`) to cover new agent template logic.
5. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` and the relevant story artifact.

**Example:**
```js
// lib/installer.js
import { readFileSync } from 'fs';

export function installAgentTemplate(templateName) {
  // logic to install agent template
}
```

---

### Platform or Adapter Module Extension
**Trigger:** When adding support for a new platform or adapter, or extending detection logic  
**Command:** `/add-platform-adapter`

1. Create or update `lib/platform.js` and/or `lib/adapters/{platform}.js`.
2. Update or add `test/platform.test.js` to cover new detection logic.
3. Update `_bmad-output/implementation-artifacts/{story-id}.md` and `sprint-status.yaml`.

**Example:**
```js
// lib/adapters/happycapy.js
export function detectHappyCapy() {
  // platform detection logic
}
```

---

### CI/CD Pipeline Update
**Trigger:** When setting up or modifying CI/CD pipelines for testing and publishing  
**Command:** `/update-ci-cd`

1. Create or update `.github/workflows/ci.yml` and/or `.github/workflows/publish.yml`.
2. Update `README.md` with CI/publish badges or npm registry notes.
3. Update `package.json` with `publishConfig` or related fields.
4. Update `_bmad-output/implementation-artifacts/{story-id}.md` and `sprint-status.yaml`.

**Example:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
```

---

### Sprint Status and Story Artifact Update
**Trigger:** When marking a story as done, in-progress, or reviewed  
**Command:** `/update-sprint-status`

1. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to reflect new status.
2. Optionally update or create `_bmad-output/implementation-artifacts/{story-id}.md` with review or completion notes.

---

## Testing Patterns

- Use [vitest](https://vitest.dev/) for all tests.
- Test files are named with the `.test.js` suffix and placed in `test/` or `test/integration/`.
- Example test file:
  ```js
  // test/my-feature.test.js
  import { myFeature } from '../lib/my-feature.js';
  import { describe, it, expect } from 'vitest';

  describe('myFeature', () => {
    it('should work as expected', () => {
      expect(myFeature()).toBe(true);
    });
  });
  ```

---

## Commands

| Command                | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| /implement-story       | Start or update a feature/story with code, docs, and tests     |
| /add-agent-template    | Add or update agent onboarding/template logic and tests         |
| /add-platform-adapter  | Add or extend platform/adapter modules and related tests       |
| /update-ci-cd          | Update CI/CD workflows, badges, or publish configuration       |
| /update-sprint-status  | Update sprint status and story artifact documentation          |
```
