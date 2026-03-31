// lib/installer.js
// PLACEHOLDER — Story 2.x 将实现安装编排、幂等检测、模板变量替换
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 安装状态检测结果：'not_installed' | 'installed' | 'corrupted'
// - 模板变量格式：{{variable_name}}，安装时替换
// - 调用链：platform.js → adapter.check() → 文件复制+替换 → adapter.install() → output.js
// - 全流程 ≤60 秒（NFR1），每步进度 ≤2 秒（NFR2）

import fsExtra from 'fs-extra'
import { fileURLToPath } from 'url'
import { dirname, isAbsolute, join, resolve } from 'path'
import { BmadError } from './errors.js'
import { printProgress, printSuccess } from './output.js'
import { detectPlatform, getAdapter } from './platform.js'

const { ensureDir, readFile, outputFile } = fsExtra

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// agent/ 模板目录（相对于 lib/installer.js 向上一级）
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')

// 框架文件列表（硬编码，与 package.json bmadExpert.frameworkFiles 保持一致）
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']

function hasTraversalSegment(targetDir) {
  return targetDir
    .split(/[\\/]+/)
    .filter(Boolean)
    .includes('..')
}

function assertSafeTargetDir(targetDir) {
  if (typeof targetDir !== 'string' || targetDir.trim() === '') {
    throw new BmadError('E002', '目标路径无效：必须提供非空字符串绝对路径', null)
  }

  if (!isAbsolute(targetDir)) {
    throw new BmadError('E002', `目标路径无效：必须为绝对路径 (${targetDir})`, null)
  }

  if (hasTraversalSegment(targetDir)) {
    throw new BmadError('E002', `目标路径无效：包含路径遍历段 (..) (${targetDir})`, null)
  }
}

function wrapFileError(error, message) {
  const isPermissionError = error?.code === 'EACCES' || error?.code === 'EPERM'
  if (isPermissionError) {
    const blockedPath = error.path ?? '（路径未知）'
    const cause = new Error(`沙盒限制写入路径 ${blockedPath}`)
    throw new BmadError('E004', '文件写入失败（权限不足）', cause, [
      `手动创建并授权目标目录：mkdir -p ~/.happycapy/agents/bmad-expert`,
      `确认路径权限后重新执行：npx bmad-expert install`,
    ])
  }
  throw new BmadError('E001', message, error)
}

/**
 * HappyCapy 完整安装编排
 * 调用链：detectPlatform → checkInstallStatus → 文件复制 → 替换变量 → adapter.install
 * @param {Object} [options={}]
 * @param {string|null} [options.platform=null]   - --platform 覆盖值，null 表示自动检测
 * @param {string} [options.agentId='bmad-expert'] - agent 标识符
 * @param {boolean} [options.yes=false]            - 非交互模式（保留参数位）
 * @throws {BmadError} E006 — 已安装（exit code 6）
 * @throws {BmadError} E002 — 无效 platform 或路径非法
 * @throws {BmadError} E004 — 文件写入权限不足
 */
