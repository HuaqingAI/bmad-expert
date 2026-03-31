import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { install } from '../../lib/installer.js'
import { BmadError } from '../../lib/errors.js'

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

// ── 测试套件 ───────────────────────────────────────────────────────────────
describe('HappyCapy 完整安装流程（集成测试）', () => {
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

  it('正常安装：写入 5 个文件并调用 happycapy-cli add', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: false })

    const fsExtra = (await import('fs-extra')).default
    // 5 个框架文件全部写入
    expect(fsExtra.outputFile).toHaveBeenCalledTimes(5)

    // happycapy-cli add 被调用
    const { execa } = await import('execa')
    const addCall = execa.mock.calls.find(
      (args) => args[0] === 'happycapy-cli' && args[1]?.[0] === 'add'
    )
    expect(addCall).toBeDefined()
    expect(addCall[1]).toContain('bmad-expert')
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
    ).resolves.toBeUndefined()
  })

  it('幂等检测：已安装时 throw BmadError(E006)', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 目标路径存在（pathExists 全 true → check() 返回 'installed'）
    fsExtra.pathExists.mockResolvedValue(true)

    await expect(
      install({ platform: null, agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })
  })
})
