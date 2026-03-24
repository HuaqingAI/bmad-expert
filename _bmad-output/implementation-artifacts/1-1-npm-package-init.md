# Story 1.1: npm 包初始化与完整项目结构搭建

Status: review

## Story

As a 开发者（AI agent）,
I want 一个完整的 npm 包项目骨架（目录结构、精确版本依赖、ESM 配置、代码质量工具）,
so that 后续所有故事可以在确定的技术基础上直接落地代码，无需重新做工程决策。

## Acceptance Criteria

1. **Given** 一个空目录
   **When** 执行项目初始化（npm init + 依赖安装 + 目录创建）
   **Then** 生成完整目录结构：`cli.js`、`lib/`（errors.js、exit-codes.js、output.js、platform.js、installer.js、adapters/）、`agent/`（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 占位文件）、`test/`（含 integration/ 子目录）、`.github/workflows/`

2. **Given** `package.json` 已创建
   **When** 检查其内容
   **Then** 包含：`"type": "module"`、`"bin": {"bmad-expert": "./cli.js"}`、精确版本运行依赖（commander@14.0.3、execa@9.6.1、fs-extra@11.3.4、chalk@5.6.2）、精确版本开发依赖（vitest@4.1.1、eslint、prettier）；还包含 `"engines": {"node": ">=20.19.0"}`；以及 `"bmadExpert"` 文件分层配置字段

3. **Given** `package-lock.json` 已生成
   **When** 检查所有依赖条目
   **Then** 所有依赖版本无 `^`、`~` 浮动范围（package.json 中以精确版本号声明）

4. **Given** 配置文件已创建
   **When** 检查根目录
   **Then** `.eslintrc.js`、`.prettierrc`、`vitest.config.js`、`.gitignore` 均存在且内容有效

5. **Given** `cli.js` 已实现 Commander.js 入口骨架
   **When** 执行 `node cli.js --help`
   **Then** 输出帮助信息，不报错，进程以 exit code 0 退出

6. **Given** 项目结构已完整建立
   **When** 执行 `npm test`（vitest）
   **Then** 运行无报错（即使无测试用例也返回 exit 0）

## Tasks / Subtasks

