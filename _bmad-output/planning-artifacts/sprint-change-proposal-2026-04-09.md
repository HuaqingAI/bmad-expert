# Sprint Change Proposal — 2026-04-09

**状态：已批准**

## 1. 问题摘要

**触发来源：** Phase 3 发版后集成验证

**问题类型：** 集成断层（Agent 层与 CLI 层未串联）+ 代码 Bug（FR56 实现不完整）

**问题陈述：**

Phase 3（v0.3.0）新增了 `bmad-expert init`（workspace 初始化）、`uninstall`（卸载）、init 幂等保护、update 扩展配置文件等功能。但这些功能目前只能通过 CLI 手动调用，agent 层完全不知道这些命令的存在，导致用户通过 agent 会话使用时流程断裂。

此外，`init --yes` 模式存在逻辑缺陷：对已有 CLAUDE.md 一律 skip，在 HappyCapy 等平台（workspace 默认带 CLAUDE.md）中导致 init 实质失效。

**发现时机：** Phase 3 发版后，在 HappyCapy 平台实际使用中验证发现。

---

## 2. 断层清单

| # | 断层描述 | 影响层 | 严重度 |
|---|---------|--------|--------|
| 1 | agent/BOOTSTRAP.md 将 BMAD 环境检测与 agent 身份初始化耦合，BOOTSTRAP 自毁后 workspace 检查逻辑随之丢失 | agent/BOOTSTRAP.md | 高 |
| 2 | agent/AGENTS.md Step 3 仅在用户显式触发或调用 bmad-* 时检测环境，不主动检测 workspace 配置完整性 | agent/AGENTS.md | 高 |
| 3 | agent/bmad-project-init.md install 完成后直接跳 bmad-help，不引导执行 init 配置 workspace | agent/bmad-project-init.md | 中 |
| 4 | `lib/initializer.js` resolveConflicts 中 `--yes` 模式对所有已有文件一律 skip，不区分"已含 bmad 配置"与"平台默认空文件" | lib/initializer.js（代码） | **最高** |
| 5 | CLI install 成功输出未提及 `npx bmad-expert init` 命令 | lib/installer.js（代码） | 低 |
| 6 | workspace CLAUDE.md 路由缺失导致 agent 从 workspace 根目录盲搜 bmad skill（#1 + #4 的下游后果） | 系统级 | 高 |

**因果链：**

```
init --yes 对已有 CLAUDE.md 直接 skip (#4)
  → workspace CLAUDE.md 缺少 bmad 路由段落
    → agent 不知道默认项目路径 (#6)
      → bmad skill 从 workspace 根目录盲搜，偶尔失效

BOOTSTRAP 自毁后 workspace 检查逻辑丢失 (#1)
  + AGENTS.md 不主动检测 workspace 配置 (#2)
    → 即使修复了 #4，agent 也不会自动触发 init
```

---

## 3. 影响分析

### 制品影响

| 制品 | 影响 |
|------|------|
| PRD FR56 | 当前实现不完整：只实现了"跳过"路径，缺少"追加/合并"路径 |
| Architecture：init 幂等保护 | `--yes` 模式行为定义需扩展：增加"追加"语义 |
| agent/BOOTSTRAP.md 模板 | 职责分离：移除 workspace 检测逻辑，保留 agent 身份初始化 |
| agent/AGENTS.md 模板 | 新增 Session Startup Step：每次 session 执行 workspace 环境检查 |
| agent/bmad-project-init.md | install 成功后追加 init 引导步骤 |
| templates/workspace-claude.md | 增加 bmad 配置段落标记（开闭注释对） |

### Epic/Story 影响

| Epic | 影响 |
|------|------|
| Epic 10 | Story 10.3（幂等保护）AC 需补充：`--yes` 模式增加"追加"语义 |
| Epic 11 | 无影响 |

### 不受影响的范围

- Phase 3 所有其他功能（uninstall、update 扩展、manifest 管理）正常
- install 命令本身无 bug
- 模板内容（workspace-claude.md、project-claude.md、workflow）的实际内容无需修改

---

## 4. 推荐方案

**选择：增量修复（Incremental Fix）**

