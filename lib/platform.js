// lib/platform.js
// 平台检测模块与适配器工厂 — Story 2.1
//
// 架构约束：
// - 具名导出，禁止 default export
// - 路径计算必须通过适配器的 getInstallPath()，禁止硬编码路径
// - 检测耗时 ≤3 秒（NFR3）
// - 错误使用 BmadError，禁止直接 throw new Error()

import { BmadError } from './errors.js'
import * as happycapyAdapter from './adapters/happycapy.js'

// 所有已知平台名称（含 Phase 1.5 占位，仅用于错误提示）
export const SUPPORTED_PLATFORMS = ['happycapy', 'cursor', 'claude-code']

// 当前 sprint 已实现的适配器；cursor/claude-code 为 Phase 1.5 占位
const PLATFORM_DETECTORS = [{ name: 'happycapy', adapter: happycapyAdapter }]

// 已实现的平台名称集合（与 PLATFORM_DETECTORS 保持同步）
const IMPLEMENTED_PLATFORMS = PLATFORM_DETECTORS.map((p) => p.name)

/**
 * 检测当前平台，支持显式覆盖
 * @param {string|null} platformOverride - --platform 参数值，null 表示自动检测
 * @returns {Promise<string>} 平台名称（'happycapy' | ...）
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
    // 再验证是否已有可用适配器（Phase 1.5 平台尚未实现）
    if (!IMPLEMENTED_PLATFORMS.includes(platformOverride)) {
      throw new BmadError(
        'E002',
        `平台 '${platformOverride}' 尚未实现（Phase 1.5），当前可用：${IMPLEMENTED_PLATFORMS.join(', ')}`,
        new Error(`'${platformOverride}' 在 SUPPORTED_PLATFORMS 中已知，但适配器尚未注册`)
      )
    }
    return platformOverride
  }

  for (const { name, adapter } of PLATFORM_DETECTORS) {
    if (await adapter.detect()) {
      return name
    }
  }

  throw new BmadError(
    'E002',
    '无法自动检测到支持的平台，请使用 --platform 参数指定',
    new Error(`已尝试检测：${PLATFORM_DETECTORS.map((p) => p.name).join(', ')}`)
  )
}

/**
 * 根据平台名称返回对应适配器对象
 * @param {string} platformName - 平台名称
 * @returns {object} 适配器对象（含 detect, getInstallPath, install, check 四个方法）
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
