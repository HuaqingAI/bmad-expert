# Story 6.1: update 命令与用户数据保护

Status: done

## Story

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert update` 时框架文件被升级，用户 memory 和个性化配置完整保留,
so that 我可以获得新版本功能，同时积累的使用上下文一条不丢。

## Acceptance Criteria

1. **Given** 已安装 bmad-expert v1.0，执行 `npx bmad-expert update`
   **When** 更新流程运行
   **Then** `frameworkFiles`（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md、bmad-project-init.md）被 `agent/` 目录的新版本覆盖
   **And** `userDataPaths`（MEMORY.md、USER.md、memory/ 目录）完整保留，内容不变（FR38）
   **And** 用户自添加的非白名单文件不被触碰
   **And** update 前自动备份用户数据至系统临时目录（FR37）
   **And** 完成后 stdout 输出："已更新至 vX.X.X，用户配置和 memory 完整保留。"（X.X.X = package.json 的版本号）

2. **Given** update 过程中出现文件写入异常（如权限拒绝 E004）
   **When** 更新中断
   **Then** 自动从备份恢复用户数据，不残留损坏状态
   **And** stderr 输出结构化错误信息（BmadError E004 格式），含恢复步骤

3. **Given** 执行 `npm test`
   **When** 测试运行
   **Then** `test/updater.test.js` 中所有用例通过（覆盖：成功更新、用户数据保留、备份恢复、异常回滚）

## Tasks / Subtasks

- [x] 创建 `lib/updater.js`，实现 `update(options)` 函数 (AC: #1, #2)
  - [x] 读取 package.json 获取 `frameworkFiles` 和 `userDataPaths`
  - [x] 通过 `detectPlatform` + `getAdapter` 获取安装路径（复用 platform.js）
  - [x] 备份 `userDataPaths` 至系统临时目录
  - [x] 将 `frameworkFiles` 从 `agent/` 目录覆盖至安装路径（含模板变量替换）
  - [x] 异常时从备份恢复 `userDataPaths`，然后 rethrow
  - [x] 成功后清理临时备份，输出完成消息
- [x] 修改 `cli.js`：实现 `update` 命令 action，import 并调用 `update()` (AC: #1, #2)
- [x] 创建 `test/updater.test.js`，覆盖所有关键场景 (AC: #3)
  - [x] 成功路径：framework files 覆盖，user data 不变
  - [x] 异常路径：写入失败时触发回滚，从备份恢复 user data
  - [x] 备份路径：update 前备份已创建
  - [x] 非白名单文件：不被触碰

## Dev Notes

### 关键约束（必须遵守，否则破坏架构一致性）

1. **文件操作**：必须使用 `fs-extra`（`import fs from 'fs-extra'`），禁止原生 `fs`
2. **外部进程**：禁止在 updater.js 中调用外部命令（update 不做平台注册）
3. **错误**：必须使用 `BmadError`，禁止 `throw new Error()`
4. **输出**：必须通过 `output.js` 的 `printProgress` / `printSuccess`，禁止 `console.log`
5. **路径**：必须通过 `adapter.getInstallPath(agentId)` 获取安装路径，禁止硬编码
6. **退出码**：禁止 `process.exit()` 在 lib 模块内，由 cli.js 顶层 catch 处理
7. **导出风格**：具名导出（Named Export），禁止 default export

### 核心数据来源

**`frameworkFiles` 和 `userDataPaths` 从 `package.json` 读取：**

```javascript
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// package.json 在 lib/ 的上一级
const pkg = JSON.parse(await fs.readFile(join(__dirname, '../package.json'), 'utf8'))
const FRAMEWORK_FILES = pkg.bmadExpert.frameworkFiles
// → ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md", "bmad-project-init.md"]
const USER_DATA_PATHS = pkg.bmadExpert.userDataPaths
// → ["MEMORY.md", "USER.md", "memory/"]
```

**当前 `package.json` 中的实际值（参考 installer.js 保持一致）：**

```json
"bmadExpert": {
  "frameworkFiles": ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md", "bmad-project-init.md"],
  "userDataPaths": ["MEMORY.md", "USER.md", "memory/"]
}
```

### 模板目录

```javascript
// 与 installer.js 相同的路径模式
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')
```

### 平台检测复用

```javascript
import { detectPlatform, getAdapter } from './platform.js'

// update 支持 --platform 覆盖（与 install 一致）
const platformName = await detectPlatform(options.platform ?? null)
const adapter = getAdapter(platformName)
const installPath = adapter.getInstallPath(options.agentId ?? 'bmad-expert')
```

### 备份策略

```javascript
import os from 'os'

// 系统临时目录下唯一子目录
const backupDir = join(os.tmpdir(), `bmad-expert-backup-${Date.now()}`)
// 备份后标记：backupCreated = true
// 回滚：for each path in USER_DATA_PATHS → fs.copy(src=backupPath, dest=installPath)
// 成功清理：fs.remove(backupDir)
```

**备份时只备份存在的 `userDataPaths`**（用户未必每项都有），使用 `fs.pathExists` 检查后再 copy。

### 模板变量替换

**复用 `installer.js` 中已有的 `replaceTemplateVars` 函数（具名导出，直接 import）：**

```javascript
import { replaceTemplateVars } from './installer.js'
```

更新时的变量值：

```javascript
const vars = {
  agentId,                          // 来自 options.agentId 或默认 'bmad-expert'
  agentName: agentId,               // 与 install 一致
  model: '',
  installDate: new Date().toISOString().slice(0, 10),  // 更新日期
}
```

### cli.js 修改

将现有占位 action 替换为：

```javascript
import { update } from './lib/updater.js'

