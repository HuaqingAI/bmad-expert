// test/platform.test.js
// 平台检测模块与 HappyCapy 适配器接口测试 — Story 2.1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import { detectPlatform, getAdapter, SUPPORTED_PLATFORMS } from '../lib/platform.js'
import { detect, getInstallPath, check, install } from '../lib/adapters/happycapy.js'
import { BmadError } from '../lib/errors.js'

// 模块级 mock（vitest 会自动 hoist 到导入前）
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
  },
}))

// ─────────────────────────────────────────────
// lib/platform.js
// ─────────────────────────────────────────────
describe('lib/platform.js', () => {
  describe('SUPPORTED_PLATFORMS', () => {
    it('包含三个支持平台', () => {
      expect(SUPPORTED_PLATFORMS).toContain('happycapy')
      expect(SUPPORTED_PLATFORMS).toContain('cursor')
      expect(SUPPORTED_PLATFORMS).toContain('claude-code')
    })
  })

  describe('detectPlatform()', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.clearAllMocks()
    })

    // Override 路径
    it('platformOverride 为 happycapy 时直接返回（不调用 detect）', async () => {
      const result = await detectPlatform('happycapy')
      expect(result).toBe('happycapy')
    })

    it('platformOverride 为 cursor 时 throw BmadError(E002)（Phase 1.5 未实现）', async () => {
      await expect(detectPlatform('cursor')).rejects.toMatchObject({ bmadCode: 'E002' })
    })

    it('platformOverride 为 claude-code 时 throw BmadError(E002)（Phase 1.5 未实现）', async () => {
      await expect(detectPlatform('claude-code')).rejects.toMatchObject({ bmadCode: 'E002' })
    })

    it('platformOverride 非法时 throw BmadError，bmadCode 为 E002', async () => {
      await expect(detectPlatform('unknown-platform')).rejects.toMatchObject({
        bmadCode: 'E002',
      })
    })

    it('platformOverride 非法时，error 继承自 BmadError', async () => {
      const err = await detectPlatform('invalid').catch((e) => e)
      expect(err).toBeInstanceOf(BmadError)
    })

    // 自动检测路径
    it('自动检测：CAPY_USER_ID 非空时返回 happycapy', async () => {
      vi.stubEnv('CAPY_USER_ID', 'test-user-id')
      const result = await detectPlatform()
      expect(result).toBe('happycapy')
    })

    it('自动检测：CAPY_USER_ID 为空 + execa 成功时返回 happycapy', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValueOnce({ exitCode: 0 })
      const result = await detectPlatform()
      expect(result).toBe('happycapy')
    })

    it('自动检测：无任何平台特征时 throw BmadError(E002)', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValueOnce(new Error('command not found'))
      await expect(detectPlatform()).rejects.toMatchObject({ bmadCode: 'E002' })
    })

    it('null 参数等同于自动检测（CAPY_USER_ID 存在时返回 happycapy）', async () => {
      vi.stubEnv('CAPY_USER_ID', 'any-value')
      const result = await detectPlatform(null)
      expect(result).toBe('happycapy')
    })
  })

  describe('getAdapter()', () => {
    it('happycapy 返回含四个接口方法的适配器', () => {
      const adapter = getAdapter('happycapy')
      expect(typeof adapter.detect).toBe('function')
      expect(typeof adapter.getInstallPath).toBe('function')
      expect(typeof adapter.check).toBe('function')
      expect(typeof adapter.install).toBe('function')
    })

    it('不支持的平台 throw BmadError(E002)', () => {
      expect(() => getAdapter('unknown')).toThrow(BmadError)
      expect(() => getAdapter('unknown')).toThrow(
        expect.objectContaining({ bmadCode: 'E002' })
      )
    })

    it('Phase 1.5 占位平台（cursor）throw BmadError(E002)', () => {
      // cursor 在 SUPPORTED_PLATFORMS 中但尚未注册到 PLATFORM_DETECTORS
      expect(() => getAdapter('cursor')).toThrow(
        expect.objectContaining({ bmadCode: 'E002' })
      )
    })
  })
})