不回滚任何已发布功能，在现有代码和模板基础上针对性修补 6 个断层。修复分为 **代码层**（lib/）和 **agent 模板层**（agent/）两条线，可并行开发。

---

## 5. 变更提案明细

### 提案 A: BOOTSTRAP.md 职责分离（agent 模板）

**文件：** `agent/BOOTSTRAP.md`

**原则：** BOOTSTRAP 管"你是谁"（agent 身份），AGENTS.md 管"你在哪个环境里工作"（workspace 状态）。

**变更：**

1. **步骤 ③ "BMAD 环境检测" → 改为引用 AGENTS.md**

原步骤 ③ 的完整环境检测 + install 逻辑移除，替换为：

```markdown
## ③ Workspace 环境检查

按照 AGENTS.md 的「Workspace 环境检查」步骤执行。

（该步骤在 AGENTS.md 中定义，此处不重复。首次 session 由 BOOTSTRAP 触发一次，
后续 session 由 AGENTS.md Session Startup 自动执行。）
```

2. **步骤 ⑤ 保持不变** — 跳转至 bmad-help

**设计要点：**
- BOOTSTRAP 仍然在首次 session 中触发一次 workspace 检查（通过引用），不断链
- 逻辑只在 AGENTS.md 中定义一处，避免双份维护
- BOOTSTRAP 自毁后，AGENTS.md 接管后续 session 的环境检查

---

### 提案 B: AGENTS.md 新增 Workspace 环境检查（agent 模板）

**文件：** `agent/AGENTS.md`

**变更：** 在 Session Startup 中新增 workspace 环境检查步骤，每次 session 启动都执行。

**新增段落（插入在 Step 2 "Check for BOOTSTRAP.md" 和 Step 3 "BMAD Project Initialization" 之间）：**

```markdown
**Step 2.5 — Workspace 环境检查:**

每次 session 启动时执行。操作幂等，已就绪的 workspace 秒过。

1. **扫描 BMAD 项目：**
   在 cwd 及其一级子目录中搜索 `_bmad/bmm/config.yaml`（或 `_bmad/_config/manifest.yaml`）：
   - 找到 0 个 → 输出 `当前 workspace 未检测到 BMAD 项目。如需安装，请说 "bmad install"。` → 跳过后续检查
   - 找到 1+ 个 → 记录所有项目路径

2. **检查 Workspace CLAUDE.md 路由：**
   读取 cwd 下的 CLAUDE.md（如果存在），检查是否包含 `<!-- bmad-workspace-config -->` 标记：
   - 标记存在且闭合（同时包含 `<!-- /bmad-workspace-config -->`）→ 配置就绪，跳过
   - 标记不存在或不完整 → 在检测到的第一个 BMAD 项目目录下执行：
     ```bash
     npx bmad-expert init --yes
     ```
   - init 成功 → 输出 `Workspace BMAD 配置已补全。`
   - init 失败 → 输出错误 + `可稍后手动执行: cd <项目路径> && npx bmad-expert init`
   - **init 失败不阻塞 session**，BMAD 核心功能仍可用

3. **状态汇报（简要）：**
   ```
   BMAD: ✓ 就绪 | 项目: bmad-expert/ | 默认: bmad-expert/
   ```
```

**同时修改 Step 3：**

原 Step 3 的触发条件中，增加一条：

```markdown
**Step 3 — BMAD Project Initialization (on demand):**

[...原有触发条件保持不变...]
- **新增触发条件：** 用户说 "bmad workspace refresh"、"bmad reinit"、
  "刷新 bmad 环境"、"重新检测 workspace" 等 → 重新执行 Step 2.5 的完整检查流程
```

**设计要点：**
1. **幂等：** 已配置好的 workspace 只做两次 fs.pathExists 检查，秒过
2. **不阻塞：** init 失败不影响 session 正常使用
3. **支持多项目：** 扫描一级子目录
4. **标记检测：** 用 HTML 注释开闭标记对，比检测段落标题更可靠
5. **手动刷新：** 通过自然语言触发词，适用于 workspace 结构变更后

---

### 提案 C: bmad-project-init.md install 后串联 init（agent 模板）

**文件：** `agent/bmad-project-init.md`

**变更：** 在 Step 4（install 成功后）追加 init 引导步骤。

