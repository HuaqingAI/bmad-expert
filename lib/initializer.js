// lib/initializer.js
// init 命令核心逻辑 — Story 10.2 + 10.3（幂等保护）
//
// 架构约束（后续故事必须遵守）：
// - 文件操作只用 fs-extra，禁止原生 fs
// - 输出只通过 output.js，禁止 console.log
// - 错误只用 BmadError，禁止 throw new Error()
// - 禁止 process.exit()，由 cli.js 顶层统一处理

import fs from 'fs-extra'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createInterface } from 'readline'
import { BmadError } from './errors.js'
import { printProgress, printSuccess } from './output.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMPLATES_DIR = join(__dirname, '..', 'templates')

/**
 * Detect workspace directory structure by scanning first-level subdirectories.
 * Identifies project directories containing .git/, _bmad/, or package.json.
 *
 * @param {string} cwd - Workspace root directory
 * @returns {Promise<{projects: Array<{name: string, path: string}>}>}
 * @throws {BmadError} E002 if no project directories found
 */
export async function detectWorkspaceStructure(cwd) {
  let entries
  try {
    entries = await fs.readdir(cwd, { withFileTypes: true })
  } catch (err) {
    throw new BmadError(
      err.code === 'ENOENT' ? 'E002' : 'E004',
      err.code === 'ENOENT'
        ? `workspace 目录不存在: ${cwd}`
        : `无法读取 workspace 目录: ${cwd}`,
      err,
      [err.code === 'ENOENT' ? '确认路径正确后重新运行' : '检查目录读取权限后重新运行']
    )
  }
  const projects = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const dirPath = join(cwd, entry.name)
    const [hasGit, hasBmad, hasPkg] = await Promise.all([
      fs.pathExists(join(dirPath, '.git')),
      fs.pathExists(join(dirPath, '_bmad')),
      fs.pathExists(join(dirPath, 'package.json')),
    ])

    if (hasGit || hasBmad || hasPkg) {
      projects.push({ name: entry.name, path: entry.name })
    }
  }

  if (projects.length === 0) {
    throw new BmadError(
      'E002',
      '未检测到项目目录，请先在 workspace 中创建项目或指定项目路径',
      null,
      [
        '在 workspace 目录下创建包含 .git/ 的项目子目录',
        '或运行 git init <project-name> 初始化新项目',
      ]
    )
  }

  return { projects }
}

/**
 * Collect project info interactively or via defaults (--yes mode).
 *
 * @param {{projects: Array<{name: string, path: string}>}} workspaceInfo
 * @param {{yes?: boolean}} options
 * @returns {Promise<{projectName: string, projectPath: string, generateWorkflow: boolean}>}
 */
export async function collectProjectInfo(workspaceInfo, options = {}) {
  const { projects } = workspaceInfo
  let selectedProject

  if (projects.length === 1) {
    selectedProject = projects[0]
    if (!options.yes) {
      const answer = await askQuestion(
        `检测到项目目录: ${selectedProject.name}，确认使用此项目？(Y/n) `
      )
      if (answer.toLowerCase() === 'n') {
        throw new BmadError('E002', '用户取消了 init 操作', null, [
          '重新运行 npx bmad-expert init 并确认项目',
        ])
      }
    }
  } else if (options.yes) {
    selectedProject = projects[0]
  } else {
    const projectList = projects.map((p, i) => `  ${i + 1}. ${p.name}`).join('\n')
    const answer = await askQuestion(
      `检测到多个项目目录:\n${projectList}\n请选择默认项目 (1-${projects.length}): `
    )
    const index = parseInt(answer, 10) - 1
    if (isNaN(index) || index < 0 || index >= projects.length) {
      selectedProject = projects[0]
    } else {
      selectedProject = projects[index]
    }
  }

  return {
    projectName: selectedProject.name,
    projectPath: selectedProject.path,
    generateWorkflow: true,
  }
}

/**
 * Check which target files already exist on disk.
 *
 * @param {string} cwd - Workspace root directory
 * @param {Array<{path: string, type: string, content: string}>} files - Planned files
 * @returns {Promise<Array<{path: string, type: string, content: string, exists: boolean}>>}
 */
export async function checkExistingFiles(cwd, files) {
  const results = await Promise.all(
    files.map(async (file) => {
      const exists = await fs.pathExists(join(cwd, file.path))
      return { ...file, exists }
    })
  )
  return results
}

/**
 * Backup a file by copying to {filename}.bak.{timestamp}.
 *
 * @param {string} cwd - Workspace root directory
 * @param {string} filePath - Relative path of file to backup
 * @returns {Promise<string>} Backup file path (relative)
 */
