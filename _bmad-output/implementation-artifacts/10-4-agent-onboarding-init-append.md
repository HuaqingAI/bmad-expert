# Story 10.4: Agent Onboarding 流程串联与 init --yes 追加修复

Status: ready-for-dev

## Story

As a 用户（通过 AI agent 对话）,
I want agent 首次 session 启动时自动检测 workspace 的 BMAD 配置状态并在缺失时自动执行 init，且 init --yes 在已有非 bmad CLAUDE.md 时追加而非跳过,
so that install → init → 正常使用这条链路在 agent 会话中能自动串起来，不需要我知道要手动跑 CLI 命令。

## Acceptance Criteria

1. **AC1 — init --yes 智能追加（代码层）**
   Given workspace CLAUDE.md 已存在但不含 `<!-- bmad-workspace-config -->` 标记
   When 执行 `npx bmad-expert init --yes`
   Then 从模板提取 bmad 配置段落（标记对之间），追加到已有文件末尾，原有内容保留
   And `action: 'appended'`，追加前确保空行分隔

2. **AC2 — init --yes 幂等（代码层）**
   Given workspace CLAUDE.md 已含完整标记对
   When 执行 `npx bmad-expert init --yes`
   Then skip，不重复追加
   And 残缺标记（只有开无闭）视为无效，触发重新追加

3. **AC3 — 交互模式追加选项（代码层）**
   Given workspace CLAUDE.md 存在但无 bmad 标记
   When 交互模式 `npx bmad-expert init`
   Then 新增"追加 BMAD 配置段落"选项作为默认推荐，在原有覆盖/跳过/diff 之前

4. **AC4 — 模板标记（代码层）**
   `templates/workspace-claude.md` 用 `<!-- bmad-workspace-config -->` / `<!-- /bmad-workspace-config -->` 包裹 bmad 段落

5. **AC5 — AGENTS.md Workspace 环境检查（agent 模板层）**
   `agent/AGENTS.md` Session Startup 新增 Step 2.5：扫描 cwd 及一级子目录 BMAD 项目 → 检查 config.yaml 和 CLAUDE.md bmad 标记 → 任一不满足则**加载 `bmad-project-init.md`** 委派处理（由其判断需 install+init 还是仅 init）

6. **AC6 — AGENTS.md 手动刷新触发（agent 模板层）**
   用户说 "bmad workspace refresh"/"bmad reinit"/"刷新 bmad 环境" 等 → 重新执行 Step 2.5

7. **AC7 — BOOTSTRAP.md 职责分离（agent 模板层）**
   步骤 ③ 改为引用 AGENTS.md Step 2.5，不重复定义环境检测逻辑

8. **AC8 — bmad-project-init.md 统一入口（agent 模板层）**
   Step 1 扩展三种检测路径：完全就绪(skip)、已安装未配置(仅init)、需安装(install+init)。install 成功后自动执行 `npx bmad-expert init --yes`，失败不阻塞。AGENTS.md Step 2.5 委派至此文件。

9. **AC9 — installer.js 输出提示（代码层）**
   install 成功输出追加：`如果你在使用 CLI，运行 npx bmad-expert init 配置工作环境。`

10. **AC10 — 测试覆盖**
    `test/initializer.test.js` 新增场景：HappyCapy 默认 CLAUDE.md + init --yes → append；完整标记 → skip；残缺标记 → 重新追加；空行分隔；`action: 'appended'` 摘要输出

## Tasks / Subtasks

