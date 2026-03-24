# Story 1.4: GitHub Actions CI/CD 流水线

Status: ready-for-dev

## Story

As a 开发者（AI agent）,
I want GitHub Actions 配置 CI（测试）和 CD（发布）两条流水线,
so that 每次推送到 main 自动验证代码质量，每次打版本 tag 自动发布至 npm 公开注册表，无需手动操作。

## Acceptance Criteria

1. **Given** `.github/workflows/ci.yml` 已配置
   **When** 有代码 push 至 main 分支
   **Then** 流水线触发，使用 `npm ci` 安装依赖，运行 `npm test`，Node.js 版本使用 20.19.x 和 22.x 矩阵
   **And** 测试失败时流水线标记为 failed，阻止合并

2. **Given** `.github/workflows/publish.yml` 已配置
   **When** 推送匹配 `v*.*.*` 格式的 git tag
   **Then** 流水线触发，使用 `npm ci` + `npm publish`，发布至 npm 公开注册表（无认证 token 障碍）
   **And** 匹配 `v*.*.*-*`（prerelease）格式的 tag 执行 `npm publish --tag next`

3. **Given** `README.md` 已创建
   **When** 查看 README
   **Then** 包含包名注册说明（提示需提前确认 `bmad-expert` 包名可用性）和 npm 发布徽章占位

## Tasks / Subtasks

