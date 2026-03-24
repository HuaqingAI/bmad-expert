---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# bmad-expert - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-expert, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: AI 可通过调用 `npx bmad-expert install` 触发完整 BMAD 安装流程
FR2: 系统可在 60 秒内完成完整安装流程
FR3: 安装过程向执行上下文实时输出逐步进度状态
FR4: 系统可在目标平台完成 agent 文件的写入与注册
FR5: 用户无需全局安装包即可通过 npx 执行安装命令
FR6: 系统可自动识别当前宿主平台（HappyCapy / OpenClaw / Claude Code）
FR7: 用户（AI）可通过 `--platform` 参数显式指定目标平台覆盖自动检测
FR8: 系统可感知目标平台的文件写入权限边界并选择有效安装路径
FR9: 系统可识别目标平台的 agent 注册机制并完成对应注册契约
FR10: 系统可在安装前检测目标环境是否已存在 BMAD 安装
FR11: 重复执行安装命令不产生重复文件、冲突配置或状态损坏
FR12: 系统可检测目标项目中是否已有 BMAD 配置文件
FR13: 在已有 BMAD 配置的项目中，系统可跳过重复安装并引导用户接入已有上下文
FR14: 安装失败时系统输出包含错误原因的结构化信息
FR15: 错误信息包含 AI 可直接执行的分步修复指令
FR16: 错误信息包含错误分类码，使 AI 能区分不同错误类型
FR17: 系统对沙盒权限拒绝场景提供经过验证的备选安装路径方案
FR18: 系统对网络中断场景提供重试或 fallback 安装方案
FR19: 安装支持幂等执行，出错后重新运行不产生副作用
FR20: 安装完成后系统向执行环境输出情感性确认信息
FR21: 安装完成后系统明确列出用户当前可执行的操作选项
FR22: 安装完成后系统提供进入 bmad-help 工作流的明确引导路径
FR23: bmad-expert 安装时向 agent 持久配置文件（AGENTS.md / CLAUDE.md）写入 BMAD 会话启动检测逻辑
FR24: agent 每次会话启动时自动执行 BMAD 环境检测，已初始化则跳过，未初始化则引导完成配置
FR25: BMAD 环境检测与初始化流程无需向用户追问，用户一句话触发即可完成全部初始化
FR26: 初始化完成后用户直接进入 bmad-help 工作流，无需额外操作
FR27: bmad-expert 安装时同时创建一次性 BOOTSTRAP 文件，用于首次 agent onboarding（解释 BMAD、建立 agent 身份），完成后自毁；BOOTSTRAP 内容不包含社交破冰对话流程——工具型 agent 首次运行直接进入工作状态
FR28: 系统提供 `install` 子命令执行完整平台感知安装
FR29: 系统支持 `--platform <name>` 参数覆盖平台自动检测
FR30: 系统支持 `--yes` 参数启用非交互模式，跳过所有确认提示
FR31: 安装命令返回确定性 exit code（0 = 成功，非 0 = 失败含分类码）
FR32: 用户可在 AI 平台聊天界面通过自然语言触发安装，无需直接操作 terminal
FR33: README 包含适用于各支持平台的单句触发命令示例
FR34: README 可被无 BMAD 背景的首次用户独立完成安装触发，无需查阅额外文档；衡量标准：触发操作步骤不超过 1 步，所有专业术语首次出现时附带简明说明
FR35: 系统可检测当前安装版本并在有新版本时向用户提示（Growth）
FR36: 系统提供 `update` 命令执行安全版本升级（Growth）
FR37: `update` 执行过程中自动备份用户 memory 与个性化配置（Growth）
FR38: `update` 完成后用户配置与 memory 完整保留，不丢失任何个性化状态（Growth）
FR39: 系统提供 `status` 命令检查当前安装健康度（Growth）
FR40: 系统支持 `--json` 参数以结构化 JSON 格式输出执行结果供 AI 调用方解析（Growth）

### NonFunctional Requirements

NFR1: `npx bmad-expert install` 完整流程在 60 秒内完成（正常网络环境）
NFR2: 安装过程每个主要步骤完成时在 2 秒内输出进度状态，不出现无响应的沉默等待
NFR3: 安装状态检测（幂等判断）在 3 秒内完成，不阻塞主流程
NFR4: 支持 Node.js 20.19+ 作为最低基线版本；推荐使用 Node.js 24 LTS，具体兼容窗口以锁定依赖和 CI 验证结果为准
NFR5: 在 HappyCapy、OpenClaw、Claude Code 三个平台的 Node.js 执行环境下，安装可成功完成（agent 文件写入 + 注册契约完成 + exit code 0），无运行时报错
NFR6: 包通过 npm 公开注册表分发，无需用户配置额外认证 token 即可执行 npx
NFR7: 安装产生的文件操作在所有支持平台上成功执行，不因路径格式差异产生文件写入错误
NFR8: 安装成功率目标 ≥ 99%（在支持平台的正常执行环境下）；通过每平台独立集成测试验证
NFR9: 100% 的失败场景输出结构化错误信息，不出现无信息的静默失败
NFR10: 重复执行安装命令（幂等场景）不引入副作用，系统状态保持一致
NFR11: 安装中断后重新执行可恢复至正确状态，不残留损坏的中间状态文件
NFR12: 写入目标平台文件系统时，仅写入预定义的合法路径范围，不越界写入系统级目录
NFR13: 发布包所有直接依赖和间接依赖版本固定，无浮动版本范围（如 `^`、`~`），供应链依赖可通过锁定文件完整还原