- [ ] Task 1: 模板标记 (AC: #4)
  - [ ] 1.1 修改 `templates/workspace-claude.md`：用 `<!-- bmad-workspace-config -->` / `<!-- /bmad-workspace-config -->` 包裹 `## Default Project` 至文件末尾
- [ ] Task 2: initializer.js --yes 追加逻辑 (AC: #1, #2)
  - [ ] 2.1 新增 `extractBmadSection(templateContent)` 函数：提取标记对之间的内容
  - [ ] 2.2 修改 `resolveConflicts()` 中 `--yes` 分支：workspace-claude 类型检测标记 → 完整则 skip / 缺失或残缺则 append
  - [ ] 2.3 append 逻辑：读已有内容 + 确保空行分隔 + 拼接 bmadSection → `action: 'appended'`
- [ ] Task 3: 交互模式追加选项 (AC: #3)
  - [ ] 3.1 修改 `resolveConflicts()` 交互分支：workspace-claude 类型无标记时新增"追加 BMAD 配置段落"选项
- [ ] Task 4: 摘要输出支持 appended (AC: #1)
  - [ ] 4.1 修改 `generateFiles()` 摘要部分：新增 appended 计数和输出
- [ ] Task 5: installer.js 输出提示 (AC: #9)
  - [ ] 5.1 修改 `lib/installer.js` printSuccess 调用：追加 init 命令提示
- [ ] Task 6: agent/AGENTS.md 环境检查 (AC: #5, #6)
  - [ ] 6.1 在 Step 2 和 Step 3 之间插入 Step 2.5「Workspace 环境检查」
  - [ ] 6.2 Step 3 增加手动刷新触发条件
- [ ] Task 7: agent/BOOTSTRAP.md 职责分离 (AC: #7)
  - [ ] 7.1 步骤 ③ 改为引用 AGENTS.md Step 2.5
- [ ] Task 8: agent/bmad-project-init.md 串联 init (AC: #8)
  - [ ] 8.1 Step 3（verify）后插入 Step 3.5 执行 `npx bmad-expert init --yes`
- [ ] Task 9: 测试覆盖 (AC: #10)
  - [ ] 9.1 新增 `extractBmadSection` 单元测试
  - [ ] 9.2 新增 resolveConflicts --yes 模式 append 场景测试
  - [ ] 9.3 新增完整标记 skip 场景测试
  - [ ] 9.4 新增残缺标记重新追加场景测试
  - [ ] 9.5 新增空行分隔验证测试
  - [ ] 9.6 新增 appended 摘要输出测试

## Dev Notes

### 实施依赖顺序

**代码层优先**（AC1-AC4, AC9-AC10），**模板层其次**（AC5-AC8 可并行）。建议顺序：

1. Task 1（模板标记）→ Task 2（追加逻辑）→ Task 3（交互模式）→ Task 4（摘要输出）→ Task 9（测试）
2. Task 5（installer 提示）可与上述并行
3. Task 6-8（agent 模板）在代码层完成后执行

### 关键技术细节

**标记检测逻辑：**
- 开标记：`<!-- bmad-workspace-config -->`
- 闭标记：`<!-- /bmad-workspace-config -->`
- 两个都在 → 完整 → skip
- 缺任何一个 → 不完整 → 追加完整段落（含标记）

**extractBmadSection 函数：**
```javascript
function extractBmadSection(templateContent) {
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

**空行分隔：** append 前检查已有内容末尾，`endsWith('\n\n')` → 不加；`endsWith('\n')` → 加一个 `\n`；否则加 `\n\n`。

**模板替换系统：** `templates/workspace-claude.md` 用 `PROJECT_NAME` / `PROJECT_PATH` 纯大写替换（不是 `{{ }}`）。`generateFileContent()` 已实现此替换。标记要放在替换变量周围，替换后标记仍保留。

**resolveConflicts 修改位置：** `lib/initializer.js` 第 234-246 行附近，当前 `--yes` 模式代码为：
```javascript
if (options.yes) {
  results.push({ path: file.path, type: file.type, content: file.content, action: 'skipped' })
  continue
}
```
改为：对 `file.type === 'workspace-claude'` 检测标记后决定 skip 或 append；其他类型保持 skip。

**generateFiles 摘要输出位置：** 约第 457 行附近，当前有 `created` 和 `skipped` 的输出逻辑，新增 `appended` 类似处理。

**installer.js 修改位置：** `lib/installer.js` 第 143-144 行 `printSuccess` 调用，在消息末尾追加 init 命令提示行。

### agent 模板文件修改说明

agent 模板文件（AGENTS.md、BOOTSTRAP.md、bmad-project-init.md）使用 `{{agent_id}}` 风格占位符，由 `installer.js` 的 `replaceTemplateVars` 处理。本次修改是纯文本内容变更，不涉及新占位符。

**AGENTS.md：** 在 Step 2（check BOOTSTRAP.md）和 Step 3（BMAD on-demand）之间插入 Step 2.5，约 20-25 行 Markdown。Step 3 增加刷新触发条件约 3 行。

**BOOTSTRAP.md：** 步骤 ③ 当前约 15 行检测+安装逻辑，替换为 3-5 行引用 AGENTS.md Step 2.5 的说明。

**bmad-project-init.md：** Step 3（verify）后插入 Step 3.5 约 10 行。

### 测试策略

扩展 `test/initializer.test.js`（当前 828 行），已有 mock 基础设施（vi.mock fs-extra、output、readline）。

新增测试组：
- `describe('extractBmadSection')` — 有标记提取 / 无标记 fallback / 空内容
- `describe('resolveConflicts --yes append')` — 无标记 append / 完整标记 skip / 残缺标记 append / 空行分隔
- `describe('generateFiles appended summary')` — appended 文件正确输出

mock 需确保 `fs.readFile` 能返回模拟的已有文件内容（含/不含标记的各种变体）。

### Project Structure Notes

所有路径和模块职责与现有架构一致：
- `lib/initializer.js` — init 命令核心，本次主要修改目标
- `templates/workspace-claude.md` — 模板文件，需加标记
- `agent/*.md` — agent 模板文件，内容变更
- `lib/installer.js` — install 命令，仅改输出消息
- `test/initializer.test.js` — 测试扩展

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4] — AC 定义
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-09.md] — 断层分析与修复方案
- [Source: _bmad-output/planning-artifacts/architecture.md#init 命令架构] — init 架构规范
- [Source: _bmad-output/planning-artifacts/architecture.md#模板体系架构] — 模板标记规范
- [Source: _bmad-output/implementation-artifacts/10-3-init-idempotent-conflict.md] — 前序 Story 实现

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
