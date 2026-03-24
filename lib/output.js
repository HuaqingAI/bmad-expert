// lib/output.js
// 统一输出模块 — Story 1.3
//
// 架构约束（后续故事必须遵守）：
// - 所有进度/成功/错误输出必须通过此模块路由，禁止直接 console.log/console.error
// - stdout：进度信息、成功确认
// - stderr：错误信息（ERROR [E{code}] 格式，AI 可读 Schema）

import chalk from 'chalk'
import { BmadError } from './errors.js'

/**
 * 进度输出 — 写入 stdout
 * 使用模式（双调用）：
 *   printProgress('正在检测平台...')        // 输出步骤描述（无换行）
 *   // ... 执行异步操作 ...
 *   printProgress('正在检测平台...', true)  // 完成后追加 ✓
 *
 * @param {string} message - 步骤描述文字
 * @param {boolean} done   - true 时追加 ✓ 换行符
 */
export function printProgress(message, done = false) {
  if (done) {
    process.stdout.write(chalk.green(' ✓') + '\n')
  } else {
    process.stdout.write(message)
  }
}

/**
 * 成功确认输出 — 写入 stdout
 *
 * @param {string} message - 成功/引导信息
 */
export function printSuccess(message) {
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
 *     1. {step}
 *   可重试：是/否
 *
 * @param {BmadError|Error} err - 错误对象
 */
export function printError(err) {
  if (err instanceof BmadError) {
    const retryableText = err.retryable ? '是' : '否'
    const causeMsg = err.cause?.message ?? '未知原因'
    const output = [
      `ERROR [${err.bmadCode}] ${err.message}`,
      `原因：${causeMsg}`,
      `修复步骤：`,
      `  1. 检查错误原因并重试`,
      `可重试：${retryableText}`,
    ].join('\n') + '\n'
    process.stderr.write(output)
  } else {
    process.stderr.write(`ERROR ${err.message}\n`)
  }
}
