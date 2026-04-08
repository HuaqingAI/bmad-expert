# Story 11.2: uninstall 命令 — 完整清理与用户数据保护

Status: ready-for-dev

---

## Story

**As a** 用户（通过 AI 代劳）,
**I want** 执行 `npx bmad-expert uninstall` 时系统展示完整的清理计划、让我确认后执行清理，保护我的用户数据（MEMORY.md、USER.md）不被删除，
**So that** 我可以干净地移除 bmad-expert，同时保留我积累的使用数据。

---

## Acceptance Criteria

### AC1 — 完整清理（已安装 + 已 init）

**Given** bmad-expert 已安装且已执行过 init
**When** 执行 `npx bmad-expert uninstall`
**Then** 收集清理目标：① `.bmad-init.json` 清单中的所有文件；② `_bmad/` 目录；③ 平台适配器路径中的 agent 文件
**And** 展示完整清理计划，列出所有将删除的文件和目录
**And** 明确标出将被**保留**的文件：MEMORY.md、USER.md、memory/ 目录
**And** 等待用户确认后执行删除
**And** 删除完成后输出清理结果摘要：已删除 N 个文件、已保留 N 个用户数据文件
**And** 最后删除 `.bmad-init.json` 自身
**And** 进程以 exit code 0 退出

### AC2 — 备份模式

**Given** 传入 `--backup` 参数
**When** 执行 uninstall
**Then** 删除前将所有目标文件复制到 `.bmad-backup-{timestamp}/` 目录

### AC3 — 未安装场景

**Given** bmad-expert 未安装（无 `_bmad/` 也无 `.bmad-init.json`）
**When** 执行 `npx bmad-expert uninstall`
**Then** 输出："未检测到 bmad-expert 安装内容，无需卸载。"
**And** 进程以 exit code 7（NOT_INSTALLED）退出

### AC4 — --yes 跳过确认

**Given** `--yes` 参数传入
**When** 执行 uninstall
**Then** 跳过确认直接执行清理，仍输出清理结果摘要

### AC5 — CLI 帮助信息

**Given** `cli.js` 已注册 `uninstall` 子命令
**When** 执行 `npx bmad-expert uninstall --help`
**Then** 输出帮助信息，列出 `--yes`、`--backup`、`--json` 参数

### AC6 — 测试覆盖

**Given** `test/uninstaller.test.js` 覆盖以上场景
**When** 运行 `npm test`
**Then** 清理计划收集、用户数据保护、备份机制、exit code 测试全部通过

---

## Tasks / Subtasks

- [ ] Task 1: 新增 `NOT_INSTALLED` exit code 和 `E007` 错误码（AC3）
  - [ ] 1.1 在 `lib/exit-codes.js` 添加 `NOT_INSTALLED: 7`
  - [ ] 1.2 在 `cli.js` 的 `CODE_TO_EXIT` 映射添加 `E007: EXIT_CODES.NOT_INSTALLED`
  - [ ] 1.3 更新 `test/exit-codes.test.js` 覆盖新 exit code

- [ ] Task 2: 创建 `lib/uninstaller.js` 模块（AC1, AC2, AC3, AC4）
  - [ ] 2.1 实现 `collectUninstallTargets(cwd)` — 读取 `.bmad-init.json` 清单 + 检测 `_bmad/` 目录 + 通过 `adapter.getInstallPath()` 获取 agent 文件路径；返回 `UninstallPlan` 对象
  - [ ] 2.2 实现 `displayCleanupPlan(plan)` — 通过 `output.js` 展示将删除的文件列表，明确标出保留的用户数据文件（MEMORY.md、USER.md、memory/）
  - [ ] 2.3 实现 `backupFiles(plan, cwd)` — 将所有目标文件复制到 `.bmad-backup-{timestamp}/` 目录
  - [ ] 2.4 实现 `executeUninstall(plan)` — 逐项删除文件/目录，跳过用户数据路径；最后删除 `.bmad-init.json`
  - [ ] 2.5 实现 `uninstall(options)` 主函数 — 串联上述步骤：detectPlatform → collectTargets → displayPlan → (confirm) → (backup) → execute → summary
  - [ ] 2.6 处理未安装场景：无 `_bmad/` 且无 `.bmad-init.json` → throw BmadError('E007', ...)

- [ ] Task 3: 注册 `uninstall` 子命令到 `cli.js`（AC5）
  - [ ] 3.1 添加 `program.command('uninstall')` 及 `--yes`、`--backup`、`--json` 选项
  - [ ] 3.2 action handler 调用 `uninstaller.uninstall()`
  - [ ] 3.3 JSON 模式输出 `printJSON(result)`

- [ ] Task 4: 编写 `test/uninstaller.test.js`（AC6）
  - [ ] 4.1 完整安装 + init 的清理场景（验证 collectUninstallTargets 返回正确文件列表）
  - [ ] 4.2 用户数据保护验证（MEMORY.md、USER.md、memory/ 不在删除列表中）
  - [ ] 4.3 备份机制验证（--backup 时 fs.copy 被调用到正确目标路径）
  - [ ] 4.4 未安装场景验证（exit code 7，BmadError E007）
  - [ ] 4.5 --yes 模式验证（跳过确认直接执行）
  - [ ] 4.6 JSON 输出模式验证

