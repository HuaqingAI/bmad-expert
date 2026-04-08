// lib/uninstaller.js
// uninstall 命令 — Story 11.2
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 错误必须使用 BmadError，禁止直接 throw new Error()
// - 所有输出通过 output.js，禁止 console.log/console.error
// - 路径通过 adapter.getInstallPath()，禁止硬编码路径
// - lib 模块内禁止 process.exit()，由 cli.js 顶层 catch 处理

import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'
import fs from 'fs-extra'
import { BmadError } from './errors.js'
import { printProgress, printSuccess } from './output.js'
import { detectPlatform, getAdapter } from './platform.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Check if resolvedPath is safely contained within containerDir.
 * Prevents path traversal attacks from manifest entries.
 *
 * @param {string} resolvedPath - Fully resolved path to check
 * @param {string} containerDir - Container directory (must be resolved)
 * @returns {boolean}
 */
function isPathContained(resolvedPath, containerDir) {
  const normalized = resolve(resolvedPath)
  const container = resolve(containerDir)
  return normalized === container || normalized.startsWith(container + '/')
}

/**
 * Collect all files and directories that should be cleaned up.
 *
 * Sources:
 *   1. .bmad-init.json manifest (init-generated files)
 *   2. _bmad/ directory (install-generated framework)
 *   3. Agent files at adapter install path (install-generated)
 *
 * User data paths (MEMORY.md, USER.md, memory/) are excluded and tracked as preserved.
 *
 * @param {string} cwd - Workspace root directory
 * @param {string} installPath - Agent install path from adapter
 * @param {string[]} frameworkFiles - Framework file names from package.json
 * @param {string[]} userDataPaths - User data paths to preserve
 * @returns {Promise<{toDelete: string[], toPreserve: string[], hasManifest: boolean, hasBmadDir: boolean}>}
 */
export async function collectUninstallTargets(cwd, installPath, frameworkFiles, userDataPaths) {
  const toDelete = []
  const toPreserve = []
  let hasManifest = false
  let hasBmadDir = false

  const resolvedCwd = resolve(cwd)

  // ── Source 1 & 2 from manifest (single read, cached) ──
  const manifestPath = join(cwd, '.bmad-init.json')
  let manifest = null
  if (await fs.pathExists(manifestPath)) {
    hasManifest = true
    try {
      const raw = await fs.readJson(manifestPath)
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        manifest = raw
      }
    } catch (_) {
      // Manifest unreadable — still proceed with other cleanup targets
    }
  }

  // Collect manifest file entries with path containment check
  if (manifest && Array.isArray(manifest.files)) {
    for (const entry of manifest.files) {
      if (typeof entry.path !== 'string' || entry.path.trim() === '') continue
      const filePath = resolve(cwd, entry.path)
      if (!isPathContained(filePath, resolvedCwd)) continue // skip path traversal
      toDelete.push(filePath)
    }
  }

  // ── Source 2: _bmad/ directory ──
  const bmadDir = join(cwd, '_bmad')
  if (await fs.pathExists(bmadDir)) {
    hasBmadDir = true
    toDelete.push(bmadDir)
  }

  // Also check if manifest listed a defaultProject with _bmad/
  if (manifest && manifest.defaultProject) {
    const projectBmadDir = resolve(cwd, manifest.defaultProject, '_bmad')
    if (isPathContained(projectBmadDir, resolvedCwd) && (await fs.pathExists(projectBmadDir))) {
      hasBmadDir = true
      if (!toDelete.includes(projectBmadDir)) {
        toDelete.push(projectBmadDir)
      }
    }
  }

  // ── Source 3: Agent files at adapter install path ──
  if (installPath && (await fs.pathExists(installPath))) {
    for (const filename of frameworkFiles) {
      const filePath = join(installPath, filename)
      if (await fs.pathExists(filePath)) {
        toDelete.push(filePath)
      }
    }

    // Identify preserved user data files
    for (const dataPath of userDataPaths) {
      const name = dataPath.replace(/\/$/, '')
      const fullPath = join(installPath, name)
      if (await fs.pathExists(fullPath)) {
        toPreserve.push(fullPath)
      }
    }
  }

  // ── Finally: manifest file itself (deleted last during execution) ──
  // Not added to toDelete here — handled separately in executeUninstall

  return { toDelete, toPreserve, hasManifest, hasBmadDir }
}

/**
 * Display the cleanup plan via output.js.
 *
 * @param {{toDelete: string[], toPreserve: string[]}} plan
 */
export function displayCleanupPlan(plan) {
  const lines = []
  lines.push('卸载计划：')
  lines.push('')

  if (plan.toDelete.length > 0) {
    lines.push('将删除：')
    for (const p of plan.toDelete) {
      lines.push(`  - ${p}`)
    }
  }

  if (plan.toPreserve.length > 0) {
    lines.push('')
    lines.push('将保留（用户数据）：')
    for (const p of plan.toPreserve) {
      lines.push(`  - ${p}`)
    }
  }

  printProgress(lines.join('\n') + '\n')
}

/**
 * Backup all target files to .bmad-backup-{timestamp}/ directory.
 *
 * @param {{toDelete: string[]}} plan
 * @param {string} cwd - Workspace root directory
 * @returns {Promise<string>} Backup directory path
 */