- [ ] 创建 `.github/workflows/ci.yml` (AC: #1)
  - [ ] 触发条件：`push` 到 `main` 分支，`pull_request` 目标为 `main`
  - [ ] Node.js 矩阵：`[20.19.x, 22.x]`
  - [ ] 安装步骤：`npm ci`（不用 `npm install`）
  - [ ] 测试步骤：`npm test`
  - [ ] 失败时自动标记流水线为 failed

- [ ] 创建 `.github/workflows/publish.yml` (AC: #2)
  - [ ] 触发条件：`push` 到匹配 `v*.*.*` 的 tags
  - [ ] 安装步骤：`npm ci`
  - [ ] 发布步骤：判断是否为 prerelease tag（含 `-`）
    - 正式版（无 `-`）：`npm publish`
    - 预发版（含 `-`）：`npm publish --tag next`
  - [ ] 配置 `NODE_AUTH_TOKEN` secret 用于 npm 认证
  - [ ] 配置 npm registry URL：`https://registry.npmjs.org/`

- [ ] 更新 `README.md` (AC: #3)
  - [ ] 在文件顶部添加 npm publish 徽章占位（使用 `bmad-expert` 包名）
  - [ ] 添加包名注册说明区块，提示需提前确认 `bmad-expert` 包名可用性

- [ ] 在 `package.json` 中添加 `publishConfig`（如不存在）
  - [ ] 确认 `"publishConfig": { "registry": "https://registry.npmjs.org/", "access": "public" }` 存在

## Dev Notes

### CI 流水线完整实现（`.github/workflows/ci.yml`）

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test (Node.js ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.19.x, 22.x]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

### CD 发布流水线完整实现（`.github/workflows/publish.yml`）

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  publish:
    name: Publish
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          registry-url: 'https://registry.npmjs.org/'

      - name: Install dependencies
        run: npm ci

      - name: Publish (stable)
        if: ${{ !contains(github.ref_name, '-') }}
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish (prerelease)
        if: ${{ contains(github.ref_name, '-') }}
        run: npm publish --tag next
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### package.json 发布配置

`package.json` 中需确认或添加：

```json
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

> 检查当前 `package.json` 是否已有 `publishConfig`；若无则添加。当前 package.json 已有 `"bmadExpert"` 字段，添加 `publishConfig` 在 `bmadExpert` 前面。

### README.md 需新增内容

在 `README.md` 顶部 `# BMAD Expert — HappyCapy Agent` 标题下方（`## What is BMAD Expert?` 前面）插入以下徽章区块：

```markdown
[![npm version](https://img.shields.io/npm/v/bmad-expert)](https://www.npmjs.com/package/bmad-expert)
[![CI](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/HuaqingAI/bmad-expert/actions/workflows/ci.yml)
```

在 `## Installation` 章节前新增包名注册说明：

```markdown
## npm 包发布说明

> **重要：** 发布前需确认 `bmad-expert` 包名在 npm 公开注册表中可用。
> 执行 `npm view bmad-expert` 检查，若已被占用请提前选定备用包名并更新 `package.json`、`bin` 字段及文档中所有引用。
```

### 关键技术说明

**`npm ci` vs `npm install`：**
- CI 流水线中必须使用 `npm ci`，它依赖 `package-lock.json` 完全复现依赖树（NFR13 要求：依赖版本锁定）
- `npm install` 会在特定条件下更新 lock 文件，导致构建不可复现

**Node.js 版本矩阵说明：**
- `20.19.x`：架构要求的最低兼容版本（`package.json engines: ">=20.19.0"`）
- `22.x`：推荐使用的 LTS 版本（当时最新稳定 LTS）
- 矩阵确保两个版本均能通过测试，满足 NFR5

**prerelease tag 判断逻辑：**
- `v1.0.0` → 无 `-` → 正式版 → `npm publish`
- `v1.0.0-beta.1` → 含 `-` → 预发版 → `npm publish --tag next`
- GitHub Actions 中通过 `github.ref_name` 获取 tag 名（不含 `refs/tags/` 前缀）

**NPM_TOKEN secret 配置：**
- 在 GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret
- Name: `NPM_TOKEN`，Value: npm publish 授权 token
- 这是操作层面说明（非代码），在 Completion Notes 中记录

**`actions/checkout@v4` 和 `actions/setup-node@v4`：**
- 使用 v4 版本（当前稳定版），避免使用 `@latest` 以保持确定性
- `setup-node` 的 `cache: 'npm'` 参数启用依赖缓存，加速流水线

### 当前项目状态（关键背景）

- `.github/workflows/` 目录：已存在（Story 1.1 创建），但内容为空，直接创建 `ci.yml` 和 `publish.yml` 两个文件
- `README.md`：已存在（Story 1.1 创建），内容见下方；需插入徽章和包名注册说明，不要替换整个文件
- `package.json`：已存在，版本 `0.1.0`，无 `publishConfig` 字段，需添加

**当前 README.md 结构（Story 1.1 已存在）：**
```
# BMAD Expert — HappyCapy Agent
## What is BMAD Expert?
## Capabilities
## Installation
## File Structure
## BMAD Environment Setup
## Workflow Overview
## License
```

### 来自 Story 1.1 的关键经验

- **ESLint flat config**：项目使用 `eslint.config.js`（非 `.eslintrc.js`），YAML 文件不受 ESLint 影响，无需担心 lint 问题
- **`package.json` 格式**：JSON 格式严格，添加 `publishConfig` 时注意逗号和引号
- **`.github/workflows/` 目录**：Story 1.1 已创建，当前为空，直接在其中创建文件

### 来自 Story 1.2 的关键经验

- **ESM Only**：本故事涉及的是 YAML/JSON/Markdown 文件，无 JS 代码，无 ESM 问题
- **具名导出**：YAML 文件不涉及

### 来自 Story 1.3 的关键经验

- **vitest passWithNoTests**：已配置，本故事不新增测试文件
- **本故事无新增 JS 测试文件**：CI/CD 流水线为基础设施配置，无需单元测试

### Project Structure Notes

- **新建文件**：`.github/workflows/ci.yml`、`.github/workflows/publish.yml`
- **修改文件**：`README.md`（插入徽章和包名注册说明）、`package.json`（添加 `publishConfig`）
- **不修改**：所有 `lib/`、`test/`、`cli.js`、`agent/` 文件
- 本故事完全独立于 Story 1.2（errors.js/exit-codes.js）和 Story 1.3（output.js），可基于 `main` 分支并行开发

### References

- Story 1.4 验收标准：[Source: _bmad-output/planning-artifacts/epics.md#Story-1.4]
- 架构文档 CI/CD 策略：[Source: _bmad-output/planning-artifacts/architecture.md#基础设施与部署]
- 架构文档版本策略：[Source: _bmad-output/planning-artifacts/architecture.md#版本策略]
- 架构文档依赖锁定（NFR13）：[Source: _bmad-output/planning-artifacts/architecture.md#依赖锁定]
- Story 1.1 经验（目录结构）：[Source: _bmad-output/implementation-artifacts/1-1-npm-package-init.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
