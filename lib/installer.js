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
  const bmadCode = error?.code === 'EACCES' || error?.code === 'EPERM' ? 'E004' : 'E001'
  throw new BmadError(bmadCode, message, error)
}

// install() 占位 — Story 2.4 实现完整安装编排流程
export async function install(options) {} // eslint-disable-line no-unused-vars

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
