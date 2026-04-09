// lib/updater.js
// update 命令 — Story 6.1 + Story 11.1（init 配置文件跟随更新）
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 错误必须使用 BmadError，禁止直接 throw new Error()
// - 所有输出通过 output.js，禁止 console.log/console.error
// - 路径通过 adapter.getInstallPath()，禁止硬编码路径
// - lib 模块内禁止 process.exit()，由 cli.js 顶层 catch 处理

import os from 'os'
import { createInterface } from 'readline'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { BmadError } from './errors.js'
import { printProgress, printSuccess } from './output.js'
import { detectPlatform, getAdapter } from './platform.js'
import { replaceTemplateVars } from './installer.js'
import { generateFileContent } from './initializer.js'
import { replaceBmadSection, extractBmadSection } from './section-manager.js'

// 标记管理文件类型 → sectionId 映射（Phase 4 Story 12.3）
const SECTION_ID_MAP = {
  'workspace-claude': 'bmad-workspace-config',
  'project-claude': 'bmad-project-config',
}

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
 * @param {boolean} [options.yes=false] - 自动确认 init 配置文件更新（FR58）
 * @param {boolean} [options.force=false] - 跳过版本门控强制更新（FR74）
 * @param {string} [options.cwd] - 工作目录（用于定位 .bmad-init.json）
 * @throws {BmadError} E004 — 文件写入权限不足
 * @throws {BmadError} E002 — 无效平台或路径非法
 * @throws {BmadError} E001 — 通用文件 I/O 错误
 */
export async function update(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert', yes = false, force = false, cwd } = options

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

  // ── Step 5: 清理备份 ─────────────────────────────────────────────────────
  await fs.remove(backupDir)

  // ── Step 6: init 配置文件跟随更新（FR58-FR60）───────────────────────────
  // init 配置更新是独立阶段，失败不阻塞框架文件更新（Dev Notes 错误处理）
  let initUpdateResult
  try {
    initUpdateResult = await updateInitConfigs({ yes, force, cwd, currentVersion: version })
  } catch (err) {
    printProgress(`Init 配置文件更新失败: ${err.message}（框架文件已成功更新）`)
    printProgress('', true)
    initUpdateResult = { skipped: false, filesUpdated: 0, filesSkipped: 0, error: err.message }
  }

  // ── Step 7: 成功输出 ────────────────────────────────────────────────────
  const message = `已更新至 v${version}，用户配置和 memory 完整保留。`
  printSuccess(message)

  // 返回结构化数据供 cli.js 在 --json 模式下使用（Story 6.3）
  return { version, message, initConfigUpdated: initUpdateResult }
}

/**
 * 更新 init 生成的配置文件（FR58-FR60, FR67-FR69, FR72, FR74）
 *
 * Phase 4 增强：按文件类型分策略处理——
 *   标记管理文件（workspace-claude, project-claude）→ 精准段落替换
 *   框架/workflow 文件 → 确认+备份+覆盖
 *
 * @param {Object} params
 * @param {boolean} params.yes - 自动确认所有更新
 * @param {boolean} [params.force=false] - 跳过版本门控（FR74）
 * @param {string} [params.cwd] - 工作目录
 * @param {string} params.currentVersion - 当前包版本
 * @returns {Promise<{skipped: boolean, filesUpdated: number, filesSkipped: number}>}
 */
export async function updateInitConfigs({ yes = false, force = false, cwd, currentVersion }) {
  const workDir = cwd || process.cwd()
  const manifestPath = join(workDir, '.bmad-init.json')

  // ── 检测 .bmad-init.json 是否存在 ──
  const manifestExists = await fs.pathExists(manifestPath)
  if (!manifestExists) {
    return { skipped: true, filesUpdated: 0, filesSkipped: 0 }
  }

  // ── 读取清单 ──
  let manifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch (err) {
    throw new BmadError('E001', '.bmad-init.json 解析失败', err)
  }

  // ── 版本比较（--force 绕过）──
  if (!force && manifest.templateVersion === currentVersion) {
    printProgress('Init 配置文件已是最新版本，跳过。')
    printProgress('', true)
    return { skipped: true, filesUpdated: 0, filesSkipped: 0 }
  }

  // ── 验证清单结构 ──
  if (!Array.isArray(manifest.files)) {
    throw new BmadError('E001', '.bmad-init.json 格式错误：缺少 files 数组')
  }
  if (!manifest.defaultProject) {
    throw new BmadError('E001', '.bmad-init.json 格式错误：缺少 defaultProject 字段')
  }

  printProgress('正在检查 init 配置文件更新...')
  printProgress('', true)

  const projectInfo = {
    projectName: manifest.defaultProject,
    projectPath: manifest.defaultProject,
  }

  let filesUpdated = 0
  let filesSkipped = 0
  let generationErrors = 0

  for (const fileEntry of manifest.files) {
    const filePath = join(workDir, fileEntry.path)
    const sectionId = SECTION_ID_MAP[fileEntry.type]

    // ── 读取当前文件 ──
    let currentContent = ''
    const fileExists = await fs.pathExists(filePath)
    if (fileExists) {
      try {
        currentContent = await fs.readFile(filePath, 'utf8')
      } catch (err) {
        throw new BmadError('E001', `读取配置文件失败: ${fileEntry.path}`, err)
      }
    }

    // ── 生成新版模板内容 ──
    let newContent
    try {
      newContent = await generateFileContent(fileEntry.type, projectInfo)
    } catch (err) {
      printProgress(`跳过 ${fileEntry.path}：模板生成失败 (${err.message})`)
      printProgress('', true)
      generationErrors++
      filesSkipped++
      continue
    }

    // ── 按文件类型分策略处理 ──
    if (sectionId) {
      // 标记管理文件：精准段落替换（FR67）
      const result = await updateMarkerManagedFile({
        filePath,
        fileEntry,
        currentContent,
        newContent,
        sectionId,
        fileExists,
      })
      if (result === 'updated') {
        filesUpdated++
      } else {
        filesSkipped++
      }
    } else {
      // workflow / 其他文件：确认+备份+覆盖（FR68, FR69）
      const result = await updateFullReplaceFile({
        filePath,
        fileEntry,
        currentContent,
        newContent,
        fileExists,
        yes,
      })
      if (result === 'updated') {
        filesUpdated++
      } else {
        filesSkipped++
      }
    }
  }

  // ── 更新 templateVersion ──
  // 仅当无模板生成错误时更新版本号（P6：避免部分失败时错误封存版本）
  // 即使所有文件无差异也更新（P2：避免每次 update 重复检查）
  if (generationErrors === 0) {
    manifest.templateVersion = currentVersion
    try {
      await fs.outputFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    } catch (err) {
      throw new BmadError('E004', '.bmad-init.json 更新失败', err)
    }
  }

  if (filesUpdated > 0) {
    printProgress(`Init 配置文件已更新 ${filesUpdated} 个，跳过 ${filesSkipped} 个。`)
    printProgress('', true)
  }

  return { skipped: false, filesUpdated, filesSkipped }
}