---

## Dev Notes

### 架构约束（必须遵守）

- 文件操作**必须用 `fs-extra`**，禁止 native `fs`
- 错误抛出**必须用 `BmadError`**，禁止 `throw new Error()`
- 输出**必须通过 `output.js`**，禁止 `console.log` / `console.error`
- lib 模块**禁止调用 `process.exit()`**，仅 `cli.js` 可调用
- **命名导出**（named exports），禁止 `export default`
- 路径解析通过 `adapter.getInstallPath()`，禁止硬编码
- lib 函数返回结构化数据对象，供 `cli.js` 的 JSON 模式消费

### 参考模式 — 以 `lib/updater.js` 为蓝本

`uninstaller.js` 应遵循 `updater.js` 相同的代码结构模式：
1. 通过 `detectPlatform()` + `getAdapter()` 获取平台适配器
2. 通过 `adapter.getInstallPath(agentId)` 获取 agent 安装路径
3. 从 `package.json` 的 `bmadExpert.frameworkFiles` 和 `bmadExpert.userDataPaths` 读取文件/路径清单
4. 使用 `printProgress(msg)` / `printProgress('', true)` 控制进度输出
5. 使用 `printSuccess(msg)` 输出完成信息
6. 返回 `{ deleted, preserved, backedUp, message }` 结构化结果

### 用户数据保护列表（`package.json` → `bmadExpert.userDataPaths`）

```
MEMORY.md, USER.md, memory/
```

这些文件/目录即使出现在清理目标中也**必须跳过**，并在摘要中明确提示"已保留"。

### 清理目标收集逻辑

| 来源 | 清理目标 | 检测依据 |
|------|----------|----------|
| install | `_bmad/` 目录 | 目录存在性检查 |
| install | agent 补充文件（SOUL.md 等） | `adapter.getInstallPath()` + `frameworkFiles` |
| init | CLAUDE.md、workflow 文件 | `.bmad-init.json` 清单 |
| init | `.bmad-init.json` 自身 | 固定位置 |

### 新增 Exit Code

| Code | 常量名 | 含义 |
|------|--------|------|
| 7 | `NOT_INSTALLED` | uninstall 检测到无安装内容 |

### 新增 BmadError Code

| Code | 含义 | 映射 exit code |
|------|------|---------------|
| E007 | 未检测到安装内容 | NOT_INSTALLED (7) |

### 数据流

```
npx bmad-expert uninstall [--yes] [--backup] [--json]
  → cli.js（参数解析）
  → uninstaller.js / uninstall(options)
    → detectPlatform() + getAdapter()
    → collectUninstallTargets(cwd)
      → 读取 .bmad-init.json（若存在）
      → 检测 _bmad/ 目录
      → 通过 adapter 获取 agent 文件路径
      → 过滤掉 userDataPaths（MEMORY.md, USER.md, memory/）
      → 返回 UninstallPlan { toDelete[], toPreserve[], hasManifest, hasBmadDir }
    → displayCleanupPlan(plan)  ← 通过 output.js
    → (非 --yes 模式) confirmUninstall()  ← 用户确认
    → (--backup 模式) backupFiles(plan, cwd)
    → executeUninstall(plan)
      → 逐项 fs.remove()
      → 最后 fs.remove('.bmad-init.json')
    → return { deleted: N, preserved: N, backedUp: bool, message }
  → cli.js: printJSON(result) 或 printSuccess(message)
```

### 测试模式（与 `updater.test.js` / `installer.test.js` 一致）

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(), readJson: vi.fn(),
    pathExists: vi.fn(), remove: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined), readdir: vi.fn(),
  },
}))

// Mock platform.js
vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn().mockReturnValue({
    getInstallPath: vi.fn().mockReturnValue('/home/user/.happycapy/agents/bmad-expert'),
  }),
}))

// Mock output.js
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(), printSuccess: vi.fn(),
}))
```

### Project Structure Notes

- 新文件路径：`lib/uninstaller.js`、`test/uninstaller.test.js`
- 修改文件：`lib/exit-codes.js`（新增 NOT_INSTALLED）、`cli.js`（新增 uninstall 命令 + CODE_TO_EXIT 映射）、`test/exit-codes.test.js`
- 命名规范：kebab-case（`uninstaller.js`，非 `unInstaller.js`）
- 测试在 `test/` 集中目录，不与源码并列

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Uninstall Command Architecture]
- [Source: _bmad-output/planning-artifacts/prd.md#FR61-FR63]
- [Source: lib/updater.js — 参考模式]
- [Source: lib/installer.js — 了解安装产物]
- [Source: lib/initializer.js — 了解 init 产物和 .bmad-init.json 结构]
- [Source: lib/exit-codes.js — 现有 exit code 定义]
- [Source: package.json#bmadExpert — frameworkFiles 和 userDataPaths]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

Ultimate context engine analysis completed — comprehensive developer guide created

### File List

(to be filled by dev agent)
