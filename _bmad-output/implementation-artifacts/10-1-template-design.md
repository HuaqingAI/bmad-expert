# Story 10.1：规范化模板文件设计（templates/）

Status: done

---

## Story

**As a** 用户,
**I want** bmad-expert 提供经过规范化设计的 workspace CLAUDE.md、project CLAUDE.md 和 workflow 模板，
**So that** init 命令生成的配置文件质量可靠、结构清晰、具备通用性，而不是某个特定项目的临时配置。

---

## Acceptance Criteria

### AC1 — workspace-claude.md 模板

**Given** `templates/workspace-claude.md` 已设计
**When** 审阅模板内容
**Then** 包含以下规范化章节：
1. 默认项目声明（占位，init 时填入实际项目名和路径）
2. 全局约定（代码仓库操作入口、skill 路由声明）

**And** 内容仅描述结构和意图，不包含特定项目的硬编码信息
**And** 模板可适用于不同技术栈的项目（Java/Node/Python 等）

### AC2 — project-claude.md 模板

**Given** `templates/project-claude.md` 已设计
**When** 审阅模板内容
**Then** 包含以下规范化章节：
1. 工作流触发词定义区块（start story 等触发词及其对应的 workflow 文件引用）
2. 项目规范引用区块（编码规范文档路径占位）

**And** 触发词定义与 workflow 模板中的步骤对应，无悬空引用

### AC3 — workflow-single-repo.md 模板

**Given** `templates/workflow-single-repo.md` 已设计
**When** 审阅模板内容
**Then** 包含通用 story 开发工作流步骤序列：
- 同步代码 & 创建分支
- 创建 Story 文件
- 实现 Story
- 编译验证（可选）
- 运行测试（可选）
- 代码审查（可选）
- 提交代码
- 推送 & 创建 PR
- 更新 Sprint 状态
- 合并 & 清理

**And** 每步只描述"做什么"（如"编译项目"、"运行单元测试"），不写具体命令（如 gradlew、npm run）
**And** 执行 AI 根据项目上下文（package.json / build.gradle / Makefile 等）自行决定具体命令

### AC4 — npm 包分发

**Given** 三个模板文件放置于 npm 包 `templates/` 目录
**When** 执行 `npm pack` 或 `npm publish`
**Then** 模板文件随包分发，可在安装时读取

---

## Tasks / Subtasks

- [x] Task 1: 创建 `templates/` 目录和 `workspace-claude.md` 模板（AC1）
  - [x] 1.1 设计默认项目声明章节（`## Default Project` + PROJECT_NAME/PROJECT_PATH 占位）
  - [x] 1.2 设计全局约定章节（`## Repository Operations` — `/github` 路由声明）
  - [x] 1.3 确保内容通用，不绑定任何特定技术栈

- [x] Task 2: 创建 `templates/project-claude.md` 模板（AC2）
  - [x] 2.1 设计工作流触发词定义区块（`start story` 触发词 → `workflow/story-dev-workflow-single-repo.md`）
  - [x] 2.2 设计项目规范引用区块（`## Project Standards` — `docs/CODE_STYLE.md` 占位引用）
  - [x] 2.3 确保触发词与 workflow 模板步骤对应

- [x] Task 3: 创建 `templates/workflow-single-repo.md` 模板（AC3）
  - [x] 3.1 设计启动确认流程（可选步骤选择 + 确认模式选择）
  - [x] 3.2 设计跨阶段上下文（会话变量定义）
  - [x] 3.3 设计 10 步工作流序列（每步仅描述意图，不绑定工具）
  - [x] 3.4 设计跨会话启动词模板
  - [x] 3.5 设计关键规则速查表

- [x] Task 4: 更新 `package.json` 的 `files` 字段纳入 `templates/`（AC4）

- [x] Task 5: 验证模板完整性
  - [x] 5.1 workspace-claude.md 中的引用路径与 project-claude.md 一致
  - [x] 5.2 project-claude.md 中的触发词与 workflow 模板步骤对应
  - [x] 5.3 npm pack 后确认 templates/ 目录包含在包内

---

## Dev Notes

### 这是一个纯模板 Story — 仅创建 Markdown 文件 + 微调 package.json

**新建文件：**
- `templates/workspace-claude.md`
- `templates/project-claude.md`
- `templates/workflow-single-repo.md`

**修改文件：**
- `package.json` — `files` 数组新增 `"templates/"`

**不创建任何 JS 代码** — init 命令逻辑在 Story 10.2 中实现。

---

### 核心设计原则

