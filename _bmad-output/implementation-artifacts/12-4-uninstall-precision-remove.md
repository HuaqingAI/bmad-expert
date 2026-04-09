# Story 12.4: uninstall 精准段落移除

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want uninstall 对那些 init 时只追加了 bmad 段落的文件，只移除 bmad 段落而不删除整个文件，
So that 卸载 bmad-expert 后我的平台默认 CLAUDE.md 和手动添加的内容完整保留。

## Acceptance Criteria

1. **AC1 — appended workspace CLAUDE.md 精准移除（FR70）**
   Given `.bmad-init.json` 中 workspace CLAUDE.md 记录 `"action": "appended"`
   When 执行 `npx bmad-expert uninstall`
   Then 调用 `section-manager.removeBmadSection()` 移除 `<!-- bmad-workspace-config -->` 段落，保留用户原有内容
   And 清理计划中该文件标注"移除 bmad 段落"而非"删除文件"

2. **AC2 — appended project CLAUDE.md 精准移除（FR70）**
   Given `.bmad-init.json` 中 project CLAUDE.md 记录 `"action": "appended"`
   When 执行 uninstall
   Then 同样仅移除 `<!-- bmad-project-config -->` 段落

3. **AC3 — created 文件整文件删除**
   Given `.bmad-init.json` 中 project CLAUDE.md 记录 `"action": "created"`
   When 执行 uninstall
   Then 删除整个文件（与 Phase 3 行为一致）

4. **AC4 — 空文件清理**
   Given appended 文件移除标记段落后，剩余内容为空或只含空白
   When 执行 uninstall
   Then 删除该文件（空文件无保留价值）

5. **AC5 — 向后兼容无 action 字段**
   Given `.bmad-init.json` 中文件记录无 action 字段（Phase 3 遗留）
   When uninstall 处理该文件
   Then 视为 `"action": "created"`，删除整文件

6. **AC6 — 测试全部通过**
   Given `test/uninstaller.test.js` 扩展
   When 运行 `npm test`
   Then appended 精准移除、created 整文件删除、空文件清理、向后兼容测试全部通过

## Tasks / Subtasks