**在 Step 4 "Announce and Redirect" 之前插入新步骤：**

```markdown
## Step 3.5 — Workspace 初始化

install 完成后（`_bmad/bmm/config.yaml` 已存在），自动执行 workspace 初始化：

```bash
npx bmad-expert init --yes
```

- 成功 → 输出 `BMAD 方法论安装完成，workspace 配置已就绪。`
- 失败 → 输出 `BMAD 方法论已安装。Workspace 配置未完成，
  可稍后执行 npx bmad-expert init 完成配置。`

无论成功或失败，都继续进入 Step 4。
```

**Rationale：** install 流程内的自然延续。即使 AGENTS.md 的 session 检查能兜底，在 install 流程中直接串联体验更好（用户不需要等到下一次 session）。

---

### 提案 D: initializer.js --yes 模式追加逻辑（代码）

**文件：** `lib/initializer.js`

**问题：** `resolveConflicts()` 第 243-246 行，`--yes` 模式对所有已有文件一律 `action: 'skipped'`。在 HappyCapy 等平台中，workspace 默认带 CLAUDE.md（平台生成，不含 bmad 配置），导致 init 实质失效。

**当前逻辑（第 234-247 行）：**

```javascript
// --yes mode: skip all existing files (safe default)
if (options.yes) {
  results.push({ path: file.path, type: file.type, content: file.content, action: 'skipped' })
  continue
}
```

**修改方案：** 对 `workspace-claude` 类型文件，`--yes` 模式下检查已有文件是否包含 bmad 配置标记，不包含则追加。

```javascript
// --yes mode: smart handling per file type
if (options.yes) {
  // workspace CLAUDE.md: check if bmad config already present
  if (file.type === 'workspace-claude') {
    const existingContent = await fs.readFile(join(cwd, file.path), 'utf8')
    const hasOpenTag = existingContent.includes('<!-- bmad-workspace-config -->')
    const hasCloseTag = existingContent.includes('<!-- /bmad-workspace-config -->')

    if (hasOpenTag && hasCloseTag) {
      // bmad config already present and complete → skip
      results.push({ ...file, action: 'skipped' })
    } else {
      // bmad config missing or incomplete → append
      // Extract bmad section from generated content
      const bmadSection = extractBmadSection(file.content)
      const separator = existingContent.endsWith('\n') ? '\n' : '\n\n'
      const appendedContent = existingContent + separator + bmadSection
      results.push({ ...file, content: appendedContent, action: 'appended' })
    }
  } else {
    // Other file types: skip (safe default, unchanged behavior)
    results.push({ ...file, action: 'skipped' })
  }
  continue
}
```

**新增辅助函数 `extractBmadSection()`：**

```javascript
/**
 * Extract the bmad workspace config section from generated template content.
 * Returns the section wrapped in marker comments.
 *
 * @param {string} templateContent - Full generated workspace CLAUDE.md content
 * @returns {string} bmad config section with markers
 */
function extractBmadSection(templateContent) {
  // If template already contains markers, extract that section
  const openMarker = '<!-- bmad-workspace-config -->'
  const closeMarker = '<!-- /bmad-workspace-config -->'
  const openIdx = templateContent.indexOf(openMarker)
  const closeIdx = templateContent.indexOf(closeMarker)

  if (openIdx !== -1 && closeIdx !== -1) {
    return templateContent.substring(openIdx, closeIdx + closeMarker.length)
  }

  // Fallback: wrap the meaningful sections (## Default Project onward)
  const defaultProjectIdx = templateContent.indexOf('## Default Project')
  if (defaultProjectIdx === -1) return `${openMarker}\n${templateContent}\n${closeMarker}`
  return `${openMarker}\n${templateContent.substring(defaultProjectIdx)}\n${closeMarker}`
}
```

**模板配套变更 `templates/workspace-claude.md`：**

在模板内容中添加开闭标记：

```markdown
# Claude

Project-specific instructions and context for Claude Code in this desktop.


<!-- bmad-workspace-config -->
## Default Project

**When the user does not specify a project, default to `PROJECT_NAME`.**

- Path: `PROJECT_PATH/`
- Before executing any project-related task, **read `PROJECT_PATH/CLAUDE.md` first** to understand project structure and rules
- All BMAD-related skills (e.g. `bmad-dev-story`, `bmad-create-story`, `bmad-sprint-status`) run in the `PROJECT_PATH/` directory unless a different working directory is specified


## Repository Operations

- For routine repository operations (PR, Issue, Project, CI status, code review, and git remote operations such as pull/push), use `/github`
<!-- /bmad-workspace-config -->
```