- [x] 初始化 npm 包并配置 package.json (AC: #2)
  - [x] 创建项目目录 `bmad-expert/`，执行 `npm init -y`
  - [x] 更新 package.json：添加 `"type": "module"`、`"bin"`、`"engines"`、`"scripts"` 字段
  - [x] 添加 `"bmadExpert"` 文件分层配置字段（frameworkFiles + userDataPaths）
  - [x] 安装精确版本运行依赖：`npm install --save-exact commander@14.0.3 execa@9.6.1 fs-extra@11.3.4 chalk@5.6.2`
  - [x] 安装精确版本开发依赖：`npm install --save-dev --save-exact vitest@4.1.1 eslint prettier`

- [x] 创建完整目录结构 (AC: #1)
  - [x] 创建 `lib/` 目录，创建空文件：`errors.js`、`exit-codes.js`、`output.js`、`platform.js`、`installer.js`
  - [x] 创建 `lib/adapters/` 目录，创建空文件：`happycapy.js`、`cursor.js`、`claude-code.js`
  - [x] 创建 `agent/` 目录，创建占位文件：`SOUL.md`、`IDENTITY.md`、`AGENTS.md`、`BOOTSTRAP.md`
  - [x] 创建 `test/` 目录及 `test/integration/` 子目录，创建 `test/fixtures/mock-agent/` 目录
  - [x] 创建 `.github/workflows/` 目录

- [x] 实现 cli.js Commander.js 入口骨架 (AC: #5)
  - [x] 创建 `cli.js`，添加 shebang `#!/usr/bin/env node`
  - [x] 导入 commander，创建 `program` 实例，设置包名、版本、描述
  - [x] 添加 `install` 子命令占位（`--platform`、`--agent-id`、`--yes` 参数）
  - [x] 添加 `update`、`status` 子命令占位（Growth 阶段，标注 TODO）
  - [x] 添加顶层异步错误捕获 `program.parseAsync().catch(err => { ... process.exit(1) })`
  - [x] 验证 `node cli.js --help` 正常输出

- [x] 创建代码质量配置文件 (AC: #4)
  - [x] 创建 `eslint.config.js`（ESLint 9+ flat config，eslint:recommended + es2022 + Node 20.19+ globals）
  - [x] 创建 `.prettierrc`（singleQuote: true, semi: false, printWidth: 100）
  - [x] 创建 `vitest.config.js`（配置 ESM 支持，passWithNoTests: true，测试文件模式 test/**/*.test.js）
  - [x] 创建 `.gitignore`（node_modules/、*.log、.DS_Store、coverage/、dist/）

- [x] 验证项目可运行 (AC: #3, #6)
  - [x] 确认 package.json 中所有依赖使用精确版本（无 `^`、`~`）
  - [x] 执行 `npm test`，确认 vitest 运行无报错（0 tests = exit 0）
  - [x] 执行 `node cli.js --help`，确认帮助信息正常输出

## Dev Notes

### 关键技术约束（必须遵守）

**模块系统：ESM Only**
- `package.json` 必须包含 `"type": "module"`
- 所有文件使用 `import`/`export`，禁止 `require()`/`module.exports`
- `cli.js` 开头用 `import { Command } from 'commander'` 而非 `const { Command } = require(...)`

**精确版本依赖（无浮动范围）**
```json
{
  "dependencies": {
    "commander": "14.0.3",
    "execa": "9.6.1",
    "fs-extra": "11.3.4",
    "chalk": "5.6.2"
  },
  "devDependencies": {
    "vitest": "4.1.1",
    "eslint": "<精确版本>",
    "prettier": "<精确版本>"
  }
}
```
> 使用 `--save-exact` flag 安装，避免版本范围符号。

**package.json 必须包含的完整字段**
```json
{
  "name": "bmad-expert",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bmad-expert": "./cli.js"
  },
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "bmadExpert": {
    "frameworkFiles": ["SOUL.md", "IDENTITY.md", "AGENTS.md", "BOOTSTRAP.md"],
    "userDataPaths": ["MEMORY.md", "USER.md", "memory/"]
  }
}
```

**cli.js 入口骨架模式**
```javascript
#!/usr/bin/env node
import { Command } from 'commander'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const program = new Command()

program
  .name('bmad-expert')
  .description('BMAD Agent 安装器与新手教练')
  .version(pkg.version)

program
  .command('install')
  .description('平台感知完整安装 BMAD agent')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '非交互模式，跳过所有确认提示')
  .action(async (options) => {
    // TODO: Story 2.x 实现
    console.log('install command - to be implemented')
  })

// Growth 阶段占位（勿实现逻辑）
program.command('update').description('安全更新框架文件（Growth）').action(() => {})
program.command('status').description('检查安装健康度（Growth）').action(() => {})

program.parseAsync().catch(err => {
  console.error(err.message)
  process.exit(1)
})
```

**各 lib/ 占位文件的初始内容模式**（本故事仅建立文件，不实现逻辑）
```javascript
// lib/exit-codes.js - 占位，Story 1.2 实现
export const EXIT_CODES = {}

// lib/errors.js - 占位，Story 1.2 实现
export class BmadError extends Error {}

// lib/output.js - 占位，Story 1.3 实现
export function printProgress(msg) {}
export function printSuccess(msg) {}
export function printError(err) {}

// lib/platform.js - 占位，Story 2.1 实现
export async function detectPlatform() {}

// lib/installer.js - 占位，Story 2.x 实现
export async function install(options) {}
```

**agent/ 占位文件内容**（最小化，后续故事替换为完整模板）
```markdown
<!-- PLACEHOLDER: Story 4.x 将替换此文件为完整模板 -->
<!-- Template variables: {{agent_id}}, {{agent_name}}, {{install_date}} -->
```

**vitest.config.js 配置**
```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
})
```

**`.eslintrc.js` 配置**（ESM 格式，Commander v14 + Node 20.19+）
```javascript
export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]
```
> 注意：ESLint 9+ 使用 flat config（`eslint.config.js`，非 `.eslintrc.js`）。根据安装的 eslint 版本选择正确格式。若 eslint@9+，文件名应为 `eslint.config.js`。

### 完整项目目录结构（本故事交付目标）

```
bmad-expert/
├── package.json               ✅ 含 type:module, bin, engines, bmadExpert 字段
├── package-lock.json          ✅ 精确版本锁定（npm install 自动生成）
├── cli.js                     ✅ Commander 入口骨架（--help 可用）
├── lib/
│   ├── errors.js              ✅ 占位（空 export）
│   ├── exit-codes.js          ✅ 占位（空 export）
│   ├── output.js              ✅ 占位（空 export）
│   ├── platform.js            ✅ 占位（空 export）
│   ├── installer.js           ✅ 占位（空 export）
│   └── adapters/
│       ├── happycapy.js       ✅ 占位（空 export）
│       ├── cursor.js          ✅ 占位（空 export）
│       └── claude-code.js     ✅ 占位（空 export）
├── agent/
│   ├── SOUL.md                ✅ 占位（含 {{variable}} 说明注释）
│   ├── IDENTITY.md            ✅ 占位
│   ├── AGENTS.md              ✅ 占位
│   └── BOOTSTRAP.md           ✅ 占位
├── test/
│   ├── fixtures/
│   │   └── mock-agent/        ✅ 空目录（放 .gitkeep）
│   └── integration/           ✅ 空目录（放 .gitkeep）
├── .github/
│   └── workflows/             ✅ 空目录（放 .gitkeep，Story 1.4 实现）
├── .eslintrc.js / eslint.config.js  ✅
├── .prettierrc                ✅
├── vitest.config.js           ✅
├── .gitignore                 ✅
└── README.md                  ✅ 最小占位（Story 5.1 完善）
```

### 架构守则（后续故事必须遵守，本故事建立基础）

1. **命名规范**：文件名 kebab-case.js，函数/变量 camelCase，常量 UPPER_SNAKE_CASE
2. **导出规范**：具名导出（Named Exports），**禁止** `export default`
3. **异步规范**：全部 `async/await`，**禁止** `.then()/.catch()` 链式
4. **输出规范**：所有输出通过 `output.js` 路由，**禁止** 直接 `console.log`
5. **错误规范**：所有错误使用 `BmadError`，**禁止** 直接 `throw new Error()`
6. **文件操作**：必须使用 `fs-extra`，**禁止** 原生 `fs`
7. **进程调用**：必须使用 `execa`，**禁止** `child_process`

> 本故事为脚手架故事，上述规则在占位文件中可暂不完全实施，但**必须**在文件头注释中标注这些约束，供后续故事开发者参考。

### 关键验证点

- `node cli.js --help` 必须输出帮助并以 exit 0 退出
- `npm test` 必须以 exit 0 退出（vitest 无测试用例时不报错）
- `package.json` 中所有 dependencies/devDependencies 版本号无 `^`、`~`
- `"type": "module"` 必须存在

### Project Structure Notes

- 本故事是所有后续故事的基础，**必须先完成**，其他故事直接在此目录结构上落代码
- `lib/adapters/` 目录结构支持平台适配器接口契约（Story 2.1 开始实现）
- `agent/` 目录中的占位文件在 Story 2.2 替换为带变量的完整模板
- `.github/workflows/` 目录在 Story 1.4 添加 CI/CD 配置
- Growth 阶段命令（update/status）在 cli.js 中以空 action 占位，不实现逻辑

### References

- 架构文档 技术栈选型：[Source: _bmad-output/planning-artifacts/architecture.md#启动模板评估]
- 架构文档 完整目录结构：[Source: _bmad-output/planning-artifacts/architecture.md#完整项目目录结构]
- 架构文档 命名/导出/异步规范：[Source: _bmad-output/planning-artifacts/architecture.md#实现模式与一致性规则]
- 架构文档 文件分层契约：[Source: _bmad-output/planning-artifacts/architecture.md#文件分层契约]
- Epic 1 Story 1.1 验收标准：[Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]
- PRD FR28、FR31：[Source: _bmad-output/planning-artifacts/prd.md#CLI-接口与可发现性]
- PRD NFR4、NFR13：[Source: _bmad-output/planning-artifacts/prd.md#非功能需求]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- vitest 4.1.1 无测试文件时默认退出 code 1，需在 vitest.config.js 添加 `passWithNoTests: true` 解决（AC #6）
- ESLint 9.24.0 使用 flat config 格式，配置文件为 `eslint.config.js` 而非 `.eslintrc.js`（AC #4 差异点）
- 首次 `npm install --save-exact` 仅安装生产依赖，需用 `npm install --include=dev` 安装全部依赖

### Completion Notes List

- ✅ AC#1: 完整目录结构已建立（cli.js, lib/, lib/adapters/, agent/, test/integration/, test/fixtures/mock-agent/, .github/workflows/）
- ✅ AC#2: package.json 包含所有必填字段（type:module, bin, engines, scripts, bmadExpert 分层配置）
- ✅ AC#3: 所有依赖版本精确无浮动范围（chalk:5.6.2, commander:14.0.3, execa:9.6.1, fs-extra:11.3.4, vitest:4.1.1, eslint:9.24.0, prettier:3.5.3）
- ✅ AC#4: eslint.config.js（flat config）、.prettierrc、vitest.config.js、.gitignore 均已创建并有效
- ✅ AC#5: `node cli.js --help` 正常输出，exit code 0
- ✅ AC#6: `npm test` 返回 exit 0（passWithNoTests: true 配置）
- 所有 lib/ 占位文件包含架构守则注释，供后续故事开发者参考
- Growth 命令（update/status）在 cli.js 中以空 action 占位

### File List

- package.json
- package-lock.json
- cli.js
- eslint.config.js
- .prettierrc
- vitest.config.js
- .gitignore
- lib/exit-codes.js
- lib/errors.js
- lib/output.js
- lib/platform.js
- lib/installer.js
- lib/adapters/happycapy.js
- lib/adapters/cursor.js
- lib/adapters/claude-code.js
- agent/SOUL.md
- agent/IDENTITY.md
- agent/AGENTS.md
- agent/BOOTSTRAP.md
- test/fixtures/mock-agent/.gitkeep
- test/integration/.gitkeep
- .github/workflows/.gitkeep