program
  .command('update')
  .description('安全更新框架文件，保留用户 memory 与个性化配置（Growth）')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .action(async (options) => {
    await update({
      platform: options.platform ?? null,
      agentId: options.agentId,
    })
  })
```

cli.js 顶层 catch 已支持 BmadError，无需修改。

### 输出消息格式

**成功（stdout）：**

```
正在检测平台... ✓
正在备份用户数据... ✓
正在更新框架文件... ✓
（调用 printSuccess）
已更新至 v0.1.0，用户配置和 memory 完整保留。
```

**异常回滚（printProgress + 再 rethrow，让 cli.js 处理 stderr）：**

```
正在恢复用户数据... ✓
```

（rethrow BmadError，由 cli.js 顶层 catch 调用 printError 输出 stderr）

### Project Structure Notes

**新增文件：**

```
lib/updater.js          ← 新建，update 编排逻辑
test/updater.test.js    ← 新建，单元测试
```

**修改文件：**

```
cli.js                  ← 实现 update command action，新增 import { update }
```

**不修改文件（避免回归）：**

```
lib/installer.js        ← 仅 import replaceTemplateVars
lib/platform.js         ← 仅 import
lib/output.js           ← 仅 import
lib/errors.js           ← 仅 import
package.json            ← 不修改（bmadExpert 字段已正确）
test/installer.test.js  ← 不修改
```

### 测试规范（与已有测试保持一致）

**mock 模式（参考 installer.test.js）：**

```javascript
// vitest.mock 自动 hoist
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    copy: vi.fn().mockResolvedValue(undefined),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    outputFile: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),  // 用于读 package.json
  },
}))

vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn().mockReturnValue({
    getInstallPath: vi.fn().mockReturnValue('/home/user/.happycapy/agents/bmad-expert'),
  }),
}))

vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
}))

// 注意：mock installer.js 中的 replaceTemplateVars
vi.mock('../lib/installer.js', () => ({
  replaceTemplateVars: vi.fn((content) => content),
}))
```

**package.json 内容 mock（在 beforeEach 中设置）：**

```javascript
const fsMock = (await import('fs-extra')).default
fsMock.readFile.mockImplementation((p) => {
  if (p.includes('package.json')) {
    return Promise.resolve(JSON.stringify({
      version: '0.1.0',
      bmadExpert: {
        frameworkFiles: ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md'],
        userDataPaths: ['MEMORY.md', 'USER.md', 'memory/'],
      },
    }))
  }
  return Promise.resolve('template content')
})
```

**测试套件骨架：**

```javascript
describe('update', () => {
  it('成功路径：按顺序调用备份、覆盖框架文件、清理备份', ...)
  it('成功路径：user data 路径不在 outputFile 调用中', ...)
  it('成功路径：printSuccess 含版本号', ...)
  it('异常路径：框架文件写入失败时触发回滚（fs.copy 恢复 user data）', ...)
  it('异常路径：回滚后 rethrow 原始 BmadError', ...)
  it('备份路径：update 开始前先调用 fs.copy 备份', ...)
})
```

### References

- 文件分层契约: [Source: `_bmad-output/planning-artifacts/architecture.md` → "文件分层契约"]
- 强制规则 6 条: [Source: `_bmad-output/planning-artifacts/architecture.md` → "执行规范"]
- frameworkFiles/userDataPaths: [Source: `package.json` → `bmadExpert`]
- 命名规范: [Source: `_bmad-output/planning-artifacts/architecture.md` → "命名规范"]
- 测试结构规范: [Source: `_bmad-output/planning-artifacts/architecture.md` → "结构规范"]
- 现有测试模式参考: [Source: `test/installer.test.js`]
- replaceTemplateVars 可复用: [Source: `lib/installer.js#replaceTemplateVars`]
- 现有 cli.js update 占位: [Source: `cli.js:36-41`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 新建 `lib/updater.js`：实现 `update()` 函数，含平台检测、用户数据备份、框架文件覆盖、异常回滚（BmadError E004/E001）、成功清理。复用 `platform.js`、`installer.js#replaceTemplateVars`、`output.js`。
- 修改 `cli.js`：import `update`，将 update 命令的占位 action 替换为完整实现，增加 `--platform` 和 `--agent-id` 选项。
- 新建 `test/updater.test.js`：15 个测试用例，覆盖成功路径（6）、备份路径（3）、异常路径（6），全部通过。
- 全部 7 个测试文件 121 个用例通过，无回归。

### File List

- lib/updater.js（新建）
- cli.js（修改）
- test/updater.test.js（新建）
- _bmad-output/implementation-artifacts/6-1-update-command-data-protection.md（新建）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）
