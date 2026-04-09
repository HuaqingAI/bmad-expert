# Story 12.1: 标记化段落管理引擎（section-manager.js）

Status: ready-for-dev

---

## Story

**As a** 开发者（AI agent）,
**I want** 一个统一的标记化段落管理模块，提供段落检测、提取、替换、移除等原子操作，
**So that** initializer、updater、uninstaller 可以共用同一套标记操作逻辑，不各自重复实现。

---

## Acceptance Criteria

### AC1 — hasBmadSection：完整标记检测

**Given** `lib/section-manager.js` 已实现
**When** 调用 `hasBmadSection(content, 'bmad-workspace-config')`，content 中包含完整的开闭标记对
**Then** 返回 `true`（FR64）

**Given** content 中只有开标记没有闭标记（残缺标记）
**When** 调用 `hasBmadSection(content, 'bmad-workspace-config')`
**Then** 返回 `false`（残缺标记视为无效，FR64）

**Given** content 中没有任何标记
**When** 调用 `hasBmadSection(content, 'bmad-workspace-config')`
**Then** 返回 `false`

### AC2 — extractBmadSection：提取标记段落

**Given** content 包含完整标记对
**When** 调用 `extractBmadSection(content, 'bmad-workspace-config')`
**Then** 返回包含开闭标记的完整段落字符串（FR64）

**Given** content 中不存在该标记
**When** 调用 `extractBmadSection(content, 'bmad-workspace-config')`
**Then** 返回 `null`

### AC3 — replaceBmadSection：替换标记段落

**Given** content 包含完整标记对，newSection 是新的完整段落（含标记）
**When** 调用 `replaceBmadSection(content, 'bmad-workspace-config', newSection)`
**Then** 标记段落被替换为 newSection，标记外用户自定义内容完全不变（FR67）
**And** 替换后段落前后各有一个空行分隔（换行保证）

**Given** content 中不存在该标记
**When** 调用 `replaceBmadSection(content, 'bmad-workspace-config', newSection)`
**Then** 返回原 content 不变（幂等）

### AC4 — removeBmadSection：移除标记段落

**Given** content 包含完整标记对
**When** 调用 `removeBmadSection(content, 'bmad-workspace-config')`
**Then** 标记段落被完整移除，标记外内容完整保留（FR70）
**And** 移除后不留多余空行（最多一个空行）

**Given** content 中不存在该标记
**When** 调用 `removeBmadSection(content, 'bmad-workspace-config')`
**Then** 返回原 content 不变（幂等）

### AC5 — wrapBmadSection：包裹段落

**Given** 调用 `wrapBmadSection(content, 'bmad-project-config')`
**When** 执行
**Then** 返回 `<!-- bmad-project-config -->\n{content}\n<!-- /bmad-project-config -->`（FR64）

### AC6 — initializer.js 迁移

**Given** Phase 3 `initializer.js` 中已有的 `extractBmadSection()` 函数（无 sectionId 参数，硬编码 bmad-workspace-config）
**When** 迁移至 section-manager.js
**Then** initializer.js 改为 `import { extractBmadSection } from './section-manager.js'`，调用时传 sectionId，功能不变

### AC7 — 测试覆盖

**Given** `test/section-manager.test.js` 覆盖全部函数
**When** 运行 `npm test`
**Then** 所有标记操作（检测/提取/替换/移除/包裹）+ 边界场景（残缺标记/空内容/无标记/多余空行）测试全部通过

---

## Tasks / Subtasks

