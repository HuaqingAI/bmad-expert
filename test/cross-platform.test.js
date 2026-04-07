import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 模块 Mock ──────────────────────────────────────────────────────────────

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(false),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('content'),
    outputFile: vi.fn().mockResolvedValue(undefined),
    readJson: vi.fn().mockResolvedValue({}),
    outputJson: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('execa', () => ({
  execa: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' })),
}))

vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

vi.mock('../lib/orchestrator.js', () => ({
  executeInstall: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  writeSupplementFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/param-builder.js', () => ({
  buildParams: vi.fn().mockReturnValue({
    toArgs: vi.fn().mockReturnValue(['--modules', 'bmm', '--yes']),
  }),
}))

// ── 测试套件 ───────────────────────────────────────────────────────────────

describe('跨平台一致性验证（AC2 / AC3 / AC4）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  // ── AC2：输出格式一致性 ────────────────────────────────────────────────────
  describe('AC2 — 进度输出格式与结构化数据一致性', () => {
    it('两平台安装成功均返回 { platform, agentId, installPath, duration } 结构', async () => {
      const { install } = await import('../lib/installer.js')
      const fsExtra = (await import('fs-extra')).default

      // HappyCapy 安装
      vi.stubEnv('CAPY_USER_ID', 'test-user-123')
      fsExtra.pathExists.mockResolvedValue(false)
      const happycapyResult = await install({ platform: null, agentId: 'bmad-expert', yes: false })

      vi.unstubAllEnvs()
      vi.clearAllMocks()
      fsExtra.pathExists.mockResolvedValue(false)

      // OpenClaw 安装：清除 HappyCapy env var 避免竞争
      vi.stubEnv('CAPY_USER_ID', '')
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-test-123')
      const openclawResult = await install({ platform: null, agentId: 'bmad-expert', yes: false })

      // 两平台返回结构必须相同（AC2 / NFR7）
      const expectedKeys = ['platform', 'agentId', 'installPath', 'duration']
      for (const key of expectedKeys) {
        expect(happycapyResult).toHaveProperty(key)
        expect(openclawResult).toHaveProperty(key)
      }
      expect(happycapyResult.platform).toBe('happycapy')
      expect(openclawResult.platform).toBe('openclaw')
      expect(happycapyResult.agentId).toBe(openclawResult.agentId)
      expect(typeof happycapyResult.duration).toBe('number')
      expect(typeof openclawResult.duration).toBe('number')
    })

    it('两平台幂等安装均抛出 BmadError(E006)（exit code 语义一致）', async () => {
      const { install } = await import('../lib/installer.js')
      const fsExtra = (await import('fs-extra')).default

      // HappyCapy 已安装
      vi.stubEnv('CAPY_USER_ID', 'test-user-123')
      fsExtra.pathExists.mockResolvedValue(true)
      await expect(
        install({ platform: null, agentId: 'bmad-expert', yes: false })
      ).rejects.toMatchObject({ bmadCode: 'E006' })

      vi.unstubAllEnvs()
      vi.clearAllMocks()
      fsExtra.pathExists.mockResolvedValue(true)

      // OpenClaw 已安装：清除 HappyCapy env var 避免竞争
      vi.stubEnv('CAPY_USER_ID', '')
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-test-123')
      await expect(
        install({ platform: null, agentId: 'bmad-expert', yes: false })
      ).rejects.toMatchObject({ bmadCode: 'E006' })
    })
  })

  // ── AC3：平台自动检测耗时 ≤ 1 秒（NFR15）──────────────────────────────────
  describe('AC3 — 平台探针链耗时 ≤ 1000ms（NFR15）', () => {
    beforeEach(async () => {
      vi.unstubAllEnvs()
      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)
      const { execa } = await import('execa')
      execa.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }))
    })

    it('HappyCapy 探针链（无 env var）耗时 ≤ 1000ms', async () => {
      const { detectConfidence } = await import('../lib/adapters/happycapy.js')
      const start = Date.now()
      await detectConfidence()
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(1000)
    })

    it('OpenClaw 探针链（无 env var）耗时 ≤ 1000ms', async () => {
      const { detectConfidence } = await import('../lib/adapters/openclaw.js')
      const start = Date.now()
      await detectConfidence()
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(1000)
    })

    it('HappyCapy 探针链（有 CAPY_USER_ID）立即返回 1.0', async () => {
      vi.stubEnv('CAPY_USER_ID', 'test-user-123')
      const { detectConfidence } = await import('../lib/adapters/happycapy.js')
      const start = Date.now()
      const confidence = await detectConfidence()
      const elapsed = Date.now() - start
      expect(confidence).toBe(1.0)
      expect(elapsed).toBeLessThan(50)
    })

    it('OpenClaw 探针链（有 OPENCLAW_SESSION_ID）立即返回 1.0', async () => {
      vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-test-123')
      const { detectConfidence } = await import('../lib/adapters/openclaw.js')
      const start = Date.now()
      const confidence = await detectConfidence()
      const elapsed = Date.now() - start
      expect(confidence).toBe(1.0)
      expect(elapsed).toBeLessThan(50)
    })
  })

  // ── AC4：Node.js 版本兼容性（NFR4）────────────────────────────────────────
  describe('AC4 — Node.js 版本兼容性（NFR4）', () => {
    it('当前 Node.js 版本满足 ≥ 20.19.0', () => {
      // process.version 格式：'v20.19.0'
      const versionStr = process.version.replace(/^v/, '')
      const [major, minor, patch] = versionStr.split('.').map(Number)

      const meetsRequirement =
        major > 20 ||
        (major === 20 && minor > 19) ||
        (major === 20 && minor === 19 && patch >= 0)

      expect(meetsRequirement).toBe(true)
    })

    it('package.json engines.node 字段声明 >=20.19.0', async () => {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const pkg = require('../package.json')
      expect(pkg.engines?.node).toBeDefined()
      expect(pkg.engines.node).toMatch(/>=?20/)
    })
  })

  // ── AC1：每平台三类场景覆盖（NFR8）────────────────────────────────────────
  describe('AC1 — 每平台三类集成测试场景存在（NFR8）', () => {
    it('HappyCapy 集成测试文件存在', async () => {
      const { default: fs } = await import('fs-extra')
      // 实际检查不需要 mock 文件系统，这里用模块加载来验证
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      // 能 resolve 说明文件存在
      expect(() => require.resolve('./integration/happycapy.test.js')).not.toThrow()
    })

    it('OpenClaw 集成测试文件存在', async () => {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      expect(() => require.resolve('./integration/openclaw.test.js')).not.toThrow()
    })
  })
})