### Additional Requirements

- 【架构启动】项目初始化（npm init + 完整目录结构创建 + 配置文件）必须作为第一个实现故事交付，为后续所有故事建立基础
- 【技术栈】Node.js 24 LTS（目标），最低兼容 Node.js 20.19+；纯 JavaScript ESM（`"type": "module"`）
- 【依赖版本锁定】commander@14.0.3、execa@9.6.1、fs-extra@11.3.4、chalk@5.6.2；开发依赖：vitest@4.1.1、eslint、prettier；所有版本精确锁定，CI 使用 `npm ci`
- 【适配器接口契约】每个平台适配器必须实现 detect()、getInstallPath(agentId)、install(files, options)、check(agentId) 四个方法，统一接口各平台独立实现
- 【BmadError 统一错误类】所有错误场景必须使用 BmadError 类抛出，在 cli.js 顶层统一捕获并格式化输出；禁止在 lib 模块内直接 console.error 或 process.exit
- 【output.js 单点输出】所有进度/成功/错误输出必须通过 output.js 路由；stdout 用于进度与成功确认，stderr 用于错误信息
- 【路径白名单安全约束】HappyCapy: `~/.happycapy/agents/[agent-id]/`；Claude Code: `[cwd]/.claude/`；Cursor: `[cwd]/.cursor/`；写入前必须验证路径在白名单内，拒绝任何 `..` 路径遍历
- 【文件分层契约】frameworkFiles（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）可被 update 覆盖；userDataPaths（MEMORY.md、USER.md、memory/）永不覆盖；在 package.json 中硬编码
- 【CI/CD 策略】GitHub Actions：push to main 运行 vitest 测试；git tag v*.*.* 触发 npm publish 至公开注册表；prerelease tag 发布至 @next
- 【HappyCapy 适配器特殊处理】需通过 execa 调用 `happycapy-cli add`，并必须有降级路径（happycapy-cli 不存在时输出手动注册命令）
- 【BOOTSTRAP.md 内容制作】作为独立交付物（FR27），不依赖现成模板，需专项设计：工具型 agent 首次运行直接进入工作状态，完成后自毁

### UX Design Requirements

不适用——bmad-expert 为纯 CLI 工具，无图形用户界面。

### FR Coverage Map

FR1: Epic 2 - AI 调用 npx bmad-expert install 触发安装
FR2: Epic 2 - 60 秒内完成完整安装
FR3: Epic 2 - 实时进度输出
FR4: Epic 2 - agent 文件写入与平台注册
FR5: Epic 2 - npx 零全局安装执行
FR6: Epic 2 - 自动识别宿主平台
FR7: Epic 2 - --platform 参数覆盖自动检测
FR8: Epic 2 - 平台路径权限边界感知
FR9: Epic 2 - 平台 agent 注册契约完成
FR10: Epic 2 - 安装前检测已有 BMAD 安装
FR11: Epic 2 - 重复安装幂等，无副作用
FR12: Epic 2 - 检测已有 BMAD 配置文件
FR13: Epic 2 - 已有配置时跳过安装并引导接入
FR14: Epic 3 - 结构化错误信息输出
FR15: Epic 3 - 含 AI 可执行分步修复指令
FR16: Epic 3 - 错误分类码
FR17: Epic 3 - 沙盒权限拒绝场景备选路径
FR18: Epic 3 - 网络中断重试/fallback 方案
FR19: Epic 2 - 幂等执行，出错后重新运行无副作用
FR20: Epic 2 - 安装完成情感性确认信息
FR21: Epic 2 - 安装后可执行操作列表
FR22: Epic 2 - 进入 bmad-help 引导路径
FR23: Epic 4 - 持久配置写入 BMAD 会话启动检测逻辑
FR24: Epic 4 - 会话启动时自动 BMAD 环境检测
FR25: Epic 4 - 零追问初始化
FR26: Epic 4 - 初始化后直接进入 bmad-help
FR27: Epic 4 - 一次性 BOOTSTRAP 文件，完成后自毁
FR28: Epic 1 - install 子命令 CLI 骨架
FR29: Epic 2 - --platform 参数实现
FR30: Epic 2 - --yes 非交互模式
FR31: Epic 1 - 语义化 exit code 实现
FR32: Epic 2 - 自然语言触发，无需 terminal 操作
FR33: Epic 5 - README 各平台单句触发命令示例
FR34: Epic 5 - README 零背景知识可独立完成安装触发
FR35: Epic 6 (Growth) - 版本检测与升级提示
FR36: Epic 6 (Growth) - update 命令
FR37: Epic 6 (Growth) - update 时备份用户数据
FR38: Epic 6 (Growth) - update 完成后用户数据完整保留
FR39: Epic 6 (Growth) - status 命令
FR40: Epic 6 (Growth) - --json 结构化输出

