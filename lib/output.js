// lib/output.js
// 统一输出模块 — Story 1.3
//
// 架构约束（后续故事必须遵守）：
// - 所有进度/成功/错误输出必须通过此模块路由，禁止直接 console.log/console.error
// - stdout：进度信息、成功确认、--json 输出（Story 6.3）
// - stderr：错误信息（ERROR [E{code}] 格式，AI 可读 Schema）；JSON 模式下 cli.js 不调用 printError

import chalk from 'chalk'
import { BmadError } from './errors.js'

// JSON 模式状态 — Story 6.3
let _jsonMode = false

/**
 * 设置 JSON 输出模式（Story 6.3）
 * JSON 模式下 printProgress/printSuccess 沉默，由 cli.js 统一通过 printJSON 输出结构化数据
 *
 * @param {boolean} enabled
 */
export function setJsonMode(enabled) {
  _jsonMode = !!enabled
}

/**
 * 读取当前 JSON 模式状态（Story 6.3）
 *
 * @returns {boolean}
 */
export function getJsonMode() {
  return _jsonMode
}

/**
 * 结构化 JSON 输出 — 写入 stdout（Story 6.3）
 * JSON 模式下用于输出成功结果或错误对象，stderr 保持空白
 *
 * @param {object} data - 要序列化的对象
 */
export function printJSON(data) {
  process.stdout.write(JSON.stringify(data) + '\n')
}

/**
 * 进度输出 — 写入 stdout
 * JSON 模式下沉默（由 cli.js 统一控制输出）
 *
 * 使用模式（双调用）：
 *   printProgress('正在检测平台...')        // 输出步骤描述（无换行）
 *   // ... 执行异步操作 ...
 *   printProgress('正在检测平台...', true)  // 完成后追加 ✓
 *
 * @param {string} message - 步骤描述文字
 * @param {boolean} done   - true 时追加 ✓ 换行符
 */
export function printProgress(message, done = false) {
  if (_jsonMode) return
  if (done) {
    process.stdout.write(chalk.green(' ✓') + '\n')
  } else {
    process.stdout.write(message)
  }
}

/**
 * 成功确认输出 — 写入 stdout
 * JSON 模式下沉默（由 cli.js 统一控制输出）
 *
 * @param {string} message - 成功/引导信息
 */
export function printSuccess(message) {
  if (_jsonMode) return
  process.stdout.write('\n' + chalk.bold(message) + '\n')
}

/**
 * 错误格式化输出 — 写入 stderr（AI 可读 Schema）
 * 兼容 BmadError 和普通 Error
 *
 * BmadError 格式：
 *   ERROR [E{code}] {message}
 *   原因：{cause.message}
 *   修复步骤：
 *     1. {step1}
 *     2. {step2}
 *   可重试：是/否
 *
 * @param {BmadError|Error} err - 错误对象
 */
export function printError(err) {
  if (err instanceof BmadError) {
    const retryableText = err.retryable ? '是' : '否'
    const causeMsg = err.cause?.message ?? '未知原因'
    const steps = err.fixSteps?.length > 0 ? err.fixSteps : ['检查错误原因并重试']
    const stepsLines = steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    const output = [
      `ERROR [${err.bmadCode}] ${err.message}`,
      `原因：${causeMsg}`,
      `修复步骤：`,
      stepsLines,
      `可重试：${retryableText}`,
    ].join('\n') + '\n'
    process.stderr.write(output)
  } else {
    process.stderr.write(`ERROR ${err.message}\n`)
  }
}
