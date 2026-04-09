# Story 13.2: status init 状态扩展

Status: done

## Story

As a AI caller,
I want `status` 和 `status --json` 输出包含 init 状态信息（是否执行过 init、模板版本、配置文件完整性），
So that 我可以编程判断是否需要执行 init 或 update，实现完全自动化的环境检测。

## Acceptance Criteria

1. **AC1 — JSON 输出：已初始化且完整**
   Given bmad-expert 已安装且已执行过 init
   When 执行 `npx bmad-expert status --json`
   Then JSON 输出新增 `"init"` 字段：`{"init": {"initialized": true, "templateVersion": "1.0.0", "files": [{"path": "CLAUDE.md", "exists": true, "hasBmadSection": true}, ...]}}`（FR73）

2. **AC2 — JSON 输出：未初始化**
   Given bmad-expert 已安装但未执行过 init
   When 执行 `npx bmad-expert status --json`
   Then `"init": {"initialized": false}`（FR73）

3. **AC3 — JSON 输出：部分文件缺失**
   Given init 已执行但部分文件被手动删除
   When 执行 `npx bmad-expert status --json`
   Then `"init": {"initialized": true, ...}`，缺失文件的 `"exists": false`（FR73）

4. **AC4 — 人类模式输出**
   Given 执行 `npx bmad-expert status`（人类模式）
   When 输出状态信息
   Then 在现有输出基础上追加 init 状态行：`Init: ✓ 已初始化 | 模板版本: 1.0.0 | 配置文件: 3/3 完整` 或 `Init: ✗ 未初始化`（FR73）

5. **AC5 — 测试覆盖**
   Given `test/checker.test.js` 扩展
   When 运行 `npm test`
   Then init 状态三种场景（已初始化/未初始化/部分损坏）+ JSON 输出结构测试通过

## Tasks / Subtasks

