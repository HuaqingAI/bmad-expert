import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkStatus } from '../lib/checker.js'

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

    it('返回对象含 success:true', async () => {
      const result = await checkStatus()
      expect(result.success).toBe(true)
    })

    it('返回对象含 platform:happycapy', async () => {
      const result = await checkStatus()
      expect(result.platform).toBe('happycapy')
    })

    it('返回对象含 version', async () => {
      const result = await checkStatus()
      expect(result.version).toBe('0.1.0')
    })

    it('返回对象含 installPath', async () => {
      const result = await checkStatus()
      expect(result.installPath).toBe(INSTALL_PATH)
    })

    it('files 数组使用 name 键（非 file 键）', async () => {
      const result = await checkStatus()
      expect(result.files.length).toBeGreaterThan(0)
      expect(result.files[0]).toHaveProperty('name')
      expect(result.files[0]).not.toHaveProperty('file')
    })

    it('files 数组每个元素含 name（string）和 exists（boolean）字段', async () => {
      const result = await checkStatus()
      for (const f of result.files) {
        expect(typeof f.name).toBe('string')
        expect(typeof f.exists).toBe('boolean')
      }
    })

    it('healthy 时 files 中所有文件 exists:true', async () => {
      const result = await checkStatus()
      expect(result.files.every((f) => f.exists)).toBe(true)
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

    it('installPath 不存在时返回 success:false', async () => {
      const result = await checkStatus()
      expect(result.success).toBe(false)
    })

    it('返回对象含 status:not_installed', async () => {
      const result = await checkStatus()
      expect(result.status).toBe('not_installed')
    })

    it('返回对象含 version:null', async () => {
      const result = await checkStatus()
      expect(result.version).toBeNull()
    })

    it('返回对象含 platform:happycapy', async () => {
      const result = await checkStatus()
      expect(result.platform).toBe('happycapy')
    })

    it('返回对象含 installPath', async () => {
      const result = await checkStatus()
      expect(result.installPath).toBe(INSTALL_PATH)
    })

    it('返回对象 files 为空数组', async () => {
      const result = await checkStatus()
      expect(result.files).toEqual([])
    })

    it('不抛出异常（状态性结果通过返回值表达）', async () => {
      await expect(checkStatus()).resolves.toBeDefined()
    })

    it('返回对象含 fixSuggestion 字段', async () => {
      const result = await checkStatus()
      expect(result.fixSuggestion).toBe('运行 npx bmad-expert install 完成安装')
    })

    it('printSuccess 含 not_installed', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('not_installed'))
    })

    it('printSuccess 含修复建议（npx bmad-expert install）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
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

    it('部分文件缺失时返回 success:false', async () => {
      const result = await checkStatus()
      expect(result.success).toBe(false)
    })

    it('返回对象含 status:corrupted', async () => {
      const result = await checkStatus()
      expect(result.status).toBe('corrupted')
    })

    it('返回对象含 version（非 null）', async () => {
      const result = await checkStatus()
      expect(result.version).toBe('0.1.0')
    })

    it('返回对象含 platform:happycapy', async () => {
      const result = await checkStatus()
      expect(result.platform).toBe('happycapy')
    })

    it('返回对象含 installPath', async () => {
      const result = await checkStatus()
      expect(result.installPath).toBe(INSTALL_PATH)
    })

    it('返回对象含 fixSuggestion 字段', async () => {
      const result = await checkStatus()
      expect(result.fixSuggestion).toBe('运行 npx bmad-expert install 重新安装')
    })

    it('files 数组中缺失文件 exists:false（IDENTITY.md）', async () => {
      const result = await checkStatus()
      const identityFile = result.files.find((f) => f.name === 'IDENTITY.md')
      expect(identityFile?.exists).toBe(false)
    })

    it('files 数组中缺失文件 exists:false（BOOTSTRAP.md）', async () => {
      const result = await checkStatus()
      const bootstrapFile = result.files.find((f) => f.name === 'BOOTSTRAP.md')
      expect(bootstrapFile?.exists).toBe(false)
    })

    it('files 数组中存在文件 exists:true（SOUL.md）', async () => {
      const result = await checkStatus()
      const soulFile = result.files.find((f) => f.name === 'SOUL.md')
      expect(soulFile?.exists).toBe(true)
    })

    it('files 数组元素使用 name 键（非 file 键）', async () => {
      const result = await checkStatus()
      expect(result.files[0]).toHaveProperty('name')
      expect(result.files[0]).not.toHaveProperty('file')
    })

    it('不抛出异常（状态性结果通过返回值表达）', async () => {
      await expect(checkStatus()).resolves.toBeDefined()
    })

    it('printSuccess 含 corrupted', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('corrupted'))
    })

    it('printSuccess 含缺失文件名（IDENTITY.md）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('IDENTITY.md'))
    })

    it('printSuccess 含缺失文件名（BOOTSTRAP.md）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('BOOTSTRAP.md'))
    })

    it('printSuccess 含修复建议（npx bmad-expert install）', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await checkStatus()
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

  // ─── JSON 输出结构完整性（FR49 AC 验证） ────────────────────────────

  describe('JSON 输出结构完整性（FR49）', () => {
    it('healthy 状态：输出结构含全部必要字段', async () => {
      fsMock.pathExists.mockResolvedValue(true)
      const result = await checkStatus()
      expect(result).toMatchObject({
        success: true,
        status: 'healthy',
        version: expect.any(String),
        platform: expect.any(String),
        installPath: expect.any(String),
        files: expect.any(Array),
      })
    })

    it('not_installed 状态：输出结构含全部必要字段', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const result = await checkStatus()
      expect(result).toMatchObject({
        success: false,
        status: 'not_installed',
        version: null,
        platform: expect.any(String),
        installPath: expect.any(String),
        files: [],
        fixSuggestion: expect.any(String),
      })
    })

    it('corrupted 状态：输出结构含全部必要字段', async () => {
      fsMock.pathExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      const result = await checkStatus()
      expect(result).toMatchObject({
        success: false,
        status: 'corrupted',
        version: expect.any(String),
        platform: expect.any(String),
        installPath: expect.any(String),
        files: expect.any(Array),
        fixSuggestion: expect.any(String),
      })
    })

    it('结果对象可被 JSON.stringify/parse 无损往返', async () => {
      fsMock.pathExists.mockResolvedValue(true)
      const result = await checkStatus()
      const roundTripped = JSON.parse(JSON.stringify(result))
      expect(roundTripped).toEqual(result)
    })
  })
})
