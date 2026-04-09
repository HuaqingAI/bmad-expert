# Story 12.2: init 增强 — project-claude 标记化与 action 字段

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want init 生成的 project CLAUDE.md 也使用标记包裹管理段落，且 .bmad-init.json 记录每个文件的写入方式（created/appended），
So that update 和 uninstall 可以对 project CLAUDE.md 执行精准操作，appended 文件卸载时不被误删。

## Acceptance Criteria

1. **AC1 — project-claude 模板标记化（FR66）**
   Given `templates/project-claude.md` 模板
   When 审阅内容
   Then bmad 管理的段落用 `<!-- bmad-project-config -->` / `<!-- /bmad-project-config -->` 开闭标记包裹

2. **AC2 — 新建 project CLAUDE.md 含标记（FR66）**
   Given 执行 `npx bmad-expert init`，目标目录下不存在 project CLAUDE.md
   When init 生成文件
   Then 生成完整 project CLAUDE.md（含标记），`.bmad-init.json` 中该文件记录 `"action": "created"`

3. **AC3 — 追加模式写入 project CLAUDE.md（FR66）**
   Given 执行 `npx bmad-expert init --yes`，目标目录已存在 project CLAUDE.md 但不含 bmad 标记
   When init 处理该文件
   Then 从模板提取 `<!-- bmad-project-config -->` 段落追加到已有文件末尾，`.bmad-init.json` 中该文件记录 `"action": "appended"`

4. **AC4 — workspace CLAUDE.md 追加记录 action（FR66）**
   Given 执行 `npx bmad-expert init --yes`，workspace CLAUDE.md 已存在且无 bmad 标记
   When init 处理该文件
   Then 追加后 `.bmad-init.json` 中该文件记录 `"action": "appended"`（与 Story 10.4 行为一致，新增 action 字段记录）

5. **AC5 — 向后兼容无 action 字段（FR66）**
   Given `.bmad-init.json` 中已有记录但无 action 字段（Phase 3 遗留数据）
   When updater 或 uninstaller 读取
   Then 缺失 action 字段视为 `"action": "created"`（向后兼容，安全默认）

6. **AC6 — --project 参数（FR71）**
   Given `--project <name>` 参数传入
   When 执行 `npx bmad-expert init --project my-app`
   Then 跳过项目检测和交互选择，直接使用 `my-app` 作为项目名和路径

7. **AC7 — 测试全部通过**
   Given `test/initializer.test.js` 扩展
   When 运行 `npm test`
   Then project-claude 标记化、action 字段记录、--project 参数、向后兼容测试全部通过

## Tasks / Subtasks

