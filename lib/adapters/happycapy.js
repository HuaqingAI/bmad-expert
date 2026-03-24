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
 * @param {string} agentId - agent 标识符（如 'bmad-expert'）
 * @returns {string} 绝对路径，如 /home/user/.happycapy/agents/bmad-expert
 * @throws {BmadError} E004 — 路径遍历攻击或越界路径
 */
export function getInstallPath(agentId) {
  const targetPath = path.join(HAPPYCAPY_BASE_PATH, agentId)
  // 路径安全验证（NFR12）：必须在白名单目录下，禁止 .. 遍历
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(HAPPYCAPY_BASE_PATH)
  if (
    !resolvedTarget.startsWith(resolvedBase + path.sep) &&
    resolvedTarget !== resolvedBase
  ) {
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
 * 执行文件写入与平台注册（Story 2.4 填充完整实现）
 * @param {Object} files - 文件内容映射 { 'AGENTS.md': '内容...', ... }
 * @param {Object} options - 安装选项 { agentId: 'bmad-expert', yes: false }
 * @returns {Promise<void>}
 */
export async function install(files, options = {}) {
  // TODO(Story 2.4): 实现完整安装流程
  // 1. 通过 getInstallPath(options.agentId) 获取目标路径
  // 2. 使用 fs.ensureDir + fs.writeFile 写入 files 中的每个文件
  // 3. 通过 execa('happycapy-cli', ['add', options.agentId]) 完成注册
  // 4. happycapy-cli 不存在时输出手动注册命令（降级路径）
  void files
  void options
}
