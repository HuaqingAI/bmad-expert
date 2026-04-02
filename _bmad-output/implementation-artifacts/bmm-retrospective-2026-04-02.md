# bmad-expert 全项目综合回顾报告

**项目：** bmad-expert -- BMAD Agent 安装器与新手教练
**范围：** Epic 1-6 全项目回顾
**回顾日期：** 2026-04-02
**主持人：** Bob（Scrum Master）
**参与角色：** Alice（Product Owner）、Charlie（Senior Dev）、Dana（QA Engineer）、Elena（Junior Dev）、Winston（Architect）

---

## 一、项目交付总览

### 交付规模

| 指标 | 数值 |
|------|------|
| Epic 总数 | 6 |
| Story 总数 | 19 |
| Story 完成率 | 19/19（100%） |
| 累计测试用例 | 172 |
| 测试回归 | 0（全程零回归） |
| 新增代码文件 | ~15 个核心模块 + 测试 |
| Sprint Change Proposal | 1 次（Epic 4） |

### 交付时间线

| Epic | 名称 | Story 数 | 测试增量 |
|------|------|----------|----------|
| Epic 1 | 项目脚手架与 CLI 基础设施 | 4 | 0 -> 33 |
| Epic 2 | HappyCapy 平台完整安装体验（MVP 核心） | 5 | 33 -> 96 |
| Epic 3 | AI 可自愈的结构化错误系统 | 3 | 96 -> 113 |
| Epic 4 | BOOTSTRAP 与零追问会话初始化 | 3 | 113 -> 141 |
| Epic 5 | Onboarding 文档与平台可发现性 | 1 | 141（不变） |
| Epic 6 | 安全更新与状态管理（Growth） | 3 | 141 -> 172 |

### PRD 成功指标评估

| 指标 | 目标 | 实际评估 |
|------|------|----------|
| 安装完成时间 | <= 60 秒 | 预期达标（全自动化流程） |
| 安装成功率 | >= 99% | 架构支持（幂等 + 降级路径） |
| 首次工作流启动 | 1 句话 | 已实现（BOOTSTRAP 零追问设计） |
| 7 天工作流完成率 | >= 70% | 待上线后验证 |

---

## 二、做得好的地方（Keep）

### K1. 架构约束的早期文档化与全程遵守

Bob（Scrum Master）："这是我见过的最成功的架构治理实践。"

Winston（Architect）："6 条强制规则在 Story 1.1 就写入了占位文件注释，整个项目生命周期 19 个 Story 保持 100% 遵守率。"

**具体表现：**
- `fs-extra`/`execa` 的 ESM 导入方式在每个 Story 的 Dev Notes 中重复列出
- BmadError 的使用规范从 Epic 1 到 Epic 6 无一违规
- stdout/stderr 分离原则贯穿始终，Epic 6 的 `--json` 模式在此基础上自然扩展
- 每个 Story 完成时在 Completion Notes 明确确认六条规则均已遵守

**价值衡量：** 零架构漂移 = 零返工成本。172 个测试无一因架构不一致而需要重写。

---

### K2. 平台适配器模式的正确投资

Alice（Product Owner）："当初决定做 adapters/ 抽象层，现在看来是最正确的架构决策。"

Winston（Architect）："高内聚低耦合。`getAdapter()` 工厂函数将平台细节封装在 `adapters/` 目录下，新增平台只需一个文件。"

**具体表现：**
- `detect()` / `getInstallPath()` / `install()` / `check()` 统一接口
- HappyCapy 适配器是第一个实现，但接口设计已为 OpenClaw、Claude Code 预留
- 路径安全白名单在适配器层实现，拒绝任何 `..` 路径遍历
- 降级路径（`happycapy-cli add` 失败时的 graceful degradation）在适配器内处理

---

### K3. 增量增强的设计哲学

Charlie（Senior Dev）："Epic 3 给我印象最深。三个 Story 全是纯增量增强，每个 Story 的变更范围极度清晰。"

**具体表现：**
- BmadError 的 `fixSteps` 第四参数默认值 `[]`，所有现有调用无需修改
- `wrapNetworkError` 镜像 `wrapFileError` 模式，新增函数不修改任何现有签名
- Epic 6 的 `--json` 模式通过模块级状态开关实现，不改变任何现有输出函数的调用方式
- 19 个 Story 全程零回归，证明增量策略有效

---

### K4. 分层测试策略

Dana（QA Engineer）："从 33 个测试增长到 172 个，全程零回归，这不是偶然的。"

