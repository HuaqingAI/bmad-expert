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

// ── 测试套件 ───────────────────────────────────────────────────────────────
describe('Codex 完整安装流程（集成测试）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Codex 平台特征：CODEX_RUNTIME 环境变量
    vi.stubEnv('CODEX_RUNTIME', 'true')

    // 默认：目标路径不存在（not_installed）
    const fsExtra = (await import('fs-extra')).default
    fsExtra.pathExists.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('成功安装：写入 5 个文件，进程以 exit code 0 退出', async () => {
    const result = await install({ platform: 'codex', agentId: 'bmad-expert', yes: false })

    const fsExtra = (await import('fs-extra')).default
    // 5 个框架文件全部写入
    expect(fsExtra.outputFile).toHaveBeenCalledTimes(5)

    // 返回结构含 platform: 'codex'
    expect(result).toMatchObject({ platform: 'codex', agentId: 'bmad-expert' })
  })

  it('成功安装：printSuccess 被调用且消息含安装完成引导', async () => {
    await install({ platform: 'codex', agentId: 'bmad-expert', yes: false })

    const { printSuccess } = await import('../../lib/output.js')
    expect(printSuccess).toHaveBeenCalled()
    const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
    expect(msg).toContain('bmad-expert 已就绪')
    expect(msg).toContain('安装完成（用时')
  })

  it('幂等安装：已安装时 throw BmadError(E006)', async () => {
    const fsExtra = (await import('fs-extra')).default
    // 目标路径存在 + AGENTS.md 存在 → check() 返回 'installed'
    fsExtra.pathExists
      .mockResolvedValueOnce(true)  // installPath 存在
      .mockResolvedValueOnce(true)  // AGENTS.md 存在

    await expect(
      install({ platform: 'codex', agentId: 'bmad-expert', yes: false })
    ).rejects.toMatchObject({ bmadCode: 'E006' })
  })

  it('降级路径：adapter.install() 内 ensureDir 失败时不 throw，install() 正常完成', async () => {
    const fsExtra = (await import('fs-extra')).default
    // installer.js 在 Step 3 先调用一次 ensureDir（必须成功）
    // adapter.install() 在 Step 5 再调用一次 ensureDir（允许失败 → adapter 降级处理）
    fsExtra.ensureDir
      .mockResolvedValueOnce(undefined)                             // Step 3: installer.js → 成功
      .mockRejectedValueOnce(new Error('EACCES: permission denied')) // Step 5: adapter → 失败，adapter 内部降级

    // install() 应完成而不 throw（adapter 捕获 ensureDir 失败并输出手动步骤）
    await expect(
      install({ platform: 'codex', agentId: 'bmad-expert', yes: false })
    ).resolves.toBeDefined()
  })

  it('跨平台行为一致性：Codex 安装返回结构与 HappyCapy 一致', async () => {
    const result = await install({ platform: 'codex', agentId: 'bmad-expert', yes: false })

    // 结构体必须含 platform、agentId、installPath、duration
    expect(result).toHaveProperty('platform', 'codex')
    expect(result).toHaveProperty('agentId', 'bmad-expert')
    expect(result).toHaveProperty('installPath')
    expect(result).toHaveProperty('duration')
    // installPath 必须含 .codex/bmad-expert（Codex 平台路径特征）
    expect(result.installPath).toContain('.codex')
    expect(result.installPath).toContain('bmad-expert')
  })
})
