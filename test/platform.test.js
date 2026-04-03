// test/platform.test.js
// 平台检测模块与适配器测试 — Story 2.1 / Story 8.1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import {
  detectPlatform,
  detectConfidence,
  getAdapter,
  SUPPORTED_PLATFORMS,
} from '../lib/platform.js'
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
    it('包含五个支持平台', () => {
      expect(SUPPORTED_PLATFORMS).toContain('happycapy')
      expect(SUPPORTED_PLATFORMS).toContain('cursor')
      expect(SUPPORTED_PLATFORMS).toContain('claude-code')
      expect(SUPPORTED_PLATFORMS).toContain('openclaw')
      expect(SUPPORTED_PLATFORMS).toContain('codex')
    })
  })

  describe('detectPlatform()', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.clearAllMocks()
    })

    // ── Override 路径 ──────────────────────────────────────
    it('platformOverride 为 happycapy 时直接返回（不调用探针链）', async () => {
      const result = await detectPlatform('happycapy')
      expect(result).toBe('happycapy')
    })

    it('platformOverride 为 openclaw 时直接返回', async () => {
      const result = await detectPlatform('openclaw')
      expect(result).toBe('openclaw')
    })

    it('platformOverride 为 claude-code 时直接返回（Phase 2 已注册）', async () => {
      const result = await detectPlatform('claude-code')
      expect(result).toBe('claude-code')
    })

    it('platformOverride 为 codex 时直接返回', async () => {
      const result = await detectPlatform('codex')
      expect(result).toBe('codex')
    })

    it('platformOverride 为 cursor 时 throw BmadError(E002)（无探针适配器）', async () => {
      await expect(detectPlatform('cursor')).rejects.toMatchObject({ bmadCode: 'E002' })
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

    it('无效 platform E002 包含 fixSteps（含所有支持平台名）', async () => {
      const err = await detectPlatform('unknown-platform').catch((e) => e)
      expect(err.fixSteps).toHaveLength(1)
      expect(err.fixSteps[0]).toContain('happycapy')
      expect(err.fixSteps[0]).toContain('openclaw')
      expect(err.fixSteps[0]).toContain('claude-code')
      expect(err.fixSteps[0]).toContain('codex')
    })

    it('无效 platform E002 的 retryable 为 false', async () => {
      const err = await detectPlatform('unknown-platform').catch((e) => e)
      expect(err.retryable).toBe(false)
    })

    // ── 自动检测路径：HappyCapy ───────────────────────────
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
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      await expect(detectPlatform()).rejects.toMatchObject({ bmadCode: 'E002' })
    })

    it('null 参数等同于自动检测（CAPY_USER_ID 存在时返回 happycapy）', async () => {
      vi.stubEnv('CAPY_USER_ID', 'any-value')
      const result = await detectPlatform(null)
      expect(result).toBe('happycapy')
    })

    // ── 自动检测路径：OpenClaw ────────────────────────────
    it('自动检测：OPENCLAW_SESSION_ID 非空时返回 openclaw（无 HappyCapy 特征）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-session-123')
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      const result = await detectPlatform()
      expect(result).toBe('openclaw')
    })

    it('自动检测：.openclaw/ 目录存在时返回 openclaw（无更高置信度信号）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('.openclaw')) return Promise.resolve(true)
        return Promise.resolve(false)
      })
      const result = await detectPlatform()
      expect(result).toBe('openclaw')
    })

    // ── 自动检测路径：Claude Code ─────────────────────────
    it('自动检测：CLAUDE_API_KEY 非空时返回 claude-code（无 HappyCapy / OpenClaw 特征）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-test-key')
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      const result = await detectPlatform()
      expect(result).toBe('claude-code')
    })

    it('自动检测：ANTHROPIC_API_KEY 非空时返回 claude-code', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      const result = await detectPlatform()
      expect(result).toBe('claude-code')
    })

    it('自动检测：.claude/ 目录存在时返回 claude-code（无更高置信度信号）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('.claude')) return Promise.resolve(true)
        return Promise.resolve(false)
      })
      const result = await detectPlatform()
      expect(result).toBe('claude-code')
    })

    // ── 自动检测路径：Codex ───────────────────────────────
    it('自动检测：CODEX_RUNTIME 非空时返回 codex（无其他平台特征）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('CODEX_RUNTIME', 'true')
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('command not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValue(false)
      const result = await detectPlatform()
      expect(result).toBe('codex')
    })

    // ── 冲突处理：高置信度优先 ─────────────────────────────
    it('冲突场景：HappyCapy(1.0) 与 Claude Code(1.0) 同时命中 → 返回注册顺序靠前的 happycapy', async () => {
      vi.stubEnv('CAPY_USER_ID', 'user-123')
      vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-key')
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      const result = await detectPlatform()
      expect(result).toBe('happycapy')
    })

    it('冲突场景：OpenClaw(0.9) 与 Claude Code(0.9) 同时命中 → 返回注册顺序靠前的 openclaw', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockImplementation((p) => {
        if (typeof p === 'string' && (p.endsWith('.openclaw') || p.endsWith('.claude'))) {
          return Promise.resolve(true)
        }
        return Promise.resolve(false)
      })
      const result = await detectPlatform()
      // openclaw 注册在 claude-code 之前，置信度相同时取靠前者
      expect(result).toBe('openclaw')
    })

    it('冲突场景：HappyCapy(1.0) 高于 .claude/(0.9) → 返回 happycapy', async () => {
      vi.stubEnv('CAPY_USER_ID', 'user-123')
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValue(new Error('not found'))
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('.claude')) return Promise.resolve(true)
        return Promise.resolve(false)
      })
      const result = await detectPlatform()
      expect(result).toBe('happycapy')
    })
  })

  describe('detectConfidence()', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.clearAllMocks()
    })

    it('CAPY_USER_ID 存在时，happycapy 置信度为 1.0', async () => {
      vi.stubEnv('CAPY_USER_ID', 'user-123')
      const conf = await detectConfidence('happycapy')
      expect(conf).toBe(1.0)
    })

    it('OPENCLAW_SESSION_ID 存在时，openclaw 置信度为 1.0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-123')
      const conf = await detectConfidence('openclaw')
      expect(conf).toBe(1.0)
    })

    it('CLAUDE_API_KEY 存在时，claude-code 置信度为 1.0', async () => {
      vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-key')
      const conf = await detectConfidence('claude-code')
      expect(conf).toBe(1.0)
    })

    it('CODEX_RUNTIME 存在时，codex 置信度为 1.0', async () => {
      vi.stubEnv('CODEX_RUNTIME', 'true')
      const conf = await detectConfidence('codex')
      expect(conf).toBe(1.0)
    })

    it('cursor（无探针）返回 0', async () => {
      const conf = await detectConfidence('cursor')
      expect(conf).toBe(0)
    })

    it('未注册平台返回 0', async () => {
      const conf = await detectConfidence('nonexistent')
      expect(conf).toBe(0)
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

    it('openclaw 返回含 detect + detectConfidence 的适配器', () => {
      const adapter = getAdapter('openclaw')
      expect(typeof adapter.detect).toBe('function')
      expect(typeof adapter.detectConfidence).toBe('function')
    })

    it('claude-code 返回含 detect + detectConfidence 的适配器', () => {
      const adapter = getAdapter('claude-code')
      expect(typeof adapter.detect).toBe('function')
      expect(typeof adapter.detectConfidence).toBe('function')
    })

    it('codex 返回含 detect + detectConfidence 的适配器', () => {
      const adapter = getAdapter('codex')
      expect(typeof adapter.detect).toBe('function')
      expect(typeof adapter.detectConfidence).toBe('function')
    })

    it('不支持的平台 throw BmadError(E002)', () => {
      expect(() => getAdapter('unknown')).toThrow(BmadError)
      expect(() => getAdapter('unknown')).toThrow(
        expect.objectContaining({ bmadCode: 'E002' })
      )
    })

    it('cursor（无探针）throw BmadError(E002)', () => {
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

    it('execa 调用参数包含 happycapy-cli --version 和 timeout 1000ms（NFR15）', async () => {
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValueOnce({ exitCode: 0 })
      await detect()
      expect(execa).toHaveBeenCalledWith('happycapy-cli', ['--version'], {
        timeout: 1000,
      })
    })
  })

  // detectConfidence()
  describe('detectConfidence()', () => {
    it('CAPY_USER_ID 存在时返回 1.0', async () => {
      const { detectConfidence: dc } = await import('../lib/adapters/happycapy.js')
      vi.stubEnv('CAPY_USER_ID', 'user-123')
      const conf = await dc()
      expect(conf).toBe(1.0)
    })

    it('CAPY_USER_ID 未设置，execa 成功时返回 0.9', async () => {
      const { detectConfidence: dc } = await import('../lib/adapters/happycapy.js')
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockResolvedValueOnce({ exitCode: 0 })
      const conf = await dc()
      expect(conf).toBe(0.9)
    })

    it('CAPY_USER_ID 未设置，execa 失败时返回 0', async () => {
      const { detectConfidence: dc } = await import('../lib/adapters/happycapy.js')
      vi.stubEnv('CAPY_USER_ID', undefined)
      const { execa } = await import('execa')
      execa.mockRejectedValueOnce(new Error('not found'))
      const conf = await dc()
      expect(conf).toBe(0)
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

// ─────────────────────────────────────────────
// lib/adapters/claude-code.js（探针层）
// ─────────────────────────────────────────────
describe('lib/adapters/claude-code.js（探针）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('detectConfidence()', () => {
    it('CLAUDE_API_KEY 存在时返回 1.0', async () => {
      vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-key')
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      const { detectConfidence: dc } = await import('../lib/adapters/claude-code.js')
      const conf = await dc()
      expect(conf).toBe(1.0)
    })

    it('ANTHROPIC_API_KEY 存在时返回 1.0', async () => {
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-key')
      const { detectConfidence: dc } = await import('../lib/adapters/claude-code.js')
      const conf = await dc()
      expect(conf).toBe(1.0)
    })

    it('.claude/ 目录存在时返回 0.9', async () => {
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(true)
      const { detectConfidence: dc } = await import('../lib/adapters/claude-code.js')
      const conf = await dc()
      expect(conf).toBe(0.9)
    })

    it('无任何信号时返回 0', async () => {
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(false)
      const { detectConfidence: dc } = await import('../lib/adapters/claude-code.js')
      const conf = await dc()
      expect(conf).toBe(0)
    })
  })

  describe('detect()', () => {
    it('CLAUDE_API_KEY 存在时返回 true', async () => {
      vi.stubEnv('CLAUDE_API_KEY', 'sk-ant-key')
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      const { detect: d } = await import('../lib/adapters/claude-code.js')
      const result = await d()
      expect(result).toBe(true)
    })

    it('无信号时返回 false', async () => {
      vi.stubEnv('CLAUDE_API_KEY', undefined)
      vi.stubEnv('ANTHROPIC_API_KEY', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(false)
      const { detect: d } = await import('../lib/adapters/claude-code.js')
      const result = await d()
      expect(result).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────
// lib/adapters/openclaw.js（探针层）
// ─────────────────────────────────────────────
describe('lib/adapters/openclaw.js（探针）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('detectConfidence()', () => {
    it('OPENCLAW_SESSION_ID 存在时返回 1.0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-123')
      const { detectConfidence: dc } = await import('../lib/adapters/openclaw.js')
      const conf = await dc()
      expect(conf).toBe(1.0)
    })

    it('.openclaw/ 目录存在时返回 0.9', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(true)
      const { detectConfidence: dc } = await import('../lib/adapters/openclaw.js')
      const conf = await dc()
      expect(conf).toBe(0.9)
    })

    it('无任何信号时返回 0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(false)
      const { detectConfidence: dc } = await import('../lib/adapters/openclaw.js')
      const conf = await dc()
      expect(conf).toBe(0)
    })
  })

  describe('detect()', () => {
    it('OPENCLAW_SESSION_ID 存在时返回 true', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-123')
      const { detect: d } = await import('../lib/adapters/openclaw.js')
      const result = await d()
      expect(result).toBe(true)
    })

    it('无信号时返回 false', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', undefined)
      const fs = (await import('fs-extra')).default
      fs.pathExists.mockResolvedValueOnce(false)
      const { detect: d } = await import('../lib/adapters/openclaw.js')
      const result = await d()
      expect(result).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────
// lib/adapters/codex.js（探针层）
// ─────────────────────────────────────────────
describe('lib/adapters/codex.js（探针）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('detectConfidence()', () => {
    it('CODEX_RUNTIME 存在时返回 1.0', async () => {
      vi.stubEnv('CODEX_RUNTIME', 'true')
      const { detectConfidence: dc } = await import('../lib/adapters/codex.js')
      const conf = await dc()
      expect(conf).toBe(1.0)
    })

    it('无任何信号时返回 0', async () => {
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { detectConfidence: dc } = await import('../lib/adapters/codex.js')
      const conf = await dc()
      expect(conf).toBe(0)
    })
  })

  describe('detect()', () => {
    it('CODEX_RUNTIME 存在时返回 true', async () => {
      vi.stubEnv('CODEX_RUNTIME', 'true')
      const { detect: d } = await import('../lib/adapters/codex.js')
      const result = await d()
      expect(result).toBe(true)
    })

    it('无信号时返回 false', async () => {
      vi.stubEnv('CODEX_RUNTIME', undefined)
      const { detect: d } = await import('../lib/adapters/codex.js')
      const result = await d()
      expect(result).toBe(false)
    })
  })
})
