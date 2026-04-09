import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkStatus } from '../lib/checker.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    pathExists: vi.fn(),
    readJSON: vi.fn(),
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

    // 默认：.bmad-init.json 不存在（未执行过 init）
    fsMock.readJSON.mockRejectedValue(new Error('ENOENT'))
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
      // 注：第 2 个调用是 .bmad-init.json（init 状态检测，Story 13.2）
      fsMock.pathExists
        .mockResolvedValueOnce(true)   // installPath 存在
        .mockResolvedValueOnce(false)  // .bmad-init.json 不存在（init 状态检测）
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
        .mockResolvedValueOnce(true)   // installPath
        .mockResolvedValueOnce(false)  // .bmad-init.json
        .mockResolvedValueOnce(true)   // SOUL.md
        .mockResolvedValueOnce(false)  // IDENTITY.md
        .mockResolvedValueOnce(true)   // AGENTS.md
        .mockResolvedValueOnce(false)  // BOOTSTRAP.md
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

  // ─── init 状态检测（FR73 — Story 13.2） ──────────────────────────────

  const MOCK_INIT_MANIFEST = {
    version: '1.0.0',
    createdAt: '2026-04-08T10:00:00Z',
    templateVersion: '1.0.0',
    defaultProject: 'my-project',
    files: [
      { path: 'CLAUDE.md', type: 'workspace-claude' },
      { path: 'my-project/CLAUDE.md', type: 'project-claude' },
      { path: 'my-project/workflow/story-dev-workflow-single-repo.md', type: 'workflow' },
    ],
  }

  const WORKSPACE_CONTENT_WITH_MARKERS = `# My Workspace\n\n<!-- bmad-workspace-config -->\n## Default Project\nfoo\n<!-- /bmad-workspace-config -->\n\n## My Custom Stuff`
  const PROJECT_CONTENT_WITH_MARKERS = `<!-- bmad-project-config -->\n## Workflow\nbar\n<!-- /bmad-project-config -->`
  const CONTENT_WITHOUT_MARKERS = `# Just a normal file\nNo markers here.`

  describe('init 状态检测（FR73）', () => {
    describe('已初始化（所有文件完整）', () => {
      beforeEach(() => {
        // install healthy + init manifest exists + all init files exist
        fsMock.pathExists.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('.bmad-init.json')) return Promise.resolve(true)
          return Promise.resolve(true) // installPath + all framework files + all init files
        })
        fsMock.readJSON.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(MOCK_INIT_MANIFEST)
          return Promise.reject(new Error('ENOENT'))
        })
        fsMock.readFile.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('package.json')) return Promise.resolve(JSON.stringify(MOCK_PKG))
          if (s.endsWith('CLAUDE.md') && !s.includes('my-project')) return Promise.resolve(WORKSPACE_CONTENT_WITH_MARKERS)
          if (s.includes('my-project') && s.endsWith('CLAUDE.md')) return Promise.resolve(PROJECT_CONTENT_WITH_MARKERS)
          return Promise.resolve('')
        })
      })

      it('返回对象含 init.initialized: true', async () => {
        const result = await checkStatus()
        expect(result.init.initialized).toBe(true)
      })

      it('返回 init.templateVersion', async () => {
        const result = await checkStatus()
        expect(result.init.templateVersion).toBe('1.0.0')
      })

      it('返回 init.files 数组，长度与清单一致', async () => {
        const result = await checkStatus()
        expect(result.init.files).toHaveLength(3)
      })

      it('workspace-claude 文件含 hasBmadSection: true', async () => {
        const result = await checkStatus()
        const wsFile = result.init.files.find((f) => f.type === 'workspace-claude')
        expect(wsFile.exists).toBe(true)
        expect(wsFile.hasBmadSection).toBe(true)
      })

      it('project-claude 文件含 hasBmadSection: true', async () => {
        const result = await checkStatus()
        const projFile = result.init.files.find((f) => f.type === 'project-claude')
        expect(projFile.exists).toBe(true)
        expect(projFile.hasBmadSection).toBe(true)
      })

      it('workflow 文件不含 hasBmadSection 字段', async () => {
        const result = await checkStatus()
        const wfFile = result.init.files.find((f) => f.type === 'workflow')
        expect(wfFile.exists).toBe(true)
        expect(wfFile).not.toHaveProperty('hasBmadSection')
      })

      it('printSuccess 含 "Init: ✓ 已初始化"', async () => {
        const { printSuccess } = await import('../lib/output.js')
        await checkStatus()
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Init: ✓ 已初始化'))
      })

      it('printSuccess 含配置文件完整数："3/3 完整"', async () => {
        const { printSuccess } = await import('../lib/output.js')
        await checkStatus()
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('3/3 完整'))
      })

      it('printSuccess 含模板版本："模板版本: 1.0.0"', async () => {
        const { printSuccess } = await import('../lib/output.js')
        await checkStatus()
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('模板版本: 1.0.0'))
      })
    })

    describe('未初始化', () => {
      beforeEach(() => {
        // install healthy, no .bmad-init.json
        fsMock.pathExists.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(false)
          return Promise.resolve(true) // installPath + all framework files
        })
      })

      it('返回对象含 init.initialized: false', async () => {
        const result = await checkStatus()
        expect(result.init.initialized).toBe(false)
      })

      it('init 对象不含 templateVersion', async () => {
        const result = await checkStatus()
        expect(result.init).not.toHaveProperty('templateVersion')
      })

      it('init 对象不含 files', async () => {
        const result = await checkStatus()
        expect(result.init).not.toHaveProperty('files')
      })

      it('printSuccess 含 "Init: ✗ 未初始化"', async () => {
        const { printSuccess } = await import('../lib/output.js')
        await checkStatus()
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Init: ✗ 未初始化'))
      })
    })

    describe('已初始化（部分文件缺失）', () => {
      beforeEach(() => {
        fsMock.pathExists.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('.bmad-init.json')) return Promise.resolve(true)
          // workflow 文件不存在
          if (s.includes('story-dev-workflow')) return Promise.resolve(false)
          return Promise.resolve(true) // installPath + framework files + CLAUDE.md files
        })
        fsMock.readJSON.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(MOCK_INIT_MANIFEST)
          return Promise.reject(new Error('ENOENT'))
        })
        fsMock.readFile.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('package.json')) return Promise.resolve(JSON.stringify(MOCK_PKG))
          if (s.endsWith('CLAUDE.md') && !s.includes('my-project')) return Promise.resolve(WORKSPACE_CONTENT_WITH_MARKERS)
          if (s.includes('my-project') && s.endsWith('CLAUDE.md')) return Promise.resolve(PROJECT_CONTENT_WITH_MARKERS)
          return Promise.resolve('')
        })
      })

      it('返回 init.initialized: true', async () => {
        const result = await checkStatus()
        expect(result.init.initialized).toBe(true)
      })

      it('缺失文件的 exists 为 false', async () => {
        const result = await checkStatus()
        const wfFile = result.init.files.find((f) => f.type === 'workflow')
        expect(wfFile.exists).toBe(false)
      })

      it('存在的文件 exists 为 true', async () => {
        const result = await checkStatus()
        const wsFile = result.init.files.find((f) => f.type === 'workspace-claude')
        expect(wsFile.exists).toBe(true)
      })

      it('printSuccess 含缺失数信息', async () => {
        const { printSuccess } = await import('../lib/output.js')
        await checkStatus()
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('2/3 完整'))
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('1 个缺失'))
      })
    })

    describe('标记对不完整时 hasBmadSection 为 false', () => {
      beforeEach(() => {
        fsMock.pathExists.mockResolvedValue(true)
        fsMock.readJSON.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(MOCK_INIT_MANIFEST)
          return Promise.reject(new Error('ENOENT'))
        })
        fsMock.readFile.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('package.json')) return Promise.resolve(JSON.stringify(MOCK_PKG))
          // workspace CLAUDE.md 无标记
          if (s.endsWith('CLAUDE.md') && !s.includes('my-project')) return Promise.resolve(CONTENT_WITHOUT_MARKERS)
          if (s.includes('my-project') && s.endsWith('CLAUDE.md')) return Promise.resolve(CONTENT_WITHOUT_MARKERS)
          return Promise.resolve('')
        })
      })

      it('workspace-claude 文件无标记时 hasBmadSection: false', async () => {
        const result = await checkStatus()
        const wsFile = result.init.files.find((f) => f.type === 'workspace-claude')
        expect(wsFile.hasBmadSection).toBe(false)
      })

      it('project-claude 文件无标记时 hasBmadSection: false', async () => {
        const result = await checkStatus()
        const projFile = result.init.files.find((f) => f.type === 'project-claude')
        expect(projFile.hasBmadSection).toBe(false)
      })
    })

    describe('JSON 输出结构含 init 字段', () => {
      it('healthy + 已初始化：init 字段完整', async () => {
        fsMock.pathExists.mockResolvedValue(true)
        fsMock.readJSON.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(MOCK_INIT_MANIFEST)
          return Promise.reject(new Error('ENOENT'))
        })
        fsMock.readFile.mockImplementation((p) => {
          const s = String(p)
          if (s.includes('package.json')) return Promise.resolve(JSON.stringify(MOCK_PKG))
          if (s.endsWith('CLAUDE.md')) return Promise.resolve(WORKSPACE_CONTENT_WITH_MARKERS)
          return Promise.resolve('')
        })

        const result = await checkStatus()
        expect(result.init).toMatchObject({
          initialized: true,
          templateVersion: '1.0.0',
          files: expect.any(Array),
        })
        // JSON 往返无损
        const roundTripped = JSON.parse(JSON.stringify(result))
        expect(roundTripped).toEqual(result)
      })

      it('healthy + 未初始化：init 字段只含 initialized: false', async () => {
        fsMock.pathExists.mockImplementation((p) => {
          if (String(p).includes('.bmad-init.json')) return Promise.resolve(false)
          return Promise.resolve(true)
        })

        const result = await checkStatus()
        expect(result.init).toEqual({ initialized: false })
      })

      it('not_installed + 未初始化：init 字段存在且 initialized: false', async () => {
        fsMock.pathExists.mockResolvedValue(false)

        const result = await checkStatus()
        expect(result.init).toEqual({ initialized: false })
      })
    })

    describe('.bmad-init.json 损坏时降级为未初始化', () => {
      beforeEach(() => {
        fsMock.pathExists.mockResolvedValue(true)
        // readJSON 抛出 JSON 解析错误
        fsMock.readJSON.mockRejectedValue(new SyntaxError('Unexpected token'))
      })

      it('返回 init.initialized: false', async () => {
        const result = await checkStatus()
        expect(result.init.initialized).toBe(false)
      })
    })
  })
})
