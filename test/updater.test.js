import { describe, it, expect, vi, beforeEach } from 'vitest'
import { update, updateInitConfigs } from '../lib/updater.js'
import { BmadError } from '../lib/errors.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    pathExists: vi.fn(),
    copy: vi.fn().mockResolvedValue(undefined),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    outputFile: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
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

// mock installer.js replaceTemplateVars — 直接返回原内容
vi.mock('../lib/installer.js', () => ({
  replaceTemplateVars: vi.fn((content) => content),
  checkInstallStatus: vi.fn(),
  writeAgentFiles: vi.fn(),
  install: vi.fn(),
}))

// mock initializer.js generateFileContent — 返回可控的模板内容
vi.mock('../lib/initializer.js', () => ({
  generateFileContent: vi.fn().mockResolvedValue('new template content'),
  TEMPLATES_DIR: '/mock/templates',
}))

// mock readline — 用于模拟用户交互输入（AC2 测试需要）
vi.mock('readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn((prompt, cb) => cb('Y')),
    close: vi.fn(),
    on: vi.fn().mockReturnThis(),
  }),
}))

const INSTALL_PATH = '/home/user/.happycapy/agents/bmad-expert'

const MOCK_PKG = {
  version: '0.1.0',
  bmadExpert: {
    frameworkFiles: ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md'],
    userDataPaths: ['MEMORY.md', 'USER.md', 'memory/'],
  },
}

