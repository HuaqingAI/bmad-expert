```markdown
# bmad-expert Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill documents the core development patterns, coding conventions, and collaborative workflows for the `bmad-expert` JavaScript codebase. It covers how to implement features, manage agent templates, update CI/CD pipelines, and maintain sprint status, with clear examples and step-by-step instructions. Whether you're contributing code, updating documentation, or managing project status, this guide will help you follow the established practices for consistency and efficiency.

## Coding Conventions

- **Language:** JavaScript (no framework)
- **File Naming:** Use kebab-case for all file names.
  - Example: `my-feature-file.js`
- **Import Style:** Use relative imports.
  ```js
  import { myFunction } from './lib/my-feature.js';
  ```
- **Export Style:** Use named exports.
  ```js
  // lib/my-feature.js
  export function myFunction() { ... }
  ```
- **Commit Messages:**
  - Prefixes: `feat`, `chore`, `fix`, `docs`
  - Example: `feat: add onboarding flow for new agents`
  - Average length: ~62 characters

## Workflows

### Implement Feature with Spec, Test, and Status
**Trigger:** When adding a new feature or error handling tied to a story  
**Command:** `/implement-feature`

1. Create or update implementation artifact markdown in `_bmad-output/implementation-artifacts/` for the story.
2. Update or create relevant source files (e.g., `cli.js`, `lib/*.js`, `agent/*.md`).
3. Add or update corresponding test files (`test/*.test.js`, `test/integration/*.test.js`).
4. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` to reflect story progress.

**Example:**
```js
// lib/new-feature.js
export function newFeature() { ... }
```
```js
// test/new-feature.test.js
import { newFeature } from '../lib/new-feature.js';
import { describe, it, expect } from 'vitest';

describe('newFeature', () => {
  it('should work as expected', () => {
    expect(newFeature()).toBe(/* expected result */);
  });
});
```

---

### Merge Main into Story Branch and Resolve Status
**Trigger:** When a story branch falls behind `main` and needs updating  
**Command:** `/sync-main`

1. Merge `origin/main` into your story branch.
2. Resolve conflicts, especially in `_bmad-output/implementation-artifacts/sprint-status.yaml`.
3. Update or add implementation artifact markdown as needed.
4. Update or add relevant code and test files.

---

### Agent Template or Session Logic Change
**Trigger:** When adding or changing agent onboarding/session logic or templates  
**Command:** `/update-agent-template`

1. Create or update agent template files (`agent/*.md`).
2. Update supporting logic in `lib/installer.js` and/or `package.json`.
3. Update or create implementation artifact markdown for the story.
4. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`.
5. Add or update tests (`test/installer.test.js`, `test/integration/happycapy.test.js`).

---

### CI/CD Pipeline Update
**Trigger:** When introducing or modifying GitHub Actions CI/CD workflows  
**Command:** `/update-ci-cd`

1. Create or update `.github/workflows/*.yml` files.
2. Update `README.md` with new badges or instructions.
3. Update or add implementation artifact markdown for the pipeline story.
4. Update `package.json` if publishing or workflow triggers change.
5. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`.

---

### Sprint Status Update Only
**Trigger:** When marking a story as done or updating sprint progress without code changes  
**Command:** `/sprint-status`

1. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`.
2. Optionally update or add the implementation artifact markdown for the completed story.

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:** Files end with `.test.js` (e.g., `lib/my-feature.test.js`)
- **Test Example:**
  ```js
  // test/example.test.js
  import { myFunction } from '../lib/my-feature.js';
  import { describe, it, expect } from 'vitest';

  describe('myFunction', () => {
    it('should return true', () => {
      expect(myFunction()).toBe(true);
    });
  });
  ```

## Commands

| Command              | Purpose                                                    |
|----------------------|------------------------------------------------------------|
| /implement-feature   | Add a new feature or error handling with spec and tests     |
| /sync-main           | Merge `main` into a story branch and resolve conflicts      |
| /update-agent-template | Update agent onboarding/session logic or templates         |
| /update-ci-cd        | Add or update CI/CD pipeline files and documentation        |
| /sprint-status       | Update sprint status or mark a story as done                |
```