# Story 开发工作流

本文件描述从 Story 创建到合并的完整开发流程。AI Agent 按此流程执行 Story 开发。

---

## 确认模式

工作流启动时，询问用户选择确认模式：

| 模式 | 说明 |
|------|------|
| **全部确认** | 每个步骤完成后暂停，向用户展示结果并等待确认后再继续下一步 |
| **全部跳过** | 所有步骤自动执行，不暂停确认 |
| **AI 判断** | 由 AI 根据步骤风险和复杂度决定是否需要确认（见下方判断规则） |

### AI 判断规则

以下步骤**必须确认**（产出影响大或不可逆）：
- 步骤 1：创建 Story 文件 -- 确认 Story 规格是否符合预期
- 步骤 2：开发完成后 -- 确认实现方案和代码变更
- 步骤 5：代码审查结果 -- 确认是否有需要修复的问题
- 步骤 7：推送 & 创建 PR -- 确认 PR 内容

以下步骤**可跳过确认**（机械操作或自动可判断）：
- 步骤 3：编译 -- 通过则继续，失败则自动修复
- 步骤 4：测试 -- 通过则继续，失败则自动修复
- 步骤 6：提交代码 -- 按规则执行即可
- 步骤 8：更新状态 -- 机械操作
- 步骤 9：合并清理 -- 始终由用户决定

---

## 前置条件

- 已完成 sprint planning（`_bmad-output/implementation-artifacts/sprint-status.yaml` 存在）
- 目标 Story 在 sprint-status 中状态为 `backlog` 或 `ready-for-dev`
- 已阅读 `_bmad-output/project-context.md` 了解项目规则
- 已阅读 `docs/BACKEND_CODE_STYLE.md` 了解编码规范

---

## 工作流步骤

### 1. 创建 Story 文件

如果 Story 状态为 `backlog`（尚无 Story 文件），先执行 `bmad-create-story` 生成 Story 规格文件。

### 2. 同步代码 & 创建分支

- **先拉取最新代码**（在 `backend/` 子模块中操作）：
  ```bash
  cd backend && git checkout main && git pull origin main
  ```
- 分支命名：`story/{epic号}-{story号}-{slug}`，如 `story/1-1-data-dictionary-management`
- **分支基点选择**：
  1. 检查 Story 文件中是否声明了依赖 Story（如 `dependencies: [1-1]`）
  2. 如果有依赖，用 `gh pr list` 检查依赖 Story 的 PR 合并状态：
     - **已合并** → 基于 `main` 创建分支（依赖代码已在 main 中）
     - **未合并** → 拉取并基于依赖分支创建：
       ```bash
       git fetch origin story/1-1-xxx && git checkout -b story/1-2-xxx origin/story/1-1-xxx
       ```
       PR 目标也改为依赖分支
  3. 如果无依赖 → 基于 `main` 创建分支
- 执行 `bmad-dev-story` 实现 Story
- 遵循 `project-context.md` 中的所有规则（语言混用、项目结构、API 设计等）

### 3. 编译

```bash
cd backend && ./gradlew :union-service-property:compileKotlin :union-service-property:compileJava
```

确保编译通过，修复所有编译错误。

### 4. 测试

```bash
cd backend && ./gradlew :union-service-property:test
```

- 使用 `application-test.yaml`（H2 内存数据库）运行测试
- 确保所有测试通过

### 5. 代码审查

执行 `bmad-code-review`，审查本次变更的代码质量。根据审查结果修复关键问题。

### 6. 提交代码

- 提交到 Story 分支
- Git 作者：`Sue <boil@vip.qq.com>`
- 不添加 Co-Authored-By
- Commit 格式：`<type>(<scope>): <subject>`
  - type: feat / fix / docs / style / refactor / test / chore
  - scope: 模块名（如 property, asset, auth）

### 7. 推送 & 创建 PR

- 推送分支到远端
- 使用 `gh pr create` 创建 PR
- 目标分支：如果基于依赖分支创建，PR 目标为依赖分支；否则目标为 `main`
- PR 标题简洁，body 包含 Summary 和 Test plan

### 8. 更新 Sprint 状态

更新 `_bmad-output/implementation-artifacts/sprint-status.yaml`：
- Story 状态改为 `done`

### 9. 合并 & 清理

由用户决定何时合并 PR。合并后删除 Story 分支。

---

## 关键规则

| 项目 | 规则 |
|------|------|
| Git 作者 | `Sue <boil@vip.qq.com>` |
| Co-Authored-By | 不添加 |
| 分支命名 | `story/{epic号}-{story号}-{slug}` |
| Commit 格式 | Conventional Commits（中文 subject 可选） |
| 编译目标 | `:union-service-property:compileKotlin` + `compileJava` |
| 测试 profile | `test`（H2 内存数据库） |
| PR 目标 | `main` 或依赖分支（依赖 PR 未合并时） |
