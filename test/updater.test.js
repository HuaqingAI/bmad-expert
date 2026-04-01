import { describe, it, expect, vi, beforeEach } from 'vitest'
import { update } from '../lib/updater.js'
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

    // 默认：用户数据路径不存在（不触发备份 copy）
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
      fsMock.pathExists.mockResolvedValue(true)
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