**generateFiles() 配套变更（第 334 行附近）：**

处理新增的 `action: 'appended'` 状态：

```javascript
// ── Phase 4: Write files that are not skipped ──
for (const file of resolved) {
  if (file.action === 'skipped') continue

  const targetPath = join(cwd, file.path)
  if (file.type === 'workflow') {
    await fs.ensureDir(dirname(targetPath))
  }
  await fs.outputFile(targetPath, file.content)
}
```

无需额外修改 — `appended` 状态的 `file.content` 已经是追加后的完整内容，直接写入即可。

**Summary output 配套变更（第 457 行附近）：**

```javascript
const appended = files.filter((f) => f.action === 'appended')
// ...
if (appended.length) parts.push(`追加: ${appended.map((f) => f.path).join(', ')}`)
```

**交互模式也需更新（第 249 行附近）：**

为已有 workspace-claude 类型文件增加"追加 bmad 配置"选项：

```javascript
// Interactive mode: prompt for each existing file
if (file.type === 'workspace-claude') {
  const existingContent = await fs.readFile(join(cwd, file.path), 'utf8')
  const hasOpenTag = existingContent.includes('<!-- bmad-workspace-config -->')
  const hasCloseTag = existingContent.includes('<!-- /bmad-workspace-config -->')

  if (hasOpenTag && hasCloseTag) {
    // Already has bmad config — offer standard options
    // [original interactive logic unchanged]
  } else {
    // No bmad config — offer append as default option
    const answer = await askQuestion(
      `文件已存在: ${file.path}（未包含 BMAD 配置）\n  1. 追加 BMAD 配置段落 2. 覆盖（先备份） 3. 跳过 4. 查看 diff\n请选择 (1/2/3/4): `
    )
    if (answer === '1') {
      const bmadSection = extractBmadSection(file.content)
      const separator = existingContent.endsWith('\n') ? '\n' : '\n\n'
      results.push({ ...file, content: existingContent + separator + bmadSection, action: 'appended' })
    }
    // ... handle other options
  }
} else {
  // [original interactive logic for non-workspace-claude files]
}
```

**设计要点：**
1. **只影响 workspace-claude 类型**：project-claude 和 workflow 文件保持原有 skip 行为
2. **标记检测**：用 `<!-- bmad-workspace-config -->` / `<!-- /bmad-workspace-config -->` 开闭对，残缺标记（只有开没有闭）视为无效，触发重新追加
3. **追加不覆盖**：用户原有内容完整保留，bmad 段落追加到末尾
4. **幂等**：标记完整存在 → skip，绝不重复追加
5. **FR56 正确实现**：`--yes` 模式从"全部跳过"变为"智能判断（标记存在 skip，不存在 append）"

---

### 提案 E: installer.js install 成功输出追加 init 提示（代码）

**文件：** `lib/installer.js` 第 143-144 行

**当前输出：**

