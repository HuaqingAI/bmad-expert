import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkStatus } from '../lib/checker.js'
import { BmadError } from '../lib/errors.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    pathExists: vi.fn(),
  },
}))

vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn().mockReturnValue({
    getInstallPath: vi.fn().mockReturnValue('/home/user/.happycapy/agents/bmad-expert'),
  }),
}))

// mock output.js — 防止真实 stdout 输出影响测试结果
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
}))

const INSTALL_PATH = '/home/user/.happycapy/agents/bmad-expert'

const MOCK_PKG = {
  version: '0.1.0',
  bmadExpert: {
    frameworkFiles: ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md'],
    userDataPaths: ['MEMORY.md', 'USER.md', 'memory/'],
  },
}

describe('checkStatus', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default

    // 默认：package.json 返回配置
    fsMock.readFile.mockImplementation((p) => {
      if (String(p).includes('package.json')) {
        return Promise.resolve(JSON.stringify(MOCK_PKG))
      }
      return Promise.resolve('')
    })
  })

  // ─── 已安装状态（healthy） ──────────────────────────────────────────

  describe('已安装状态（healthy）', () => {
    beforeEach(() => {
      // installPath 存在 + 所有 frameworkFiles 均存在
      fsMock.pathExists.mockResolvedValue(true)
    })

    it('所有文件存在时不抛出异常，返回含 status:healthy 的结果对象', async () => {
      const result = await checkStatus()
      expect(result).toMatchObject({ status: 'healthy' })
    })

    it('printSuccess 含版本号', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('v0.1.0'))
    })

    it('printSuccess 含安装路径', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining(INSTALL_PATH))
    })

    it('printSuccess 含 healthy', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('healthy'))
    })

    it('对每个 frameworkFile 均调用 fs.pathExists', async () => {
      await checkStatus()
      const calls = fsMock.pathExists.mock.calls.map(([p]) => String(p))
      for (const file of MOCK_PKG.bmadExpert.frameworkFiles) {
        expect(calls.some((p) => p.includes(file))).toBe(true)
      }
    })
  })

  // ─── 未安装状态（not_installed） ────────────────────────────────────

  describe('未安装状态（not_installed）', () => {
    beforeEach(() => {
      // installPath 不存在
      fsMock.pathExists.mockResolvedValue(false)
    })

    it('installPath 不存在时抛出 BmadError E001', async () => {
      await expect(checkStatus()).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('抛出的错误是 BmadError 实例', async () => {
      const err = await checkStatus().catch((e) => e)
      expect(err).toBeInstanceOf(BmadError)
    })

    it('printSuccess 含 not_installed', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('not_installed'))
    })

    it('printSuccess 含修复建议（npx bmad-expert install）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('npx bmad-expert install'))
    })
  })

  // ─── 损坏状态（corrupted） ──────────────────────────────────────────

  describe('损坏状态（corrupted）', () => {
    beforeEach(() => {
      // installPath 存在，但第 2、4 个文件缺失
      fsMock.pathExists
        .mockResolvedValueOnce(true)   // installPath 存在
        .mockResolvedValueOnce(true)   // SOUL.md 存在
        .mockResolvedValueOnce(false)  // IDENTITY.md 缺失
        .mockResolvedValueOnce(true)   // AGENTS.md 存在
        .mockResolvedValueOnce(false)  // BOOTSTRAP.md 缺失
    })

    it('部分文件缺失时抛出 BmadError E001', async () => {
      await expect(checkStatus()).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('抛出的错误是 BmadError 实例', async () => {
      const err = await checkStatus().catch((e) => e)
      expect(err).toBeInstanceOf(BmadError)
    })

    it('printSuccess 含 corrupted', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('corrupted'))
    })

    it('printSuccess 含缺失文件名（IDENTITY.md）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('IDENTITY.md'))
    })

    it('printSuccess 含缺失文件名（BOOTSTRAP.md）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('BOOTSTRAP.md'))
    })

    it('printSuccess 含修复建议（npx bmad-expert install）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus().catch(() => {})
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('npx bmad-expert install'))
    })
  })

  // ─── platform 选项透传 ──────────────────────────────────────────────

  describe('platform 选项透传', () => {
    it('传入 platform 选项时 detectPlatform 收到对应值', async () => {
      fsMock.pathExists.mockResolvedValue(true)
      const { detectPlatform } = await import('../lib/platform.js')
      await checkStatus({ platform: 'cursor' })
      expect(detectPlatform).toHaveBeenCalledWith('cursor')
    })

    it('未传入 platform 时 detectPlatform 收到 null', async () => {
      fsMock.pathExists.mockResolvedValue(true)
      const { detectPlatform } = await import('../lib/platform.js')
      await checkStatus()
      expect(detectPlatform).toHaveBeenCalledWith(null)
    })
  })
})
