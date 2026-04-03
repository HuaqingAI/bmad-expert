// lib/orchestrator.js
// BMAD 官方安装器编排器 — Story 7.2
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 外部进程调用必须使用 execa，禁止 child_process
// - 所有输出通过 output.js，禁止 console.log/console.error
// - 错误必须使用 BmadError，禁止直接 throw new Error()
// - 具名导出，禁止 default export
// - lib 模块内禁止 process.exit()

import { execa } from 'execa'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import fs from 'fs-extra'
import { BmadError } from './errors.js'
import { printProgress } from './output.js'
import { replaceTemplateVars } from './installer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Phase 2：仅 bmad-expert 补充文件（不含 bmad-project-init.md）
// 与 installer.js FRAMEWORK_FILES 的区别：FRAMEWORK_FILES 含 'bmad-project-init.md'（Phase 1 全集）
const SUPPLEMENT_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md']

// agent/ 模板目录（与 installer.js / updater.js 一致）
const AGENT_TEMPLATE_DIR = resolve(__dirname, '../agent')

// 网络相关错误码（用于 execa 本身抛出时的判断）
const NETWORK_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']

/**
 * 通过 execa 调用 npx bmad-method install，动态获取官方安装器最新版本
 *
 * @param {string[]} params - 传递给官方安装器的参数数组（不含 --yes，内部自动追加）
 *   示例：['--modules', 'bmm', '--tools', 'claude-code']
 * @returns {Promise<{stdout: string, stderr: string}>}
 * @throws {BmadError} E001 — 官方安装器非零退出
 * @throws {BmadError} E005 — 网络错误
 */
export async function executeInstall(params) {
  printProgress('正在执行 BMAD 安装...')

  let result
  try {
    // reject: false → 不自动抛出，手动检查 exitCode 以获得完整 stdout/stderr 用于错误上下文
    // all: true → result.all 包含合并的 stdout+stderr
    result = await execa('npx', ['bmad-method', 'install', ...params, '--yes'], {
      all: true,
      reject: false,
    })
  } catch (err) {
    // execa 本身抛出（如 npx 不存在、OS 级网络错误）
    if (NETWORK_CODES.includes(err?.code)) {
      throw new BmadError('E005', '网络错误：无法调用 npx bmad-method install', err, [
        '检查网络连接后重新执行安装命令',
        '若持续失败，检查代理设置',
      ])
    }
    throw new BmadError('E001', 'BMAD 官方安装器调用失败', err)
  }

  if (result.exitCode !== 0) {
    const outputContext = result.all || result.stderr || result.stdout || '（无输出）'
    throw new BmadError(
      'E001',
      'BMAD 官方安装器执行失败',
      new Error(outputContext),
      ['检查 npx bmad-method install 的可用性', '确认网络连接后重试']
    )
  }

  printProgress('', true)
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/**
 * 写入 bmad-expert 补充 agent 文件至目标路径，替换模板变量
 *
 * 写入文件：SOUL.md、IDENTITY.md、AGENTS.md、BOOTSTRAP.md
 *
 * @param {string} targetPath - 目标安装目录（绝对路径，路径白名单由调用方 installer.js 保证）
 * @param {Object} [vars={}]  - 模板变量覆盖（可覆盖 agentId/agentName/model/installDate）
 * @throws {BmadError} E004  — EACCES/EPERM 文件写入权限不足
 * @throws {BmadError} E001  — 其他 I/O 错误
 */
export async function writeSupplementFiles(targetPath, vars = {}) {
  printProgress('正在写入补充文件...')

  const installDate = new Date().toISOString().slice(0, 10)
  const mergedVars = {
    agentId: 'bmad-expert',
    agentName: 'bmad-expert',
    model: '',
    installDate,
    ...vars,
  }

  try {
    await fs.ensureDir(targetPath)
  } catch (err) {
    _wrapWriteError(err, `创建目标目录失败：${targetPath}`)
  }

  for (const filename of SUPPLEMENT_FILES) {
    const templatePath = join(AGENT_TEMPLATE_DIR, filename)
    try {
      const content = await fs.readFile(templatePath, 'utf8')
      const replaced = replaceTemplateVars(content, mergedVars)
      await fs.outputFile(join(targetPath, filename), replaced, 'utf8')
    } catch (err) {
      _wrapWriteError(err, `写入补充文件失败：${filename}`)
    }
  }

  printProgress('', true)
}

/**
 * 统一文件写入错误包装（内部辅助，不导出）
 * EACCES/EPERM → BmadError('E004')，其他 → BmadError('E001')
 *
 * @param {Error} err - 原始错误
 * @param {string} fallbackMsg - 非权限错误时使用的消息
 */
function _wrapWriteError(err, fallbackMsg) {
  const isPermissionError = err?.code === 'EACCES' || err?.code === 'EPERM'
  if (isPermissionError) {
    throw new BmadError('E004', '补充文件写入失败', err, [
      '检查目标目录权限后重试',
      '重新执行安装命令：npx bmad-expert install',
    ])
  }
  throw new BmadError('E001', fallbackMsg, err)
}
