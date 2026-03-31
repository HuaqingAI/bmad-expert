# Sprint Change Proposal — 2026-03-31 (v2)

## 1. 问题摘要

**触发 Story：** `4-1-persistent-config-session-detection`（Epic 4：BOOTSTRAP 与零追问会话初始化）

**问题（两层）：**

**第一层——初始化方式错误：** AGENTS.md 中 "BMAD Zero-Question Initialization Flow" 实现为 agent 手动创建 `_bmad/bmm/config.yaml`（硬编码默认值）。但 BMAD 提供官方非交互安装命令 `npx bmad-method install --modules bmm --yes`。手动创建只产生一个最小 config 文件，不包含 BMAD 核心组件（agents、workflows、checklists 等），导致初始化不完整且版本不可控。

**第二层——架构性错误（更根本）：** BMAD 检测和初始化逻辑不应放在 AGENTS.md 的 Session Startup 中。原因：
1. Agent 是 BMAD 的**助手**，不是 BMAD 的使用者——BMAD 绑定项目，不绑定 agent
2. 一个 workspace 可包含多个项目，每个项目有独立的 `_bmad/` 和独立的配置
3. 检测应在**进入项目上下文时**触发（用户明确要求或 bmad-* skill 被调用时），而非 session 启动时
4. 当前设计隐含"一个 session = 一个项目"的错误假设

**问题类型：** 原始需求误解 + 架构设计偏差

**证据：**
- BMAD 官方文档 `https://docs.bmad-method.org/how-to/non-interactive-installation/` 提供标准非交互安装路径
- PRD FR25 要求"零追问"但未要求"零命令"——agent 可执行 shell 命令
- 实际使用场景：用户使用同一 agent 在多个项目间切换，每个项目需独立 BMAD 初始化

## 2. 影响分析

### Epic 影响

| Epic | 影响 |
|------|------|
| Epic 4（BOOTSTRAP 与零追问会话初始化） | **需修改** — Story 4.1 架构调整：检测逻辑从 Session Startup 移出，新增独立文件 |
| Epic 1（项目骨架） | 无影响 |
| Epic 2（HappyCapy 安装） | **微调** — installer.js FRAMEWORK_FILES 需新增条目 |
| Epic 3（错误系统） | 无影响 |
| Epic 5（文档） | 无影响 |
| Epic 6（Growth） | 无影响 |

### 制品影响

| 制品 | 影响 |
|------|------|
| PRD FR23-FR24 | **Story 层面 reinterpretation** — FR23"写入 AGENTS.md"扩展为"agent 持久配置文件集"；FR24"会话启动时"改为"进入项目上下文时"。PRD 意图不变，不需正式修改 PRD 文档 |
| Architecture | **无需修改** — 新增一个模板文件不改变架构模式 |
| `agent/AGENTS.md` 模板 | **需修改** — 移除 Step 3 的 BMAD 检测和整个 Zero-Question Initialization Flow，替换为按需加载指令 |
| `agent/bmad-project-init.md` | **新增** — 独立的 BMAD 项目初始化指令文件 |
| `lib/installer.js` | **需修改** — FRAMEWORK_FILES 新增 `bmad-project-init.md` |
| `package.json` | **需修改** — bmadExpert.frameworkFiles 同步新增 |
| `agent/SOUL.md` 模板 | 无影响 |
| `agent/IDENTITY.md` 模板 | 无影响 |
| Story 文件 | **需更新** — 实现记录反映变更 |

## 3. 推荐方案

**选择：直接调整（Direct Adjustment）**

在当前 Story 4-1 的 PR #16 上追加 commit，实施全部 4 项变更。

**理由：**
1. 变更范围可控：修改 2 个现有文件（AGENTS.md、installer.js），新增 1 个文件（bmad-project-init.md），同步 package.json
2. 核心逻辑不变（检测 + 初始化），只是位置和方式调整
3. PR #16 尚在 review 状态，可直接追加
4. SOUL.md、IDENTITY.md 不受影响
5. Story 4-1 范围从"纯内容设计"扩展为"内容设计 + installer.js 小改"，可接受

**工作量：** Low-Medium（1 小时）
**风险：** Low
**时间线影响：** 无

## 4. 详细变更提案

### 变更 1：`agent/AGENTS.md` — 移除 BMAD 检测，改为按需加载

移除 Step 3（BMAD Environment Detection）和整个 "BMAD Zero-Question Initialization Flow" 段落。

替换为 Step 3 按需加载指令：当用户调用 bmad-* skill、明确要求初始化 BMAD、或开始项目工作时，加载 `bmad-project-init.md` 并执行。

### 变更 2：新增 `agent/bmad-project-init.md`

独立的 BMAD 项目初始化指令文件，包含：
- Step 1：BMAD 环境检测（以 `_bmad/` + config.yaml 为权威标志）
- Step 2：执行 `npx bmad-method install --modules bmm --yes`
- Step 3：验证安装
- Step 4：输出确认并调用 bmad-help

### 变更 3：`lib/installer.js` + `package.json`

`FRAMEWORK_FILES` 和 `bmadExpert.frameworkFiles` 新增 `bmad-project-init.md`。

### 变更 4：Story 文件实现记录

Dev Agent Record Notes 追加 Sprint Change Proposal 记录，更新文件列表。

## 5. 实施交接

**变更范围分类：Minor**

**执行者：** 开发团队（Dev Agent），直接在 PR #16 上实施

**实施步骤：**
1. 修改 `agent/AGENTS.md` — 应用变更 1
2. 创建 `agent/bmad-project-init.md` — 应用变更 2
3. 修改 `lib/installer.js` 和 `package.json` — 应用变更 3
4. 更新 Story 文件 — 应用变更 4
5. 运行测试确认无回归
6. 追加 commit 到 PR #16

**成功标准：**
- `agent/AGENTS.md` 不再包含 BMAD 检测和初始化逻辑，改为按需加载引用
- `agent/bmad-project-init.md` 包含完整的检测 + 初始化流程，使用官方安装器
- `lib/installer.js` 和 `package.json` 的 FRAMEWORK_FILES 包含新文件
- 所有现有测试通过
