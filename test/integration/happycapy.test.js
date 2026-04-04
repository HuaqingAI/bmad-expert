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
describe('HappyCapy 完整安装流程（集成测试 Phase 2）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // HappyCapy 平台特征变量（detect() 用 env var 通过，无需 execa --version）
    vi.stubEnv('CAPY_USER_ID', 'test-user-123')

    // 默认：目标路径不存在（not_installed）
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)

    // 默认：happycapy-cli add 成功
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

  it('正常安装：happycapy-cli add 被调用（平台注册）', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { execa } = await import('execa')
    const addCall = execa.mock.calls.find(
      (args) => args[0] === 'happycapy-cli' && args[1]?.[0] === 'add'
    )
    expect(addCall).toBeDefined()
    expect(addCall[1]).toContain('bmad-expert')
  })

  it('正常安装：buildParams 以 platformName 和含 userOverrides 的 context 调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { buildParams } = await import('../../lib/param-builder.js')
    expect(buildParams).toHaveBeenCalledTimes(1)
    const [platformArg, contextArg] = buildParams.mock.calls[0]
    expect(platformArg).toBe('happycapy')
    expect(contextArg).toHaveProperty('projectRoot')
    expect(contextArg).toHaveProperty('userOverrides')
  })

  it('正常安装：writeSupplementFiles 以 targetDir 作为第一个参数调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { writeSupplementFiles } = await import('../../lib/orchestrator.js')
    const [targetDirArg] = writeSupplementFiles.mock.calls[0]
    // targetDir 为适配器返回的安装路径（绝对路径，含 agentId）
    expect(typeof targetDirArg).toBe('string')
    expect(targetDirArg).toContain('bmad-expert')
  })

  it('executeInstall 以 toArgs() 返回值调用', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { executeInstall } = await import('../../lib/orchestrator.js')
    expect(executeInstall).toHaveBeenCalledWith(['--modules', 'bmm', '--yes'])
  })

  it('用户显式 --modules/--tools 参数透传至 buildParams.userOverrides（FR46）', async () => {
    await install({
      platform: null,
      agentId: 'bmad-expert',
      modules: 'bmb',
      tools: 'custom-tool',
      yes: false,
    })

    const { buildParams } = await import('../../lib/param-builder.js')
    const [, contextArg] = buildParams.mock.calls[0]
    expect(contextArg.userOverrides.modules).toBe('bmb')
    expect(contextArg.userOverrides.tools).toBe('custom-tool')
  })

  it('用户显式 --communication-language/--output-folder 参数透传至 buildParams.userOverrides', async () => {
    await install({
      platform: null,
      agentId: 'bmad-expert',
      communicationLanguage: 'English',
      outputFolder: '/custom/output',
      yes: false,
    })

    const { buildParams } = await import('../../lib/param-builder.js')
    const [, contextArg] = buildParams.mock.calls[0]
    expect(contextArg.userOverrides.communicationLanguage).toBe('English')
    expect(contextArg.userOverrides.outputFolder).toBe('/custom/output')
  })

  it('降级安装：happycapy-cli add 失败时不 throw，install() 正常完成', async () => {
    const { execa } = await import('execa')
    execa.mockImplementation((_cmd, args) => {
      if (args?.[0] === 'add') {
        const err = new Error('Command not found: happycapy-cli')
        err.code = 'ENOENT'
        return Promise.reject(err)
      }
      return Promise.resolve({ exitCode: 0 })
    })

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).resolves.toBeDefined()
  })

  it('幂等检测：已安装时 throw BmadError(E006)', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 目标路径存在（pathExists 全 true → check() 返回 'installed'）
    fsExtra.pathExists.mockResolvedValue(true)

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })
  })

  it('正常安装：install() 返回结构化数据（供 --json 模式使用）', async () => {
    const result = await install({ platform: null, agentId: 'bmad-expert', yes: false })

    expect(result).toHaveProperty('platform', 'happycapy')
    expect(result).toHaveProperty('agentId', 'bmad-expert')
    expect(result).toHaveProperty('installPath')
    expect(result).toHaveProperty('duration')
  })

  it('正常安装：printSuccess 被调用且消息含引导模板', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const { printSuccess } = await import('../../lib/output.js')
    expect(printSuccess).toHaveBeenCalled()
    const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
    expect(msg).toContain('bmad-expert 已就绪')
    expect(msg).toContain('①')
    expect(msg).toContain('②')
    expect(msg).toContain('bmad-help')
    expect(msg).toContain('安装完成（用时')
    expect(msg.indexOf('安装完成')).toBeLessThan(msg.indexOf('bmad-expert 已就绪'))
  })

  it('--yes 模式：安装完成后仍输出引导信息', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: true })

    const { printSuccess } = await import('../../lib/output.js')
    expect(printSuccess).toHaveBeenCalled()
    const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
    expect(msg).toContain('bmad-expert 已就绪')
  })
})
