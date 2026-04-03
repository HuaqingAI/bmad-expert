// lib/adapters/claude-code.js
// Claude Code 平台适配器探针 — Story 8.1
//
// 接口契约（Phase 2，本 Story 仅实现探针层）：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（Story 8.3 实现）
//   install(files, options)  → Promise<void>（Story 8.3 实现）
//   check(agentId)           → Promise<string>（Story 8.3 实现）
//
// 探针策略：
//   - CLAUDE_API_KEY 或 ANTHROPIC_API_KEY 存在 → 1.0
//   - [cwd]/.claude/ 目录存在 → 0.9
//   - 否则 → 0
//
// 路径白名单（Story 8.3 实现）：[cwd]/.claude/，拒绝任何 .. 路径遍历

import path from 'path'
import fs from 'fs-extra'
import { BmadError } from '../errors.js'

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
 * 返回指定 agent 的安装路径（Story 8.3 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export function getInstallPath(_agentId) {
  throw new BmadError(
    'E002',
    'Claude Code 适配器完整实现在 Story 8.3，当前仅支持平台探针',
    new Error('getInstallPath not implemented for claude-code adapter')
  )
}

/**
 * 执行 Claude Code 平台注册（Story 8.3 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export async function install(_files, _options) {
  throw new BmadError(
    'E002',
    'Claude Code 适配器完整实现在 Story 8.3，当前仅支持平台探针',
    new Error('install not implemented for claude-code adapter')
  )
}

/**
 * 检测 Claude Code agent 安装状态（Story 8.3 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export async function check(_agentId) {
  throw new BmadError(
    'E002',
    'Claude Code 适配器完整实现在 Story 8.3，当前仅支持平台探针',
    new Error('check not implemented for claude-code adapter')
  )
}