## Epic List

### Epic 1：项目脚手架与 CLI 基础设施

开发者可从零搭建出可运行的 npm CLI 包，完整目录结构、依赖配置、CLI 入口、语义化 exit code 表、CI/CD 流水线全部就位，所有后续 Epic 的代码均可直接在此基础上落地。
**FRs covered:** FR28、FR31；架构附加需求（项目初始化、技术栈锁定、CI/CD 策略）

### Epic 2：HappyCapy 平台完整安装体验（MVP 核心）

用户（通过 AI 代劳）在 HappyCapy 平台聊天界面触发一句话，`npx bmad-expert install` 在 60 秒内完成平台感知、agent 文件写入与注册、幂等检测、实时进度输出，安装完成后获得情感性确认引导；重复执行不产生副作用。
**FRs covered:** FR1-FR13、FR19-FR22、FR29、FR30、FR32

### Epic 3：AI 可自愈的结构化错误系统

安装失败时，AI 无需人工介入即可通过结构化错误输出（含分类码、原因、分步 fix 指令）自主修复；沙盒权限拒绝和网络中断场景均有经过验证的应对路径；所有错误格式通过 output.js 统一路由至 stderr。
**FRs covered:** FR14-FR18

### Epic 4：BOOTSTRAP 与零追问会话初始化

首次运行时，BOOTSTRAP 文件引导 agent 完成身份建立与 BMAD 环境配置，执行完毕后自毁；再次会话时自动检测环境并跳过初始化，直接就绪；整个流程用户一句话触发，无需任何追问，完成后直接进入 bmad-help。
**FRs covered:** FR23-FR27

### Epic 5：Onboarding 文档与平台可发现性

README 让任何无 BMAD 背景的新用户通过单句命令完成安装触发，操作步骤不超过 1 步，所有专业术语首次出现时附带简明说明；各支持平台均有明确的触发命令示例。
**FRs covered:** FR33-FR34

### Epic 6：安全更新与状态管理（Growth）

用户可通过 `npx bmad-expert update` 安全升级框架文件，同时保证用户 memory 与个性化配置完整保留；`status` 命令可检查当前安装健康度；`--json` 参数支持 AI 调用方可编程解析执行结果。
**FRs covered:** FR35-FR40

---

## Epic 1：项目脚手架与 CLI 基础设施

开发者可从零搭建出可运行的 npm CLI 包，完整目录结构、依赖配置、CLI 入口、语义化 exit code 表、CI/CD 流水线全部就位，所有后续 Epic 的代码均可直接在此基础上落地。

### Story 1.1：npm 包初始化与完整项目结构搭建

As a 开发者（AI agent）,
I want 一个完整的 npm 包项目骨架（目录结构、精确版本依赖、ESM 配置、代码质量工具），
So that 后续所有故事可以在确定的技术基础上直接落地代码，无需重新做工程决策。

**Acceptance Criteria:**

**Given** 一个空目录
**When** 执行项目初始化脚本（npm init + 依赖安装 + 目录创建）
**Then** 生成完整目录结构：`cli.js`、`lib/`（errors.js、exit-codes.js、output.js、platform.js、installer.js、adapters/）、`agent/`（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 占位文件）、`test/`（含 integration/ 子目录）、`.github/workflows/`
**And** `package.json` 包含：`"type": "module"`、`"bin": {"bmad-expert": "./cli.js"}`、精确版本依赖（commander@14.0.3、execa@9.6.1、fs-extra@11.3.4、chalk@5.6.2）、开发依赖（vitest@4.1.1、eslint、prettier）
**And** `package-lock.json` 存在且所有依赖版本无 `^`、`~` 浮动范围
**And** `.eslintrc.js`、`.prettierrc`、`vitest.config.js`、`.gitignore` 配置文件存在且内容有效
**And** `cli.js` 包含 Commander.js 入口骨架，执行 `node cli.js --help` 输出帮助信息而不报错
**And** `npm test`（vitest）运行无报错（即使无测试用例也返回 exit 0）