describe('update', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default

    // 默认：package.json 返回配置；模板文件返回占位内容
    fsMock.readFile.mockImplementation((p) => {
      if (String(p).includes('package.json')) {
        return Promise.resolve(JSON.stringify(MOCK_PKG))
      }
      return Promise.resolve('template content for {{agent_id}}')
    })

    // 默认：用户数据路径不存在（不触发备份 copy）；.bmad-init.json 也不存在
    fsMock.pathExists.mockResolvedValue(false)
  })

  // ─── 成功路径 ───────────────────────────────────────────────────────────

  describe('成功路径', () => {
    it('读取 package.json 获取框架文件列表', async () => {
      await update()
      expect(fsMock.readFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        'utf8'
      )
    })

    it('按 frameworkFiles 列表调用 outputFile，每个文件写入一次', async () => {
      await update()
      expect(fsMock.outputFile).toHaveBeenCalledTimes(MOCK_PKG.bmadExpert.frameworkFiles.length)
    })

    it('所有 outputFile 写入路径均位于 installPath 下', async () => {
      await update()
      for (const [writePath] of fsMock.outputFile.mock.calls) {
        expect(writePath).toContain(INSTALL_PATH)
      }
    })

    it('userDataPaths 不出现在 outputFile 的目标路径中（用户数据不被覆盖）', async () => {
      await update()
      const writtenFiles = fsMock.outputFile.mock.calls.map(([p]) => p)
      for (const dataPath of MOCK_PKG.bmadExpert.userDataPaths) {
        // memory/ 是目录路径，去掉尾部 / 后做包含检查
        const name = dataPath.replace(/\/$/, '')
        const overwritten = writtenFiles.some((p) => {
          const base = p.replace(INSTALL_PATH, '').replace(/^[\\/]/, '')
          return base === name || base.startsWith(name + '/')
        })
        expect(overwritten).toBe(false)
      }
    })

    it('printSuccess 含版本号', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await update()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('v0.1.0'))
    })

    it('printSuccess 含用户配置保留提示', async () => {
      const { printSuccess } = await import('../lib/output.js')
      await update()
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('memory 完整保留'))
    })

    it('成功后调用 fs.remove 清理备份目录', async () => {
      await update()
      expect(fsMock.remove).toHaveBeenCalledTimes(1)
    })
  })

  // ─── 备份路径 ───────────────────────────────────────────────────────────

  describe('备份路径', () => {
    it('存在的 userDataPaths 在 update 前被 copy 到备份目录', async () => {
      // 仅第一个路径（MEMORY.md）存在
      fsMock.pathExists
        .mockResolvedValueOnce(true)  // MEMORY.md 存在
        .mockResolvedValueOnce(false) // USER.md 不存在
        .mockResolvedValueOnce(false) // memory/ 不存在
      await update()
      expect(fsMock.copy).toHaveBeenCalledTimes(1)
      const [srcPath, destPath] = fsMock.copy.mock.calls[0]
      expect(srcPath).toContain('MEMORY.md')
      expect(destPath).toContain('bmad-expert-backup-')
    })

    it('不存在的 userDataPaths 不触发 fs.copy', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      await update()
      expect(fsMock.copy).not.toHaveBeenCalled()
    })

    it('备份目标路径包含 bmad-expert-backup- 前缀（位于系统临时目录）', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        // .bmad-init.json 不存在，避免触发 init 配置更新
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(false)
        return Promise.resolve(true)
      })
      await update()
      const backupCalls = fsMock.copy.mock.calls
      for (const [, destPath] of backupCalls) {
        expect(destPath).toContain('bmad-expert-backup-')
      }
    })
  })

  // ─── 异常路径 ───────────────────────────────────────────────────────────

  describe('异常路径', () => {
    it('框架文件写入权限失败时抛出 BmadError E004', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const permError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
      fsMock.outputFile.mockRejectedValueOnce(permError)
      await expect(update()).rejects.toMatchObject({ bmadCode: 'E004' })
    })

    it('抛出的 E004 是 BmadError 实例，retryable 为 true', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const permError = Object.assign(new Error('eperm'), { code: 'EPERM' })
      fsMock.outputFile.mockRejectedValueOnce(permError)
      const err = await update().catch((e) => e)
      expect(err).toBeInstanceOf(BmadError)
      expect(err.retryable).toBe(true)
    })

    it('非权限错误包装为 BmadError E001', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const ioError = Object.assign(new Error('disk full'), { code: 'ENOSPC' })
      fsMock.outputFile.mockRejectedValueOnce(ioError)
      await expect(update()).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('模板文件读取失败时包装为 BmadError E001', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      // 第一次 readFile = package.json（成功），第二次 = 模板文件（失败）
      fsMock.readFile
        .mockResolvedValueOnce(JSON.stringify(MOCK_PKG))
        .mockRejectedValueOnce(new Error('ENOENT: no such file or directory'))
      await expect(update()).rejects.toMatchObject({ bmadCode: 'E001' })
    })

    it('写入失败时触发回滚：备份数据通过 fs.copy 恢复至 installPath', async () => {
      // 备份阶段：MEMORY.md 存在 → 备份 1 次 copy
      // 恢复阶段：backupDir/MEMORY.md 存在 → 恢复 1 次 copy
      fsMock.pathExists
        .mockResolvedValueOnce(true)  // 备份检查：MEMORY.md 存在
        .mockResolvedValueOnce(false) // 备份检查：USER.md 不存在
        .mockResolvedValueOnce(false) // 备份检查：memory/ 不存在
        .mockResolvedValueOnce(true)  // 恢复检查：backupDir/MEMORY.md 存在
        .mockResolvedValueOnce(false) // 恢复检查：backupDir/USER.md 不存在
        .mockResolvedValueOnce(false) // 恢复检查：backupDir/memory/ 不存在

      const permError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
      fsMock.outputFile.mockRejectedValueOnce(permError)

      await expect(update()).rejects.toBeInstanceOf(BmadError)
      // 1 次备份 copy + 1 次恢复 copy = 2
      expect(fsMock.copy).toHaveBeenCalledTimes(2)
      // 恢复时第二次 copy 的目标路径应在 installPath 下
      const restoreCall = fsMock.copy.mock.calls[1]
      expect(restoreCall[1]).toContain(INSTALL_PATH)
    })

    it('异常回滚后调用 fs.remove 清理备份目录', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const permError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
      fsMock.outputFile.mockRejectedValueOnce(permError)

      await expect(update()).rejects.toBeInstanceOf(BmadError)
      expect(fsMock.remove).toHaveBeenCalledTimes(1)
    })

    it('回滚后原始 BmadError 被 rethrow（不被吞掉）', async () => {
      fsMock.pathExists.mockResolvedValue(false)
      const permError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
      fsMock.outputFile.mockRejectedValueOnce(permError)

      const thrown = await update().catch((e) => e)
      expect(thrown).toBeInstanceOf(BmadError)
      expect(thrown.bmadCode).toBe('E004')
    })
  })
})

