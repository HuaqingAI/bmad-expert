// lib/updater.js
// update 命令 — Story 6.1
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 错误必须使用 BmadError，禁止直接 throw new Error()
// - 所有输出通过 output.js，禁止 console.log/console.error
// - 路径通过 adapter.getInstallPath()，禁止硬编码路径
// - lib 模块内禁止 process.exit()，由 cli.js 顶层 catch 处理

import os from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { BmadError } from './errors.js'
import { printProgress, printSuccess } from './output.js'
import { detectPlatform, getAdapter } from './platform.js'
import { replaceTemplateVars } from './installer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// agent/ 模板目录（相对于 lib/updater.js 向上一级）
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')

/**
 * 安全更新框架文件，保留用户数据（FR37、FR38）
 *
 * 执行顺序：
 *   1. 读取 package.json 获取 frameworkFiles / userDataPaths / version
 *   2. 平台检测 → 获取 installPath
 *   3. 备份 userDataPaths 至系统临时目录
 *   4. 覆盖 frameworkFiles（含模板变量替换）
 *   5. 成功 → 清理备份；异常 → 回滚 userDataPaths 后 rethrow
 *
 * @param {Object} [options={}]
 * @param {string|null} [options.platform=null] - --platform 覆盖值，null 表示自动检测
 * @param {string} [options.agentId='bmad-expert'] - agent 标识符
 * @throws {BmadError} E004 — 文件写入权限不足
 * @throws {BmadError} E002 — 无效平台或路径非法
 * @throws {BmadError} E001 — 通用文件 I/O 错误
 */
export async function update(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert' } = options

  // ── Step 1: 读取配置 ──────────────────────────────────────────────────────
  let pkg
  try {
    pkg = JSON.parse(await fs.readFile(join(__dirname, '../package.json'), 'utf8'))
  } catch (error) {
    throw new BmadError('E001', '读取 package.json 失败', error)
  }
  if (!pkg.bmadExpert?.frameworkFiles || !pkg.bmadExpert?.userDataPaths) {
    throw new BmadError('E001', 'package.json 缺少 bmadExpert.frameworkFiles 或 bmadExpert.userDataPaths 字段')
  }
  const frameworkFiles = pkg.bmadExpert.frameworkFiles
  const userDataPaths = pkg.bmadExpert.userDataPaths
  const version = pkg.version

  // ── Step 2: 平台检测 ──────────────────────────────────────────────────────
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  printProgress('', true)

  const installPath = adapter.getInstallPath(agentId)

  // ── Step 3: 备份用户数据至临时目录 ────────────────────────────────────────
  printProgress('正在备份用户数据...')
  const backupDir = join(os.tmpdir(), `bmad-expert-backup-${Date.now()}`)
  try {
    for (const dataPath of userDataPaths) {
      const srcPath = join(installPath, dataPath)
      const exists = await fs.pathExists(srcPath)
      if (exists) {
        await fs.copy(srcPath, join(backupDir, dataPath))
      }
    }
  } catch (error) {
    await fs.remove(backupDir).catch(() => {})
    throw new BmadError('E001', '备份用户数据失败', error)
  }
  printProgress('', true)

  // ── Step 4: 覆盖框架文件（含模板变量替换）────────────────────────────────
  printProgress('正在更新框架文件...')
  const vars = {
    agentId,
    agentName: agentId,
    model: '',
    installDate: new Date().toISOString().slice(0, 10),
  }

  try {
    await fs.ensureDir(installPath)

    for (const filename of frameworkFiles) {
      let content
      try {
        content = await fs.readFile(join(AGENT_TEMPLATE_DIR, filename), 'utf8')
      } catch (error) {
        throw new BmadError('E001', `读取模板文件失败：${filename}`, error)
      }

      const replaced = replaceTemplateVars(content, vars)

      try {
        await fs.outputFile(join(installPath, filename), replaced, 'utf8')
      } catch (error) {
        const isPermissionError = error?.code === 'EACCES' || error?.code === 'EPERM'
        if (isPermissionError) {
          throw new BmadError('E004', `更新文件失败（权限不足）：${filename}`, error, [
            `检查目标目录权限：ls -la ${installPath}`,
            `授权目录后重试：npx bmad-expert update`,
          ])
        }
        throw new BmadError('E001', `更新文件失败：${filename}`, error)
      }
    }
    printProgress('', true)
  } catch (originalError) {
    // ── 回滚：从备份恢复用户数据 ──────────────────────────────────────────
    try {
      printProgress('正在恢复用户数据...')
      for (const dataPath of userDataPaths) {
        const backupPath = join(backupDir, dataPath)
        const backupExists = await fs.pathExists(backupPath)
        if (backupExists) {
          await fs.copy(backupPath, join(installPath, dataPath), { overwrite: true })
        }
      }
      printProgress('', true)
    } catch (_rollbackError) {
      // 回滚失败不覆盖原始错误，忽略
    } finally {
      await fs.remove(backupDir).catch(() => {})
    }
    throw originalError
  }

  // ── Step 5: 清理备份 + 成功输出 ───────────────────────────────────────────
  await fs.remove(backupDir)
  printSuccess(`已更新至 v${version}，用户配置和 memory 完整保留。`)
}
