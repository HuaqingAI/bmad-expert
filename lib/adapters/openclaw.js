// lib/adapters/openclaw.js
// OpenClaw 平台适配器 — Story 8.1（探针）/ Story 8.2（完整实现）
//
// 接口契约（Phase 2）：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>
//   check(agentId)           → Promise<'not_installed'|'installed'|'corrupted'>
//   getToolsParam()          → string | null
//
// 平台特征（Story 8.2 预研确定）：
//   环境变量：OPENCLAW_SESSION_ID → 置信度 1.0
//   文件系统：[cwd]/.openclaw/ 目录 → 置信度 0.9
//
// 路径白名单（NFR12）：[cwd]/.openclaw/agents/[agentId]（项目级，与 Claude Code 模式一致）
// 注册机制：文件注册（写入 [cwd]/.openclaw/agents-registry.json），无外部 CLI 依赖
// --tools 参数：null（不传，与 HappyCapy 一致）
//
// 注意：OPENCLAW_BASE_PATH 必须是函数（每次调用 process.cwd()），不能是模块加载时固定的常量，
//       原因：测试中 process.cwd() 通过 mock 可能变化，模块级常量会导致测试失效。

import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'
import { printSuccess } from '../output.js'

/**
 * 返回 OpenClaw agents 基础路径（函数而非常量，确保 cwd mock 在测试中生效）
 * @returns {string}
 */
function openclawBasePath() {
  return path.join(process.cwd(), '.openclaw', 'agents')
}

/**
 * 返回 OpenClaw 平台的探针置信度（0-1）
 * 检测策略（按优先级）：
 *   1. OPENCLAW_SESSION_ID 存在 → 1.0（平台专属会话变量，确定命中）
 *   2. [cwd]/.openclaw/ 目录存在 → 0.9（项目级配置目录，高置信）
 *   3. 否则 → 0
 * @returns {Promise<number>}
 */
export async function detectConfidence() {
  if (process.env.OPENCLAW_SESSION_ID) return 1.0
  const openclawDir = path.join(process.cwd(), '.openclaw')
  if (await fs.pathExists(openclawDir)) return 0.9
  return 0
}

/**
 * 检测当前环境是否为 OpenClaw 平台
 * @returns {Promise<boolean>}
 */
export async function detect() {
  return (await detectConfidence()) > 0
}

/**
 * 返回指定 agent 的安装路径（绝对路径）
 * @param {string} agentId - agent 标识符（如 'bmad-expert'），必须是单段非空名称
 * @returns {string} 绝对路径，如 /project/.openclaw/agents/bmad-expert
 * @throws {BmadError} E004 — 非法 agentId 或路径越界
 */
export function getInstallPath(agentId) {
  // agentId 必须是非空单段标识符：禁止空串、"."、控制字符及任何含路径分隔符的值
  if (
    !agentId ||
    agentId === '.' ||
    agentId === '..' ||
    agentId.includes('/') ||
    agentId.includes('\\') ||
    /[\x00-\x1f]/.test(agentId)
  ) {
    throw new BmadError(
      'E004',
      `非法 agentId：'${agentId}' 不是有效的单段标识符`,
      new Error('agentId 不得为空、"."、".." 或包含路径分隔符、控制字符')
    )
  }
  const basePath = openclawBasePath()
  const targetPath = path.join(basePath, agentId)
  // 路径安全验证（NFR12）：必须严格位于白名单目录的直接子目录
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError(
      'E004',
      '非法安装路径：路径遍历被拒绝',
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${basePath}'`)
    )
  }
  return resolvedTarget
}

/**
 * 检测指定 agent 的安装状态（幂等检测，NFR3: ≤3s）
 * @param {string} agentId - agent 标识符
 * @returns {Promise<'not_installed'|'installed'|'corrupted'>}
 */
export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  const exists = await fs.pathExists(installPath)
  if (!exists) return 'not_installed'
  // 以 AGENTS.md 作为完整安装的标记文件
  const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
  return agentsMdExists ? 'installed' : 'corrupted'
}

/**
 * 执行 OpenClaw 平台注册（文件写入已由 installer.js/orchestrator.js 完成，此处仅做 registry 注册）
 * 注册机制：向 [cwd]/.openclaw/agents-registry.json 写入 agentId 记录（读取-合并-写入）
 * @param {Object|null} files - 忽略（文件已由 installer.js 写入文件系统）
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert' }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  // files 参数由 installer.js/orchestrator.js 在文件写入阶段处理，此处仅做平台注册
  void files
  const agentId = options.agentId ?? 'bmad-expert'
  const registryPath = path.join(process.cwd(), '.openclaw', 'agents-registry.json')

  // 读取已有 registry（不存在则为空对象；parse 错误向上抛出，不进入降级路径）
  let registry = {}
  if (await fs.pathExists(registryPath)) {
    registry = await fs.readJson(registryPath)
  }
  // 合并写入当前 agentId；仅写入失败时降级
  registry[agentId] = { installedAt: new Date().toISOString() }
  try {
    await fs.outputJson(registryPath, registry, { spaces: 2 })
  } catch {
    // 降级路径：registry 写入失败 → 输出手动注册步骤，不 throw
    printSuccess(
      `\n无法写入 OpenClaw 注册文件，请手动注册：\n  在 [项目根]/.openclaw/agents-registry.json 中添加：\n  { "${agentId}": { "installedAt": "<安装时间>" } }\n`
    )
  }
}

/**
 * 返回该平台对应的 --tools 参数值（Phase 2 接口扩展）
 * OpenClaw 不需要传 --tools 参数（与 HappyCapy 一致）
 * @returns {null}
 */
export function getToolsParam() {
  return null
}