1. **纯内容模板，非参数化模板**：模板是"起点内容"——不使用 `{{variable}}` 占位符（区别于 `agent/` 目录的模板）。init 命令通过字符串拼接将项目信息注入到模板的固定位置。[Source: architecture.md#模板体系架构]
2. **步骤意图，不绑技术栈**：workflow 模板每步只描述"做什么"（如"编译项目"），不写"用什么工具做"（如 `gradlew` 或 `npm run`）。执行 AI 根据项目上下文自行决定命令。[Source: prd.md#FR53, epics.md#Story 10.1 AC]
3. **通用性优先**：模板可适用于 Java/Node/Python 等不同技术栈，不包含任何特定项目的硬编码信息。[Source: prd.md#风险缓解矩阵]

---

### 现有项目文件的参考价值与禁区

**可参考结构（但不可直接照搬）：**
- `CLAUDE.md`（当前项目）— 理解 workspace 级配置文件的实际用法
- `workflow/story-dev-workflow-single-repo.md` — 理解 story 开发工作流的步骤序列和结构

**绝对不可照搬的内容：**
- 特定项目名（`bmad-expert`）、特定路径（`_bmad-output/`）、特定工具命令（`gradlew`、`npm run`）
- 当前 workflow 中绑定到 Gradle 的编译/测试命令
- 当前 CLAUDE.md 中硬编码的 skill 列表

**架构明确警告：** "模板内容需从规范角度重新设计，不可直接照搬现有项目文件" [Source: architecture.md#Phase 3 待确认项]

---

### 三个模板的职责边界

| 模板 | 核心章节 | init 时填入的信息 |
|------|---------|-----------------|
| workspace-claude.md | 默认项目声明、全局约定、skill 路由 | 实际项目名和路径 |
| project-claude.md | 工作流触发词、项目规范引用 | 项目实际信息 |
| workflow-single-repo.md | 步骤意图序列（10 步） | 无（纯起点内容） |

---

### 模板内容生成策略

init 命令（Story 10.2）将：
1. 读取模板基础结构
2. 结合交互收集的项目信息（项目名、路径、偏好）
3. 通过**字符串拼接**生成最终文件
4. 不使用模板引擎库

因此模板中需要有清晰的注入点标识，但不使用 `{{}}` 语法。建议用注释或明确的占位文字标识 init 需要替换的位置。
[Source: architecture.md#模板内容生成策略]

---

### npm 包分发

当前 `package.json` 的 `files` 字段：
```json
["cli.js", "lib/", "agent/", "README.md"]
```

需新增 `"templates/"` 使模板随包分发。

当前 `.npmignore` 无需修改 — 它排除的是开发产物（`_bmad-output/`、`test/` 等），`templates/` 不在排除列表中。

---

### 与其他 Story 的依赖关系

- Story 10.2（init 命令核心逻辑）**依赖本 Story** 的模板文件 — 10.2 的 `initializer.js` 从 `templates/` 读取模板
- Story 10.3（幂等保护）依赖 10.2
- `.bmad-init.json` 清单中会记录 `templateVersion`，与本 Story 的模板版本对应

---

### Project Structure Notes

**新增目录位置：**
```
bmad-expert/
├── templates/                    # ← 新增目录
│   ├── workspace-claude.md       # workspace 级 CLAUDE.md 模板
│   ├── project-claude.md         # project 级 CLAUDE.md 模板
│   └── workflow-single-repo.md   # 通用 story 开发工作流模板
├── agent/                        # 已有：agent 补充文件（含 {{}} 变量）
├── lib/                          # 已有：代码模块
└── ...
```

`templates/` 与 `agent/` 是**完全独立**的两个目录：
- `agent/` = 含 `{{variable}}` 的 agent 文件模板，install 时由 orchestrator.js 替换变量后写入
- `templates/` = 纯内容模板，init 时由 initializer.js 读取并拼接项目信息后写入

---

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#模板体系架构] — 模板设计原则、存储结构、内容规范
- [Source: _bmad-output/planning-artifacts/architecture.md#init 命令架构] — init 命令如何消费模板
- [Source: _bmad-output/planning-artifacts/architecture.md#Phase 3 待确认项] — 模板内容需从规范角度重新设计
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] — AC 原文
- [Source: _bmad-output/planning-artifacts/prd.md#FR51-FR53] — 模板相关功能需求
- [Source: _bmad-output/planning-artifacts/prd.md#Phase 3 路线图] — 交付内容排列
- [Source: _bmad-output/planning-artifacts/prd.md#风险缓解矩阵] — 模板通用性风险缓解

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 三个模板文件从规范角度全新设计，未照搬现有项目文件
- workspace-claude.md: 使用 PROJECT_NAME/PROJECT_PATH 占位文字标识 init 注入点，包含默认项目声明和仓库操作路由
- project-claude.md: 工作流触发词 `start story` 引用 `workflow/story-dev-workflow-single-repo.md`，含项目规范引用区块
- workflow-single-repo.md: 10 步工作流序列全部抽象为意图描述，不绑定任何特定构建工具；Steps 4/5 改为"检测项目构建系统并执行相应命令"的通用描述；Step 7 移除硬编码的 git author
- package.json files 字段新增 `templates/`，npm pack 验证通过

### File List

- `templates/workspace-claude.md` (新建)
- `templates/project-claude.md` (新建)
- `templates/workflow-single-repo.md` (新建)
- `package.json` (修改 files 字段)
