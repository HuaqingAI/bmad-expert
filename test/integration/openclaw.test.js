import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import { install } from '../../lib/installer.js'
import * as openclawAdapter from '../../lib/adapters/openclaw.js'

// ── 模块 Mock ──────────────────────────────────────────────────────────────
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
    readJson: vi.fn().mockResolvedValue({}),
    outputJson: vi.fn().mockResolvedValue(undefined),
  },
}))

// output.js mock：静默进度输出，避免 stdout 污染
vi.mock('../../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

// Phase 2：mock orchestrator（不真实执行 npx bmad-method install）
vi.mock('../../lib/orchestrator.js', () => ({
  executeInstall: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  writeSupplementFiles: vi.fn().mockResolvedValue(undefined),
}))

// Phase 2：mock param-builder（返回含 toArgs() 的 mock 对象）
vi.mock('../../lib/param-builder.js', () => ({
  buildParams: vi.fn().mockReturnValue({
    toArgs: vi.fn().mockReturnValue(['--modules', 'bmm', '--yes']),
  }),
}))

// ── 测试套件 ───────────────────────────────────────────────────────────────
describe('OpenClaw 完整安装流程（集成测试）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // 清除可能干扰平台检测的环境变量（防止 HappyCapy / Claude Code 抢占检测结果）
    vi.stubEnv('CAPY_USER_ID', '')
    vi.stubEnv('CLAUDE_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    // OpenClaw 平台特征变量（detectConfidence → 1.0）
    vi.stubEnv('OPENCLAW_SESSION_ID', 'test-session-xyz')

    // 默认：目标路径不存在（not_installed），registry 不存在
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)
    fsExtra.readJson.mockResolvedValue({})
    fsExtra.outputJson.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 正常安装 ──────────────────────────────────────────────────────────────
  it('正常安装：executeInstall、writeSupplementFiles 和 registry 写入被调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    // Phase 2 编排路径验证
    const { executeInstall, writeSupplementFiles } = await import('../../lib/orchestrator.js')
    expect(executeInstall).toHaveBeenCalledTimes(1)
    expect(writeSupplementFiles).toHaveBeenCalledTimes(1)

    // OpenClaw 平台注册：registry 被写入（outputJson）
    const fsExtra = (await import('fs-extra')).default
    expect(fsExtra.outputJson).toHaveBeenCalledTimes(1)
    const registryCall = fsExtra.outputJson.mock.calls[0]
    expect(registryCall[0]).toContain('agents-registry.json')
    expect(registryCall[1]).toMatchObject({ 'bmad-expert': expect.objectContaining({ installedAt: expect.any(String) }) })
  })

  it('正常安装：install() 完成后 printSuccess 含引导信息（FR20-22）', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { printSuccess } = await import('../../lib/output.js')
    expect(printSuccess).toHaveBeenCalled()
    const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
    expect(msg).toContain('bmad-expert 已就绪')
    expect(msg).toContain('安装完成（用时')
  })

  it('正常安装：buildParams 以 platformName=openclaw 调用（AC2 跨平台验证）', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { buildParams } = await import('../../lib/param-builder.js')
    expect(buildParams).toHaveBeenCalledTimes(1)
    const [platformArg, contextArg] = buildParams.mock.calls[0]
    expect(platformArg).toBe('openclaw')
    expect(contextArg).toHaveProperty('projectRoot')
    expect(contextArg).toHaveProperty('userOverrides')
  })

  it('正常安装：install() 返回结构化数据（platform / agentId / installPath / duration）', async () => {
    const result = await install({ platform: null, agentId: 'bmad-expert', yes: false })

    expect(result).toHaveProperty('platform', 'openclaw')
    expect(result).toHaveProperty('agentId', 'bmad-expert')
    expect(result).toHaveProperty('installPath')
    expect(result).toHaveProperty('duration')
    expect(typeof result.duration).toBe('number')
  })

  it('错误场景：writeSupplementFiles EACCES 时抛出 BmadError(E004)', async () => {
    const { writeSupplementFiles } = await import('../../lib/orchestrator.js')
    const { BmadError } = await import('../../lib/errors.js')
    const permissionError = Object.assign(
      new Error('EACCES: permission denied, mkdir'),
      { code: 'EACCES' }
    )
    writeSupplementFiles.mockRejectedValueOnce(
      new BmadError('E004', '补充文件写入失败', permissionError)
    )

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })

  // ── 幂等安装 ──────────────────────────────────────────────────────────────
  it('幂等安装：已安装时 throw BmadError(E006)，不写入任何文件', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 模拟已安装：安装路径存在，AGENTS.md 也存在
    fsExtra.pathExists.mockResolvedValue(true)

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })

    // Phase 2：幂等时 executeInstall / writeSupplementFiles / registry 写入均不执行
    const { executeInstall, writeSupplementFiles } = await import('../../lib/orchestrator.js')
    expect(executeInstall).not.toHaveBeenCalled()
    expect(writeSupplementFiles).not.toHaveBeenCalled()
    expect(fsExtra.outputJson).not.toHaveBeenCalled()
  })

  // ── 降级安装 ──────────────────────────────────────────────────────────────
  it('降级安装：registry 写入失败时不 throw，install() 正常完成并输出手动步骤', async () => {
    const fsExtra = (await import('fs-extra')).default
    // outputJson 失败（模拟权限拒绝等场景）
    fsExtra.outputJson.mockRejectedValue(new Error('EACCES: permission denied'))

    // 安装流程不应 throw
    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).resolves.toBeDefined()

    // printSuccess 被调用（降级路径：输出手动注册步骤）
    const { printSuccess } = await import('../../lib/output.js')
    // 至少一次 printSuccess 包含手动注册提示
    const manualHintCall = printSuccess.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('agents-registry.json')
    )
    expect(manualHintCall).toBeDefined()
  })
})

