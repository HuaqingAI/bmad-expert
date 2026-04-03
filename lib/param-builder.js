// lib/param-builder.js
// 智能参数构建引擎 — Story 7.1
//
// 架构约束：
// - 具名导出，禁止 default export
// - 仅使用 Node.js 内置模块（fs/path/os）和已有 fs-extra，禁止新增 npm 包
// - 配置文件不存在或解析失败时静默 fallback（不抛异常）
// - 参数优先级：用户显式参数 > 智能推断 > 默认值

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ── 平台 tools 映射表 ────────────────────────────────────────────────────────
// HappyCapy/OpenClaw/Codex 不传 --tools；Claude Code 传 'claude-code'
const PLATFORM_TOOLS_MAP = {
  happycapy: null,
  openclaw: null,
  'claude-code': 'claude-code',
  codex: null,
}

/**
 * 推断 --tools 参数值
 * @param {string} platform - 目标平台名称
 * @returns {string|null} tools 值，null 表示不传此参数
 */
function inferToolsParam(platform) {
  // 有明确映射（含 null）的平台直接返回；未知平台安全 fallback 为 null
  return Object.prototype.hasOwnProperty.call(PLATFORM_TOOLS_MAP, platform)
    ? PLATFORM_TOOLS_MAP[platform]
    : null
}

/**
 * 推断 --modules 参数值
 * 默认 'bmm'；检测到 bmb 配置目录时追加 'bmm,bmb'
 * @param {string|null} projectRoot - 项目根目录绝对路径
 * @returns {string} modules 值
 */
function inferModulesParam(projectRoot) {
  if (!projectRoot) return 'bmm'

  const bmbMarkers = [
    join(projectRoot, '_bmad', 'bmb'),
    join(projectRoot, '_bmad-output', 'bmb'),
  ]

  const hasBmb = bmbMarkers.some((p) => existsSync(p))
  return hasBmb ? 'bmm,bmb' : 'bmm'
}

/**
 * 推断 --communication-language 参数值
 * 优先级：已有 BMAD config.yaml 中的设置 > 系统 locale > null
 * @param {string|null} projectRoot - 项目根目录绝对路径
 * @returns {string|null} language 值，null 表示不传此参数
 */
function inferLanguageParam(projectRoot) {
  // 1. 尝试从项目 BMAD config 读取 communication_language
  if (projectRoot) {
    const configPath = join(projectRoot, '_bmad', 'bmm', 'config.yaml')
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8')
        const match = content.match(/communication_language\s*:\s*(.+)/)
        if (match) {
          // 去除引号、行内注释（# 及其后内容）
          return match[1].trim().replace(/['"]/g, '').split('#')[0].trim()
        }
      } catch {
        // 读取或解析失败时静默 fallback，不抛异常
      }
    }
  }

  // 2. Fallback：系统 locale（去掉编码后缀，如 'zh_CN.UTF-8' → 'zh_CN'）
  // 先 split 再过滤，避免 'C.UTF-8' 通过 'C' 检查后返回 'C'
  const locale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES
  if (locale) {
    const localePure = locale.split('.')[0]
    if (localePure && localePure !== 'C' && localePure !== 'POSIX') {
      return localePure
    }
  }

  // 3. 最终 fallback：不传此参数
  return null
}

/**
 * 构建 `npx bmad-method install` 所需的全部参数
 *
 * @param {string} platform - 目标平台（'happycapy'|'claude-code'|'openclaw'|'codex'|...）
 * @param {Object} [context={}] - 项目上下文
 * @param {string} [context.projectRoot] - 项目根目录绝对路径（用于扫描已有 BMAD 配置）
 * @param {Object} [context.userOverrides={}] - 用户 CLI 显式参数（最高优先级）
 * @param {string|null} [context.userOverrides.modules]
 * @param {string|null} [context.userOverrides.tools]
 * @param {string|null} [context.userOverrides.communicationLanguage]
 * @param {string|null} [context.userOverrides.outputFolder]
 * @param {string|null} [context.userOverrides.userName]
 * @param {string|null} [context.userOverrides.action]
 * @returns {ParamResult} 结构化参数对象，含 toArgs() 方法
 */
export function buildParams(platform, context = {}) {
  const { projectRoot = null, userOverrides = {} } = context

  // ── 智能推断 ───────────────────────────────────────────────────────────────
  const inferredTools = inferToolsParam(platform)
  const inferredModules = inferModulesParam(projectRoot)
  const inferredLanguage = inferLanguageParam(projectRoot)

  // ── 优先级合并：用户显式 > 智能推断 > 默认值 ────────────────────────────────
  // null 与 undefined 均视为「未指定」，走智能推断；仅非 null 的显式值才覆盖
  const modules = userOverrides.modules != null ? userOverrides.modules : inferredModules

  // tools 特殊处理：userOverrides.tools 显式设为 null 也应覆盖推断值
  // （允许用户通过 null 强制禁用 --tools，即使平台推断有值）
  const tools = Object.prototype.hasOwnProperty.call(userOverrides, 'tools')
    ? userOverrides.tools
    : inferredTools

  const communicationLanguage =
    userOverrides.communicationLanguage != null
      ? userOverrides.communicationLanguage
      : inferredLanguage

  const outputFolder =
    userOverrides.outputFolder != null ? userOverrides.outputFolder : null

  const userName =
    userOverrides.userName != null ? userOverrides.userName : null

  const action =
    userOverrides.action != null ? userOverrides.action : 'install'

  return {
    modules,
    tools,
    communicationLanguage,
    outputFolder,
    userName,
    action,
    yes: true, // 始终非交互模式

    /**
     * 将参数对象转换为 CLI 参数数组（null/undefined 值不输出）
     * 供 orchestrator.js 拼接 `npx bmad-method install [args...]` 使用
     * @returns {string[]}
     */
    toArgs() {
      const args = []
      if (this.modules != null) args.push('--modules', this.modules)
      if (this.tools != null) args.push('--tools', this.tools)
      if (this.communicationLanguage != null) args.push('--communication-language', this.communicationLanguage)
      if (this.outputFolder != null) args.push('--output-folder', this.outputFolder)
      if (this.userName != null) args.push('--user-name', this.userName)
      if (this.action != null) args.push('--action', this.action)
      if (this.yes) args.push('--yes')
      return args
    },
  }
}
