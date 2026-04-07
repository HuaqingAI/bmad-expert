import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { install } from '../../lib/installer.js'

// ── 模块 Mock ──────────────────────────────────────────────────────────────

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
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
    // OpenClaw 平台特征变量（detect() 用 env var 通过，无需 fs 检查）
    // 清除 HappyCapy 环境变量，确保 openclaw 被优先检测
    vi.stubEnv('CAPY_USER_ID', '')
    vi.stubEnv('OPENCLAW_SESSION_ID', 'oc-test-123')

    // 默认：目标路径不存在（not_installed）
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)

    // 默认：openclaw add 成功
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常安装：executeInstall 和 writeSupplementFiles 被调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { executeInstall, writeSupplementFiles } = await import('../../lib/orchestrator.js')
    expect(executeInstall).toHaveBeenCalledTimes(1)
    expect(writeSupplementFiles).toHaveBeenCalledTimes(1)
  })

  it('正常安装：openclaw add 被调用（平台注册）', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { execa } = await import('execa')
    const addCall = execa.mock.calls.find(
      (args) => args[0] === 'openclaw' && args[1]?.[0] === 'add'
    )
    expect(addCall).toBeDefined()
    expect(addCall[1]).toContain('bmad-expert')
  })

  it('正常安装：buildParams 以 platformName=openclaw 调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { buildParams } = await import('../../lib/param-builder.js')
    expect(buildParams).toHaveBeenCalledTimes(1)
    const [platformArg, contextArg] = buildParams.mock.calls[0]
    expect(platformArg).toBe('openclaw')
    expect(contextArg).toHaveProperty('projectRoot')
    expect(contextArg).toHaveProperty('userOverrides')
  })

  it('正常安装：writeSupplementFiles 以含 agentId 的 targetDir 调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { writeSupplementFiles } = await import('../../lib/orchestrator.js')
    const [targetDirArg] = writeSupplementFiles.mock.calls[0]
    expect(typeof targetDirArg).toBe('string')
    expect(targetDirArg).toContain('bmad-expert')
  })

  it('正常安装：install() 返回结构化数据（platform / agentId / installPath / duration）', async () => {
    const result = await install({ platform: null, agentId: 'bmad-expert', yes: false })

    expect(result).toHaveProperty('platform', 'openclaw')
    expect(result).toHaveProperty('agentId', 'bmad-expert')
    expect(result).toHaveProperty('installPath')
    expect(result).toHaveProperty('duration')
    expect(typeof result.duration).toBe('number')
  })

  it('幂等检测：已安装时 throw BmadError(E006)', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 目标路径存在（pathExists 全 true → check() 返回 'installed'）
    fsExtra.pathExists.mockResolvedValue(true)

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })
  })

  it('错误场景：EACCES 权限拒绝时抛出 BmadError(E004)', async () => {
    const { writeSupplementFiles } = await import('../../lib/orchestrator.js')
    const permissionError = Object.assign(
      new Error('EACCES: permission denied, mkdir'),
      { code: 'EACCES' }
    )
    // orchestrator.writeSupplementFiles 内部已将 EACCES 包装为 BmadError(E004)
    const { BmadError } = await import('../../lib/errors.js')
    writeSupplementFiles.mockRejectedValueOnce(
      new BmadError('E004', '补充文件写入失败', permissionError)
    )

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })

  it('降级安装：openclaw add 失败时不 throw，install() 正常完成', async () => {
    const { execa } = await import('execa')
    execa.mockImplementation((_cmd, args) => {
      if (args?.[0] === 'add') {
        const err = new Error('Command not found: openclaw')
        err.code = 'ENOENT'
        return Promise.reject(err)
      }
      return Promise.resolve({ exitCode: 0 })
    })

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).resolves.toBeDefined()
  })
})
