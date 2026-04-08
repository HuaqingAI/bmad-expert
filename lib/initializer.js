// lib/initializer.js
// init 命令核心逻辑 — Story 10.2
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

export const TEMPLATES_DIR = join(__dirname, '..', 'templates')

/**
 * Template type → template file mapping.
 * @type {Record<string, string>}
 */
const TEMPLATE_FILE_MAP = {
  'workspace-claude': 'workspace-claude.md',
  'project-claude': 'project-claude.md',
  workflow: 'workflow-single-repo.md',
}

/**
 * Generate file content from a template type and project info.
 * Reusable by both init and update commands.
 *
 * @param {string} templateType - One of 'workspace-claude', 'project-claude', 'workflow'
 * @param {{projectName: string, projectPath: string}} projectInfo
 * @returns {Promise<string>} Generated content
 * @throws {BmadError} E001 if template file not found
 */
export async function generateFileContent(templateType, projectInfo) {
  const templateFile = TEMPLATE_FILE_MAP[templateType]
  if (!templateFile) {
    throw new BmadError('E001', `未知模板类型: ${templateType}`)
  }

  let template
  try {
    template = await fs.readFile(join(TEMPLATES_DIR, templateFile), 'utf8')
  } catch (err) {
    throw new BmadError('E001', `读取模板文件失败: ${templateFile}`, err)
  }

  const { projectName, projectPath } = projectInfo
  let content = template
  if (templateType === 'workspace-claude') {
    content = content.replace(/PROJECT_NAME/g, projectName).replace(/PROJECT_PATH/g, projectPath)
  } else if (templateType === 'project-claude') {
    content = content.replace(/PROJECT_NAME/g, projectName)
  }
  // workflow type: no substitution needed

  return content
}

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
 * Generate config files from templates with project info substitution.
 *
 * @param {string} cwd - Workspace root directory
 * @param {{projectName: string, projectPath: string, generateWorkflow: boolean}} projectInfo
 * @returns {Promise<Array<{path: string, type: string}>>}
 * @throws {BmadError} E004 on file write failure
 */
export async function generateFiles(cwd, projectInfo) {
  const { projectName, projectPath, generateWorkflow } = projectInfo
  const files = []

  try {
    const pInfo = { projectName, projectPath }

    // ── Generate workspace CLAUDE.md ──
    const workspaceContent = await generateFileContent('workspace-claude', pInfo)
    await fs.outputFile(join(cwd, 'CLAUDE.md'), workspaceContent)
    files.push({ path: 'CLAUDE.md', type: 'workspace-claude' })

    // ── Generate project CLAUDE.md ──
    const projectContent = await generateFileContent('project-claude', pInfo)
    await fs.outputFile(join(cwd, projectPath, 'CLAUDE.md'), projectContent)
    files.push({ path: `${projectPath}/CLAUDE.md`, type: 'project-claude' })

    // ── Generate workflow file ──
    if (generateWorkflow) {
      const workflowContent = await generateFileContent('workflow', pInfo)
      const workflowDir = join(cwd, projectPath, 'workflow')
      await fs.ensureDir(workflowDir)
      await fs.outputFile(
        join(workflowDir, 'story-dev-workflow-single-repo.md'),
        workflowContent
      )
      files.push({
        path: `${projectPath}/workflow/story-dev-workflow-single-repo.md`,
        type: 'workflow',
      })
    }
  } catch (err) {
    if (err instanceof BmadError) throw err
    throw new BmadError('E004', '文件生成失败', err, [
      '检查 workspace 目录写入权限',
      '确认 templates/ 目录存在且包含模板文件',
    ])
  }

  return files
}

/**
 * Write .bmad-init.json manifest file.
 *
 * @param {string} cwd - Workspace root directory
 * @param {Array<{path: string, type: string}>} files - Generated file records
 * @param {string} defaultProject - Default project name
 * @returns {Promise<void>}
 * @throws {BmadError} E004 on file write failure
 */
export async function writeManifest(cwd, files, defaultProject) {
  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    templateVersion: '1.0.0',
    defaultProject,
    files,
  }

  try {
    await fs.outputFile(join(cwd, '.bmad-init.json'), JSON.stringify(manifest, null, 2) + '\n')
  } catch (err) {
    throw new BmadError('E004', '.bmad-init.json 写入失败', err, [
      '检查 workspace 目录写入权限',
    ])
  }
}

/**
 * Main init command entry point.
 *
 * @param {{yes?: boolean, cwd?: string}} options
 * @returns {Promise<{defaultProject: string, files: Array<{path: string, type: string}>}>}
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

  // ── Step 3: Generate files from templates ──
  printProgress('正在生成配置文件...')
  let files
  try {
    files = await generateFiles(cwd, projectInfo)
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

  printSuccess(
    `Init 完成！已为项目 "${projectInfo.projectName}" 生成 ${files.length} 个配置文件。`
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