// ─── init 配置文件更新（Story 11.1）──────────────────────────────────────

describe('updateInitConfigs', () => {
  let fsMock
  let generateFileContentMock

  const MOCK_MANIFEST = {
    version: '1.0.0',
    createdAt: '2026-04-08T10:00:00Z',
    templateVersion: '0.1.0',
    defaultProject: 'my-project',
    files: [
      { path: 'CLAUDE.md', type: 'workspace-claude' },
      { path: 'my-project/CLAUDE.md', type: 'project-claude' },
    ],
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    generateFileContentMock = (await import('../lib/initializer.js')).generateFileContent

    fsMock.pathExists.mockResolvedValue(false)
    fsMock.readFile.mockResolvedValue('old content')
    fsMock.outputFile.mockResolvedValue(undefined)
    fsMock.copy.mockResolvedValue(undefined)
    generateFileContentMock.mockResolvedValue('new template content')
  })

  // ─── AC3: 无 .bmad-init.json 时跳过 ──────────────────────────────────

  describe('无 .bmad-init.json（AC3）', () => {
    it('pathExists 返回 false 时跳过，返回 skipped: true', async () => {
      fsMock.pathExists.mockResolvedValue(false)

      const result = await updateInitConfigs({
        yes: false,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result).toEqual({ skipped: true, filesUpdated: 0, filesSkipped: 0 })
    })

    it('不读取 .bmad-init.json 文件', async () => {
      fsMock.pathExists.mockResolvedValue(false)

      await updateInitConfigs({ yes: false, cwd: '/workspace', currentVersion: '0.2.0' })

      // readFile 不应被调用（因为 pathExists 返回 false 直接跳过）
      expect(fsMock.readFile).not.toHaveBeenCalled()
    })
  })

  // ─── AC1: 有差异时备份 + 写入 ──────────────────────────────────────────

  describe('有差异时备份并写入（AC1）', () => {
    beforeEach(() => {
      // .bmad-init.json 存在
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        // 当前文件存在（用于备份）
        return Promise.resolve(true)
      })

      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve('old content')
      })

      // 模板生成不同内容 → 有差异
      generateFileContentMock.mockResolvedValue('new template content')
    })

    it('检测到差异时备份旧文件', async () => {
      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // 应为每个有差异的文件调用 copy（备份）
      expect(fsMock.copy).toHaveBeenCalledTimes(2)
      for (const [src, dest] of fsMock.copy.mock.calls) {
        expect(dest).toMatch(/\.bak\.\d+$/)
      }
      expect(result.filesUpdated).toBe(2)
    })

    it('备份后写入新内容', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // outputFile 应被调用：2 个文件写入 + 1 个 .bmad-init.json 更新 = 3
      const writeCalls = fsMock.outputFile.mock.calls
      const fileWrites = writeCalls.filter(([p]) => !String(p).includes('.bmad-init.json'))
      expect(fileWrites.length).toBe(2)
      for (const [, content] of fileWrites) {
        expect(content).toBe('new template content')
      }
    })

    it('更新完成后 .bmad-init.json 中 templateVersion 更新', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      const manifestWrite = fsMock.outputFile.mock.calls.find(([p]) =>
        String(p).includes('.bmad-init.json')
      )
      expect(manifestWrite).toBeDefined()
      const written = JSON.parse(manifestWrite[1].trim())
      expect(written.templateVersion).toBe('0.2.0')
    })
  })

  // ─── AC1: 无差异时跳过 ────────────────────────────────────────────────

  describe('无差异时跳过写入（AC1）', () => {
    it('配置无差异时 filesSkipped 增加，不写入', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        // 当前内容与生成内容相同
        return Promise.resolve('same content')
      })
      generateFileContentMock.mockResolvedValue('same content')

      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(2)
      // 不应有文件备份（无 copy）
      expect(fsMock.copy).not.toHaveBeenCalled()
      // templateVersion 仍会被更新（P2 修复：即使无文件差异也封存版本号）
      const manifestWrites = fsMock.outputFile.mock.calls.filter(([p]) =>
        String(p).includes('.bmad-init.json')
      )
      expect(manifestWrites.length).toBe(1)
      // 不应有配置文件写入
      const fileWrites = fsMock.outputFile.mock.calls.filter(([p]) =>
        !String(p).includes('.bmad-init.json')
      )
      expect(fileWrites.length).toBe(0)
    })
  })

  // ─── 版本相同时跳过 ────────────────────────────────────────────────────

  describe('templateVersion 与当前版本相同时跳过', () => {
    it('版本相同返回 skipped: true', async () => {
      const sameVersionManifest = { ...MOCK_MANIFEST, templateVersion: '0.2.0' }
      fsMock.pathExists.mockResolvedValue(true)
      fsMock.readFile.mockResolvedValue(JSON.stringify(sameVersionManifest))

      const result = await updateInitConfigs({
        yes: false,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result).toEqual({ skipped: true, filesUpdated: 0, filesSkipped: 0 })
    })
  })

  // ─── AC2: 用户拒绝时保留原文件 ────────────────────────────────────────

  describe('用户拒绝更新时保留原文件（AC2）', () => {
    it('用户输入 n 时文件保持不变', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve('old content')
      })
      generateFileContentMock.mockResolvedValue('new template content')

      // 通过 file-scope mock 配置 readline 模拟用户拒绝
      const { createInterface } = await import('readline')
      createInterface.mockReturnValue({
        question: vi.fn((prompt, cb) => cb('n')),
        close: vi.fn(),
        on: vi.fn().mockReturnThis(),
      })

      const result = await updateInitConfigs({
        yes: false,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // 文件应被备份但不写入新内容
      expect(result.filesSkipped).toBe(2)
      expect(result.filesUpdated).toBe(0)
      // 不应更新 .bmad-init.json（无文件被更新，且有 generationErrors=0 但 filesUpdated=0）
      // templateVersion 仍会更新因为 generationErrors === 0（P2 修复）
      // 但不应写入文件内容
      const fileWrites = fsMock.outputFile.mock.calls.filter(([p]) =>
        !String(p).includes('.bmad-init.json')
      )
      expect(fileWrites.length).toBe(0)
    })
  })

  // ─── AC4: --yes 模式自动覆盖 ──────────────────────────────────────────

  describe('--yes 模式自动覆盖（AC4）', () => {
    it('yes 模式下不暂停确认，直接备份覆盖', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve('old content')
      })
      generateFileContentMock.mockResolvedValue('new template content')

      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result.filesUpdated).toBe(2)
      expect(result.skipped).toBe(false)
    })
  })

  // ─── .bmad-init.json 解析失败 ─────────────────────────────────────────

  describe('异常处理', () => {
    it('.bmad-init.json 解析失败时抛出 BmadError E001', async () => {
      fsMock.pathExists.mockResolvedValue(true)
      fsMock.readFile.mockResolvedValue('invalid json{{{')

      await expect(
        updateInitConfigs({ yes: true, cwd: '/workspace', currentVersion: '0.2.0' })
      ).rejects.toMatchObject({ bmadCode: 'E001' })
    })
  })
})