### Story 1.2：语义化 Exit Code 常量与 BmadError 类

As a 开发者（AI agent）,
I want `lib/exit-codes.js` 中定义 7 个语义化 exit code 常量，以及 `lib/errors.js` 中的 BmadError 类，
So that 所有模块抛出错误时使用统一的对象结构，CLI 入口可通过错误类型决定退出码，消除硬编码数字。

**Acceptance Criteria:**

**Given** `lib/exit-codes.js` 已实现
**When** 导入 EXIT_CODES
**Then** 包含 7 个常量：SUCCESS(0)、GENERAL_ERROR(1)、INVALID_ARGS(2)、MISSING_DEPENDENCY(3)、PERMISSION_DENIED(4)、NETWORK_ERROR(5)、ALREADY_INSTALLED(6)
**And** 全部使用 UPPER_SNAKE_CASE 命名，通过具名导出（Named Export）

**Given** `lib/errors.js` 已实现
**When** 执行 `new BmadError('E004', '文件写入失败', originalError)`
**Then** 返回的实例包含 `bmadCode: 'E004'`、`message: '文件写入失败'`、`cause: originalError`
**And** `retryable` 属性对 E004、E005 为 true，其余为 false
**And** BmadError 继承自 Error，`instanceof Error` 为 true

**Given** `test/errors.test.js` 和 `test/exit-codes.test.js` 已实现
**When** 运行 `npm test`
**Then** 所有测试通过，覆盖上述所有属性断言

### Story 1.3：输出格式化模块（output.js）

As a 开发者（AI agent）,
I want `lib/output.js` 提供统一的进度输出、成功确认输出、错误格式化输出三个函数，
So that 所有模块通过单一出口路由输出，stdout/stderr 分离规则在整个代码库中自动保证，AI caller 可可靠解析输出。

**Acceptance Criteria:**

**Given** `lib/output.js` 已实现 `printProgress(message)`、`printSuccess(message)`、`printError(bmadError)` 三个具名导出函数
**When** 调用 `printProgress('正在检测平台...')`，随后操作完成后调用 `printProgress('正在检测平台...', true)`（标记完成）
**Then** stdout 依次输出 `正在检测平台...` 和 ` ✓\n`，格式符合架构文档中的进度输出模式

**Given** 调用 `printError(new BmadError('E004', '文件写入失败', cause))`
**When** 输出被路由
**Then** 内容写入 stderr（非 stdout）
**And** 格式符合 `ERROR [E004] 文件写入失败\n原因：...\n修复步骤：\n  1. ...\n可重试：是` 的 AI 可读 Schema
**And** stdout 无任何内容输出

**Given** `test/output.test.js` 已实现，使用 vitest spy 捕获 process.stdout.write 和 process.stderr.write
**When** 运行 `npm test`
**Then** 所有输出路由测试通过

### Story 1.4：GitHub Actions CI/CD 流水线

As a 开发者（AI agent）,
I want GitHub Actions 配置 CI（测试）和 CD（发布）两条流水线，
So that 每次推送到 main 自动验证代码质量，每次打版本 tag 自动发布至 npm 公开注册表，无需手动操作。

**Acceptance Criteria:**

**Given** `.github/workflows/ci.yml` 已配置
**When** 有代码 push 至 main 分支
**Then** 流水线触发，使用 `npm ci` 安装依赖，运行 `npm test`，Node.js 版本使用 20.19.x 和 22.x 矩阵
**And** 测试失败时流水线标记为 failed，阻止合并

**Given** `.github/workflows/publish.yml` 已配置
**When** 推送匹配 `v*.*.*` 格式的 git tag
**Then** 流水线触发，使用 `npm ci` + `npm publish`，发布至 npm 公开注册表（无认证 token 障碍）
**And** 匹配 `v*.*.*-*`（prerelease）格式的 tag 执行 `npm publish --tag next`

**Given** `README.md` 已创建
**When** 查看 README
**Then** 包含包名注册说明（提示需提前确认 `bmad-expert` 包名可用性）和 npm 发布徽章占位

---

## Epic 2：HappyCapy 平台完整安装体验（MVP 核心）

用户（通过 AI 代劳）在 HappyCapy 平台聊天界面触发一句话，`npx bmad-expert install` 在 60 秒内完成平台感知、agent 文件写入与注册、幂等检测、实时进度输出，安装完成后获得情感性确认引导；重复执行不产生副作用。

### Story 2.1：平台检测模块（platform.js）与 HappyCapy 适配器骨架

As a 开发者（AI agent）,
I want `lib/platform.js` 实现平台自动检测逻辑，以及 `lib/adapters/happycapy.js` 实现完整适配器接口，
So that 安装流程在最早阶段确定目标平台，后续所有路径计算和注册操作通过适配器统一执行。

