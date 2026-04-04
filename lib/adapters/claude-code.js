// lib/adapters/claude-code.js
// Claude Code 平台适配器 — Story 8.1（探针）/ Story 8.3（完整实现）
//
// 接口契约（Phase 2）：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（绝对路径，路径白名单验证）
//   install(files, options)  → Promise<void>（CLAUDE.md 追加注册）
//   check(agentId)           → Promise<string>（'not_installed'|'installed'|'corrupted'）
//   getToolsParam()          → string（'claude-code'，FR42）
//
// 探针策略（Story 8.1 已实现）：
//   - CLAUDE_API_KEY 或 ANTHROPIC_API_KEY 存在 → 1.0
//   - [cwd]/.claude/ 目录存在 → 0.9
//   - 否则 → 0
//
// 安装路径白名单（Story 8.3）：[cwd]/.claude/，拒绝任何 .. 路径遍历
// 注册契约（Story 8.3）：追加至 [cwd]/CLAUDE.md（幂等，含 marker 则跳过）

import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'

// CLAUDE.md 注册标记（用于幂等检测）
const CLAUDE_MD_MARKER = 'BMAD Expert Agent'

/**
 * 返回 Claude Code 平台的探针置信度（0-1）
 * @returns {Promise<number>}
 */
export async function detectConfidence() {
  if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) return 1.0
  const claudeDir = path.join(process.cwd(), '.claude')
  if (await fs.pathExists(claudeDir)) return 0.9
  return 0
}

/**
 * 检测当前环境是否为 Claude Code 平台
 * @returns {Promise<boolean>}
 */
export async function detect() {
  return (await detectConfidence()) > 0
}

/**
 * 返回指定 agent 的安装路径（[cwd]/.claude 绝对路径）
 *
 * Claude Code 无 per-agent 子目录，所有 agent 文件统一放入 [cwd]/.claude/。
 * agentId 不作为路径段，仅做基本有效性验证（防注入）。
 *
 * @param {string} agentId - agent 标识符（如 'bmad-expert'），非空字符串
 * @returns {string} 绝对路径，如 /path/to/project/.claude
 * @throws {BmadError} E004 — 非法 agentId
 */
export function getInstallPath(agentId) {
  if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
    throw new BmadError(
      'E004',
      `非法 agentId：'${agentId}' 不是有效的标识符`,
      new Error('agentId 不得为空')
    )
  }
  const targetPath = path.join(process.cwd(), '.claude')
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(process.cwd())
  // 路径安全验证（NFR12）：目标路径必须在 cwd 下
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new BmadError(
      'E004',
      '非法安装路径：路径遍历被拒绝',
      new Error(`目标路径 '${targetPath}' 超出白名单范围 '${process.cwd()}'`)
    )
  }
  return resolvedTarget
}

/**
 * 检测 Claude Code agent 安装状态
 * 以 .claude/AGENTS.md 作为完整安装的标记文件
 *
 * @param {string} agentId - agent 标识符
 * @returns {Promise<'not_installed'|'installed'|'corrupted'>}
 */
export async function check(agentId) {
  const installPath = getInstallPath(agentId)
  try {
    const exists = await fs.pathExists(installPath)
    if (!exists) return 'not_installed'
    const agentsMdExists = await fs.pathExists(path.join(installPath, 'AGENTS.md'))
    return agentsMdExists ? 'installed' : 'corrupted'
  } catch (err) {
    throw new BmadError('E001', `安装状态检测失败：${installPath}`, err)
  }
}

/**
 * 执行 Claude Code 平台注册：向 [cwd]/CLAUDE.md 追加 BMAD 引用（幂等）
 *
 * 注册契约：
 *   - 检测 [cwd]/CLAUDE.md 是否含注册标记，已含则静默跳过
 *   - 不含则追加 BMAD Expert Agent 段落
 *   - 无需外部 CLI（纯文件系统操作）
 *
 * @param {Object|null} _files - 忽略（文件已由 orchestrator.writeSupplementFiles() 写入）
 * @param {Object} [options={}] - 安装选项 { agentId: 'bmad-expert' }
 * @returns {Promise<void>}
 * @throws {BmadError} E004 — 文件写入权限不足
 * @throws {BmadError} E001 — 其他 I/O 错误
 */
export async function install(_files, options = {}) {
  void options // agentId 已隐含于 cwd，Claude Code 无 per-agent 注册路径
  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md')

  try {
    let existing = ''
    if (await fs.pathExists(claudeMdPath)) {
      try {
        existing = await fs.readFile(claudeMdPath, 'utf8')
      } catch (readErr) {
        const isReadPermission = readErr?.code === 'EACCES' || readErr?.code === 'EPERM'
        if (isReadPermission) {
          throw new BmadError('E004', 'CLAUDE.md 读取失败（权限不足）', readErr, [
            '检查项目根目录权限后重试',
            '重新执行安装命令：npx bmad-expert install',
          ])
        }
        throw new BmadError('E001', 'CLAUDE.md 读取失败', readErr)
      }
    }
    // 幂等：已含 marker 时静默跳过
    if (!existing.includes(CLAUDE_MD_MARKER)) {
      const appendContent =
        `\n# ${CLAUDE_MD_MARKER}\n` +
        `Agent files installed in \`.claude/\`. See \`.claude/AGENTS.md\` for session startup instructions.\n`
      await fs.appendFile(claudeMdPath, appendContent, 'utf8')
    }
  } catch (err) {
    // 已处理为 BmadError 的直接抛出
    if (err?.bmadCode) throw err
    const isPermission = err?.code === 'EACCES' || err?.code === 'EPERM'
    if (isPermission) {
      throw new BmadError('E004', 'CLAUDE.md 写入失败（权限不足）', err, [
        '检查项目根目录权限后重试',
        '重新执行安装命令：npx bmad-expert install',
      ])
    }
    throw new BmadError('E001', 'CLAUDE.md 注册失败', err)
  }
}

/**
 * 返回该平台对应的 --tools 参数值（FR42）
 * Claude Code 需传 'claude-code'，其余平台返回 null
 * @returns {string}
 */
export function getToolsParam() {
  return 'claude-code'
}
