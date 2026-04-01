# Story 6.2: status 命令与安装健康度检查

Status: review

## Story

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert status` 查看当前安装状态,
so that 我可以在不执行安装的情况下确认 bmad-expert 是否正确安装且运行健康。

## Acceptance Criteria

1. **Given** bmad-expert 已正确安装（installPath 存在且所有 frameworkFiles 齐全）
   **When** 执行 `npx bmad-expert status`
   **Then** stdout 输出：当前安装版本（来自 package.json）、安装路径、frameworkFiles 完整性检查结果（每个文件标注 ✓ 存在 或 ✗ 缺失）
   **And** 进程以 exit code 0（SUCCESS）退出

2. **Given** bmad-expert 未安装（installPath 不存在）
   **When** 执行 `npx bmad-expert status`
   **Then** stdout 输出状态为 `not_installed`，并给出修复建议（运行 `npx bmad-expert install`）
   **And** 进程以非零 exit code（GENERAL_ERROR = 1）退出

3. **Given** bmad-expert 安装损坏（installPath 存在但部分 frameworkFiles 缺失）
   **When** 执行 `npx bmad-expert status`
   **Then** stdout 输出状态为 `corrupted`，列出缺失文件，并给出修复建议（运行 `npx bmad-expert install` 重装）
   **And** 进程以非零 exit code（GENERAL_ERROR = 1）退出

4. **Given** 执行 `npm test`
   **When** 测试运行
   **Then** `test/checker.test.js` 中所有用例通过（覆盖：已安装、未安装、损坏状态、文件逐一检查）

## Tasks / Subtasks

- [x] 创建 `lib/checker.js`，实现具名导出 `checkStatus(options)` 函数 (AC: #1, #2, #3)
  - [x] 读取 package.json 获取 `version` 和 `frameworkFiles`
  - [x] 调用 `detectPlatform` + `getAdapter` 获取 `installPath`（复用 platform.js）
  - [x] 检查 installPath 是否存在（`fs.pathExists`）
  - [x] 若不存在 → 输出 not_installed 状态 + 修复建议，抛出 `BmadError('E001', ...)` 携带 exitCode 语义
  - [x] 若存在 → 逐一检查每个 frameworkFile 是否存在（`fs.pathExists`）
  - [x] 构建检查结果列表（`{ file, exists }[]`）
  - [x] 通过 `printSuccess` 输出格式化状态报告（版本、路径、文件列表）
  - [x] 若有缺失文件 → 额外输出 corrupted 提示与修复建议，抛出 `BmadError('E001', ...)`
- [x] 修改 `cli.js`：import `checkStatus` 并替换 status 命令占位 action (AC: #1, #2, #3)
  - [x] 增加 `--platform <name>` 和 `--agent-id <id>` 选项（与 install/update 一致）
  - [x] 在 action 中调用 `checkStatus(options)`，不处理异常（交给顶层 catch）
- [x] 创建 `test/checker.test.js`，覆盖所有关键场景 (AC: #4)
  - [x] 已安装：所有文件存在 → printSuccess 含版本号和安装路径，无异常抛出
  - [x] 未安装：installPath 不存在 → 抛出 BmadError E001，printSuccess 含 not_installed
  - [x] 损坏：部分文件缺失 → 抛出 BmadError E001，printSuccess 含 corrupted 及缺失文件名
  - [x] 完整性检查：所有 frameworkFiles 均被 fs.pathExists 检查

## Dev Notes

### 架构约束（必须遵守，否则破坏架构一致性）

1. **文件操作**：必须使用 `fs-extra`（`import fs from 'fs-extra'`），禁止原生 `fs`
2. **外部进程**：`checker.js` 不调用任何外部命令
3. **错误**：必须使用 `BmadError`，禁止 `throw new Error()`
4. **输出**：必须通过 `output.js` 的 `printProgress` / `printSuccess`，禁止 `console.log`
5. **路径**：必须通过 `adapter.getInstallPath(agentId)` 获取安装路径，禁止硬编码
6. **退出码**：禁止 `process.exit()` 在 lib 模块内，由 cli.js 顶层 catch 处理
7. **导出风格**：具名导出（Named Export），禁止 default export
8. **注意**：非零退出使用 `GENERAL_ERROR(1)`——exit-codes.js 无专用 `UNHEALTHY` 码，勿新增

### 核心数据来源

**`version` 和 `frameworkFiles` 从 `package.json` 读取（与 updater.js 保持一致）：**

```javascript
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkg = JSON.parse(await fs.readFile(join(__dirname, '../package.json'), 'utf8'))
const version = pkg.version
const frameworkFiles = pkg.bmadExpert.frameworkFiles
// → ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md", "bmad-project-init.md"]
```

**当前 `package.json` 中的实际值：**

```json
"bmadExpert": {
  "frameworkFiles": ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md", "bmad-project-init.md"],
  "userDataPaths": ["MEMORY.md", "USER.md", "memory/"]
}
```

### 平台检测复用

```javascript
import { detectPlatform, getAdapter } from './platform.js'

const platformName = await detectPlatform(options.platform ?? null)
const adapter = getAdapter(platformName)
const installPath = adapter.getInstallPath(options.agentId ?? 'bmad-expert')
```

### 输出消息格式

**已安装且健康（exit 0，通过 printSuccess）：**

```
bmad-expert 安装状态
版本：v0.1.0
安装路径：/home/user/.happycapy/agents/bmad-expert

