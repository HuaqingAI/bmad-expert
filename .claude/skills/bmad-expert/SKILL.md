```markdown
# bmad-expert Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the key development patterns, coding conventions, and workflows used in the `bmad-expert` JavaScript repository. You'll learn how to implement features, handle error and infrastructure stories, onboard new agent templates, manage sprint status, and keep branches in sync—all following the project's conventions and automation-friendly workflows.

## Coding Conventions

- **File Naming:**  
  Use `kebab-case` for all file names.  
  _Example:_  
  ```
  lib/error-handler.js
  agent/bmad-project-init.md
  ```

- **Import Style:**  
  Use relative imports for modules within the project.  
  _Example:_  
  ```js
  import { installDependencies } from './installer.js';
  ```

- **Export Style:**  
  Use named exports for all modules.  
  _Example:_  
  ```js
  // lib/installer.js
  export function installDependencies() { ... }
  export function uninstallDependencies() { ... }
  ```

- **Commit Messages:**  
  Use prefixes like `feat`, `chore`, `fix`, `docs`.  
  Keep messages concise (average ~62 characters).  
  _Example:_  
  ```
  feat: add agent onboarding flow with template variable support
  fix: resolve error wrapping in installer
  ```

## Workflows

### Implement Feature with Story Tracking
**Trigger:** When implementing a new feature or story (e.g., install, update, error handling, agent onboarding)  
**Command:** `/implement-feature`

1. Create or update an implementation artifact for the story:  
   ```
   _bmad-output/implementation-artifacts/{story-id}-{story-name}.md
   ```
2. Update the sprint status:  
   ```
   _bmad-output/implementation-artifacts/sprint-status.yaml
   ```
3. Implement or update main logic in source files (e.g., `cli.js`, `lib/*.js`, `agent/*.md`).
4. Add or update corresponding test files:  
   ```
   test/*.test.js
   test/integration/*.test.js
   ```

---

### Merge Main into Story Branch with Conflict Resolution
**Trigger:** When syncing a story branch with main before merging or continuing work  
**Command:** `/sync-main`

1. Merge `origin/main` into your story branch.
2. Resolve conflicts, especially in:
   - `_bmad-output/implementation-artifacts/sprint-status.yaml`
   - Implementation artifact markdown files
3. Update affected files (`cli.js`, `lib/*.js`, `test/*.test.js`, etc.) as needed.

---

### Implement Error Handling or Infrastructure Story
**Trigger:** When adding or enhancing error handling or infrastructure logic  
**Command:** `/implement-error-handling`

1. Create or update an implementation artifact for the error/infrastructure story.
2. Update sprint status.
3. Modify or add logic in:
   - `lib/errors.js`
   - `lib/installer.js`
   - `lib/output.js`
4. Update or add tests:
   - `test/errors.test.js`
   - `test/installer.test.js`
   - `test/output.test.js`

_Example:_
```js
// lib/errors.js
export function wrapError(err, context) {
  return new Error(`[${context}] ${err.message}`);
}
```

---

### Implement Agent Template or Onboarding Flow
**Trigger:** When adding or updating agent onboarding/session logic or template variable replacement  
**Command:** `/implement-agent-onboarding`

1. Create or update an implementation artifact for the agent onboarding/session story.
2. Update sprint status.
3. Modify or add agent template files:
   - `agent/AGENTS.md`
   - `agent/BOOTSTRAP.md`
   - `agent/IDENTITY.md`
   - `agent/SOUL.md`
   - `agent/bmad-project-init.md`
4. Update logic in `lib/installer.js` and/or `package.json` to support new/changed templates.
5. Update or add tests:
   - `test/installer.test.js`
   - `test/integration/happycapy.test.js`

---

### Update Sprint Status and Mark Story Done
**Trigger:** When completing a story and updating sprint tracking  
**Command:** `/mark-story-done`

1. Update the implementation artifact for the completed story (if not already done).
2. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to mark the story as done.

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:**  
  - Unit tests: `test/*.test.js`
  - Integration tests: `test/integration/*.test.js`
- **Example Test:**
  ```js
  // test/installer.test.js
  import { installDependencies } from '../lib/installer.js';
  import { describe, it, expect } from 'vitest';

  describe('installDependencies', () => {
    it('should install packages successfully', async () => {
      const result = await installDependencies(['foo']);
      expect(result).toBe(true);
    });
  });
  ```

## Commands

| Command                     | Purpose                                                        |
|-----------------------------|----------------------------------------------------------------|
| /implement-feature          | Start a new feature/story with traceable docs, code, and tests |
| /sync-main                  | Sync your story branch with main and resolve conflicts         |
| /implement-error-handling   | Add or enhance error/infrastructure logic with tests           |
| /implement-agent-onboarding | Add/update agent onboarding/session logic and templates        |
| /mark-story-done            | Mark a story as completed in sprint tracking                   |
```