**Acceptance Criteria:**

**Given** 当前执行环境为 HappyCapy（存在 `happycapy-cli` 可执行文件或特定环境变量）
**When** 调用 `detectPlatform()`
**Then** 返回字符串 `'happycapy'`，检测耗时不超过 3 秒（NFR3）

**Given** 执行 `detectPlatform()` 且无法自动检测到任何已知平台
**When** 用户通过 `--platform happycapy` 显式指定
**Then** 返回 `'happycapy'`，覆盖自动检测结果（FR7）

**Given** `lib/adapters/happycapy.js` 已实现四个接口方法
**When** 调用 `getInstallPath('bmad-expert')`
**Then** 返回 `~/.happycapy/agents/bmad-expert/`（路径在白名单内，无 `..` 遍历）

**Given** `test/platform.test.js` 使用 mock 环境变量测试各分支
**When** 运行 `npm test`
**Then** 平台检测和适配器接口测试全部通过

### Story 2.2：agent 模板文件集与变量替换引擎

As a 开发者（AI agent）,
I want `agent/` 目录下的四个模板文件（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 占位），以及 `installer.js` 中的模板变量替换函数，
So that 安装时 `{{agent_id}}`、`{{agent_name}}`、`{{model}}`、`{{install_date}}` 被正确替换为实际值后写入目标路径。

**Acceptance Criteria:**

**Given** `agent/` 目录下四个模板文件存在，内容包含 `{{agent_id}}`、`{{agent_name}}`、`{{install_date}}` 变量
**When** 调用 `replaceTemplateVars(content, { agentId: 'bmad-expert', agentName: 'BMAD Expert', installDate: '2026-03-23' })`
**Then** 返回字符串中所有 `{{agent_id}}` 替换为 `bmad-expert`，`{{agent_name}}` 替换为 `BMAD Expert`，`{{install_date}}` 替换为安装时的系统日期
**And** 不存在未替换的 `{{...}}` 占位符残留

**Given** 模板替换后的文件内容
**When** 写入目标路径（通过 fs-extra，非原生 fs）
**Then** 文件写入成功，内容与替换结果完全一致
**And** 写入路径通过白名单验证，拒绝任何包含 `..` 的路径

**Given** `test/installer.test.js` 覆盖变量替换逻辑
**When** 运行 `npm test`
**Then** 所有变量替换测试通过，包括空值处理和特殊字符场景

### Story 2.3：幂等检测与安装状态判断

As a 用户（通过 AI 代劳）,
I want 重复执行 `npx bmad-expert install` 时系统自动检测已有安装并安全跳过，
So that 不产生重复文件、冲突配置或状态损坏，即使 AI 误触发多次也不会破坏已有环境。

**Acceptance Criteria:**

**Given** 目标路径 `~/.happycapy/agents/bmad-expert/` 已存在且包含 `AGENTS.md`
**When** 执行 `npx bmad-expert install`
**Then** `adapter.check('bmad-expert')` 返回 `'installed'`
**And** 安装流程跳过文件写入和注册步骤
**And** 输出："检测到已有安装（版本 vX.X.X），跳过重复安装，当前状态正常。"（FR13）
**And** 进程以 exit code 6（ALREADY_INSTALLED）退出（FR31）
**And** 检测耗时不超过 3 秒（NFR3）

**Given** 目标路径存在但文件不完整（缺少必要文件）
**When** 执行 `adapter.check('bmad-expert')`
**Then** 返回 `'corrupted'`，安装流程继续执行（覆盖损坏状态）

**Given** 目标路径不存在
**When** 执行 `adapter.check('bmad-expert')`
**Then** 返回 `'not_installed'`，安装流程正常进行

### Story 2.4：HappyCapy 完整安装流程编排

As a 用户（通过 AI 代劳）,
I want 在 HappyCapy 聊天界面触发一句话后，`npx bmad-expert install` 在 60 秒内完成平台感知、文件写入、happycapy-cli 注册，并实时输出每步进度，
So that 我可以在不打开 terminal 的情况下完成完整 BMAD 安装，全程看到进度反馈而不是沉默等待。

**Acceptance Criteria:**

**Given** HappyCapy 平台，`happycapy-cli` 可用，目标路径不存在
**When** 执行 `npx bmad-expert install`
**Then** stdout 依次输出各步进度（正在检测平台... ✓、正在复制 agent 文件... ✓、正在替换模板变量... ✓、正在注册 agent... ✓）
**And** 每步进度输出间隔不超过 2 秒（NFR2）
**And** 全流程在 60 秒内完成（NFR1）
**And** `~/.happycapy/agents/bmad-expert/` 目录包含四个已替换变量的文件
**And** `happycapy-cli add` 被成功调用（通过 execa，非 child_process）
**And** 进程以 exit code 0 退出