export async function install(options = {}) {
  const { platform: platformOverride = null, agentId = 'bmad-expert' } = options
  const startTime = Date.now()

  // ── Step 1: 平台检测 ──────────────────────────────────────────────────────
  printProgress('正在检测平台...')
  const platformName = await detectPlatform(platformOverride)
  const adapter = getAdapter(platformName)
  printProgress('', true)

  // ── Step 2: 幂等检测（checkInstallStatus 内部含进度输出）──────────────────
  await checkInstallStatus(adapter, agentId)
  // 若 installed → checkInstallStatus 内部已 throw BmadError('E006')，不往下执行
  // 若 corrupted/not_installed → 继续

  const targetDir = adapter.getInstallPath(agentId)
  const installDate = new Date().toISOString().slice(0, 10)
  const vars = { agentId, agentName: agentId, model: '', installDate }

  // ── Step 3: 复制 agent 文件（读模板到内存）───────────────────────────────
  printProgress('正在复制 agent 文件...')
  try {
    await ensureDir(targetDir)
  } catch (error) {
    wrapFileError(error, `创建目标目录失败：${targetDir}`)
  }
  const fileContents = {}
  for (const filename of FRAMEWORK_FILES) {
    try {
      fileContents[filename] = await readFile(join(AGENT_TEMPLATE_DIR, filename), 'utf8')
    } catch (error) {
      wrapFileError(error, `读取模板文件失败：${filename}`)
    }
  }
  printProgress('', true)

  // ── Step 4: 替换模板变量 + 写入目标目录 ──────────────────────────────────
  printProgress('正在替换模板变量...')
  for (const filename of FRAMEWORK_FILES) {
    const replaced = replaceTemplateVars(fileContents[filename], vars)
    try {
      await outputFile(join(targetDir, filename), replaced, 'utf8')
    } catch (error) {
      wrapFileError(error, `写入文件失败：${filename}`)
    }
  }
  printProgress('', true)

  // ── Step 5: 平台注册 ─────────────────────────────────────────────────────
  printProgress('正在注册 agent...')
  await adapter.install(null, { agentId })
  printProgress('', true)

  // ── 安装完成引导 ──────────────────────────────────────────────────────────
  const duration = Math.round((Date.now() - startTime) / 1000)
  printSuccess(
    `bmad-expert 已就绪。安装完成（用时 ${duration}s）\n\n现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
  )
}

/**
 * 检测安装状态，实现幂等保护
 * 若已安装：输出提示到 stdout，抛出 BmadError('E006') 触发 exit code 6
 * 若损坏或未安装：返回 { status } 让调用方继续安装流程
 *
 * @param {object} adapter - 平台适配器（必须含 check(agentId) 方法）
 * @param {string} agentId - agent 标识符（如 'bmad-expert'）
 * @returns {Promise<{status: 'not_installed'|'corrupted'}>} 仅在非 installed 状态返回
 * @throws {BmadError} E006 — 已安装时（不返回，直接抛出）
 */
export async function checkInstallStatus(adapter, agentId) {
  printProgress('正在检测安装状态...')
  let status
  try {
    status = await adapter.check(agentId)
  } finally {
    printProgress('正在检测安装状态...', true)
  }

  if (status === 'installed') {
    printSuccess('检测到已有安装，跳过重复安装，当前状态正常。')
    throw new BmadError('E006', '检测到已有安装，跳过重复安装，当前状态正常。', null)
  }

  if (status === 'corrupted') {
    printProgress('检测到安装损坏，将重新安装...')
  }

  return { status }
}

/**
 * 替换模板文件中的 {{variable}} 占位符
 * 使用函数形式 replacement 防止 $ 字符产生 String.replace 特殊语义副作用
 *
 * @param {string} content - 模板文件原始内容
 * @param {Object} vars - 变量对象
 * @param {string} [vars.agentId=''] - agent 标识符，替换 {{agent_id}}
 * @param {string} [vars.agentName=''] - agent 显示名称，替换 {{agent_name}}
 * @param {string} [vars.model=''] - 模型标识，替换 {{model}}
 * @param {string} [vars.installDate=''] - 安装日期，替换 {{install_date}}
 * @returns {string} 替换后的内容
 */
export function replaceTemplateVars(content, vars) {
  const { agentId = '', agentName = '', model = '', installDate = '' } = vars

  return content
    .replace(/\{\{agent_id\}\}/g, () => agentId)
    .replace(/\{\{agent_name\}\}/g, () => agentName)
    .replace(/\{\{model\}\}/g, () => model)
    .replace(/\{\{install_date\}\}/g, () => installDate)
}

/**
 * 读取 agent/ 模板文件，替换变量后写入目标目录
 * 写入路径必须为合法绝对路径，不得包含 .. 路径段
 *
 * @param {string} targetDir - 目标安装目录（绝对路径）
 * @param {Object} vars - 模板变量（agentId, agentName, model, installDate）
 * @throws {BmadError} E002 - 路径非法时抛出
 */
export async function writeAgentFiles(targetDir, vars) {
  // 路径安全验证：目标路径必须为绝对路径，且不能包含 .. 路径段（NFR12）
  assertSafeTargetDir(targetDir)

  try {
    await ensureDir(targetDir)
  } catch (error) {
    wrapFileError(error, `创建目标目录失败：${targetDir}`)
  }

  for (const filename of FRAMEWORK_FILES) {
    const templatePath = join(AGENT_TEMPLATE_DIR, filename)

    try {
      const content = await readFile(templatePath, 'utf8')
      const replaced = replaceTemplateVars(content, vars)
      await outputFile(join(targetDir, filename), replaced, 'utf8')
    } catch (error) {
      wrapFileError(error, `写入模板文件失败：${filename}`)
    }
  }
}