- [x] Task 1: 在 `lib/checker.js` 中增加 init 状态检测逻辑 (AC: #1, #2, #3)
  - [x] 1.1 读取 `cwd` 下的 `.bmad-init.json` 清单文件
  - [x] 1.2 清单不存在 → `init: { initialized: false }`
  - [x] 1.3 清单存在 → 解析 `templateVersion` 和 `files` 数组
  - [x] 1.4 对每个清单文件检查 `exists`（通过 `fs.pathExists`）
  - [x] 1.5 对 workspace-claude / project-claude 类型文件额外检查 `hasBmadSection`
  - [x] 1.6 组装 `init` 字段并合并到返回结果对象
- [x] Task 2: 扩展人类模式输出 (AC: #4)
  - [x] 2.1 在 printSuccess 的状态报告末尾追加 init 状态行
  - [x] 2.2 已初始化：`Init: ✓ 已初始化 | 模板版本: {ver} | 配置文件: {n}/{total} 完整`
  - [x] 2.3 未初始化：`Init: ✗ 未初始化`
- [x] Task 3: 扩展 `test/checker.test.js` (AC: #5)
  - [x] 3.1 测试场景：已初始化 + 所有文件完整
  - [x] 3.2 测试场景：未初始化（无 .bmad-init.json）
  - [x] 3.3 测试场景：已初始化 + 部分文件缺失
  - [x] 3.4 测试场景：JSON 输出结构含 init 字段
  - [x] 3.5 测试场景：人类模式输出含 init 状态行

## Dev Notes

### 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/checker.js` | 修改 | 新增 init 状态检测逻辑，扩展返回对象和人类输出 |
| `test/checker.test.js` | 修改 | 新增 init 状态相关测试 |

cli.js **不需修改** — status action 已将完整 `result` 传给 `printJSON(result)`，init 字段自动包含。

### 架构约束（必须遵守）

- **文件操作**：使用 `fs-extra`（`fs.pathExists`、`fs.readJSON`），禁止原生 fs
- **错误处理**：`.bmad-init.json` 读取失败（JSON 解析错误等）不应抛 BmadError，应降级为 `initialized: false`（与 initializer.js 中损坏清单的处理一致）
- **输出路由**：所有输出通过 `output.js` 的 `printProgress` / `printSuccess`，禁止 console.log
- **禁止 process.exit()**：由 cli.js 顶层处理
- **具名导出**：禁止 default export
- **命名规范**：函数 camelCase，常量 UPPER_SNAKE_CASE

### checkStatus 返回值扩展

现有返回结构（不变）：
```js
{
  success: boolean,
  status: 'healthy' | 'not_installed' | 'corrupted',
  version: string | null,
  platform: string,
  installPath: string,
  files: Array<{ name: string, exists: boolean }>,
  fixSuggestion?: string,
}
```

新增 `init` 字段：
```js
{
  // ...现有字段不变...
  init: {
    initialized: boolean,       // .bmad-init.json 是否存在且有效
    templateVersion?: string,   // 仅 initialized=true 时存在
    files?: Array<{             // 仅 initialized=true 时存在
      path: string,             // 清单中的相对路径
      type: string,             // 'workspace-claude' | 'project-claude' | 'workflow'
      exists: boolean,          // 文件是否存在于磁盘
      hasBmadSection?: boolean, // 仅 workspace-claude / project-claude 类型；检测标记对完整性
    }>,
  },
}
```

### 实现细节

#### .bmad-init.json 读取

```js
// 在 checkStatus 函数内，Step 5 之前插入
const initStatus = await checkInitStatus(process.cwd())
```

新增内部函数 `checkInitStatus(cwd)`：
1. `const manifestPath = join(cwd, '.bmad-init.json')`
2. `fs.pathExists(manifestPath)` — false → 返回 `{ initialized: false }`
3. `fs.readJSON(manifestPath)` — try/catch，解析失败 → 返回 `{ initialized: false }`
4. 从清单提取 `templateVersion` 和 `files` 数组
5. 对每个 file：
   - `exists`: `fs.pathExists(join(cwd, file.path))`
   - `hasBmadSection`（仅 workspace-claude / project-claude 类型）：
     - 读取文件内容
     - 根据 type 确定标记名：
       - `workspace-claude` → `<!-- bmad-workspace-config -->` + `<!-- /bmad-workspace-config -->`
       - `project-claude` → `<!-- bmad-project-config -->` + `<!-- /bmad-project-config -->`
     - 开闭标记均存在 → `true`，否则 → `false`
     - 文件不存在时 `hasBmadSection` 为 `false`
6. 返回 `{ initialized: true, templateVersion, files: [...] }`

#### 标记检测逻辑

**不引入 section-manager.js**（该模块是 Story 12-1 的产物，当前不存在）。直接在 checker.js 中用简单 `includes` 检测：

```js
const MARKER_MAP = {
  'workspace-claude': { open: '<!-- bmad-workspace-config -->', close: '<!-- /bmad-workspace-config -->' },
  'project-claude': { open: '<!-- bmad-project-config -->', close: '<!-- /bmad-project-config -->' },
}

function hasBmadSection(content, type) {
  const markers = MARKER_MAP[type]
  if (!markers) return undefined  // 非标记管理文件类型，不返回此字段
  return content.includes(markers.open) && content.includes(markers.close)
}
```

#### 人类模式输出

在 3 种状态（healthy / not_installed / corrupted）的 `printSuccess` 调用中追加 init 行：

- 已初始化：
  ```
  Init: ✓ 已初始化 | 模板版本: 1.0.0 | 配置文件: 3/3 完整
  ```
- 已初始化但有缺失：
  ```
  Init: ✓ 已初始化 | 模板版本: 1.0.0 | 配置文件: 2/3 完整（1 个缺失）
  ```
- 未初始化：
  ```
  Init: ✗ 未初始化
  ```

init 状态行追加在现有输出的**最后一行之后**（状态行之后，或 fixSuggestion 之后）。

### 测试要点

#### Mock 策略

`.bmad-init.json` 的读取通过 `fs.pathExists` + `fs.readJSON` 实现。现有测试已 mock 了 `fs-extra`。

需要扩展 `fsMock` 的 mock：
- `fsMock.readJSON` — 新增 mock（当前测试只 mock 了 `readFile` 和 `pathExists`）
- `fsMock.readFile` — 扩展以支持读取 init 文件内容（用于 hasBmadSection 检测）

#### 新增 describe 块

```
describe('init 状态检测（FR73）', () => {
  describe('已初始化（所有文件完整）', () => { ... })
  describe('未初始化', () => { ... })
  describe('已初始化（部分文件缺失）', () => { ... })
  describe('JSON 输出含 init 字段', () => { ... })
  describe('人类模式含 init 状态行', () => { ... })
})
```

#### 测试数据

```js
const MOCK_INIT_MANIFEST = {
  version: '1.0.0',
  createdAt: '2026-04-08T10:00:00Z',
  templateVersion: '1.0.0',
  defaultProject: 'my-project',
  files: [
    { path: 'CLAUDE.md', type: 'workspace-claude' },
    { path: 'my-project/CLAUDE.md', type: 'project-claude' },
    { path: 'my-project/workflow/story-dev-workflow-single-repo.md', type: 'workflow' },
  ],
}
```

### Project Structure Notes

- `lib/checker.js` 是唯一需要修改的业务模块
- 不需要新增文件
- 不涉及 cli.js 修改（status action 已透传完整 result）
- `process.cwd()` 用于定位 `.bmad-init.json`（与 initializer.js 一致）

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 13.2 定义（行 1472-1498）]
- [Source: _bmad-output/planning-artifacts/architecture.md — init 命令架构 / .bmad-init.json 结构（行 514-533）]
- [Source: _bmad-output/planning-artifacts/architecture.md — 标记化段落标记 ID（行 648-650）]
- [Source: _bmad-output/planning-artifacts/prd.md — FR73 定义（行 700-701）]
- [Source: lib/checker.js — 现有 checkStatus 实现（142 行）]
- [Source: lib/initializer.js — writeManifest / extractBmadSection（行 233-235, 421-476）]
- [Source: test/checker.test.js — 现有测试结构（362 行）]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

N/A

### Completion Notes List

- checkInitStatus() 内部函数：读取 .bmad-init.json，解析文件完整性和标记段落存在性
- formatInitStatusLine() 内部函数：将 init 状态格式化为人类可读行
- MARKER_MAP 常量：workspace-claude / project-claude 标记对映射
- 代码审查修复：templateVersion 为空时从返回对象中省略（而非返回 null）
- 所有 479 个测试通过

### File List

- lib/checker.js（修改：新增 checkInitStatus, formatInitStatusLine, MARKER_MAP；集成到 checkStatus 返回值和输出）
- test/checker.test.js（修改：新增 init 状态检测 FR73 测试套件）
- _bmad-output/implementation-artifacts/13-2-status-init-expansion.md（创建：Story 文件）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改：状态更新）