**Given** HappyCapy 平台，`happycapy-cli` 不存在（降级场景）
**When** 执行安装注册步骤
**Then** 输出手动注册命令（降级路径），不抛出未处理异常，进程正常完成

**Given** `test/integration/happycapy.test.js` 使用 mock 文件系统和 mock execa
**When** 运行 `npm test`
**Then** 完整安装流程集成测试通过（NFR8 验证基础）

### Story 2.5：安装完成情感性确认与操作引导

As a 用户（通过 AI 代劳）,
I want 安装成功后看到明确的确认信息和下一步操作列表，
So that 我清楚地知道"装好了"且"现在能做什么"，将功能完成转化为使用信心。

**Acceptance Criteria:**

**Given** 安装全部步骤成功完成
**When** `output.js` 输出安装后引导信息
**Then** stdout 包含情感性确认语句（如 "bmad-expert 已就绪"）
**And** stdout 包含至少两个明确的可执行操作选项（FR21），包含进入 bmad-help 的引导（FR22）
**And** 格式符合架构文档中定义的安装后引导模板（含 ① ② 编号选项）
**And** 安装耗时（秒数）包含在确认信息中（如 "安装完成（用时 42 秒）"）

**Given** `--yes` 参数被传入（非交互模式，FR30）
**When** 执行安装
**Then** 所有确认提示被跳过，安装直接执行，完成后仍输出引导信息

---

## Epic 3：AI 可自愈的结构化错误系统

安装失败时，AI 无需人工介入即可通过结构化错误输出（含分类码、原因、分步 fix 指令）自主修复；沙盒权限拒绝和网络中断场景均有经过验证的应对路径；所有错误格式通过 output.js 统一路由至 stderr。

### Story 3.1：权限拒绝错误的结构化输出与备选路径

As a AI（安装执行方）,
I want 沙盒权限拒绝时接收到包含错误码、原因和备选安装路径命令的结构化 stderr 输出，
So that 我可以无需人工介入，自主执行 fix 步骤完成安装修复。

**Acceptance Criteria:**

**Given** 写入 `~/.happycapy/agents/bmad-expert/` 时遇到权限拒绝（EACCES）
**When** BmadError('E004', ...) 被 cli.js 顶层 catch 捕获
**Then** stderr 输出符合 AI 可读 Schema：`ERROR [E004] 文件写入失败（权限不足）\n原因：HappyCapy 沙盒限制写入路径 /xxx\n修复步骤：\n  1. [备选路径命令]\n  2. [fallback 方案]\n可重试：是`
**And** stdout 无任何内容
**And** 进程以 exit code 4（PERMISSION_DENIED）退出（FR31）
**And** `retryable` 字段值为 `true`（FR15）

**Given** `test/errors.test.js` 覆盖 E004 错误场景
**When** 运行 `npm test`
**Then** 权限错误的 Schema 格式、exit code、retryable 值测试全部通过

### Story 3.2：无效参数与依赖缺失错误处理

As a AI（安装执行方）,
I want 传入非法 `--platform` 值或 Node.js 版本不足时，收到包含具体原因和修复步骤的结构化错误，
So that 我能精确判断错误类型并执行对应修复，不产生歧义。

**Acceptance Criteria:**

**Given** 执行 `npx bmad-expert install --platform unknown-platform`
**When** 参数验证失败
**Then** stderr 输出 `ERROR [E002] 无效参数: --platform 值 'unknown-platform' 不被支持\n修复步骤：\n  1. 使用支持的平台值：happycapy, cursor, claude-code\n可重试：否`
**And** 进程以 exit code 2（INVALID_ARGS）退出

**Given** 当前 Node.js 版本低于 20.19
**When** CLI 启动时版本检测失败
**Then** stderr 输出 `ERROR [E003] 依赖缺失: Node.js 版本不足（当前 vX.X.X，需要 ≥20.19.0）\n修复步骤：\n  1. 升级 Node.js 至 20.19+ 或更高版本\n可重试：否`
**And** 进程以 exit code 3（MISSING_DEPENDENCY）退出

**Given** `test/errors.test.js` 覆盖 E002、E003 场景
**When** 运行 `npm test`
**Then** 所有参数和依赖错误测试通过

### Story 3.3：网络中断场景的 Fallback 安装方案

As a AI（安装执行方）,
I want 网络中断时（预留场景，当前版本 agent 文件随 npm 包内嵌无需网络）收到明确的重试指令，
So that 即使未来版本引入网络依赖，AI 也能在无人工介入的情况下完成重试。

**Acceptance Criteria:**