/**
 * 标记管理文件精准段落替换（FR67）
 *
 * 从新版模板中提取标记段落，替换当前文件中对应的标记段落，
 * 标记外用户自定义内容不受影响。
 *
 * @returns {Promise<'updated'|'skipped'>}
 */
async function updateMarkerManagedFile({ filePath, fileEntry, currentContent, newContent, sectionId, fileExists }) {
  // 从新版模板中提取标记段落
  const newSection = extractBmadSection(newContent, sectionId)
  if (!newSection) {
    printProgress(`${fileEntry.path}：新版模板中无 ${sectionId} 标记段落，跳过。`)
    printProgress('', true)
    return 'skipped'
  }

  if (!fileExists) {
    // 文件不存在，直接写入完整模板（与 init 行为一致）
    try {
      await fs.outputFile(filePath, newContent)
    } catch (err) {
      throw new BmadError('E004', `写入配置文件失败: ${fileEntry.path}`, err, [
        '检查目录写入权限后重试',
      ])
    }
    printProgress(`${fileEntry.path}: 文件不存在，已生成完整配置。`)
    printProgress('', true)
    return 'updated'
  }

  // 精准替换标记段落
  const updatedContent = replaceBmadSection(currentContent, sectionId, newSection)

  // 比较是否有变化
  if (currentContent === updatedContent) {
    printProgress(`${fileEntry.path}：bmad 配置段落无变更，跳过。`)
    printProgress('', true)
    return 'skipped'
  }

  // 写入（无需备份和确认——标记内容为自动生成，用户内容不受影响）
  try {
    await fs.outputFile(filePath, updatedContent)
  } catch (err) {
    throw new BmadError('E004', `写入更新文件失败: ${fileEntry.path}`, err, [
      '检查目录写入权限后重试',
    ])
  }

  printProgress(`${fileEntry.path}: bmad 配置段落已更新（用户自定义内容未变）`)
  printProgress('', true)
  return 'updated'
}

/**
 * 框架/workflow 文件全文件确认+备份+覆盖（FR68, FR69）
 *
 * @returns {Promise<'updated'|'skipped'>}
 */
async function updateFullReplaceFile({ filePath, fileEntry, currentContent, newContent, fileExists, yes }) {
  // 比较差异
  if (currentContent === newContent) {
    printProgress(`${fileEntry.path}：无变更，跳过。`)
    printProgress('', true)
    return 'skipped'
  }

  // 展示变更摘要
  const oldLines = currentContent.split('\n').length
  const newLines = newContent.split('\n').length
  const lineDiff = newLines - oldLines
  const diffDesc = lineDiff > 0 ? `+${lineDiff}` : lineDiff === 0 ? '±0' : `${lineDiff}`
  printProgress(`${fileEntry.path}：内容有变更（${oldLines} → ${newLines} 行，${diffDesc}）`)
  printProgress('', true)

  // 备份（FR69）
  const timestamp = Date.now()
  const backupPath = `${filePath}.bak.${timestamp}`
  if (fileExists) {
    try {
      await fs.copy(filePath, backupPath)
    } catch (err) {
      throw new BmadError('E004', `备份文件失败: ${fileEntry.path}`, err, [
        '检查目录写入权限后重试',
      ])
    }
  }

  // 确认（FR68）—— --yes 模式跳过确认（FR72）
  let shouldUpdate = yes
  if (!yes) {
    const answer = await askConfirm(
      `${fileEntry.path} 有更新，已备份为 ${basename(backupPath)}。是否覆盖？(Y/n) `
    )
    shouldUpdate = answer.toLowerCase() !== 'n'
  }

  if (shouldUpdate) {
    try {
      await fs.outputFile(filePath, newContent)
    } catch (err) {
      throw new BmadError('E004', `写入更新文件失败: ${fileEntry.path}`, err, [
        '检查目录写入权限后重试',
      ])
    }
    return 'updated'
  }

  return 'skipped'
}

/**
 * Ask a yes/no confirmation via stdin/stdout.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function askConfirm(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve, reject) => {
    rl.on('error', (err) => {
      rl.close()
      reject(new BmadError('E001', 'stdin 读取失败', err))
    })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