- [ ] Task 1: 创建 `lib/section-manager.js`（AC1~AC5）
  - [ ] 1.1 实现 `hasBmadSection(content, sectionId): boolean`
    - 构造 openMarker = `<!-- ${sectionId} -->`，closeMarker = `<!-- /${sectionId} -->`
    - 使用 `indexOf` 检测两者均存在（openIdx !== -1 && closeIdx !== -1）
    - 残缺标记（只有开/只有闭）返回 `false`
  - [ ] 1.2 实现 `extractBmadSection(content, sectionId): string|null`
    - 找到 openIdx 和 closeIdx + closeMarker.length
    - 两者均存在时返回 `content.substring(openIdx, closeIdx + closeMarker.length)`
    - 否则返回 `null`
  - [ ] 1.3 实现 `replaceBmadSection(content, sectionId, newSection): string`
    - 若不存在完整标记对，返回原 content
    - 找到标记段落的起止范围（从 openIdx 到 closeIdx + closeMarker.length）
    - 分析前后上下文，确保替换后段落前后各有一个空行（处理多余空行）
    - 返回 before + `\n\n` + newSection + `\n\n` + after（trim 接缝处多余空行）
  - [ ] 1.4 实现 `removeBmadSection(content, sectionId): string`
    - 若不存在完整标记对，返回原 content（幂等）
    - 找到标记段落范围，连同前后多余空行一起移除
    - 处理移除后末尾多余换行
  - [ ] 1.5 实现 `wrapBmadSection(content, sectionId): string`
    - 返回 `<!-- ${sectionId} -->\n${content}\n<!-- /${sectionId} -->`

- [ ] Task 2: 迁移 `initializer.js` 中的 `extractBmadSection`（AC6）
  - [ ] 2.1 在 `lib/section-manager.js` 顶部 exports 中确认 `extractBmadSection` 已正确实现（支持两参数）
  - [ ] 2.2 删除 `lib/initializer.js` 中的 `extractBmadSection` 函数定义（第 233-247 行）
  - [ ] 2.3 在 `lib/initializer.js` 顶部 import 行添加 `import { extractBmadSection } from './section-manager.js'`
  - [ ] 2.4 修改 `initializer.js` 中所有 `extractBmadSection(file.content)` 调用为 `extractBmadSection(file.content, 'bmad-workspace-config')`
  - [ ] 2.5 修改 `test/initializer.test.js`：删除对 `extractBmadSection` 的直接 import（已通过 section-manager 测试覆盖），确认相关测试仍通过

- [ ] Task 3: 创建 `test/section-manager.test.js`（AC7）
  - [ ] 3.1 `hasBmadSection` 测试：完整标记→true、仅开标记→false、仅闭标记→false、无标记→false、空字符串→false
  - [ ] 3.2 `extractBmadSection` 测试：完整标记→返回含标记段落、无标记→null、内容前后有其他文本时正确提取
  - [ ] 3.3 `replaceBmadSection` 测试：正常替换→用户自定义内容不变、无标记→原样返回、前后空行正确处理
  - [ ] 3.4 `removeBmadSection` 测试：正常移除→保留标记外内容、无标记→原样返回、移除后空行处理、幂等验证
  - [ ] 3.5 `wrapBmadSection` 测试：基本包裹→格式正确
  - [ ] 3.6 综合边界场景：空内容、只含标记无内容、多个不同 sectionId 共存时只操作指定 sectionId

---

## Dev Notes

### 架构约束（必须严格遵守）

- `lib/section-manager.js` 是**纯字符串操作模块**，无文件 I/O，无外部依赖
- **禁止使用正则**——标记格式固定，`indexOf` + `substring` 更可靠、更快（架构决策）
- **命名导出**（named exports），禁止 `export default`
- 函数均为**纯函数**（synchronous，无副作用），不需要 async/await
- 不导入 `fs-extra`、`output.js`、`platform.js` 等任何项目内模块
- ES Module（`export function xxx`），与项目其余 lib 文件一致

### 标记格式规范

```
开标记：<!-- ${sectionId} -->
闭标记：<!-- /${sectionId} -->
```

已有 sectionId：
| sectionId | 用途 | 目标文件 |
|-----------|------|---------|
| `bmad-workspace-config` | workspace CLAUDE.md bmad 路由配置 | workspace CLAUDE.md |
| `bmad-project-config` | project CLAUDE.md bmad 项目配置 | project CLAUDE.md |

### 现有 extractBmadSection 分析（迁移对象）