**Given** 安装过程中出现网络相关错误（ECONNREFUSED、ETIMEDOUT 等）
**When** BmadError('E005', ...) 被顶层 catch 捕获
**Then** stderr 输出 `ERROR [E005] 网络错误: ...\n修复步骤：\n  1. 检查网络连接后重新执行安装命令\n  2. 若持续失败，检查代理设置\n可重试：是`
**And** 进程以 exit code 5（NETWORK_ERROR）退出
**And** `retryable` 字段值为 `true`

**Given** 出错后重新执行 `npx bmad-expert install`（幂等场景）
**When** 网络恢复正常
**Then** 安装正常完成，不因之前的中断状态产生副作用（FR19、NFR11）

---

## Epic 4：BOOTSTRAP 与零追问会话初始化

首次运行时，BOOTSTRAP 文件引导 agent 完成身份建立与 BMAD 环境配置，执行完毕后自毁；再次会话时自动检测环境并跳过初始化，直接就绪；整个流程用户一句话触发，无需任何追问，完成后直接进入 bmad-help。

### Story 4.1：持久配置文件写入 BMAD 会话启动检测逻辑

As a 用户（通过 AI 代劳）,
I want 安装完成后 agent 持久配置文件（AGENTS.md）包含会话启动时自动执行的 BMAD 环境检测逻辑，
So that 每次在 HappyCapy 开启新会话时，agent 自动判断是否需要初始化，已初始化则直接就绪，未初始化则引导完成配置，无需用户手动触发。

**Acceptance Criteria:**

**Given** `installer.js` 写入 agent 文件至 `~/.happycapy/agents/bmad-expert/`
**When** 写入 `AGENTS.md` 模板（含会话启动检测逻辑）
**Then** `AGENTS.md` 包含 BMAD 环境检测指令区块，指令检查项目根目录是否存在 `_bmad/` 或等效标记文件（FR23）
**And** 检测逻辑条件分支：已初始化 → 跳过，直接进入工作状态；未初始化 → 执行 BMAD 配置引导（FR24）
**And** 整个检测和引导流程不向用户发起任何追问，一句话触发即完成全部步骤（FR25）
**And** 初始化完成后最终状态为：用户直接进入 bmad-help 工作流（FR26）

**Given** `agent/AGENTS.md` 模板已设计完成
**When** 人工审阅模板内容
**Then** 会话启动检测逻辑清晰，无歧义，任何 AI agent 按指令执行均可完成全部初始化步骤

### Story 4.2：一次性 BOOTSTRAP 文件设计与自毁机制

As a 用户（通过 AI 代劳）,
I want 首次激活 bmad-expert agent 时，BOOTSTRAP 文件引导完成 BMAD 工具介绍、agent 身份建立和环境配置，完成后文件自毁，再次激活时直接进入工作状态，
So that 新用户获得结构化的首次上手体验，而不是面对一个无任何上下文的空白 agent；老用户再次使用时不会被重复的 onboarding 流程打断。

**Acceptance Criteria:**

**Given** `agent/BOOTSTRAP.md` 模板文件已设计完成
**When** 人工审阅模板内容
**Then** 包含以下内容区块（按执行顺序）：① BMAD 方法论简明说明（不超过 200 字）；② agent 身份建立指令（读取 SOUL.md、IDENTITY.md、USER.md）；③ 环境检测与 _bmad/ 初始化指令；④ 自毁指令（删除 BOOTSTRAP.md 本身或将其清空标记为已完成）；⑤ 跳转至 bmad-help 指令
**And** 文件中不包含任何社交破冰对话流程或"介绍自己"类指令——工具型 agent 首次运行直接进入工作状态（FR27）
**And** 自毁机制在同一 agent 会话内执行，不依赖用户手动删除

**Given** BOOTSTRAP.md 已自毁（文件不存在或被标记为 completed）
**When** agent 再次启动新会话
**Then** 不再执行 BOOTSTRAP 流程，AGENTS.md 中的会话检测逻辑正常运行（FR24）

### Story 4.3：安装时写入持久配置的集成验证

As a 开发者（AI agent）,
I want 一个集成测试验证安装后 agent 目录中的所有文件内容符合设计规范，
So that 确保模板变量已完整替换、AGENTS.md 包含会话检测逻辑、BOOTSTRAP.md 存在且格式正确，防止文件内容错误导致 agent 首次运行失败。

**Acceptance Criteria:**

**Given** 在 mock HappyCapy 环境中执行完整安装流程
**When** 检查 `~/.happycapy/agents/bmad-expert/` 目录内容
**Then** 目录中存在且仅存在：SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md 四个文件
**And** 每个文件中不存在任何未替换的 `{{...}}` 占位符
**And** AGENTS.md 包含会话启动检测逻辑区块
**And** BOOTSTRAP.md 包含自毁指令区块

**Given** `test/integration/happycapy.test.js` 扩展覆盖文件内容验证
**When** 运行 `npm test`
**Then** 所有文件内容验证测试通过

