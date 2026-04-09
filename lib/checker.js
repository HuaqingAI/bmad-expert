// lib/checker.js
// status 命令健康度检查模块 — Story 6.2 / Story 9.1 / Story 13.2
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 错误必须使用 BmadError，禁止 throw new Error()
//   注意：not_installed / corrupted 是状态性结果，不是异常，通过返回值表达
// - 所有输出通过 output.js 路由，禁止 console.log
// - 禁止 process.exit()，由 cli.js 顶层处理
// - 具名导出，禁止 default export

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { printProgress, printSuccess } from './output.js'
import { detectPlatform, getAdapter } from './platform.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 标记管理文件的标记 ID 映射（用于 hasBmadSection 检测）
const MARKER_MAP = {
  'workspace-claude': { open: '<!-- bmad-workspace-config -->', close: '<!-- /bmad-workspace-config -->' },
  'project-claude': { open: '<!-- bmad-project-config -->', close: '<!-- /bmad-project-config -->' },
}

/**
 * 检测 init 状态：读取 .bmad-init.json 并验证文件完整性（Story 13.2 — FR73）
 *
 * @param {string} cwd - 工作目录
 * @returns {Promise<{initialized: boolean, templateVersion?: string, files?: Array}>}
 */
async function checkInitStatus(cwd) {
  const manifestPath = join(cwd, '.bmad-init.json')

  const manifestExists = await fs.pathExists(manifestPath)
  if (!manifestExists) {
    return { initialized: false }
  }

  let manifest
  try {
    manifest = await fs.readJSON(manifestPath)
  } catch {
    // JSON 解析失败 → 降级为未初始化（与 initializer.js 损坏清单处理一致）
    return { initialized: false }
  }

  const templateVersion = manifest.templateVersion || undefined
  const manifestFiles = manifest.files || []

  const files = await Promise.all(
    manifestFiles.map(async (entry) => {
      const filePath = join(cwd, entry.path)
      const exists = await fs.pathExists(filePath)

      const result = {
        path: entry.path,
        type: entry.type,
        exists,
      }

      // 仅对标记管理文件类型检测 hasBmadSection
      const markers = MARKER_MAP[entry.type]
      if (markers) {
        if (!exists) {
          result.hasBmadSection = false
        } else {
          try {
            const content = await fs.readFile(filePath, 'utf8')
            result.hasBmadSection = content.includes(markers.open) && content.includes(markers.close)
          } catch {
            result.hasBmadSection = false
          }
        }
      }

      return result
    })
  )

  const result = { initialized: true, files }
  if (templateVersion) result.templateVersion = templateVersion
  return result
}

/**
 * 构建 init 状态的人类可读输出行
 *
 * @param {{initialized: boolean, templateVersion?: string, files?: Array}} initStatus
 * @returns {string}
 */
function formatInitStatusLine(initStatus) {
  if (!initStatus.initialized) {
    return 'Init: ✗ 未初始化'
  }

  const totalFiles = initStatus.files.length
  const existingFiles = initStatus.files.filter((f) => f.exists).length
  const versionPart = initStatus.templateVersion ? ` | 模板版本: ${initStatus.templateVersion}` : ''

  if (existingFiles === totalFiles) {
    return `Init: ✓ 已初始化${versionPart} | 配置文件: ${existingFiles}/${totalFiles} 完整`
  }

  const missingCount = totalFiles - existingFiles
  return `Init: ✓ 已初始化${versionPart} | 配置文件: ${existingFiles}/${totalFiles} 完整（${missingCount} 个缺失）`
}