```javascript
printSuccess(
  `安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
)
```

**修改为：**

```javascript
printSuccess(
  `安装完成（用时 ${duration}s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流\n\n如果你在使用 CLI，运行 npx bmad-expert init 配置工作环境。\n（通过 AI agent 使用时，init 将在下次 session 启动时自动执行。）`
)
```

**Rationale：** CLI 用户和 agent 用户都有明确预期。成本极低。

---

## 6. 测试场景

| # | 场景 | 预期结果 |
|---|------|----------|
| 1 | 全新 workspace + 全新 agent | BOOTSTRAP → 环境检查 → install → init → 一条龙完成 |
| 2 | 已有 BMAD 项目 + 新 session | AGENTS.md Step 2.5 → 检测通过 → 秒过，无多余输出 |
| 3 | HappyCapy 默认 CLAUDE.md + BMAD 项目 | init --yes → 检测无 bmad 标记 → append bmad 段落 → 原有内容不变 |
| 4 | CLAUDE.md 已含完整 bmad 标记 | init --yes → skip → 不重复追加 |
| 5 | 多项目 workspace | 扫描列出所有项目 → --yes 取第一个 → 交互模式让用户选 |
| 6 | init 失败（网络/权限） | 不阻塞 session → 输出手动命令 → 下次 session 重试 |
| 7 | 用户手动编辑过 bmad 标记段落 | init --yes 检测到标记完整 → skip → 不覆盖 |
| 8 | 标记残缺（只有开标记没有闭标记） | 视为无效 → 重新追加完整段落 |
| 9 | CLAUDE.md 末尾无换行 | append 前插入空行分隔 → 内容不粘连 |
| 10 | "bmad workspace refresh" 触发 | 重新执行 Step 2.5 → 发现新项目/修复配置 |

---

## 7. 实施计划

### 依赖关系

```
提案 D (initializer.js) ─── 前置 ───→ 提案 B (AGENTS.md) + 提案 C (bmad-project-init.md)
                                       ↑
提案 A (BOOTSTRAP.md) ──── 引用 ───→ 提案 B

提案 E (installer.js) ─── 独立，可并行
```

### 建议执行顺序

| 顺序 | 提案 | 文件 | 预计工作量 |
|------|------|------|-----------|
| 1 | D | lib/initializer.js + templates/workspace-claude.md | 中（代码 + 测试） |
| 2 | B | agent/AGENTS.md | 小（模板文本） |
| 3 | A | agent/BOOTSTRAP.md | 小（模板文本） |
| 4 | C | agent/bmad-project-init.md | 小（模板文本） |
| 5 | E | lib/installer.js | 极小（一行文案） |

### Story 建议

此修复可作为 **单个 Story（10.4 或 hotfix-story）** 实施，理由：

1. 所有变更围绕同一个断层链条，不可分割
2. 代码变更集中在 initializer.js 一个文件（+ 模板标记）
3. Agent 模板变更不涉及代码测试
4. 总工作量可控（代码层改动约 80 行，模板层约 60 行文本）

---

## 8. 约束确认

| 约束 | 是否满足 |
|------|---------|
| 不改变 PRD 方向 | ✓ — 修复 FR56 的未完整实现，不新增 FR |
| 不改变 Phase 3 的 FR 定义 | ✓ — FR56 原文"提供覆盖、跳过或合并选项"已包含合并语义 |
| 已发版 CLI 功能本身没问题 | ⚠ 修正 — init --yes 的 skip-all 行为是 FR56 实现不完整，属于 bug 修复 |
| 修复范围可控 | ✓ — 1 个 JS 文件 + 1 个模板文件 + 3 个 agent 模板文件 |

---

## 9. Party Mode 评审共识

以下决议在评审中达成一致：

| 决议 | 内容 |
|------|------|
| BOOTSTRAP 职责分离 | BOOTSTRAP 管 agent 身份，AGENTS.md 管 workspace 环境。BOOTSTRAP 通过引用 AGENTS.md 步骤（而非重复定义）在首次 session 中执行环境检查 |
| init --yes 追加策略 | 标记不存在 → append；标记存在且完整 → skip；用户想更新 → 交互模式 |
| 标记格式 | 用开闭标记对 `<!-- bmad-workspace-config -->` / `<!-- /bmad-workspace-config -->`，两个都在才算有效 |
| 多项目处理 | 单项目自动默认；多项目 --yes 取第一个，交互模式让用户选 |
| 追加安全性 | 追加前确保空行分隔；残缺标记视为无效 |
| 触发词 | 宽泛自然语言匹配，不限于精确命令 |
| 测试覆盖 | 10 个关键场景 |

---

## 10. 制品更新清单

提案批准后，以下制品需同步更新：

| 制品 | 更新内容 |
|------|---------|
| `_bmad-output/planning-artifacts/epics.md` | Epic 10 新增 Story 10.4（或标注为 hotfix） |
| `_bmad-output/planning-artifacts/architecture.md` | init 幂等保护段落补充 `--yes` 追加语义；增加 bmad 标记说明 |
| `sprint-status.yaml` | 新增 Story 条目 |
| `CHANGELOG.md` | v0.3.1 记录 init --yes append 修复 |