- [x] Task 1: 更新 project-claude.md 模板，添加标记 (AC: #1)
  - [x] 1.1 在 `templates/project-claude.md` 中用 `<!-- bmad-project-config -->` / `<!-- /bmad-project-config -->` 包裹 bmad 管理段落
  - [x] 1.2 标记外保留标题行（`# CLAUDE.md — PROJECT_NAME`），标记内包含工作流命令、项目标准等
- [x] Task 2: initializer.js — project-claude 冲突解决与追加逻辑 (AC: #2, #3)
  - [x] 2.1 在 `resolveConflicts` 中增加 `project-claude` 类型的标记检测（检测 `bmad-project-config` 标记）
  - [x] 2.2 已有文件无标记时，从模板提取标记段落追加到文件末尾（复用 `extractBmadSection`）
  - [x] 2.3 已有文件含标记时，跳过（与 workspace-claude 行为一致）
- [x] Task 3: initializer.js — action 字段写入 .bmad-init.json (AC: #2, #3, #4)
  - [x] 3.1 在 `writeManifest` 中根据文件是新建还是追加，记录 `action: "created"` 或 `action: "appended"`
  - [x] 3.2 确保 workspace CLAUDE.md 追加时也记录 `action: "appended"`
- [x] Task 4: cli.js — 添加 `--project <name>` 参数 (AC: #6)
  - [x] 4.1 在 init 命令定义中增加 `--project <name>` option
  - [x] 4.2 将参数传递给 `init()`
  - [x] 4.3 initializer.js 中接收参数，跳过项目检测逻辑直接使用指定名称
- [x] Task 5: 扩展测试 (AC: #7)
  - [x] 5.1 测试模板包含 bmad-project-config 标记（通过 resolveConflicts 测试验证）
  - [x] 5.2 测试新建 project CLAUDE.md 含标记且 action=created
  - [x] 5.3 测试追加 project CLAUDE.md 标记段落且 action=appended
  - [x] 5.4 测试 workspace CLAUDE.md 追加时 action=appended
  - [x] 5.5 测试 --project 参数跳过检测
  - [x] 5.6 测试向后兼容（无 action 字段 → 默认 created）

## Dev Notes

### 关键架构约束

- **文件分层契约**：project CLAUDE.md 属于 `markerManagedFiles` 类别，update 时用 `replaceBmadSection` 精准替换，uninstall 时根据 action 字段决定整文件删除还是仅移除标记段落
- **标记 ID**：`bmad-project-config`（对应 project CLAUDE.md），与 `bmad-workspace-config`（workspace CLAUDE.md）机制一致
- **section-manager.js 已就绪**：Story 12-1 已实现全部 5 个函数（`hasBmadSection`、`extractBmadSection`、`replaceBmadSection`、`removeBmadSection`、`wrapBmadSection`），直接 import 使用
- **initializer.js 已完成 12-1 迁移**：`extractBmadSection` 已从 initializer.js 迁移至 section-manager.js，当前 initializer.js 第 17 行 `import { extractBmadSection } from './section-manager.js'`

### 现有代码关键位置

| 文件 | 行号 | 内容 |
|------|------|------|
| `lib/initializer.js:17` | import | `import { extractBmadSection } from './section-manager.js'` — 需扩展 import 添加 `hasBmadSection` |
| `lib/initializer.js:28-32` | TEMPLATE_FILE_MAP | `'project-claude': 'project-claude.md'` 已映射 |
| `lib/initializer.js:236` | resolveConflicts | 当前只处理 `workspace-claude` 类型的标记检测，需新增 `project-claude` 类型 |
| `lib/initializer.js:345` | generateFiles | 生成 3 个文件：workspace CLAUDE.md、project CLAUDE.md、workflow 文件 |
| `templates/project-claude.md` | 模板 | 当前无标记，需添加 `<!-- bmad-project-config -->` 包裹 |
| `cli.js` | init 命令 | 需添加 `--project <name>` option |

### resolveConflicts 改造要点

当前 `resolveConflicts` 对 `workspace-claude` 类型的处理逻辑（initializer.js:236 附近）：
1. 检测文件是否已包含 `<!-- bmad-workspace-config -->` 和 `<!-- /bmad-workspace-config -->` 标记
2. 含标记 → 跳过（已安装）
3. 无标记 → 从模板提取标记段落，追加到现有文件末尾

**对 `project-claude` 类型需实现同样逻辑**：
1. 检测 `<!-- bmad-project-config -->` / `<!-- /bmad-project-config -->`
2. 含标记 → 跳过
3. 无标记 → 提取模板中标记段落，追加到现有文件末尾
4. 追加时在 .bmad-init.json 中记录 `action: "appended"`

### action 字段写入逻辑

在 `generateFiles` 函数中，文件写入记录到 .bmad-init.json 时需增加判断：
- 文件不存在 → 新建 → `action: "created"`
- 文件已存在且无标记 → 追加 → `action: "appended"`
- 文件已存在且有标记 → 跳过（不写入 manifest）

### --project 参数传递链

```
cli.js (--project option) → initializer.runInit({ project: name }) → skipDetection → 直接使用 name 作为项目路径
```

### 编码规范速查

- 文件命名：kebab-case.js
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 导出：具名导出，禁止 default export
- 文件操作：`fs-extra`，不用原生 `fs`
- 异步：async/await，禁止 .then() 链
- 错误：throw BmadError，cli.js 顶层捕获
- 输出：通过 output.js，不直接 console.log
- 测试：`test/*.test.js`，集中管理

### Project Structure Notes

- 模板文件位于 `templates/` 目录，与 `package.json` 中 `bmadExpert.templateFiles` 配置一致
- `.bmad-init.json` 是安装清单，记录 init 生成的全部文件及其写入方式
- `lib/section-manager.js` 是 Phase 4 基础设施，本 story 是其第一个消费者（init 场景）

### Story 12-1 关键经验

- section-manager.js 使用纯字符串操作（indexOf + substring），不用正则
- `extractBmadSection` 对 `bmad-workspace-config` 有 Phase 3 回退逻辑（检测 `## Default Project` 标题），`bmad-project-config` 无需此回退
- 标记格式固定：`<!-- bmad-{sectionId} -->` 和 `<!-- /bmad-{sectionId} -->`
- `wrapBmadSection(content, sectionId)` 返回 `<!-- sectionId -->\n{content}\n<!-- /sectionId -->`

### References

- [Source: _bmad-output/planning-artifacts/prd.md — FR64-FR66, FR70-FR72]
- [Source: _bmad-output/planning-artifacts/architecture.md — Phase 4 Key Decisions, File Layering Contract, initializer.js Enhancements, .bmad-init.json action Field]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 12, Story 12.2]
- [Source: _bmad-output/implementation-artifacts/12-1-section-manager.md — Dev Notes, section-manager API]
- [Source: lib/section-manager.js — 已实现的 5 个函数]
- [Source: lib/initializer.js — resolveConflicts, generateFiles, TEMPLATE_FILE_MAP]
- [Source: templates/project-claude.md — 当前无标记的模板]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- templates/project-claude.md: 添加 `<!-- bmad-project-config -->` / `<!-- /bmad-project-config -->` 标记包裹 bmad 管理段落，标题行保留在标记外
- lib/initializer.js: resolveConflicts 统一处理 workspace-claude 和 project-claude 两种标记类型（`hasBmadSection` 检测），--yes 和交互模式均支持
- lib/initializer.js: writeManifest 首次写入和增量更新均包含 action 字段（created/appended），skipped 文件保留已有记录
- lib/initializer.js: init() 支持 --project 参数，跳过 detectWorkspaceStructure 和 collectProjectInfo
- cli.js: init 命令增加 `--project <name>` option
- test/initializer.test.js: 新增 10 个测试覆盖 project-claude 标记化、action 字段记录、--project 参数、向后兼容；更新 5 个已有测试适配新行为
- 全部 520 测试通过，零回归

### Change Log

- 2026-04-09: Story 12-2 实现完成 — project-claude 标记化、action 字段、--project 参数

### File List

- templates/project-claude.md (modified)
- lib/initializer.js (modified)
- cli.js (modified)
- test/initializer.test.js (modified)
- _bmad-output/implementation-artifacts/12-2-init-project-claude-markers.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