export async function backupFile(cwd, filePath) {
  const timestamp = Date.now()
  const backupPath = `${filePath}.bak.${timestamp}`
  await fs.copy(join(cwd, filePath), join(cwd, backupPath))
  return backupPath
}

/**
 * Generate a simple line-based diff between two text contents.
 *
 * @param {string} existing - Current file content
 * @param {string} incoming - New template content
 * @returns {string} Formatted diff output
 */
export function generateDiff(existing, incoming) {
  const oldLines = existing.split('\n')
  const newLines = incoming.split('\n')
  const output = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined
    const newLine = i < newLines.length ? newLines[i] : undefined

    if (oldLine === newLine) {
      output.push(`  ${oldLine}`)
    } else {
      if (oldLine !== undefined) output.push(`- ${oldLine}`)
      if (newLine !== undefined) output.push(`+ ${newLine}`)
    }
  }

  return output.join('\n')
}

/**
 * Resolve file conflicts interactively or via --yes safe defaults.
 *
 * @param {string} cwd - Workspace root directory
 * @param {Array<{path: string, type: string, content: string, exists: boolean}>} fileChecks
 * @param {{yes?: boolean}} options
 * @returns {Promise<Array<{path: string, type: string, content: string, action: string}>>}
 */
export async function resolveConflicts(cwd, fileChecks, options = {}) {
  const results = []

  for (const file of fileChecks) {
    if (!file.exists) {
      results.push({ path: file.path, type: file.type, content: file.content, action: 'created' })
      continue
    }

    // --yes mode: skip all existing files (safe default)
    if (options.yes) {
      results.push({ path: file.path, type: file.type, content: file.content, action: 'skipped' })
      continue
    }

    // Interactive mode: prompt for each existing file
    const answer = await askQuestion(
      `文件已存在: ${file.path}\n  1. 覆盖（先备份） 2. 跳过 3. 查看 diff\n请选择 (1/2/3): `
    )

    if (answer === '1') {
      await backupFile(cwd, file.path)
      results.push({
        path: file.path,
        type: file.type,
        content: file.content,
        action: 'overwritten',
      })
    } else if (answer === '3') {
      const existingContent = await fs.readFile(join(cwd, file.path), 'utf8')
      const diff = generateDiff(existingContent, file.content)
      printProgress(`\n--- ${file.path} (当前) vs (新模板) ---\n${diff}\n`)
      const followUp = await askQuestion(`覆盖此文件？(y/N) `)
      if (followUp.toLowerCase() === 'y') {
        await backupFile(cwd, file.path)
        results.push({
          path: file.path,
          type: file.type,
          content: file.content,
          action: 'overwritten',
        })
      } else {
        results.push({
          path: file.path,
          type: file.type,
          content: file.content,
          action: 'skipped',
        })
      }
    } else {
      results.push({ path: file.path, type: file.type, content: file.content, action: 'skipped' })
    }
  }

  return results
}

/**
 * Generate config files from templates with idempotent conflict handling.
 *
 * @param {string} cwd - Workspace root directory
 * @param {{projectName: string, projectPath: string, generateWorkflow: boolean}} projectInfo
 * @param {{yes?: boolean}} options
 * @returns {Promise<Array<{path: string, type: string, action: string}>>}
 * @throws {BmadError} E004 on file operation failure
 */
export async function generateFiles(cwd, projectInfo, options = {}) {
  const { projectName, projectPath, generateWorkflow } = projectInfo
  const planned = []

  try {
    // ── Phase 1: Build content in memory ──
    const workspaceTemplate = await fs.readFile(
      join(TEMPLATES_DIR, 'workspace-claude.md'),
      'utf8'
    )
    const workspaceContent = workspaceTemplate
      .replace(/PROJECT_NAME/g, projectName)
      .replace(/PROJECT_PATH/g, projectPath)
    planned.push({ path: 'CLAUDE.md', type: 'workspace-claude', content: workspaceContent })

    const projectTemplate = await fs.readFile(join(TEMPLATES_DIR, 'project-claude.md'), 'utf8')
    const projectContent = projectTemplate.replace(/PROJECT_NAME/g, projectName)
    planned.push({
      path: `${projectPath}/CLAUDE.md`,
      type: 'project-claude',
      content: projectContent,
    })

    if (generateWorkflow) {
      const workflowTemplate = await fs.readFile(
        join(TEMPLATES_DIR, 'workflow-single-repo.md'),
        'utf8'
      )
      planned.push({
        path: `${projectPath}/workflow/story-dev-workflow-single-repo.md`,
        type: 'workflow',
        content: workflowTemplate,
      })
    }

    // ── Phase 2: Check existing files ──
    const fileChecks = await checkExistingFiles(cwd, planned)

    // ── Phase 3: Resolve conflicts ──
    const resolved = await resolveConflicts(cwd, fileChecks, options)

    // ── Phase 4: Write files that are not skipped ──
    for (const file of resolved) {
      if (file.action === 'skipped') continue

      const targetPath = join(cwd, file.path)
      if (file.type === 'workflow') {
        await fs.ensureDir(dirname(targetPath))
      }
      await fs.outputFile(targetPath, file.content)
    }

    return resolved.map(({ path, type, action }) => ({ path, type, action }))
  } catch (err) {
    if (err instanceof BmadError) throw err
    throw new BmadError('E004', '文件生成失败', err, [
      '检查 workspace 目录写入权限',
      '确认 templates/ 目录存在且包含模板文件',
    ])
  }
}