文件完整性检查：
  ✓ SOUL.md
  ✓ IDENTITY.md
  ✓ AGENTS.md
  ✓ BOOTSTRAP.md
  ✓ bmad-project-init.md

状态：healthy
```

**未安装（exit 1，通过 printSuccess 输出状态，然后 throw BmadError E001）：**

```
bmad-expert 安装状态

状态：not_installed
修复建议：运行 npx bmad-expert install 完成安装
```

**损坏（exit 1，通过 printSuccess 输出状态，然后 throw BmadError E001）：**

```
bmad-expert 安装状态
版本：v0.1.0
安装路径：/home/user/.happycapy/agents/bmad-expert

文件完整性检查：
  ✓ SOUL.md
  ✗ IDENTITY.md（缺失）
  ✓ AGENTS.md
  ✗ BOOTSTRAP.md（缺失）
  ✓ bmad-project-init.md

状态：corrupted（2 个文件缺失）
修复建议：运行 npx bmad-expert install 重新安装
```

### cli.js 修改

将现有占位 action 替换为（参考 update 命令结构）：

```javascript
import { checkStatus } from './lib/checker.js'

program
  .command('status')
  .description('检查当前安装健康度（Growth）')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .action(async (options) => {
    await checkStatus({
      platform: options.platform ?? null,
      agentId: options.agentId,
    })
  })
```

cli.js 顶层 catch 已支持 BmadError → GENERAL_ERROR，无需修改顶层逻辑。

### BmadError 抛出规范

- 非零退出时：`throw new BmadError('E001', '状态检查：xxx', null, ['修复建议'])`
- E001 对应 `GENERAL_ERROR(1)`，参见 cli.js 中 `CODE_TO_EXIT` 映射

### Project Structure Notes

**新增文件：**

```
lib/checker.js          ← 新建，status 检查逻辑
test/checker.test.js    ← 新建，单元测试
```

**修改文件：**

```
cli.js                  ← 实现 status command action，新增 import { checkStatus }
```

**不修改文件（避免回归）：**

```
lib/exit-codes.js       ← 不新增 exit code，用 GENERAL_ERROR(1)
lib/installer.js        ← 不修改
lib/updater.js          ← 不修改
lib/platform.js         ← 仅 import
lib/output.js           ← 仅 import
lib/errors.js           ← 仅 import
```

### 测试规范（与已有测试保持一致，参考 updater.test.js）

**mock 模式：**

```javascript
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    pathExists: vi.fn(),
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
```

**package.json 内容 mock（在 beforeEach 中设置）：**

```javascript
const fsMock = (await import('fs-extra')).default
fsMock.readFile.mockImplementation((p) => {
  if (String(p).includes('package.json')) {
    return Promise.resolve(JSON.stringify({
      version: '0.1.0',
      bmadExpert: {
        frameworkFiles: ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md'],
        userDataPaths: ['MEMORY.md', 'USER.md', 'memory/'],
      },
    }))
  }
  return Promise.resolve('')
})
```

**测试套件骨架：**

```javascript
describe('checkStatus', () => {
  describe('已安装状态（healthy）', () => {
    it('所有文件存在时不抛出异常', ...)
    it('printSuccess 含版本号', ...)
    it('printSuccess 含安装路径', ...)
    it('printSuccess 含 healthy 或每个文件名', ...)
    it('对每个 frameworkFile 调用 fs.pathExists', ...)
  })
  describe('未安装状态（not_installed）', () => {
    it('installPath 不存在时抛出 BmadError E001', ...)
    it('printSuccess 含 not_installed', ...)
    it('printSuccess 含修复建议', ...)
  })
  describe('损坏状态（corrupted）', () => {
    it('部分文件缺失时抛出 BmadError E001', ...)
    it('printSuccess 含 corrupted', ...)
    it('printSuccess 含缺失文件名', ...)
  })
})
```

### References

- Story 6.2 定义: [Source: `_bmad-output/planning-artifacts/epics.md` → Epic 6, Story 6.2]
- 强制规则 6 条: [Source: `lib/updater.js` → 文件顶部注释]
- frameworkFiles/userDataPaths: [Source: `package.json` → `bmadExpert`]
- 退出码映射: [Source: `cli.js` → `CODE_TO_EXIT`]
- 测试结构规范: [Source: `test/updater.test.js`]
- 现有 cli.js status 占位: [Source: `cli.js:48-53`]
- detectPlatform/getAdapter 复用: [Source: `lib/updater.js:61-66`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 新建 `lib/checker.js`：实现 `checkStatus(options)` 具名导出，支持 healthy / not_installed / corrupted 三种状态，通过 `printSuccess` 输出到 stdout，非健康状态通过 BmadError E001 触发 exit 1
- 修改 `cli.js`：import `checkStatus`，替换 status 命令占位 action，增加 `--platform` 和 `--agent-id` 选项
- 新建 `test/checker.test.js`：17 个用例，覆盖 healthy / not_installed / corrupted 所有分支及 platform 透传，全部通过
- 全套回归测试：154/154 通过，无回归

### File List

- lib/checker.js（新建）
- cli.js（修改）
- test/checker.test.js（新建）
- _bmad-output/implementation-artifacts/6-2-status-command-health-check.md（修改）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）
