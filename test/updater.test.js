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

// mock section-manager.js — 标记化段落管理引擎（Phase 4 Story 12.3）
vi.mock('../lib/section-manager.js', () => ({
  replaceBmadSection: vi.fn((content, _sectionId, newSection) => {
    // 默认：模拟替换成功（返回替换后的内容）
    return content.replace(/<!-- bmad-[\w-]+ -->[\s\S]*?<!-- \/bmad-[\w-]+ -->/, newSection)
  }),
  extractBmadSection: vi.fn((content, sectionId) => {
    // 默认：从模板内容中提取标记段落
    const open = `<!-- ${sectionId} -->`
    const close = `<!-- /${sectionId} -->`
    const openIdx = content.indexOf(open)
    const closeIdx = content.indexOf(close)
    if (openIdx !== -1 && closeIdx !== -1) {
      return content.substring(openIdx, closeIdx + close.length)
    }
    return `${open}\nnew managed content\n${close}`
  }),
  hasBmadSection: vi.fn().mockReturnValue(true),
  removeBmadSection: vi.fn(),
  wrapBmadSection: vi.fn(),
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

// ─── init 配置文件更新（Story 11.1 + Phase 4 Story 12.3）─────────────────

describe('updateInitConfigs', () => {
  let fsMock
  let generateFileContentMock
  let sectionManagerMock

  // Phase 4：MOCK_MANIFEST 包含 action 字段
  const MOCK_MANIFEST = {
    version: '1.0.0',
    createdAt: '2026-04-08T10:00:00Z',
    templateVersion: '0.1.0',
    defaultProject: 'my-project',
    files: [
      { path: 'CLAUDE.md', type: 'workspace-claude', action: 'appended' },
      { path: 'my-project/CLAUDE.md', type: 'project-claude', action: 'created' },
    ],
  }

  // 包含 workflow 文件的清单（用于框架文件确认流程测试）
  const MOCK_MANIFEST_WITH_WORKFLOW = {
    ...MOCK_MANIFEST,
    files: [
      ...MOCK_MANIFEST.files,
      { path: 'my-project/workflow/dev.md', type: 'workflow', action: 'created' },
    ],
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    generateFileContentMock = (await import('../lib/initializer.js')).generateFileContent
    sectionManagerMock = await import('../lib/section-manager.js')

    fsMock.pathExists.mockResolvedValue(false)
    fsMock.readFile.mockResolvedValue('old content')
    fsMock.outputFile.mockResolvedValue(undefined)
    fsMock.copy.mockResolvedValue(undefined)
    generateFileContentMock.mockResolvedValue('<!-- bmad-workspace-config -->\nnew managed content\n<!-- /bmad-workspace-config -->')
  })

  // ─── 无 .bmad-init.json 时跳过 ──────────────────────────────────────

  describe('无 .bmad-init.json', () => {
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

      expect(fsMock.readFile).not.toHaveBeenCalled()
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

  // ─── AC1: 标记管理文件精准段落替换（workspace-claude）───────────────────

  describe('标记管理文件精准段落替换（AC1, AC2）', () => {
    const CURRENT_CONTENT_WITH_MARKERS =
      '# Claude\n\nMy custom rules\n\n<!-- bmad-workspace-config -->\nold managed content\n<!-- /bmad-workspace-config -->\n\nMore custom content'

    beforeEach(() => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })

      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve(CURRENT_CONTENT_WITH_MARKERS)
      })

      // 新模板包含更新后的标记段落
      generateFileContentMock.mockResolvedValue(
        '<!-- bmad-workspace-config -->\nnew managed content\n<!-- /bmad-workspace-config -->'
      )

      // section-manager mocks
      sectionManagerMock.extractBmadSection.mockReturnValue(
        '<!-- bmad-workspace-config -->\nnew managed content\n<!-- /bmad-workspace-config -->'
      )
      sectionManagerMock.replaceBmadSection.mockReturnValue(
        '# Claude\n\nMy custom rules\n\n<!-- bmad-workspace-config -->\nnew managed content\n<!-- /bmad-workspace-config -->\n\nMore custom content'
      )
    })

    it('调用 extractBmadSection 从新模板中提取标记段落', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(sectionManagerMock.extractBmadSection).toHaveBeenCalledWith(
        expect.any(String),
        'bmad-workspace-config'
      )
    })

    it('调用 replaceBmadSection 精准替换标记段落', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(sectionManagerMock.replaceBmadSection).toHaveBeenCalledWith(
        CURRENT_CONTENT_WITH_MARKERS,
        'bmad-workspace-config',
        expect.stringContaining('bmad-workspace-config')
      )
    })

    it('标记管理文件不创建备份（用户内容不受影响）', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // 不应有 copy 调用（标记管理文件无需备份）
      expect(fsMock.copy).not.toHaveBeenCalled()
    })

    it('标记管理文件不需要用户确认', async () => {
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

      // 即使用户不确认，标记管理文件仍应更新（无确认流程）
      expect(result.filesUpdated).toBe(2)
    })

    it('写入内容保留用户自定义部分', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      const fileWrites = fsMock.outputFile.mock.calls.filter(([p]) =>
        !String(p).includes('.bmad-init.json')
      )
      for (const [, content] of fileWrites) {
        // 写入的内容应包含用户自定义部分
        expect(content).toContain('My custom rules')
        expect(content).toContain('More custom content')
        // 也应包含新的 managed content
        expect(content).toContain('new managed content')
      }
    })

    it('project-claude 使用 bmad-project-config sectionId', async () => {
      const projectManifest = {
        ...MOCK_MANIFEST,
        files: [
          { path: 'my-project/CLAUDE.md', type: 'project-claude', action: 'created' },
        ],
      }

      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(projectManifest))
        }
        return Promise.resolve('# CLAUDE.md\n\n<!-- bmad-project-config -->\nold\n<!-- /bmad-project-config -->')
      })

      generateFileContentMock.mockResolvedValue(
        '<!-- bmad-project-config -->\nnew project content\n<!-- /bmad-project-config -->'
      )
      sectionManagerMock.extractBmadSection.mockReturnValue(
        '<!-- bmad-project-config -->\nnew project content\n<!-- /bmad-project-config -->'
      )
      sectionManagerMock.replaceBmadSection.mockReturnValue(
        '# CLAUDE.md\n\n<!-- bmad-project-config -->\nnew project content\n<!-- /bmad-project-config -->'
      )

      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(sectionManagerMock.extractBmadSection).toHaveBeenCalledWith(
        expect.any(String),
        'bmad-project-config'
      )
      expect(sectionManagerMock.replaceBmadSection).toHaveBeenCalledWith(
        expect.any(String),
        'bmad-project-config',
        expect.stringContaining('bmad-project-config')
      )
    })
  })

  // ─── 标记段落无差异时跳过 ─────────────────────────────────────────────

  describe('标记段落无差异时跳过', () => {
    it('replaceBmadSection 返回内容与原内容相同时跳过', async () => {
      const content = '# Claude\n\n<!-- bmad-workspace-config -->\nmanaged\n<!-- /bmad-workspace-config -->'

      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve(content)
      })

      // replaceBmadSection 返回原内容（无变化）
      sectionManagerMock.replaceBmadSection.mockReturnValue(content)
      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nmanaged\n<!-- /bmad-workspace-config -->')

      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(2)
      // 只有 .bmad-init.json 更新（templateVersion）
      const fileWrites = fsMock.outputFile.mock.calls.filter(([p]) =>
        !String(p).includes('.bmad-init.json')
      )
      expect(fileWrites.length).toBe(0)
    })
  })

  // ─── AC3: 框架/workflow 文件确认+备份 ──────────────────────────────────

  describe('框架/workflow 文件确认+备份（AC3）', () => {
    beforeEach(() => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })

      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST_WITH_WORKFLOW))
        }
        if (String(p).includes('workflow')) {
          return Promise.resolve('old workflow content')
        }
        return Promise.resolve('# Claude\n\n<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      })

      generateFileContentMock.mockResolvedValue('new workflow content')

      // 标记管理文件无差异（不触发更新）
      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      sectionManagerMock.replaceBmadSection.mockImplementation((content) => content) // 无变化
    })

    it('workflow 文件有差异时创建备份', async () => {
      await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // 应有备份调用（仅 workflow 文件）
      expect(fsMock.copy).toHaveBeenCalledTimes(1)
      const [, backupPath] = fsMock.copy.mock.calls[0]
      expect(backupPath).toMatch(/\.bak\.\d+$/)
    })

    it('交互模式下用户拒绝 workflow 更新，文件保持不变', async () => {
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

      // 标记文件 2 个跳过（无差异）+ workflow 1 个跳过（用户拒绝）
      expect(result.filesSkipped).toBe(3)
      expect(result.filesUpdated).toBe(0)
    })
  })

  // ─── AC4: --yes 模式自动覆盖 ──────────────────────────────────────────

  describe('--yes 模式自动覆盖（AC4）', () => {
    it('yes 模式下 workflow 文件不暂停确认，直接备份覆盖', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST_WITH_WORKFLOW))
        }
        if (String(p).includes('workflow')) {
          return Promise.resolve('old workflow content')
        }
        return Promise.resolve('# Claude\n\n<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      })

      generateFileContentMock.mockResolvedValue('new content')
      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')
      sectionManagerMock.replaceBmadSection.mockReturnValue('# Claude\n\n<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')

      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      // 标记文件 2 个 + workflow 1 个 = 3
      expect(result.filesUpdated).toBe(3)
      expect(result.skipped).toBe(false)
    })
  })

  // ─── AC5: --force 跳过版本门控 ────────────────────────────────────────

  describe('--force 跳过版本门控（AC5）', () => {
    it('版本相同但 force=true 时不跳过，执行更新流程', async () => {
      const sameVersionManifest = { ...MOCK_MANIFEST, templateVersion: '0.2.0' }
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(sameVersionManifest))
        }
        return Promise.resolve('# Claude\n\n<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      })

      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')
      sectionManagerMock.replaceBmadSection.mockReturnValue('# Claude\n\n<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')

      const result = await updateInitConfigs({
        yes: true,
        force: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result.skipped).toBe(false)
      expect(result.filesUpdated).toBe(2)
    })

    it('版本相同且 force=false 时跳过（默认行为）', async () => {
      const sameVersionManifest = { ...MOCK_MANIFEST, templateVersion: '0.2.0' }
      fsMock.pathExists.mockResolvedValue(true)
      fsMock.readFile.mockResolvedValue(JSON.stringify(sameVersionManifest))

      const result = await updateInitConfigs({
        yes: false,
        force: false,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result).toEqual({ skipped: true, filesUpdated: 0, filesSkipped: 0 })
    })
  })

  // ─── 向后兼容（无 action 字段）────────────────────────────────────────

  describe('向后兼容（无 action 字段）', () => {
    it('无 action 字段的 manifest 文件仍能正常处理', async () => {
      const legacyManifest = {
        ...MOCK_MANIFEST,
        files: [
          { path: 'CLAUDE.md', type: 'workspace-claude' },
          { path: 'my-project/CLAUDE.md', type: 'project-claude' },
        ],
      }

      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(legacyManifest))
        }
        return Promise.resolve('# Claude\n\n<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      })

      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')
      sectionManagerMock.replaceBmadSection.mockReturnValue('# Claude\n\n<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')

      const result = await updateInitConfigs({
        yes: true,
        cwd: '/workspace',
        currentVersion: '0.2.0',
      })

      expect(result.filesUpdated).toBe(2)
      expect(result.skipped).toBe(false)
    })
  })

  // ─── .bmad-init.json 更新 ──────────────────────────────────────────────

  describe('templateVersion 更新', () => {
    it('更新完成后 .bmad-init.json 中 templateVersion 更新', async () => {
      fsMock.pathExists.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) return Promise.resolve(true)
        return Promise.resolve(true)
      })
      fsMock.readFile.mockImplementation((p) => {
        if (String(p).includes('.bmad-init.json')) {
          return Promise.resolve(JSON.stringify(MOCK_MANIFEST))
        }
        return Promise.resolve('# Claude\n\n<!-- bmad-workspace-config -->\nold\n<!-- /bmad-workspace-config -->')
      })
      sectionManagerMock.extractBmadSection.mockReturnValue('<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')
      sectionManagerMock.replaceBmadSection.mockReturnValue('# Claude\n\n<!-- bmad-workspace-config -->\nnew\n<!-- /bmad-workspace-config -->')

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

  // ─── 异常处理 ─────────────────────────────────────────────────────────

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
