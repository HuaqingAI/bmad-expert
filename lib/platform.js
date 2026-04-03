// lib/platform.js
// 平台检测模块与适配器工厂 — Story 2.1 / Story 8.1
//
// 架构约束：
// - 具名导出，禁止 default export
// - 路径计算必须通过适配器的 getInstallPath()，禁止硬编码路径
// - 探针链总耗时 ≤ 1 秒（NFR15）
// - 错误使用 BmadError，禁止直接 throw new Error()

import { BmadError } from './errors.js'
import * as happycapyAdapter from './adapters/happycapy.js'
import * as claudeCodeAdapter from './adapters/claude-code.js'
import * as openclawAdapter from './adapters/openclaw.js'
import * as codexAdapter from './adapters/codex.js'

// 所有已知平台名称（含未完整实现的占位）
export const SUPPORTED_PLATFORMS = ['happycapy', 'openclaw', 'claude-code', 'codex', 'cursor']

// 已注册探针的适配器（按优先级排列；置信度相同时取注册顺序靠前者）
const PLATFORM_DETECTORS = [
  { name: 'happycapy', adapter: happycapyAdapter },
  { name: 'openclaw', adapter: openclawAdapter },
  { name: 'claude-code', adapter: claudeCodeAdapter },
  { name: 'codex', adapter: codexAdapter },
]

// cursor 在 SUPPORTED_PLATFORMS 中已知，但无探针适配器（Phase 1.5 占位，非 Phase 2 目标）
const IMPLEMENTED_PLATFORMS = PLATFORM_DETECTORS.map((p) => p.name)

// 置信度阈值：低于此值视为未命中
const CONFIDENCE_THRESHOLD = 0.5

/**
 * 检测当前平台，支持显式覆盖
 * @param {string|null} platformOverride - --platform 参数值，null 表示自动检测
 * @returns {Promise<string>} 平台名称（'happycapy' | 'openclaw' | 'claude-code' | 'codex' | ...）
 * @throws {BmadError} E002 — 无效/未实现平台参数，或无法自动检测
 */
export async function detectPlatform(platformOverride = null) {
  if (platformOverride !== null) {
    // 先验证是否为已知平台名
    if (!SUPPORTED_PLATFORMS.includes(platformOverride)) {
      throw new BmadError(
        'E002',
        `无效参数: --platform 值 '${platformOverride}' 不被支持`,
        new Error(`支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`),
        [`使用支持的平台值：${SUPPORTED_PLATFORMS.join(', ')}`]
      )
    }
    // 再验证是否已有可用适配器（cursor 等未注册探针的平台）
    if (!IMPLEMENTED_PLATFORMS.includes(platformOverride)) {
      throw new BmadError(
        'E002',
        `平台 '${platformOverride}' 尚未实现，当前可用：${IMPLEMENTED_PLATFORMS.join(', ')}`,
        new Error(`'${platformOverride}' 在 SUPPORTED_PLATFORMS 中已知，但适配器尚未注册`)
      )
    }
    return platformOverride
  }

  // 自动检测：并发运行所有已注册适配器的探针，取置信度最高者
  // 每个探针独立捕获异常并降级为 0，避免单个适配器故障导致整条链崩溃
  const results = await Promise.all(
    PLATFORM_DETECTORS.map(async ({ name, adapter }) => {
      try {
        return { name, confidence: await adapter.detectConfidence() }
      } catch {
        return { name, confidence: 0 }
      }
    })
  )

  // reduce 保持注册顺序的稳定性：置信度相同时保留靠前的（a 不被 b 替换）
  const best = results.reduce((a, b) => (b.confidence > a.confidence ? b : a))

  if (best.confidence >= CONFIDENCE_THRESHOLD) {
    return best.name
  }

  throw new BmadError(
    'E002',
    '无法自动检测平台，请通过 --platform 手动指定',
    new Error(`已尝试检测：${PLATFORM_DETECTORS.map((p) => p.name).join(', ')}`),
    [`使用 --platform 指定平台，支持值：${SUPPORTED_PLATFORMS.join(', ')}`]
  )
}

/**
 * 返回指定平台在当前环境的探针置信度
 * @param {string} platformName - 平台名称
 * @returns {Promise<number>} 置信度（0-1）；未注册探针的平台返回 0
 */
export async function detectConfidence(platformName) {
  const found = PLATFORM_DETECTORS.find((p) => p.name === platformName)
  if (!found) return 0
  return found.adapter.detectConfidence()
}

/**
 * 根据平台名称返回对应适配器对象
 * @param {string} platformName - 平台名称
 * @returns {object} 适配器对象（含 detect, detectConfidence, getInstallPath, install, check 方法）
 * @throws {BmadError} E002 — 不支持的平台
 */
export function getAdapter(platformName) {
  const found = PLATFORM_DETECTORS.find((p) => p.name === platformName)
  if (!found) {
    throw new BmadError(
      'E002',
      `不支持的平台：${platformName}`,
      new Error(`已注册平台：${PLATFORM_DETECTORS.map((p) => p.name).join(', ')}`)
    )
  }
  return found.adapter
}