/**
 * 检查 bmad-expert 当前安装健康度
 *
 * 始终返回结构化对象（Story 9.1 — FR49）：
 *   healthy:       { success: true,  status: 'healthy',      version, platform, installPath, files }
 *   not_installed: { success: false, status: 'not_installed', version: null, platform, installPath, files: [] }
 *   corrupted:     { success: false, status: 'corrupted',     version, platform, installPath, files, fixSuggestion }
 *
 * cli.js 负责根据 success 字段决定退出码。
 * 仅对真正意外的运行时错误（如文件读取失败）throw BmadError。
 *
 * @param {Object} [options={}]
 * @param {string|null} [options.platform=null] - --platform 覆盖值，null 表示自动检测
 * @param {string} [options.agentId='bmad-expert'] - agent 标识符
 * @returns {Promise<{success: boolean, status: string, version: string|null, platform: string, installPath: string, files: Array}>}
 */
export async function checkStatus(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert' } = options

  // ── Step 1: 读取 package.json 获取版本与框架文件列表 ──────────────────
  const pkg = JSON.parse(await fs.readFile(join(__dirname, '../package.json'), 'utf8'))
  const version = pkg.version
  const frameworkFiles = pkg.bmadExpert.frameworkFiles

  // ── Step 2: 平台检测 & 获取 installPath ──────────────────────────────
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  const installPath = adapter.getInstallPath(agentId)
  printProgress('', true)

  // ── Step 3: 检查 installPath 是否存在 ────────────────────────────────
  printProgress('正在检查安装状态...')
  const pathExists = await fs.pathExists(installPath)
  printProgress('', true)

  // ── Step 3b: 检查 init 状态（Story 13.2 — FR73）────────────────────
  printProgress('正在检查 init 状态...')
  const initStatus = await checkInitStatus(process.cwd())
  printProgress('', true)

  if (!pathExists) {
    const fixSuggestion = '运行 npx bmad-expert install 完成安装'
    const initLine = formatInitStatusLine(initStatus)
    printSuccess(
      [
        `bmad-expert 安装状态`,
        ``,
        `状态：not_installed`,
        `修复建议：${fixSuggestion}`,
        ``,
        initLine,
      ].join('\n')
    )
    return {
      success: false,
      status: 'not_installed',
      version: null,
      platform: platformName,
      installPath,
      files: [],
      fixSuggestion,
      init: initStatus,
    }
  }

  // ── Step 4: 逐一检查每个 frameworkFile ──────────────────────────────
  const fileChecks = await Promise.all(
    frameworkFiles.map(async (name) => ({
      name,
      exists: await fs.pathExists(join(installPath, name)),
    }))
  )

  const missingFiles = fileChecks.filter((c) => !c.exists).map((c) => c.name)
  const isHealthy = missingFiles.length === 0

  // ── Step 5: 构建并输出状态报告 ───────────────────────────────────────
  const fileList = fileChecks
    .map((c) => `  ${c.exists ? '✓' : '✗'} ${c.name}${c.exists ? '' : '（缺失）'}`)
    .join('\n')

  const initLine = formatInitStatusLine(initStatus)

  if (isHealthy) {
    printSuccess(
      [
        `bmad-expert 安装状态`,
        `版本：v${version}`,
        `安装路径：${installPath}`,
        ``,
        `文件完整性检查：`,
        fileList,
        ``,
        `状态：healthy`,
        ``,
        initLine,
      ].join('\n')
    )
    return {
      success: true,
      status: 'healthy',
      version,
      platform: platformName,
      installPath,
      files: fileChecks,
      init: initStatus,
    }
  }

  // ── Step 6: 损坏状态：输出报告后返回结构化对象 ────────────────────────
  const fixSuggestion = '运行 npx bmad-expert install 重新安装'
  printSuccess(
    [
      `bmad-expert 安装状态`,
      `版本：v${version}`,
      `安装路径：${installPath}`,
      ``,
      `文件完整性检查：`,
      fileList,
      ``,
      `状态：corrupted（${missingFiles.length} 个文件缺失）`,
      `修复建议：${fixSuggestion}`,
      ``,
      initLine,
    ].join('\n')
  )
  return {
    success: false,
    status: 'corrupted',
    version,
    platform: platformName,
    installPath,
    files: fileChecks,
    fixSuggestion,
    init: initStatus,
  }
}