// ── 适配器单元测试 ─────────────────────────────────────────────────────────
describe('lib/adapters/openclaw.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('detectConfidence()', () => {
    it('OPENCLAW_SESSION_ID 非空时返回 1.0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'sess-abc')
      const conf = await openclawAdapter.detectConfidence()
      expect(conf).toBe(1.0)
    })

    it('OPENCLAW_SESSION_ID 不存在且 .openclaw/ 目录存在时返回 0.9', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', '')
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockImplementation(async (p) => {
        if (typeof p === 'string' && p.endsWith('.openclaw')) return true
        return false
      })
      const conf = await openclawAdapter.detectConfidence()
      expect(conf).toBe(0.9)
    })

    it('无信号时返回 0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', '')
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      const conf = await openclawAdapter.detectConfidence()
      expect(conf).toBe(0)
    })
  })

  describe('detect()', () => {
    it('有平台特征信号时返回 true', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'sess-xyz')
      expect(await openclawAdapter.detect()).toBe(true)
    })

    it('无平台特征信号时返回 false', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', '')
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      expect(await openclawAdapter.detect()).toBe(false)
    })
  })

  describe('getInstallPath()', () => {
    it('返回以 .openclaw/agents/bmad-expert 结尾的绝对路径', () => {
      const p = openclawAdapter.getInstallPath('bmad-expert')
      expect(p).toContain('.openclaw')
      expect(p).toContain('agents')
      expect(p).toContain('bmad-expert')
      expect(path.isAbsolute(p)).toBe(true)
    })

    it('路径不含 .. 路径遍历', () => {
      const p = openclawAdapter.getInstallPath('bmad-expert')
      expect(p).not.toContain('..')
    })

    it('非法 agentId（空字符串）throw BmadError E004', () => {
      expect(() => openclawAdapter.getInstallPath('')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('非法 agentId（含 /）throw BmadError E004', () => {
      expect(() => openclawAdapter.getInstallPath('a/b')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })

    it('非法 agentId（..）throw BmadError E004', () => {
      expect(() => openclawAdapter.getInstallPath('..')).toThrow(
        expect.objectContaining({ bmadCode: 'E004' })
      )
    })
  })

  describe('check()', () => {
    it('路径不存在时返回 not_installed', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      const result = await openclawAdapter.check('bmad-expert')
      expect(result).toBe('not_installed')
    })

    it('路径存在但无 AGENTS.md 时返回 corrupted', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockImplementation(async (p) => {
        if (typeof p === 'string' && p.endsWith('AGENTS.md')) return false
        return true
      })
      const result = await openclawAdapter.check('bmad-expert')
      expect(result).toBe('corrupted')
    })

    it('路径存在且 AGENTS.md 存在时返回 installed', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true)
      const result = await openclawAdapter.check('bmad-expert')
      expect(result).toBe('installed')
    })
  })

  describe('install()', () => {
    it('正常注册：写入 agents-registry.json 含 agentId', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false) // registry 不存在
      fsExtra.outputJson.mockResolvedValue(undefined)

      await openclawAdapter.install(null, { agentId: 'bmad-expert' })

      expect(fsExtra.outputJson).toHaveBeenCalledTimes(1)
      const [, data] = fsExtra.outputJson.mock.calls[0]
      expect(data).toMatchObject({
        'bmad-expert': expect.objectContaining({ installedAt: expect.any(String) }),
      })
    })

    it('registry 已存在时合并写入（不覆盖其他 agent）', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(true) // registry 存在
      fsExtra.readJson.mockResolvedValue({ 'other-agent': { installedAt: '2026-01-01T00:00:00.000Z' } })
      fsExtra.outputJson.mockResolvedValue(undefined)

      await openclawAdapter.install(null, { agentId: 'bmad-expert' })

      const [, data] = fsExtra.outputJson.mock.calls[0]
      // 原有 other-agent 保留
      expect(data['other-agent']).toBeDefined()
      // 新 bmad-expert 写入
      expect(data['bmad-expert']).toBeDefined()
    })

    it('outputJson 失败时不 throw，降级输出手动提示', async () => {
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      fsExtra.outputJson.mockRejectedValue(new Error('EACCES'))

      const { printSuccess } = await import('../../lib/output.js')

      // 不 throw
      await expect(openclawAdapter.install(null, { agentId: 'bmad-expert' })).resolves.toBeUndefined()

      // 降级输出
      expect(printSuccess).toHaveBeenCalled()
      const msg = printSuccess.mock.calls[0][0]
      expect(msg).toContain('agents-registry.json')
    })
  })

  describe('getToolsParam()', () => {
    it('返回 null（OpenClaw 不需要传 --tools）', () => {
      expect(openclawAdapter.getToolsParam()).toBeNull()
    })
  })
})