---

## Epic 5：Onboarding 文档与平台可发现性

README 让任何无 BMAD 背景的新用户通过单句命令完成安装触发，操作步骤不超过 1 步，所有专业术语首次出现时附带简明说明；各支持平台均有明确的触发命令示例。

### Story 5.1：面向零 BMAD 背景用户的 README

As a 新用户（无 BMAD 使用经验）,
I want README 提供针对各支持平台的单句触发命令，配以简明说明，
So that 我不需要查阅任何其他文档，打开 README 后一步完成安装触发，所有专业术语均有就地解释。

**Acceptance Criteria:**

**Given** 用户打开 README.md
**When** 阅读 "快速开始" 章节
**Then** 包含针对 HappyCapy 平台的单句触发命令（可直接粘贴到聊天界面的自然语言句子）（FR33）
**And** 触发命令下方有简短的平台说明（该命令在哪里输入、输入后会发生什么）
**And** 首次出现的专业术语（BMAD、agent、npx）均附带不超过 1 句话的简明说明（FR34）
**And** 从打开 README 到完成安装触发，用户需要执行的步骤不超过 1 步（FR34）

**Given** README 中的触发命令
**When** 被无 BMAD 背景的首次用户按步骤操作
**Then** 该用户无需打开第二份文档，无需理解 BMAD 方法论背景，即可完成安装触发

**Given** README 已包含 HappyCapy 触发命令
**When** Phase 1.5 扩展 OpenClaw 和 Claude Code 支持后
**Then** README 结构支持追加新平台的触发命令示例，无需重构现有内容

---

## Epic 6：安全更新与状态管理（Growth）

用户可通过 `npx bmad-expert update` 安全升级框架文件，同时保证用户 memory 与个性化配置完整保留；`status` 命令可检查当前安装健康度；`--json` 参数支持 AI 调用方可编程解析执行结果。

### Story 6.1：update 命令与用户数据保护

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert update` 时框架文件被升级，用户 memory 和个性化配置完整保留，
So that 我可以获得新版本功能，同时积累的使用上下文一条不丢。

**Acceptance Criteria:**

**Given** 已安装 bmad-expert v1.0，执行 `npx bmad-expert update`
**When** 更新流程运行
**Then** frameworkFiles（SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md）被新版本覆盖
**And** userDataPaths（MEMORY.md、USER.md、memory/ 目录）完整保留，内容不变（FR38）
**And** 用户自添加的非白名单文件不被触碰
**And** update 前自动备份用户数据至临时目录（FR37）
**And** 完成后输出："已更新至 vX.X.X，用户配置和 memory 完整保留。"

**Given** update 过程中出现异常（如权限拒绝）
**When** 更新中断
**Then** 自动从备份恢复用户数据，不残留损坏状态
**And** stderr 输出结构化错误信息（E004 格式），含恢复步骤

### Story 6.2：status 命令与安装健康度检查

As a 用户（通过 AI 代劳）,
I want 执行 `npx bmad-expert status` 查看当前安装状态，
So that 我可以在不执行安装的情况下确认 bmad-expert 是否正确安装且运行健康。

**Acceptance Criteria:**

**Given** bmad-expert 已正确安装
**When** 执行 `npx bmad-expert status`
**Then** stdout 输出：当前安装版本、安装路径、frameworkFiles 完整性检查结果（所有文件存在/缺失列表）
**And** 进程以 exit code 0 退出

**Given** bmad-expert 未安装或安装损坏
**When** 执行 `npx bmad-expert status`
**Then** stdout 输出状态为 `corrupted` 或 `not_installed`，并给出修复建议
**And** 进程以非零 exit code 退出

### Story 6.3：--json 结构化输出模式

As a AI（自动化调用方）,
I want 在 install/update/status 命令上传入 `--json` 参数获得结构化 JSON 输出，
So that 我可以通过编程方式解析执行结果，进行条件判断和错误处理，而不依赖文本解析。

**Acceptance Criteria:**

**Given** 执行 `npx bmad-expert install --json` 且安装成功
**When** 进程完成
**Then** stdout 输出单个合法 JSON 对象：`{"success": true, "platform": "happycapy", "agentId": "bmad-expert", "installPath": "...", "duration": N}`
**And** stderr 无任何输出
**And** 进程以 exit code 0 退出

**Given** 执行 `npx bmad-expert install --json` 且安装失败
**When** BmadError 被捕获
**Then** stdout 输出单个合法 JSON 对象：`{"success": false, "errorCode": "E004", "errorMessage": "...", "fixSteps": [...], "retryable": true}`
**And** stderr 无任何输出（JSON 模式下所有输出走 stdout）
**And** 进程以对应分类 exit code 退出（FR40）
