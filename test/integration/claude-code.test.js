// test/integration/claude-code.test.js
// Claude Code 适配器集成测试 — Story 8.3
//
// 测试策略：直接调用适配器方法（无需经过 installer.js），
// 因为 Claude Code 无外部 CLI 依赖，适配器本身即最小测试单元。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

// ── 模块 Mock ──────────────────────────────────────────────────────────────

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
    appendFile: vi.fn().mockResolvedValue(undefined),
  },
}))

// ── 测试套件 ───────────────────────────────────────────────────────────────

describe('Claude Code 适配器集成测试', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // 设置 ANTHROPIC_API_KEY 触发 detectConfidence() → 1.0
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-claude')

    // 重置所有 fs-extra mock 实现（clearAllMocks 只清历史，不清实现）
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)
    fsExtra.readFile.mockResolvedValue('')
    fsExtra.appendFile.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── detect / detectConfidence ──────────────────────────────────────────

  describe('detect() / detectConfidence()（Story 8.1 验证）', () => {
    it('ANTHROPIC_API_KEY 存在时 detectConfidence() 返回 1.0', async () => {
      const { detectConfidence } = await import('../../lib/adapters/claude-code.js')
      expect(await detectConfidence()).toBe(1.0)
    })

    it('detect() 返回 true（ANTHROPIC_API_KEY 存在）', async () => {
      const { detect } = await import('../../lib/adapters/claude-code.js')
      expect(await detect()).toBe(true)
    })

    it('.claude/ 目录存在时 detectConfidence() 返回 0.9', async () => {
      vi.unstubAllEnvs() // 清除 ANTHROPIC_API_KEY
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true)

      const { detectConfidence } = await import('../../lib/adapters/claude-code.js')
      expect(await detectConfidence()).toBe(0.9)
    })

    it('无信号时 detectConfidence() 返回 0', async () => {
      vi.unstubAllEnvs()
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)

      const { detectConfidence } = await import('../../lib/adapters/claude-code.js')
      expect(await detectConfidence()).toBe(0)
    })

    it('CLAUDE_API_KEY 作为唯一信号时 detectConfidence() 返回 1.0（P3）', async () => {
      vi.unstubAllEnvs() // 清除 ANTHROPIC_API_KEY
      vi.stubEnv('CLAUDE_API_KEY', 'test-claude-key')

      const { detectConfidence } = await import('../../lib/adapters/claude-code.js')
      expect(await detectConfidence()).toBe(1.0)
    })
  })

  // ── getInstallPath ──────────────────────────────────────────────────────

  describe('getInstallPath(agentId)', () => {
    it('返回 [cwd]/.claude 绝对路径（AC: #2）', async () => {
      const { getInstallPath } = await import('../../lib/adapters/claude-code.js')
      const result = getInstallPath('bmad-expert')
      const expected = path.resolve(process.cwd(), '.claude')
      expect(result).toBe(expected)
      expect(path.isAbsolute(result)).toBe(true)
    })

    it('不同 agentId 均返回同一路径（无 per-agent 子目录）', async () => {
      const { getInstallPath } = await import('../../lib/adapters/claude-code.js')
      expect(getInstallPath('bmad-expert')).toBe(getInstallPath('other-agent'))
    })

    it('空 agentId 时 throw BmadError(E004)', async () => {
      const { getInstallPath } = await import('../../lib/adapters/claude-code.js')
      const { BmadError } = await import('../../lib/errors.js')
      expect(() => getInstallPath('')).toThrow(BmadError)
      expect(() => getInstallPath('')).toThrow(expect.objectContaining({ bmadCode: 'E004' }))
    })

    it('null agentId 时 throw BmadError(E004)', async () => {
      const { getInstallPath } = await import('../../lib/adapters/claude-code.js')
      expect(() => getInstallPath(null)).toThrow(expect.objectContaining({ bmadCode: 'E004' }))
    })

    it('返回路径在 cwd 白名单范围内（NFR12）', async () => {
      const { getInstallPath } = await import('../../lib/adapters/claude-code.js')
      const result = getInstallPath('bmad-expert')
      expect(result.startsWith(process.cwd())).toBe(true)
    })
  })

  // ── check 边界（P4）──────────────────────────────────────────────────────

  describe('check() 边界场景', () => {
    it('check(null) 向上传播 BmadError(E004)（P4）', async () => {
      const { check } = await import('../../lib/adapters/claude-code.js')
      await expect(check(null)).rejects.toMatchObject({ bmadCode: 'E004' })
    })

    it('check() 中 fs.pathExists 抛出时封装为 BmadError(E001)（P1）', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockRejectedValue(new Error('EACCES: permission denied'))

      const { check } = await import('../../lib/adapters/claude-code.js')
      await expect(check('bmad-expert')).rejects.toMatchObject({ bmadCode: 'E001' })
    })
  })

  // ── check ───────────────────────────────────────────────────────────────

  describe('check(agentId)', () => {
    it('.claude/ 不存在时返回 not_installed', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)

      const { check } = await import('../../lib/adapters/claude-code.js')
      expect(await check('bmad-expert')).toBe('not_installed')
    })

    it('.claude/ 存在但 AGENTS.md 不存在时返回 corrupted', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists
        .mockResolvedValueOnce(true)  // .claude/ 存在
        .mockResolvedValueOnce(false) // AGENTS.md 不存在

      const { check } = await import('../../lib/adapters/claude-code.js')
      expect(await check('bmad-expert')).toBe('corrupted')
    })

    it('.claude/ 和 AGENTS.md 均存在时返回 installed', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true)

      const { check } = await import('../../lib/adapters/claude-code.js')
      expect(await check('bmad-expert')).toBe('installed')
    })
  })

  // ── install（CLAUDE.md 注册）────────────────────────────────────────────

  describe('install() — CLAUDE.md 注册契约（AC: #4）', () => {
    it('CLAUDE.md 不存在时：appendFile 被调用，追加 BMAD 内容', async () => {
      const fsExtra = (await import('fs-extra')).default
      // pathExists：.claude/ 不存在（用于 check），CLAUDE.md 也不存在
      fsExtra.pathExists.mockResolvedValue(false)

      const { install } = await import('../../lib/adapters/claude-code.js')
      await install(null, { agentId: 'bmad-expert' })

      expect(fsExtra.appendFile).toHaveBeenCalledOnce()
      const [filePath, content] = fsExtra.appendFile.mock.calls[0]
      expect(filePath).toBe(path.join(process.cwd(), 'CLAUDE.md'))
      expect(content).toContain('BMAD Expert Agent')
      expect(content).toContain('.claude/AGENTS.md')
    })

    it('CLAUDE.md 已存在但无 marker 时：追加 BMAD 段落', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true) // CLAUDE.md 存在
      fsExtra.readFile.mockResolvedValue('# 既有项目说明\n一些已有内容\n')

      const { install } = await import('../../lib/adapters/claude-code.js')
      await install(null, { agentId: 'bmad-expert' })

      expect(fsExtra.appendFile).toHaveBeenCalledOnce()
      const content = fsExtra.appendFile.mock.calls[0][1]
      expect(content).toContain('BMAD Expert Agent')
    })

    it('CLAUDE.md 已含 marker 时：幂等跳过，appendFile 不被调用', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true)
      fsExtra.readFile.mockResolvedValue(
        '# 已有内容\n\n# BMAD Expert Agent\nAgent files installed in `.claude/`.\n'
      )

      const { install } = await import('../../lib/adapters/claude-code.js')
      await install(null, { agentId: 'bmad-expert' })

      expect(fsExtra.appendFile).not.toHaveBeenCalled()
    })

    it('appendFile 权限错误时 throw BmadError(E004)', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      const permErr = new Error('Permission denied')
      permErr.code = 'EACCES'
      fsExtra.appendFile.mockRejectedValue(permErr)

      const { install } = await import('../../lib/adapters/claude-code.js')
      await expect(install(null, {})).rejects.toMatchObject({ bmadCode: 'E004' })
    })

    it('appendFile 其他 I/O 错误时 throw BmadError(E001)', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      fsExtra.appendFile.mockRejectedValue(new Error('ENOENT: disk full'))

      const { install } = await import('../../lib/adapters/claude-code.js')
      await expect(install(null, {})).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('readFile 错误（非权限）时 throw BmadError(E001)', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true) // CLAUDE.md "存在"
      fsExtra.readFile.mockRejectedValue(new Error('EIO: io error'))

      const { install } = await import('../../lib/adapters/claude-code.js')
      await expect(install(null, {})).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('readFile EACCES 时 throw BmadError(E004)，含修复提示（P2）', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true) // CLAUDE.md "存在"
      const readPermErr = new Error('EACCES: permission denied')
      readPermErr.code = 'EACCES'
      fsExtra.readFile.mockRejectedValue(readPermErr)

      const { install } = await import('../../lib/adapters/claude-code.js')
      await expect(install(null, {})).rejects.toMatchObject({ bmadCode: 'E004' })
    })
  })

  // ── getToolsParam ────────────────────────────────────────────────────────

  describe('getToolsParam()（FR42）', () => {
    it('返回 "claude-code"', async () => {
      const { getToolsParam } = await import('../../lib/adapters/claude-code.js')
      expect(getToolsParam()).toBe('claude-code')
    })
  })

  // ── 完整安装流程（适配器层）────────────────────────────────────────────────

  describe('完整安装流程（check → install 序列）', () => {
    it('未安装时：check 返回 not_installed，install 追加 CLAUDE.md（NFR5）', async () => {
      const fsExtra = (await import('fs-extra')).default
      // check() 第一次 pathExists 调用：.claude/ 不存在
      fsExtra.pathExists.mockResolvedValueOnce(false)
      // install() 中 pathExists：CLAUDE.md 不存在
      fsExtra.pathExists.mockResolvedValueOnce(false)

      const { check, install } = await import('../../lib/adapters/claude-code.js')

      const status = await check('bmad-expert')
      expect(status).toBe('not_installed')

      await install(null, { agentId: 'bmad-expert' })
      expect(fsExtra.appendFile).toHaveBeenCalledOnce()
    })

    it('已安装时：check 返回 installed（幂等保护入口）', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true) // .claude/ 和 AGENTS.md 均存在

      const { check } = await import('../../lib/adapters/claude-code.js')
      const status = await check('bmad-expert')
      expect(status).toBe('installed')
      // installer.js 的 checkInstallStatus 会在此处 throw E006，不再调用 install()
    })
  })

  // ── param-builder 工具参数验证（AC: #3）─────────────────────────────────

  describe('param-builder 工具参数验证（AC: #3）', () => {
    it('buildParams("claude-code") 结果中 tools = "claude-code"（FR42）', async () => {
      const { buildParams } = await import('../../lib/param-builder.js')
      const params = buildParams('claude-code', { projectRoot: null })
      expect(params.tools).toBe('claude-code')
    })

    it('buildParams("claude-code").toArgs() 包含 --tools claude-code', async () => {
      const { buildParams } = await import('../../lib/param-builder.js')
      const params = buildParams('claude-code', { projectRoot: null })
      const args = params.toArgs()
      const toolsIdx = args.indexOf('--tools')
      expect(toolsIdx).toBeGreaterThanOrEqual(0)
      expect(args[toolsIdx + 1]).toBe('claude-code')
    })
  })
})
