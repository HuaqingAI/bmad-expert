// lib/adapters/openclaw.js
// OpenClaw 平台适配器 — Story 8.1 (探针) / Story 8.5 (完整实现)
//
// 接口契约：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>
//   check(agentId)           → Promise<'not_installed'|'installed'|'corrupted'>
//
// 探针策略：
//   - OPENCLAW_SESSION_ID 存在 → 1.0
//   - .openclaw/ 目录存在 → 0.9
//   - 否则 → 0
//
// 路径白名单：[cwd]/.openclaw/agents/[agent-id]/（项目本地路径）

import path from 'path'
import fs from 'fs-extra'
import { execa } from 'execa'
import { BmadError } from '../errors.js'
import { printSuccess } from '../output.js'

/**
 * 返回 OpenClaw 平台的探针置信度（0-1）
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
  const basePath = path.join(process.cwd(), '.openclaw', 'agents')
  const targetPath = path.join(basePath, agentId)
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
 * 执行 OpenClaw 平台注册（文件写入已由 installer.js 完成，此处仅做 openclaw CLI 注册）
 * @param {Object|null} files - 忽略（文件已由 installer.js 写入文件系统）
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert' }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  void files
  const agentId = options.agentId ?? 'bmad-expert'

  try {
    await execa('openclaw', ['add', agentId])
  } catch {
    // 降级路径：openclaw CLI 不存在或注册失败 → 输出手动命令，不 throw
    printSuccess(
      `\nopenclaw CLI 未找到，请手动注册：\n  openclaw add ${agentId}\n`
    )
  }
}