/**
 * Write .bmad-init.json manifest file with incremental merge support.
 *
 * @param {string} cwd - Workspace root directory
 * @param {Array<{path: string, type: string, action: string}>} files - File operation results
 * @param {string} defaultProject - Default project name
 * @returns {Promise<void>}
 * @throws {BmadError} E004 on file write failure
 */
export async function writeManifest(cwd, files, defaultProject) {
  const manifestPath = join(cwd, '.bmad-init.json')

  try {
    let existingManifest = null
    if (await fs.pathExists(manifestPath)) {
      const raw = await fs.readFile(manifestPath, 'utf8')
      try {
        existingManifest = JSON.parse(raw)
      } catch {
        // Corrupt manifest — treat as first-time init
        existingManifest = null
      }
    }

    const now = new Date().toISOString()
    const fileRecords = files.map(({ path, type, action }) => ({ path, type, action }))

    let manifest
    if (existingManifest) {
      // Merge: keep skipped files from old manifest, update overwritten/created
      const existingFileMap = new Map(
        (existingManifest.files || []).map((f) => [f.path, f])
      )
      for (const rec of fileRecords) {
        existingFileMap.set(rec.path, { path: rec.path, type: rec.type })
      }
      manifest = {
        ...existingManifest,
        updatedAt: now,
        templateVersion: '1.0.0',
        defaultProject,
        files: Array.from(existingFileMap.values()),
      }
    } else {
      manifest = {
        version: '1.0.0',
        createdAt: now,
        templateVersion: '1.0.0',
        defaultProject,
        files: fileRecords.map(({ path, type }) => ({ path, type })),
      }
    }

    await fs.outputFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  } catch (err) {
    if (err instanceof BmadError) throw err
    throw new BmadError('E004', '.bmad-init.json 写入失败', err, [
      '检查 workspace 目录写入权限',
    ])
  }
}

/**
 * Main init command entry point.
 *
 * @param {{yes?: boolean, cwd?: string}} options
 * @returns {Promise<{defaultProject: string, files: Array<{path: string, type: string, action: string}>}>}
 * @throws {BmadError} E002 if no project directories found
 * @throws {BmadError} E004 on file write failure
 */
export async function init(options = {}) {
  const cwd = options.cwd || process.cwd()

  // ── Step 1: Detect workspace structure ──
  printProgress('正在检测 workspace 目录结构...')
  let workspaceInfo
  try {
    workspaceInfo = await detectWorkspaceStructure(cwd)
  } finally {
    printProgress('', true)
  }

  // ── Step 2: Collect project info ──
  const projectInfo = await collectProjectInfo(workspaceInfo, { yes: options.yes })

  // ── Step 3: Generate files with conflict handling ──
  printProgress('正在生成配置文件...')
  let files
  try {
    files = await generateFiles(cwd, projectInfo, { yes: options.yes })
  } finally {
    printProgress('', true)
  }

  // ── Step 4: Write manifest ──
  printProgress('正在写入 .bmad-init.json 清单...')
  try {
    await writeManifest(cwd, files, projectInfo.projectName)
  } finally {
    printProgress('', true)
  }

  // ── Summary ──
  const created = files.filter((f) => f.action === 'created')
  const overwritten = files.filter((f) => f.action === 'overwritten')
  const skipped = files.filter((f) => f.action === 'skipped')

  const parts = []
  if (created.length) parts.push(`新建: ${created.map((f) => f.path).join(', ')}`)
  if (overwritten.length) parts.push(`覆盖: ${overwritten.map((f) => f.path).join(', ')}`)
  if (skipped.length) parts.push(`跳过: ${skipped.map((f) => f.path).join(', ')}`)

  printSuccess(
    `Init 完成！项目 "${projectInfo.projectName}"\n${parts.join('\n')}`
  )

  return {
    defaultProject: projectInfo.projectName,
    files,
  }
}

// ── Internal helpers ──

/**
 * Ask a question via stdin/stdout and return the answer.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
function askQuestion(prompt) {
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
