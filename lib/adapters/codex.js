// lib/adapters/codex.js
// Codex（OpenAI）平台适配器 — Story 8.1（探针层）/ Story 8.4（完整实现）
//
// 接口契约（Phase 2）：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>
//   check(agentId)           → Promise<'not_installed'|'installed'|'corrupted'>
//
// 探针策略：
//   - CODEX_RUNTIME 存在 → 1.0（Codex 沙盒专属变量）
//   - [cwd]/.codex/ 目录存在 → 0.9（Codex 项目配置目录特征）
//   - 否则 → 0
//
// 安装路径：[cwd]/.codex/[agentId]/（类比 Claude Code 的 [cwd]/.claude/）
// 注册契约：无需外部 CLI，确保目标目录存在即完成注册
// 路径白名单：[cwd]/.codex/ 的直接子目录，拒绝任何 .. 路径遍历（NFR12）

import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'
import { printSuccess } from '../output.js'

// 白名单基础路径（动态，基于运行时 cwd）
function getCodexBaseDir() {
  return path.join(process.cwd(), '.codex')
}

/**
 * 返回 Codex 平台的探针置信度（0-1）
 * 检测策略（按优先级）：
 *   1. CODEX_RUNTIME 存在 → 1.0（Codex 沙盒专属变量，确定命中）
 *   2. [cwd]/.codex/ 目录存在 → 0.9（Codex 项目配置目录特征）
 *   3. 否则 → 0
 * @returns {Promise<number>}
 */
export async function detectConfidence() {
  if (process.env.CODEX_RUNTIME) return 1.0
  if (await fs.pathExists(getCodexBaseDir())) return 0.9
  return 0
}

/**
 * 检测当前环境是否为 Codex 平台
 * @returns {Promise<boolean>}
 */
export async function detect() {
  return (await detectConfidence()) > 0
}

/**
 * 返回指定 agent 的安装路径（绝对路径）
 * 路径格式：[cwd]/.codex/[agentId]
 * @param {string} agentId - agent 标识符（如 'bmad-expert'），必须是单段非空名称
 * @returns {string} 绝对路径，如 /project/.codex/bmad-expert
 * @throws {BmadError} E004 — 非法 agentId 或路径越界
 */
export function getInstallPath(agentId) {
  // agentId 必须是非空单段标识符：禁止空串、"."、".." 及任何含路径分隔符的值
  if (
    !agentId ||
    agentId === '.' ||
    agentId === '..' ||
    agentId.includes('/') ||
    agentId.includes('\\')
  ) {
    throw new BmadError(
      'E004',
      `非法 agentId：'${agentId}' 不是有效的单段标识符`,
      new Error('agentId 不得为空、"."、".." 或包含路径分隔符')
    )
  }
  const baseDir = getCodexBaseDir()
  const targetPath = path.join(baseDir, agentId)
  // 路径安全验证（NFR12）：必须严格位于白名单目录的直接子目录
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(baseDir)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError(
      'E004',
      '非法安装路径：路径遍历被拒绝',
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${baseDir}'`)
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
 * 执行 Codex 平台注册契约
 * 注册方式：确保目标目录存在（文件已由 installer.js 写入文件系统，此处完成目录结构）
 * 无需外部 CLI（类比 Claude Code 适配器）
 * @param {Object|null} files - 忽略（文件已由 installer.js 写入文件系统）
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert' }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  // files 参数由 installer.js 在步骤 3/4 写入文件系统，此处仅做平台注册（确保目录存在）
  void files
  const agentId = options.agentId ?? 'bmad-expert'
  const installPath = getInstallPath(agentId)

  try {
    await fs.ensureDir(installPath)
  } catch {
    // 降级路径：目录创建失败（权限问题）→ 输出手动步骤，不 throw
    printSuccess(
      `\nCodex 目录创建失败，请手动执行：\n  mkdir -p ${installPath}\n`
    )
  }
}