- [x] Task 1: uninstaller.js — collectUninstallTargets 区分 action 类型 (AC: #1, #2, #3, #5)
  - [x] 1.1 import `removeBmadSection` from `./section-manager.js`
  - [x] 1.2 在 plan 结构中新增 `toRemoveSection` 数组（元素 `{ path, sectionId, absolutePath }`）
  - [x] 1.3 遍历 manifest entries 时，根据 `action` 字段分流：
    - `action === 'appended'` → 推入 `toRemoveSection`，sectionId 从文件类型推导（见 sectionId 映射表）
    - `action === 'created'` 或 action 缺失 → 推入 `toDelete`（现有行为，向后兼容）
  - [x] 1.4 sectionId 映射：manifest entry 的 key 含 `workspace-claude` → `bmad-workspace-config`；含 `project-claude` → `bmad-project-config`

- [x] Task 2: uninstaller.js — displayCleanupPlan 显示精准移除项 (AC: #1)
  - [x] 2.1 在清理计划输出中，`toRemoveSection` 项显示"移除 bmad 段落"标签，与"删除文件"区分
  - [x] 2.2 保留 `toDelete` 和 `toPreserve` 的现有输出格式不变

- [x] Task 3: uninstaller.js — executeUninstall 处理精准移除 (AC: #1, #2, #4)
  - [x] 3.1 对 `toRemoveSection` 中每项：读取文件 → `removeBmadSection(content, sectionId)` → 判断结果
  - [x] 3.2 移除后内容非空（trim 后有内容）→ 写回文件
  - [x] 3.3 移除后内容为空或纯空白 → 删除文件（AC4）
  - [x] 3.4 移除操作的计数纳入结果统计

- [x] Task 4: 扩展测试 (AC: #6)
  - [x] 4.1 测试 collectUninstallTargets：action=appended 进入 toRemoveSection
  - [x] 4.2 测试 collectUninstallTargets：action=created 进入 toDelete
  - [x] 4.3 测试 collectUninstallTargets：无 action 字段 → 进入 toDelete（向后兼容）
  - [x] 4.4 测试 executeUninstall：appended 文件调用 removeBmadSection 后写回
  - [x] 4.5 测试 executeUninstall：移除后内容为空 → 删除文件
  - [x] 4.6 测试 displayCleanupPlan：appended 项显示"移除 bmad 段落"
  - [x] 4.7 确保所有现有测试不回归

## Dev Notes

### 关键架构约束

- **文件分层契约**（architecture.md）：marker-managed 文件（workspace/project CLAUDE.md）uninstall 时根据 action 字段决定操作方式：`created` → 删除整文件；`appended` → `removeBmadSection()` 仅移除标记段落
- **section-manager.js 已就绪**：Story 12-1 实现的 `removeBmadSection(content, sectionId)` 是本 story 核心依赖
- **action 字段已就绪**：Story 12-2 在 `.bmad-init.json` 中记录了 `action: "created"` / `"appended"`

### sectionId 映射表

| manifest entry key 包含 | sectionId | 对应标记 |
|---|---|---|
| `workspace-claude` | `bmad-workspace-config` | `<!-- bmad-workspace-config -->` / `<!-- /bmad-workspace-config -->` |
| `project-claude` | `bmad-project-config` | `<!-- bmad-project-config -->` / `<!-- /bmad-project-config -->` |

### 现有代码关键位置

| 文件 | 位置 | 说明 |
|---|---|---|
| `lib/uninstaller.js:1-10` | imports | 当前无 section-manager import，需添加 `removeBmadSection` |
| `lib/uninstaller.js` | `collectUninstallTargets` | 遍历 manifest entries，当前全部推入 `toDelete`，需按 action 分流 |
| `lib/uninstaller.js` | `displayCleanupPlan` | 输出清理计划，需增加 `toRemoveSection` 类别显示 |
| `lib/uninstaller.js` | `executeUninstall` | 执行删除，需增加精准移除分支 |
| `lib/uninstaller.js` | `uninstall` | 主入口，plan 结构需携带 `toRemoveSection` |
| `lib/section-manager.js:109-126` | `removeBmadSection` | 接收 `(content, sectionId)`，返回移除标记段落后的字符串 |
| `test/uninstaller.test.js` | 全部 | 当前 19 个测试，需扩展覆盖精准移除场景 |

### removeBmadSection API 速查

```js
import { removeBmadSection } from './section-manager.js';

// 输入：文件全文 + sectionId
// 输出：移除标记段落后的字符串（不含开闭标记行及其间内容）
// 未找到标记 → 返回原文不变
const result = removeBmadSection(fileContent, 'bmad-workspace-config');
```

### plan 结构扩展

当前 plan 结构：`{ toDelete: [...], toPreserve: [...] }`

扩展后：`{ toDelete: [...], toRemoveSection: [...], toPreserve: [...] }`

`toRemoveSection` 元素：`{ path: 'relative/path', sectionId: 'bmad-workspace-config', absolutePath: '/abs/path' }`

### executeUninstall 精准移除伪代码

```
for (const item of plan.toRemoveSection) {
  const content = await fs.readFile(item.absolutePath, 'utf8')
  const cleaned = removeBmadSection(content, item.sectionId)
  if (cleaned.trim() === '') {
    await fs.remove(item.absolutePath)  // 空文件直接删除
  } else {
    await fs.writeFile(item.absolutePath, cleaned, 'utf8')
  }
  removedCount++
}
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

### Story 12-1 / 12-2 关键经验

- section-manager.js 使用纯字符串操作（indexOf + substring），不用正则
- `removeBmadSection` 未找到标记时返回原文不变（安全降级）
- 标记格式固定：`<!-- bmad-{sectionId} -->` 和 `<!-- /bmad-{sectionId} -->`
- .bmad-init.json manifest 中 action 字段由 Story 12-2 写入，Phase 3 遗留数据无此字段
- 全部 520 测试通过（截至 12-2 完成时），本 story 不可引入回归

### Project Structure Notes

- `lib/uninstaller.js` — uninstall 命令核心逻辑
- `lib/section-manager.js` — 标记化段落管理引擎（12-1 产物）
- `.bmad-init.json` — init 安装清单，含文件路径和 action 字段（12-2 产物）
- `test/uninstaller.test.js` — uninstaller 测试集

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 12, Story 12.4]
- [Source: _bmad-output/planning-artifacts/architecture.md — File Layering Contract, Precision Uninstall Flow]
- [Source: _bmad-output/planning-artifacts/prd.md — FR70]
- [Source: _bmad-output/implementation-artifacts/12-1-section-manager.md — removeBmadSection API]
- [Source: _bmad-output/implementation-artifacts/12-2-init-project-claude-markers.md — action 字段, Dev Notes]
- [Source: lib/section-manager.js — removeBmadSection 实现]
- [Source: lib/uninstaller.js — collectUninstallTargets, executeUninstall, displayCleanupPlan]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- lib/uninstaller.js: 添加 `removeBmadSection` import 和 `TYPE_TO_SECTION_ID` 映射表
- lib/uninstaller.js: `collectUninstallTargets` 根据 manifest entry 的 `action` 字段分流 — `appended` 进入 `toRemoveSection`，`created` 或缺失进入 `toDelete`（向后兼容）
- lib/uninstaller.js: `displayCleanupPlan` 新增"将移除 bmad 段落"类别输出
- lib/uninstaller.js: `executeUninstall` Phase 2 精准移除 — 读文件、`removeBmadSection`、写回或删除空文件
- lib/uninstaller.js: `backupFiles` 同时备份 `toRemoveSection` 项
- lib/uninstaller.js: `uninstall` nothing-to-uninstall 检查纳入 `toRemoveSection`
- test/uninstaller.test.js: 新增 7 个测试覆盖 action=appended 精准移除、action=created 整文件删除、无 action 向后兼容、空文件清理、清理计划显示
- 全部 526 测试通过，零回归

### Change Log

- 2026-04-09: Story 12-4 实现完成 — uninstall 精准段落移除

### File List

- lib/uninstaller.js (modified)
- test/uninstaller.test.js (modified)
- _bmad-output/implementation-artifacts/12-4-uninstall-precision-remove.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