export async function backupFiles(plan, cwd) {
  const backupDir = join(cwd, `.bmad-backup-${Date.now()}`)
  const resolvedCwd = resolve(cwd)

  printProgress('正在备份文件...')
  try {
    for (const filePath of plan.toDelete) {
      if (await fs.pathExists(filePath)) {
        // Compute relative path for backup structure
        const resolvedFile = resolve(filePath)
        let relativePath
        if (resolvedFile.startsWith(resolvedCwd + '/')) {
          relativePath = resolvedFile.slice(resolvedCwd.length + 1)
        } else {
          // Files outside cwd (e.g. agent install path): flatten to avoid path.join issues
          relativePath = 'external/' + resolvedFile.replace(/^\//, '').replace(/\//g, '__')
        }
        await fs.copy(filePath, join(backupDir, relativePath))
      }
    }
  } catch (err) {
    throw new BmadError('E004', '备份文件失败', err, [
      `检查目录写入权限: ${backupDir}`,
      '确认磁盘空间充足后重试',
    ])
  }
  printProgress('', true)

  return backupDir
}

/**
 * Execute the uninstall: delete all target files/directories, then remove manifest.
 * Uses per-item error collection to maximize cleanup even on partial failures.
 *
 * @param {{toDelete: string[], hasManifest: boolean}} plan
 * @param {string} cwd - Workspace root directory
 * @returns {Promise<number>} Number of items deleted
 */
export async function executeUninstall(plan, cwd) {
  let deletedCount = 0
  const errors = []

  printProgress('正在执行卸载...')

  for (const filePath of plan.toDelete) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath)
        deletedCount++
      }
    } catch (err) {
      errors.push({ path: filePath, err })
    }
  }

  // Delete .bmad-init.json last
  if (plan.hasManifest) {
    const manifestPath = join(cwd, '.bmad-init.json')
    try {
      if (await fs.pathExists(manifestPath)) {
        await fs.remove(manifestPath)
        deletedCount++
      }
    } catch (err) {
      errors.push({ path: manifestPath, err })
    }
  }

  printProgress('', true)

  if (errors.length > 0) {
    throw new BmadError(
      'E004',
      `卸载部分失败：已删除 ${deletedCount} 项，失败 ${errors.length} 项`,
      errors[0].err,
      ['检查文件删除权限', '手动删除残留文件后重试']
    )
  }

  return deletedCount
}

/**
 * Main uninstall command entry point.
 *
 * @param {{platform?: string|null, agentId?: string, yes?: boolean, backup?: boolean, cwd?: string}} options
 * @returns {Promise<{deleted: number, preserved: number, backedUp: boolean, backupDir?: string, message: string}>}
 * @throws {BmadError} E007 if no installation detected
 * @throws {BmadError} E004 on file operation failure
 */
export async function uninstall(options = {}) {
  const {
    platform: platformOverride = null,
    agentId = 'bmad-expert',
    yes = false,
    backup = false,
    cwd: cwdOverride,
  } = options

  const cwd = cwdOverride || process.cwd()

  // ── Step 1: Read package.json config ──
  let pkg
  try {
    pkg = JSON.parse(await fs.readFile(join(__dirname, '../package.json'), 'utf8'))
  } catch (error) {
    throw new BmadError('E001', '读取 package.json 失败', error)
  }
  const frameworkFiles = pkg.bmadExpert?.frameworkFiles ?? []
  const userDataPaths = pkg.bmadExpert?.userDataPaths ?? []

  // ── Step 2: Detect platform & get install path ──
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  printProgress('', true)

  const installPath = adapter.getInstallPath(agentId)

  // ── Step 3: Collect uninstall targets ──
  printProgress('正在收集清理目标...')
  const plan = await collectUninstallTargets(cwd, installPath, frameworkFiles, userDataPaths)
  printProgress('', true)

  // ── Step 4: Check if anything to uninstall ──
  if (plan.toDelete.length === 0 && !plan.hasManifest && !plan.hasBmadDir) {
    throw new BmadError('E007', '未检测到 bmad-expert 安装内容，无需卸载。', null, [
      '确认当前目录为 bmad-expert 安装所在的 workspace',
      '运行 npx bmad-expert install 进行安装',
    ])
  }

  // ── Step 5: Display cleanup plan ──
  displayCleanupPlan(plan)

  // ── Step 6: Confirm (unless --yes) ──
  if (!yes) {
    const confirmed = await confirmUninstall()
    if (!confirmed) {
      const message = '用户取消了卸载操作。'
      printSuccess(message)
      return { deleted: 0, preserved: plan.toPreserve.length, backedUp: false, message }
    }
  }

  // ── Step 7: Backup (if --backup) ──
  let backedUp = false
  let backupDir
  if (backup) {
    backupDir = await backupFiles(plan, cwd)
    backedUp = true
  }

  // ── Step 8: Execute uninstall ──
  const deletedCount = await executeUninstall(plan, cwd)

  // ── Step 9: Summary ──
  const parts = [`卸载完成：已删除 ${deletedCount} 个文件/目录，已保留 ${plan.toPreserve.length} 个用户数据文件。`]
  if (backupDir) {
    parts.push(`备份位置：${backupDir}`)
  }
  const message = parts.join('\n')
  printSuccess(message)

  return {
    deleted: deletedCount,
    preserved: plan.toPreserve.length,
    backedUp,
    ...(backupDir ? { backupDir } : {}),
    message,
  }
}

// ── Internal helpers ──

/**
 * Ask user to confirm uninstall via stdin/stdout.
 * @returns {Promise<boolean>}
 */
function confirmUninstall() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve, reject) => {
    rl.on('error', (err) => {
      rl.close()
      reject(new BmadError('E001', 'stdin 读取失败', err))
    })
    rl.question('确认执行卸载？(y/N) ', (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}