`lib/initializer.js` 第 233-247 行现有实现：
```javascript
export function extractBmadSection(templateContent) {
  const openMarker = '<!-- bmad-workspace-config -->'
  const closeMarker = '<!-- /bmad-workspace-config -->'
  const openIdx = templateContent.indexOf(openMarker)
  const closeIdx = templateContent.indexOf(closeMarker)
  if (openIdx !== -1 && closeIdx !== -1) {
    return templateContent.substring(openIdx, closeIdx + closeMarker.length)
  }
  // Fallback: wrap from ## Default Project onward
  const dpIdx = templateContent.indexOf('## Default Project')
  if (dpIdx === -1) return `${openMarker}\n${templateContent}\n${closeMarker}`
  return `${openMarker}\n${templateContent.substring(dpIdx)}\n${closeMarker}`
}
```

迁移后 section-manager 版本的 `extractBmadSection(content, sectionId)` 应支持任意 sectionId。**保留 Fallback 逻辑**（向后兼容，initializer 调用时依赖此行为）：
```javascript
// 当 sectionId === 'bmad-workspace-config' 时保留 fallback 逻辑
// 其他 sectionId 不需要 fallback（找不到标记直接返回 null）
```

> **注意**：initializer.js 调用 extractBmadSection 时是从**模板内容**中提取（模板已包含标记），不是普通文本追加，因此 fallback 分支有实际意义。迁移时保留。

### replaceBmadSection 换行处理规范

替换后段落前后需保证一个空行。推荐实现：
```javascript
// 找到标记范围
const before = content.substring(0, openIdx)
const after = content.substring(closeIdx + closeMarker.length)
// trim 接缝处多余空行，统一补一个空行
const trimmedBefore = before.replace(/\n+$/, '')
const trimmedAfter = after.replace(/^\n+/, '')
if (trimmedAfter.length === 0) {
  return trimmedBefore + '\n\n' + newSection + '\n'
}
return trimmedBefore + '\n\n' + newSection + '\n\n' + trimmedAfter
```

### removeBmadSection 空行处理规范

移除标记段落时，连同前后多余空行一并清理：
```javascript
const before = content.substring(0, openIdx)
const after = content.substring(closeIdx + closeMarker.length)
const trimmedBefore = before.replace(/\n+$/, '')
const trimmedAfter = after.replace(/^\n+/, '')
if (trimmedBefore.length === 0 && trimmedAfter.length === 0) return ''
if (trimmedBefore.length === 0) return trimmedAfter
if (trimmedAfter.length === 0) return trimmedBefore + '\n'
return trimmedBefore + '\n\n' + trimmedAfter
```

### 测试模式（本模块无外部依赖，直接单元测试）

```javascript
import { describe, it, expect } from 'vitest'
import {
  hasBmadSection,
  extractBmadSection,
  replaceBmadSection,
  removeBmadSection,
  wrapBmadSection,
} from '../lib/section-manager.js'

// 不需要 vi.mock —— 纯函数，无依赖
```

测试用例示例（replaceBmadSection 用户内容不变）：
```javascript
it('用户自定义内容不受影响', () => {
  const content = `用户自定义内容1\n\n<!-- bmad-workspace-config -->\n旧内容\n<!-- /bmad-workspace-config -->\n\n用户自定义内容2`
  const newSection = `<!-- bmad-workspace-config -->\n新内容\n<!-- /bmad-workspace-config -->`
  const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
  expect(result).toContain('用户自定义内容1')
  expect(result).toContain('用户自定义内容2')
  expect(result).toContain('新内容')
  expect(result).not.toContain('旧内容')
})
```

### 文件位置

| 文件 | 操作 |
|------|------|
| `lib/section-manager.js` | **新建** |
| `test/section-manager.test.js` | **新建** |
| `lib/initializer.js` | 修改：删除 `extractBmadSection` 函数定义，添加 import |
| `test/initializer.test.js` | 修改：删除 `extractBmadSection` 的直接 import（可选，若测试结构需要调整） |

### 命名规范

- 文件名：`section-manager.js`（kebab-case）
- 函数名：camelCase（`hasBmadSection`，`extractBmadSection` 等）
- 测试描述：中文（与项目其余测试文件一致）

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#标记化段落管理引擎（Phase 4）]
- [Source: lib/initializer.js#extractBmadSection — 迁移对象（第 233-247 行）]
- [Source: test/initializer.test.js — 测试模式参考]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Completion Notes List

Ultimate context engine analysis completed — comprehensive developer guide created

### File List

(to be filled by dev agent)