// ─────────────────────────────────────────────
// lib/adapters/happycapy.js
// ─────────────────────────────────────────────
describe('lib/adapters/happycapy.js', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  // detect()
  describe('detect()', () => {
    it('CAPY_USER_ID 非空时返回 true，不调用 execa', async () => {
      vi.stubEnv('CAPY_USER_ID', 'user-123')
      const { execa } = await import('execa')
      const result = await detect()
      expect(result).toBe(true)
      expect(execa).not.toHaveBeenCalled()
    })

    it('CAPY_USER_ID 未设置，execa 成功时返回 true', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValueOnce({ exitCode: 0 })
      const result = await detect()
      expect(result).toBe(true)
    })

    it('CAPY_USER_ID 未设置，execa 失败时返回 false', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValueOnce(new Error('not found'))
      const result = await detect()
      expect(result).toBe(false)
    })

    it('execa 调用参数包含 happycapy-cli --version 和 timeout', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValueOnce({ exitCode: 0 })
      await detect()
      expect(execa).toHaveBeenCalledWith('happycapy-cli', ['--version'], {
        timeout: 3000,
      })
    })
  })

  // getInstallPath()
  describe('getInstallPath()', () => {
    it('返回正确的绝对路径（含 .happycapy/agents/agentId）', () => {
      const result = getInstallPath('bmad-expert')
      const expected = path.resolve(
        path.join(os.homedir(), '.happycapy', 'agents', 'bmad-expert')
      )
      expect(result).toBe(expected)
    })

    it('路径以 homedir/.happycapy/agents/ 开头', () => {
      const result = getInstallPath('my-agent')
      expect(result).toContain('.happycapy')
      expect(result).toContain('agents')
      expect(result).toContain('my-agent')
    })

    it('空字符串 agentId throw BmadError(E004)', () => {
      expect(() => getInstallPath('')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('"." agentId throw BmadError(E004)', () => {
      expect(() => getInstallPath('.')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('".." agentId throw BmadError(E004)', () => {
      expect(() => getInstallPath('..')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('含路径分隔符的 agentId（foo/bar）throw BmadError(E004)', () => {
      expect(() => getInstallPath('foo/bar')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('含反斜杠的 agentId throw BmadError(E004)', () => {
      expect(() => getInstallPath('foo\\bar')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('agentId 含 .. 的路径遍历 throw BmadError(E004)', () => {
      expect(() => getInstallPath('../evil')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('返回值是绝对路径（path.isAbsolute）', () => {
      const result = getInstallPath('test-agent')
      expect(path.isAbsolute(result)).toBe(true)
    })
  })

  // check()
  describe('check()', () => {
    beforeEach(async () => {
      // 确保 fs-extra mock 干净
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockReset()
    })

    it('目标路径不存在时返回 not_installed', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(false)
      const result = await check('bmad-expert')
      expect(result).toBe('not_installed')
    })

    it('目标路径存在且含 AGENTS.md 时返回 installed', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists
        .mockResolvedValueOnce(true) // installPath 存在
        .mockResolvedValueOnce(true) // AGENTS.md 存在
      const result = await check('bmad-expert')
      expect(result).toBe('installed')
    })

    it('目标路径存在但缺 AGENTS.md 时返回 corrupted', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists
        .mockResolvedValueOnce(true) // installPath 存在
        .mockResolvedValueOnce(false) // AGENTS.md 缺失
      const result = await check('bmad-expert')
      expect(result).toBe('corrupted')
    })

    it('AGENTS.md 检查时使用正确路径（含 agentId）', async () => {
      const fs = (await import('fs-extra')).default
      fs.pathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
      await check('my-agent')
      const secondCall = fs.pathExists.mock.calls[1][0]
      expect(secondCall).toContain('my-agent')
      expect(secondCall).toContain('AGENTS.md')
    })
  })

  // install()
  describe('install()', () => {
    it('存在且可调用（Story 2.4 占位骨架）', async () => {
      // install 是 Story 2.4 的占位，不应 throw
      await expect(install({}, { agentId: 'bmad-expert' })).resolves.toBeUndefined()
    })

    it('无参数调用不 throw', async () => {
      await expect(install()).resolves.toBeUndefined()
    })
  })
})
