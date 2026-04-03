// lib/adapters/codex.js
// Codex（OpenAI）平台适配器探针 — Story 8.1
//
// 接口契约（Phase 2，本 Story 仅实现探针层）：
//   detect()                 → Promise<boolean>
//   detectConfidence()       → Promise<number>（0-1）
//   getInstallPath(agentId)  → string（Story 8.4 实现）
//   install(files, options)  → Promise<void>（Story 8.4 实现）
//   check(agentId)           → Promise<string>（Story 8.4 实现）
//
// 探针策略（占位，Story 8.4 预研后可能更新信号）：
//   - CODEX_RUNTIME 存在 → 1.0
//   - 否则 → 0
// 注意：OPENAI_API_KEY 过于通用（非 Codex 专属），不作为探针信号

import { BmadError } from '../errors.js'

/**
 * 返回 Codex 平台的探针置信度（0-1）
 * 注意：探针信号为占位符，Story 8.4 预研后将更新为实际信号
 * @returns {Promise<number>}
 */
export async function detectConfidence() {
  if (process.env.CODEX_RUNTIME) return 1.0
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
 * 返回指定 agent 的安装路径（Story 8.4 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export function getInstallPath(_agentId) {
  throw new BmadError(
    'E002',
    'Codex 适配器完整实现在 Story 8.4，当前仅支持平台探针',
    new Error('getInstallPath not implemented for codex adapter')
  )
}

/**
 * 执行 Codex 平台注册（Story 8.4 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export async function install(_files, _options) {
  throw new BmadError(
    'E002',
    'Codex 适配器完整实现在 Story 8.4，当前仅支持平台探针',
    new Error('install not implemented for codex adapter')
  )
}

/**
 * 检测 Codex agent 安装状态（Story 8.4 实现）
 * @throws {BmadError} E002 — 适配器尚未完整实现
 */
export async function check(_agentId) {
  throw new BmadError(
    'E002',
    'Codex 适配器完整实现在 Story 8.4，当前仅支持平台探针',
    new Error('check not implemented for codex adapter')
  )
}
