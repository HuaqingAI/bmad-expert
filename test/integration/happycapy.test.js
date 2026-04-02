import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { install } from '../../lib/installer.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// agent/ 模板目录，相对 test/integration/ 向上两级
const AGENT_DIR = join(__dirname, '../../agent')

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

    // Story 6.3: install() 现在返回结构化数据 { platform, agentId, installPath, duration }
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

  it('正常安装：printSuccess 被调用且消息符合引导模板（AC1）', async () => {
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

  it('--yes 模式：安装完成后仍输出引导信息（FR30 + AC2）', async () => {
    await install({ platform: null, agentId: 'bmad-expert', yes: true })

    const { printSuccess } = await import('../../lib/output.js')
    expect(printSuccess).toHaveBeenCalled()
    const msg = printSuccess.mock.calls.at(-1)?.[0] ?? ''
    expect(msg).toContain('bmad-expert 已就绪')
  })

  // ── 文件内容验证套件 ────────────────────────────────────────────────────────
  describe('安装文件内容验证', () => {
    let writtenFiles

    beforeEach(async () => {
      vi.clearAllMocks()
      vi.stubEnv('CAPY_USER_ID', 'test-user-123')

      writtenFiles = {}

      const fsExtra = (await import('fs-extra')).default
      fsExtra.pathExists.mockResolvedValue(false)

      // readFile mock：按文件名返回真实模板内容，触发实际变量替换逻辑
      fsExtra.readFile.mockImplementation(async (filePath) => {
        return readFileSync(join(AGENT_DIR, basename(filePath)), 'utf8')
      })

      // outputFile mock：捕获写入内容供断言使用
      fsExtra.outputFile.mockImplementation(async (filePath, content) => {
        writtenFiles[basename(filePath)] = content
      })

      const { execa } = await import('execa')
      execa.mockResolvedValue({ exitCode: 0 })
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('文件数量：写入 5 个框架文件', async () => {
      await install({ platform: null, agentId: 'bmad-expert', yes: false })

      const expectedFiles = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md', 'bmad-project-init.md']
      expect(Object.keys(writtenFiles)).toHaveLength(5)
      for (const file of expectedFiles) {
        expect(Object.keys(writtenFiles), `${file} 未被写入`).toContain(file)
      }
    })

    it('占位符替换：所有写入文件无残留 {{...}}', async () => {
      await install({ platform: null, agentId: 'bmad-expert', yes: false })

      for (const [filename, content] of Object.entries(writtenFiles)) {
        expect(content, `${filename} 中存在未替换的占位符`).not.toMatch(/\{\{.*?\}\}/)
      }
    })

    it('AGENTS.md 内容：含 Session Startup 与 BOOTSTRAP.md 检测逻辑', async () => {
      await install({ platform: null, agentId: 'bmad-expert', yes: false })

      const agentsContent = writtenFiles['AGENTS.md']
      expect(agentsContent).toBeDefined()
      expect(agentsContent).toContain('Session Startup')
      expect(agentsContent).toContain('BOOTSTRAP.md')
    })

    it('BOOTSTRAP.md 内容：含自毁指令与 bmad-help 跳转', async () => {
      await install({ platform: null, agentId: 'bmad-expert', yes: false })

      const bootstrapContent = writtenFiles['BOOTSTRAP.md']
      expect(bootstrapContent).toBeDefined()
      expect(bootstrapContent).toContain('rm -f')
      expect(bootstrapContent).toContain('bmad-help')
    })
  })
})