**三层结构：**
1. **单元测试**（test/*.test.js）：大量使用 `vi.mock()` 隔离 I/O
2. **集成测试**（test/integration/happycapy.test.js）：测试 `install()` 完整五步流程
3. **内容验证测试**（Story 4.3 扩展）：使用真实模板文件验证变量替换

**测试增长曲线：** 33 -> 96 -> 113 -> 141 -> 172，每个 Epic 都有稳健增长。

---

### K5. Sprint Change Proposal 的正式执行

Bob（Scrum Master）："Epic 4 的 Sprint Change Proposal 是整个项目最重要的流程事件。"

**事件：** Story 4.1 实施中发现两个架构性错误：
1. 初始化方式应调用 `npx bmad-method install --modules bmm --yes`，而非手动创建 config.yaml
2. BMAD 是项目级而非 agent 级，检测逻辑需从 AGENTS.md 移出到独立文件

**处理方式：** Dev Agent 主动识别并提出正式 Sprint Change Proposal，有文档记录，变更范围从"纯内容"扩展为包含 `lib/installer.js` 和 `package.json` 的结构改动。

**意义：** 问题不在于"发生了设计错误"，而在于"能否及时发现并正式处理"。这次 Course Correction 避免了 BMAD 项目级 vs agent 级的根本性混淆。

---

### K6. Story 间的知识传递链

Elena（Junior Dev）："每个 Story 的 Dev Notes 都有'来自 Story X.X 的关键经验'章节，让我接手新 Story 时不用从头摸索。"

**具体表现：**
- Story 2.1 汇总了 1.1/1.2/1.3 的所有关键经验
- Story 3.3 的 `wrapNetworkError` 显式镜像 3.1 的 `wrapFileError` 模式
- 每个 Story 明确标注"本 Story 不需要实现的内容（避免越界）"，有效防止功能蔓延

---

## 三、需要改进的地方（Change）

### C1. Story 文件 Status 字段不同步 -- 系统性流程问题

Bob（Scrum Master）："这是最令我沮丧的问题。从 Epic 1 到 Epic 6，每次回顾都提出，从未改善。"

**问题描述：**
- Sprint-status.yaml 中 Story 状态为 `done`，但 Story 文件的 Status 字段停留在 `review` 甚至 `ready-for-dev`
- Epic 5 的 Story 5.1 最为严重：Status = `ready-for-dev`（看起来像"未开始"），实际早已完成
- 6 个 Epic 的回顾中每次都提出此问题，且列为高优先级行动项，但从未执行

**根因分析：**
- 缺乏流程层面的强制保障
- Story done 的门控条件中不包含"更新 Status 字段"
- 依赖个人自觉，而非自动化校验

**建议：** 将 Status 字段同步纳入 Story done 的必要条件，或通过 CI 脚本自动校验 sprint-status.yaml 与 Story 文件的状态一致性。

---

### C2. 回顾会议长期缺失

Alice（Product Owner）："六个 Epic 的回顾全部在同一天补做，丢失了大量跨 Epic 的实时学习机会。"

**影响：**
- Epic 1 的行动项（如"填写 Dev Agent Record"）如果及时跟踪，可能在 Epic 2 就改善
- Story Status 不同步问题如果在 Epic 1 回顾后立即执行，不会持续到 Epic 6
- 无法追踪行动项的跨 Epic 落实情况

**建议：** 每个 Epic 完成后立即运行 retro。

---

### C3. 文档欠债随功能扩展快速累积

Charlie（Senior Dev）："Epic 5（文档）在 Epic 6 之后完成，导致 README 不包含 `update`、`status`、`--json` 三个已交付命令。"

**影响：**
- `--json` 模式（专为 AI 调用设计）完全无文档，等于功能对外不可见
- 新用户无法从 README 了解项目的完整能力
- 功能 Epic 与文档 Epic 解耦，但缺乏同步机制

**建议：** 功能 Epic 的 AC 中必须包含文档更新要求，或在功能 Story 的 Done Definition 中加入"对应文档已更新"。

---

### C4. 预留场景基础设施缺乏标注

Winston（Architect）："Story 3.3 的 `wrapNetworkError` 是一个'预留基础设施' -- 当前版本安装过程完全不需要网络请求，E005 永远不会被真实触发。"

**风险：**
- 后续开发者可能误认为网络错误处理已完整测试
- 预留代码的维护成本（测试 mock 但无真实覆盖）
- 未来引入网络请求时需要补充真实测试

**建议：** "预留场景"类 Story 在文件中明确标注 `[RESERVED]` 属性，便于优先级排序和未来补全。

---

### C5. 内容设计类 Story 缺乏自动化验证

Bob（Scrum Master）："Epic 4 的 AGENTS.md 和 BOOTSTRAP.md 是纯 Markdown，验收完全依赖人工审阅。"

**问题：**
- 代码有架构文档约束 + 172 个测试保障
- Markdown 内容没有等价机制，后续修改模板可能无意破坏规范
- Story 4.3 补了集成验证（读取真实模板文件），但仅验证结构，不验证内容语义

**建议：** 内容设计类 Story 在 Epic 规格阶段安排"内容架构评审"，由 SM + Architect 共同确认设计方向。

---

## 四、关键突破时刻

### B1. Story 2.1 -- 唯一零摩擦实现

Dana（QA Engineer）："61 个测试一次全绿，无任何调试问题。这是 19 个 Story 中唯一的零摩擦记录。"

**原因分析：** Epic 1 的脚手架质量直接决定了 Epic 2 的启动摩擦。Story 1.1 排除的每个"地雷"（vitest passWithNoTests、ESLint flat config）为 Story 2.1 节省了全部重复调试。

**教训：** 脚手架 Story 的质量是乘数效应，一次排雷 = 多次节省。

---

### B2. Story 2.2 -- `$` 字符替换陷阱

Charlie（Senior Dev）："`String.prototype.replace` 的第二个参数中 `$&`、`$'` 有特殊语义。如果不处理，agent 名称含 `$` 时安装文件内容会静默错误。"

**解决方案：** 改用函数形式 `() => value` 作为 replacement，彻底规避。

---

### B3. Story 4.1 -- 主动识别架构性错误

Winston（Architect）："这是整个 Sprint 中主动纠错能力最强的一次。Dev Agent 没有按错误设计盲目实现，而是主动发起变更。"

**教训：** 实施阶段发现规格问题是正常的，关键是有正式流程来处理（Sprint Change Proposal）。

---

### B4. Story 6.3 -- 隐式契约变化的回归发现

Elena（Junior Dev）："`install()` 增加返回值后，集成测试中的 `toBeUndefined()` 断言变成了误报。Dev Agent 识别了这一隐式契约变化并同步修复。"

**教训：** 返回值变化是 API 契约变化，需要同步更新所有依赖方的断言。

---

## 五、跨 Epic 模式分析

### 5.1 持续性摩擦点

| 摩擦点 | 首次出现 | 最后出现 | 影响范围 |
|--------|----------|----------|----------|
| Story Status 不同步 | Epic 1 | Epic 6 | 全部 19 个 Story |
| ESM 模块系统陷阱 | Story 1.1 | Story 6.3 | ~10 个 Story |
| Vitest Mock 隔离 | Epic 2 | Epic 6 | ~8 个 Story |
| 预存 Lint 错误干扰 | Story 1.1 | Story 2.1 | 5 个 Story |

### 5.2 成功模式

| 模式 | 首次建立 | 复用次数 | 价值 |
|------|----------|----------|------|
| 架构守则文档化 | Story 1.1 | 19 次 | 零架构漂移 |
| 适配器抽象 | Story 2.1 | Epic 2-6 | 平台扩展免返工 |
| 增量增强（可选参数 + 默认值） | Story 3.1 | 5+ 次 | 零破坏性变更 |
| Story 间知识传递 | Story 1.2 | 18 次 | 减少重复摸索 |
| wrapXxxError 同构模式 | Story 3.1 | 2 次 | 错误处理可预测 |
| afterEach 状态重置 | Story 2.x | Epic 2-6 | 测试稳定性 |

### 5.3 团队成长曲线

**Epic 1-2：探索期**
- 频繁遇到 ESM 陷阱、Mock 隔离问题
- 每个 Story 都在建立新模式

**Epic 3-4：稳定期**
- 模式复用开始发挥作用
- Sprint Change Proposal 展示了成熟的流程意识

**Epic 5-6：高效期**
- Story 6.2 完全复用 6.1 建立的模式，零摸索成本
- 架构约束已内化为"团队习惯"而非"外部规则"

---

## 六、累积技术债清单

| # | 来源 | 描述 | 严重性 | 状态 |
|---|------|------|--------|------|
| D1 | Story 1.3 | Dev Agent Record 空白（记录债务） | 低 | 未解决 |
| D2 | Story 3.3 | `wrapNetworkError` 为预留基础设施，永远不触发 | 低 | 未解决（设计预留） |
| D3 | Epic 4 | FRAMEWORK_FILES 在 installer.js 和 package.json 两处维护，无 CI 一致性校验 | 中 | 未解决 |
| D4 | Epic 5/6 | README 不含 `update`、`status`、`--json` 命令说明 | 高 | 未解决 |
| D5 | Story 6.2 | `status` 无专用 UNHEALTHY exit code，使用 GENERAL_ERROR(1) | 低 | 设计决策 |
| D6 | Story 6.3 | `status --json` 为占位实现，实际未输出结构化数据 | 中 | 未解决 |
| D7 | 全项目 | 全部 19 个 Story 文件 Status 字段与 sprint-status.yaml 不一致 | 中 | 系统性问题 |

---

## 七、行动项汇总

### 高优先级

| # | 行动项 | 责任角色 | 来源 |
|---|--------|---------|------|
| A1 | 更新 README，补充 `update`/`status`/`--json` 命令说明（`--json` 专注 AI 调用场景） | Tech Writer + Dev | Epic 5/6 回顾 |
| A2 | 将 Story Status 字段同步纳入 Done Definition，或添加 CI 校验脚本 | SM | 全项目回顾 |
| A3 | 批量修复全部 19 个 Story 文件的 Status 字段 | SM/Dev | 全项目回顾 |

### 中优先级

| # | 行动项 | 责任角色 | 来源 |
|---|--------|---------|------|
| A4 | 实现 `status --json` 完整输出（Story 6.3 遗留 TODO） | Dev | Epic 6 回顾 |
| A5 | 为 FRAMEWORK_FILES 双重维护添加 CI 一致性校验，或合并为单一数据源 | Dev | Epic 4 回顾 |
| A6 | 内容设计类 Story 在规格阶段安排"内容架构评审" | SM + Architect | Epic 4 回顾 |
| A7 | "预留场景"类 Story 明确标注 `[RESERVED]`，便于优先级管理 | SM/PM | Epic 3 回顾 |

### 低优先级

| # | 行动项 | 责任角色 | 来源 |
|---|--------|---------|------|
| A8 | 占位骨架函数使用 throw 而非空函数，防止假阳性测试 | Dev | Epic 2 回顾 |
| A9 | 跨 Epic 修改测试时在 Dev Notes 中标注影响范围 | Dev | Epic 3 回顾 |

---

## 八、项目级经验总结

### 给未来项目的 5 条核心教训

**1. 脚手架质量是乘数效应**

Story 1.1 排除的每个"地雷"为后续 18 个 Story 节省了重复调试。投资在脚手架上的额外精力，回报倍率远超预期。

**2. 架构约束必须文档化到代码中，而非仅存在于文档中**

将 6 条强制规则写入占位文件注释，使约束在每个 Story 的开发环境中可见。"看得见的规则"比"写在文档里的规则"有效得多。

**3. 增量增强 > 破坏性重构**

可选参数 + 默认值的模式在 Epic 3-6 中反复证明有效。每次扩展都是"添加新能力"而非"修改已有行为"，零破坏 = 零返工。

**4. 流程改善不能依赖自觉，需要自动化保障**

Story Status 不同步问题持续 6 个 Epic 未改善，证明仅靠回顾提出 + 个人执行是不够的。需要 CI 脚本或门控条件等自动化手段。

**5. 回顾必须及时，不能补做**

补做的回顾丢失了实时上下文和情绪记忆。每个 Epic 完成后立即回顾，才能让行动项有足够的执行窗口。

---

## 九、对后续阶段的建议

### Phase 1.5（多平台扩展）准备

Alice（Product Owner）："接下来是 OpenClaw 和 Claude Code 平台支持。"

Winston（Architect）："适配器架构已经准备好了。每个新平台只需：一个适配器文件 + 对应测试 + platform.js 注册。"

**准备清单：**
- [ ] 更新 README 覆盖当前所有功能（A1）
- [ ] 修复 `status --json` 占位实现（A4）
- [ ] 确认 FRAMEWORK_FILES 一致性（A5）
- [ ] 为新平台适配器建立测试模板（基于 HappyCapy 测试）

### 流程改善

Bob（Scrum Master）："基于这次全项目回顾，以下流程改善立即生效。"

1. **Done Definition 更新：** Story 完成必须同步更新 Story 文件 Status 字段
2. **回顾节奏：** 每个 Epic 完成后当天运行 retro
3. **文档同步：** 功能 Story 的 AC 中包含"对应文档已更新或有独立文档 Story 创建"

---

Bob（Scrum Master）："团队，这是 bmad-expert 从零到完整 MVP + Growth 的旅程回顾。19 个 Story、172 个测试、零回归、一次成功的 Course Correction。这不是完美的旅程，但我们在过程中建立了有效的模式，也清楚地识别了需要改善的地方。"

Alice（Product Owner）："感谢团队的付出。bmad-expert 已经准备好迎接更多平台用户了。"

Charlie（Senior Dev）："最重要的是，我们有了一套可复制的工程实践 -- 架构约束前置、增量增强、分层测试。这些模式不仅对 bmad-expert 有效，对未来任何项目都有效。"

Dana（QA Engineer）："172 个测试是我们的安全网。感谢这个过程。"

---

*报告由 Bob（Scrum Master）主持生成，全团队参与*
