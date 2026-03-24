---
name: bmad-expert-conventions
description: Development conventions and patterns for bmad-expert. JavaScript project with conventional commits.
---

# Bmad Expert Conventions

> Generated from [HuaqingAI/bmad-expert](https://github.com/HuaqingAI/bmad-expert) on 2026-03-24

## Overview

This skill teaches Claude the development patterns and conventions used in bmad-expert.

## Tech Stack

- **Primary Language**: JavaScript
- **Architecture**: hybrid module organization
- **Test Location**: separate
- **Test Framework**: vitest

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 19 analyzed commits.

### Commit Style: Conventional Commits

### Prefixes Used

- `chore`
- `feat`
- `docs`
- `chroe`
- `fix`

### Message Guidelines

- Average message length: ~52 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
chore: update sprint status and add Epic 2 story specs (2-1, 2-2)
```

*Commit message example*

```text
feat(story-1.4): add GitHub Actions CI/CD pipelines
```

*Commit message example*

```text
docs(architecture): align BmadError exit code example
```

*Commit message example*

```text
chroe: 添加bmad的各工具支持
```

*Commit message example*

```text
fix: align project baseline to node 20
```

*Commit message example*

```text
chore(story-1.4): create story spec and update sprint status
```

*Commit message example*

```text
Merge pull request #4 from HuaqingAI/story/1-2-exit-codes-and-errors
```

*Commit message example*

```text
Merge pull request #1 from HuaqingAI/story/1-3-output-module
```

## Architecture

### Project Structure: Single Package

This project uses **hybrid** module organization.

### Configuration Files

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`
- `.prettierrc`
- `eslint.config.js`
- `package.json`

### Guidelines

- This project uses a hybrid organization
- Follow existing patterns when adding new code

## Code Style

### Language: JavaScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | kebab-case |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Relative Imports

### Export Style: Mixed Style


*Preferred import style*

```typescript
// Use relative imports
import { Button } from '../components/Button'
import { useAuth } from './hooks/useAuth'
```

## Testing

### Test Framework: vitest

### File Pattern: `*.test.js`

### Test Types

- **Unit tests**: Test individual functions and components in isolation
- **Integration tests**: Test interactions between multiple components/services

### Coverage

This project has coverage reporting configured. Aim for 80%+ coverage.


*Test file structure*

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFunction', () => {
  it('should return expected result', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

## Common Workflows

These workflows were detected from analyzing commit patterns.

### Feature Development

Standard feature implementation workflow

**Frequency**: ~17 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Files typically involved**:
- `.claude/skills/bmad-create-ux-design/steps/*`
- `.agents/skills/bmad-create-ux-design/steps/*`
- `**/*.test.*`
- `**/api/**`

**Example commit sequence**:
```
feat: initial BMAD Expert agent files
docs: add epics and stories breakdown for bmad-expert
chore: add BMAD skills, planning artifacts, and research outputs
```

### Add Or Update Bmad Skill

Adds or updates a BMAD skill, including its manifest, workflow, and supporting files.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update SKILL.md for the skill.
2. Create or update bmad-skill-manifest.yaml for the skill.
3. Add or update supporting files (e.g., steps/, templates/, data/, agents/, prompts/).
4. Add or update workflow.md for the skill.

**Files typically involved**:
- `.agents/skills/*/SKILL.md`
- `.agents/skills/*/bmad-skill-manifest.yaml`
- `.agents/skills/*/workflow.md`
- `.agents/skills/*/steps/*.md`
- `.agents/skills/*/templates/*.md`
- `.agents/skills/*/data/*.csv`
- `.agents/skills/*/agents/*.md`
- `.agents/skills/*/prompts/*.md`

**Example commit sequence**:
```
Create or update SKILL.md for the skill.
Create or update bmad-skill-manifest.yaml for the skill.
Add or update supporting files (e.g., steps/, templates/, data/, agents/, prompts/).
Add or update workflow.md for the skill.
```

### Story Spec And Sprint Status Update

Adds or updates a story specification and synchronizes sprint status metadata.

**Frequency**: ~4 times per month

**Steps**:
1. Create or update a story spec markdown file (e.g., 1-2-*.md, 1-3-*.md) in implementation-artifacts.
2. Update sprint-status.yaml to reflect current status.

**Files typically involved**:
- `_bmad-output/implementation-artifacts/*-story-*.md`
- `_bmad-output/implementation-artifacts/*-output-*.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Example commit sequence**:
```
Create or update a story spec markdown file (e.g., 1-2-*.md, 1-3-*.md) in implementation-artifacts.
Update sprint-status.yaml to reflect current status.
```

### Feature Implementation With Tests

Implements a new feature or module, accompanied by unit/integration tests.

**Frequency**: ~2 times per month

**Steps**:
1. Implement new module or feature in lib/ or cli.js.
2. Add or update corresponding test files in test/.
3. Integrate feature into CLI or main workflow.

**Files typically involved**:
- `lib/*.js`
- `cli.js`
- `test/*.test.js`

**Example commit sequence**:
```
Implement new module or feature in lib/ or cli.js.
Add or update corresponding test files in test/.
Integrate feature into CLI or main workflow.
```

### Ci Cd Pipeline Setup Or Update

Adds or updates CI/CD pipeline configuration and related project metadata.

**Frequency**: ~1 times per month

**Steps**:
1. Create or update .github/workflows/*.yml for CI/CD.
2. Update package.json with publishConfig or related fields.
3. Update README.md with badges or publishing info.

**Files typically involved**:
- `.github/workflows/*.yml`
- `package.json`
- `README.md`

**Example commit sequence**:
```
Create or update .github/workflows/*.yml for CI/CD.
Update package.json with publishConfig or related fields.
Update README.md with badges or publishing info.
```

### Add Or Update Bmad Planning Artifacts

Adds or updates planning artifacts such as epics, stories, and research documents.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update planning artifact markdown files (epics, architecture, etc.).
2. Add or update research documents in planning-artifacts/research/.

**Files typically involved**:
- `_bmad-output/planning-artifacts/*.md`
- `_bmad-output/planning-artifacts/research/*.md`

**Example commit sequence**:
```
Create or update planning artifact markdown files (epics, architecture, etc.).
Add or update research documents in planning-artifacts/research/.
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Use conventional commit format (feat:, fix:, etc.)
- Write tests using vitest
- Follow *.test.js naming pattern
- Use kebab-case for file names
- Prefer mixed exports

### Don't

- Don't write vague commit messages
- Don't skip tests for new features
- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*
