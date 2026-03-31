// lib/adapters/happycapy.js
// HappyCapy 平台适配器 — Story 2.1
//
// 接口契约（四个方法）：
//   detect()                 → Promise<boolean>
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>（Story 2.4 填充完整实现）
//   check(agentId)           → Promise<'not_installed'|'installed'|'corrupted'>
//
// 特殊处理：
// - detect: 优先检查 CAPY_USER_ID 环境变量，再尝试 happycapy-cli --version
// - 路径白名单：~/.happycapy/agents/[agent-id]/，拒绝 .. 路径遍历
// - 文件操作必须使用 fs-extra，禁止原生 fs

import os from 'os'
import path from 'path'
import { execa } from 'execa'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'
import { printSuccess } from '../output.js'

const HAPPYCAPY_BASE_PATH = path.join(os.homedir(), '.happycapy', 'agents')

/**
 * 检测当前环境是否为 HappyCapy 平台
 * 检测策略（按优先级）：
 *   1. process.env.CAPY_USER_ID 存在（HappyCapy session 特征环境变量，最快）
 *   2. happycapy-cli --version 可执行（timeout: 3000ms，满足 NFR3）
 * @returns {Promise<boolean>}
 */
export async function detect() {
  // 优先环境变量（无 I/O，最快）：CAPY_USER_ID 是 HappyCapy session 的特征环境变量
  if (process.env.CAPY_USER_ID) {
    return true
  }
  // fallback：检查 CLI 是否在 PATH 中
  try {
    await execa('happycapy-cli', ['--version'], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * 返回指定 agent 的安装路径（绝对路径）
 * @param {string} agentId - agent 标识符（如 'bmad-expert'），必须是单段非空名称
 * @returns {string} 绝对路径，如 /home/user/.happycapy/agents/bmad-expert
 * @throws {BmadError} E004 — 非法 agentId 或路径越界
 */
export function getInstallPath(agentId) {
  // agentId 必须是非空单段标识符：禁止空串、"."、及任何含路径分隔符的值
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
  const targetPath = path.join(HAPPYCAPY_BASE_PATH, agentId)
  // 路径安全验证（NFR12）：必须严格位于白名单目录的直接子目录
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(HAPPYCAPY_BASE_PATH)
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new BmadError(
      'E004',
      '非法安装路径：路径遍历被拒绝',
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${HAPPYCAPY_BASE_PATH}'`)
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
 * 执行 HappyCapy 平台注册（文件写入已由 installer.js 完成，此处仅做 happycapy-cli 注册）
 * @param {Object|null} files - 忽略（文件已由 installer.js 写入文件系统）
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert' }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  // files 参数由 installer.js 在 Step 3/4 写入文件系统，此处仅做平台注册
  void files
  const agentId = options.agentId ?? 'bmad-expert'

  try {
    await execa('happycapy-cli', ['add', agentId])
  } catch {
    // 降级路径：happycapy-cli 不存在或注册失败 → 输出手动命令，不 throw
    printSuccess(
      `\nhappycapy-cli 未找到，请手动注册：\n  happycapy-cli add ${agentId}\n`
    )
  }
}
