import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectWorkspaceStructure,
  collectProjectInfo,
  generateFiles,
  writeManifest,
  checkExistingFiles,
  resolveConflicts,
  backupFile,
  generateDiff,
  init,
} from '../lib/initializer.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    readdir: vi.fn(),
    pathExists: vi.fn(),
    readFile: vi.fn(),
    outputFile: vi.fn(),
    ensureDir: vi.fn(),
    copy: vi.fn(),
  },
}))

// mock output.js — 防止真实 stdout 输出影响测试结果
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  setJsonMode: vi.fn(),
  getJsonMode: vi.fn(),
  printJSON: vi.fn(),
}))

// mock readline — 控制交互式输入
vi.mock('readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn((_, cb) => cb('Y')),
    close: vi.fn(),
    on: vi.fn(),
  }),
}))

const WORKSPACE = '/workspace'

// ═══════════════════════════════════════════════════════════════════════════════
// detectWorkspaceStructure
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectWorkspaceStructure', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
  })

  it('识别含 .git/ 的子目录为项目', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'my-project', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // .git
      .mockResolvedValueOnce(false)  // _bmad
      .mockResolvedValueOnce(false)  // package.json

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0]).toEqual({ name: 'my-project', path: 'my-project' })
  })

  it('识别含 _bmad/ 的子目录为项目', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'another-project', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(false)  // .git
      .mockResolvedValueOnce(true)   // _bmad
      .mockResolvedValueOnce(false)  // package.json

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('another-project')
  })

  it('识别含 package.json 的子目录为项目', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'node-app', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(false)  // .git
      .mockResolvedValueOnce(false)  // _bmad
      .mockResolvedValueOnce(true)   // package.json

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('node-app')
  })

  it('检测到多个项目目录', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'project-a', isDirectory: () => true },
      { name: 'project-b', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(2)
  })

  it('无项目目录时抛出 BmadError E002', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'docs', isDirectory: () => true },
    ])
    fsMock.pathExists.mockResolvedValue(false)

    await expect(detectWorkspaceStructure(WORKSPACE)).rejects.toMatchObject({
      bmadCode: 'E002',
    })
  })

  it('空目录时抛出 BmadError E002', async () => {
    fsMock.readdir.mockResolvedValue([])

    await expect(detectWorkspaceStructure(WORKSPACE)).rejects.toMatchObject({
      bmadCode: 'E002',
    })
  })

  it('跳过 . 开头的隐藏目录', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: '.hidden', isDirectory: () => true },
      { name: 'real-project', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('real-project')
  })

  it('跳过 node_modules 目录', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'node_modules', isDirectory: () => true },
      { name: 'my-app', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('my-app')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// collectProjectInfo
// ═══════════════════════════════════════════════════════════════════════════════

describe('collectProjectInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('--yes 模式单项目自动选中', async () => {
    const info = await collectProjectInfo(
      { projects: [{ name: 'my-project', path: 'my-project' }] },
      { yes: true }
    )
    expect(info.projectName).toBe('my-project')
    expect(info.projectPath).toBe('my-project')
    expect(info.generateWorkflow).toBe(true)
  })

  it('--yes 模式多项目选第一个', async () => {
    const info = await collectProjectInfo(
      {
        projects: [
          { name: 'alpha', path: 'alpha' },
          { name: 'beta', path: 'beta' },
        ],
      },
      { yes: true }
    )
    expect(info.projectName).toBe('alpha')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// checkExistingFiles (Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkExistingFiles', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
  })

  it('无已有文件时 exists 全为 false', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const result = await checkExistingFiles(WORKSPACE, [
      { path: 'CLAUDE.md', type: 'workspace-claude', content: 'new' },
      { path: 'app/CLAUDE.md', type: 'project-claude', content: 'new' },
    ])

    expect(result).toHaveLength(2)
    expect(result.every((f) => f.exists === false)).toBe(true)
  })

  it('部分已有文件时正确标记 exists', async () => {
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // CLAUDE.md exists
      .mockResolvedValueOnce(false)  // app/CLAUDE.md not exists

    const result = await checkExistingFiles(WORKSPACE, [
      { path: 'CLAUDE.md', type: 'workspace-claude', content: 'new' },
      { path: 'app/CLAUDE.md', type: 'project-claude', content: 'new' },
    ])

    expect(result[0].exists).toBe(true)
    expect(result[1].exists).toBe(false)
  })

  it('全部已有文件时 exists 全为 true', async () => {
    fsMock.pathExists.mockResolvedValue(true)

    const result = await checkExistingFiles(WORKSPACE, [
      { path: 'CLAUDE.md', type: 'workspace-claude', content: 'new' },
    ])

    expect(result[0].exists).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// backupFile (Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('backupFile', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.copy.mockResolvedValue(undefined)
  })

  it('备份文件路径包含 .bak. 和时间戳', async () => {
    const backupPath = await backupFile(WORKSPACE, 'CLAUDE.md')
    expect(backupPath).toMatch(/^CLAUDE\.md\.bak\.\d+$/)
  })

  it('调用 fs.copy 从原路径复制到备份路径', async () => {
    await backupFile(WORKSPACE, 'CLAUDE.md')
    expect(fsMock.copy).toHaveBeenCalledWith(
      expect.stringContaining('CLAUDE.md'),
      expect.stringMatching(/CLAUDE\.md\.bak\.\d+/)
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// generateDiff (Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateDiff', () => {
  it('相同内容无差异标记', () => {
    const diff = generateDiff('line1\nline2', 'line1\nline2')
    expect(diff).not.toContain('-')
    expect(diff).not.toContain('+')
  })

  it('差异行用 - 和 + 标记', () => {
    const diff = generateDiff('old line', 'new line')
    expect(diff).toContain('- old line')
    expect(diff).toContain('+ new line')
  })

  it('新内容多出行用 + 标记', () => {
    const diff = generateDiff('line1', 'line1\nline2')
    expect(diff).toContain('+ line2')
  })

  it('旧内容多出行用 - 标记', () => {
    const diff = generateDiff('line1\nline2', 'line1')
    expect(diff).toContain('- line2')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// resolveConflicts (Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveConflicts', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.copy.mockResolvedValue(undefined)
    fsMock.readFile.mockResolvedValue('existing content')
  })

  it('不存在的文件 action=created', async () => {
    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new', exists: false }],
      { yes: true }
    )
    expect(result[0].action).toBe('created')
  })

  it('--yes 模式已有文件 action=skipped', async () => {
    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new', exists: true }],
      { yes: true }
    )
    expect(result[0].action).toBe('skipped')
  })

  it('--yes 模式混合场景：已有跳过 + 新文件创建', async () => {
    const result = await resolveConflicts(
      WORKSPACE,
      [
        { path: 'CLAUDE.md', type: 'workspace-claude', content: 'new', exists: true },
        { path: 'app/CLAUDE.md', type: 'project-claude', content: 'new', exists: false },
      ],
      { yes: true }
    )
    expect(result[0].action).toBe('skipped')
    expect(result[1].action).toBe('created')
  })

  it('交互模式选择覆盖时调用 backupFile', async () => {
    const { createInterface } = await import('readline')
    createInterface.mockReturnValue({
      question: vi.fn((_, cb) => cb('1')),
      close: vi.fn(),
      on: vi.fn(),
    })

    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new', exists: true }],
      {}
    )
    expect(result[0].action).toBe('overwritten')
    expect(fsMock.copy).toHaveBeenCalled()
  })

  it('交互模式选择跳过时 action=skipped', async () => {
    const { createInterface } = await import('readline')
    createInterface.mockReturnValue({
      question: vi.fn((_, cb) => cb('2')),
      close: vi.fn(),
      on: vi.fn(),
    })

    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new', exists: true }],
      {}
    )
    expect(result[0].action).toBe('skipped')
  })

  it('交互模式选择查看 diff 后确认覆盖', async () => {
    const { createInterface } = await import('readline')
    let callCount = 0
    createInterface.mockReturnValue({
      question: vi.fn((_, cb) => {
        callCount++
        cb(callCount === 1 ? '3' : 'y')
      }),
      close: vi.fn(),
      on: vi.fn(),
    })

    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new content', exists: true }],
      {}
    )
    expect(result[0].action).toBe('overwritten')
    expect(fsMock.copy).toHaveBeenCalled()
    expect(fsMock.readFile).toHaveBeenCalled()
  })

  it('交互模式选择查看 diff 后拒绝覆盖', async () => {
    const { createInterface } = await import('readline')
    let callCount = 0
    createInterface.mockReturnValue({
      question: vi.fn((_, cb) => {
        callCount++
        cb(callCount === 1 ? '3' : 'N')
      }),
      close: vi.fn(),
      on: vi.fn(),
    })

    const result = await resolveConflicts(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', content: 'new content', exists: true }],
      {}
    )
    expect(result[0].action).toBe('skipped')
    expect(fsMock.copy).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// generateFiles (with conflict handling, Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateFiles', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default

    // 模板文件内容
    fsMock.readFile.mockImplementation((p) => {
      const path = String(p)
      if (path.includes('workspace-claude.md')) {
        return Promise.resolve('Default project: PROJECT_NAME\nPath: PROJECT_PATH/')
      }
      if (path.includes('project-claude.md')) {
        return Promise.resolve('# CLAUDE.md — PROJECT_NAME')
      }
      if (path.includes('workflow-single-repo.md')) {
        return Promise.resolve('# Story Development Workflow')
      }
      return Promise.resolve('')
    })
    fsMock.outputFile.mockResolvedValue(undefined)
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.copy.mockResolvedValue(undefined)
  })

  it('首次运行：生成 3 个文件，action 全为 created', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const files = await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    expect(files).toHaveLength(3)
    expect(files.every((f) => f.action === 'created')).toBe(true)
  })

  it('workspace CLAUDE.md 包含正确的项目名', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).endsWith('/CLAUDE.md') && !String(p).includes('my-app')
    )
    expect(writeCall).toBeDefined()
    expect(writeCall[1]).toContain('my-app')
    expect(writeCall[1]).not.toContain('PROJECT_NAME')
  })

  it('project CLAUDE.md 包含正确的项目名', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).includes('my-app/CLAUDE.md')
    )
    expect(writeCall).toBeDefined()
    expect(writeCall[1]).toContain('my-app')
    expect(writeCall[1]).not.toContain('PROJECT_NAME')
  })

  it('workspace CLAUDE.md 中 PROJECT_PATH 被替换为实际路径', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).endsWith('/CLAUDE.md') && !String(p).includes('my-app')
    )
    expect(writeCall[1]).not.toContain('PROJECT_PATH')
  })

  it('generateWorkflow=false 时不生成 workflow 文件', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const files = await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: false },
      { yes: true }
    )
    expect(files).toHaveLength(2)
    expect(files.every((f) => f.type !== 'workflow')).toBe(true)
  })

  it('files 数组包含正确的类型标签', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const files = await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'workspace-claude' }),
        expect.objectContaining({ type: 'project-claude' }),
        expect.objectContaining({ type: 'workflow' }),
      ])
    )
  })

  it('文件写入失败时抛出 BmadError E004', async () => {
    fsMock.pathExists.mockResolvedValue(false)
    fsMock.outputFile.mockRejectedValue(new Error('EACCES'))

    await expect(
      generateFiles(
        WORKSPACE,
        { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
        { yes: true }
      )
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })

  // ─── Story 10-3: 幂等保护场景 ─────────────────────────────────────────

  it('重复运行 --yes：已有文件被跳过不写入', async () => {
    // 所有文件已存在
    fsMock.pathExists.mockResolvedValue(true)

    const files = await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    expect(files).toHaveLength(3)
    expect(files.every((f) => f.action === 'skipped')).toBe(true)
    // outputFile 不应被调用（跳过所有文件）
    expect(fsMock.outputFile).not.toHaveBeenCalled()
  })

  it('部分已有文件 --yes：已有跳过 + 新文件创建', async () => {
    // CLAUDE.md exists, app/CLAUDE.md not exists, workflow not exists
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // workspace CLAUDE.md
      .mockResolvedValueOnce(false)  // project CLAUDE.md
      .mockResolvedValueOnce(false)  // workflow

    const files = await generateFiles(
      WORKSPACE,
      { projectName: 'my-app', projectPath: 'my-app', generateWorkflow: true },
      { yes: true }
    )
    expect(files[0].action).toBe('skipped')
    expect(files[1].action).toBe('created')
    expect(files[2].action).toBe('created')
    // outputFile called for 2 created files only
    expect(fsMock.outputFile).toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// writeManifest (with incremental merge, Story 10-3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('writeManifest', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.outputFile.mockResolvedValue(undefined)
  })

  it('首次写入 .bmad-init.json 包含 version 和 createdAt', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    await writeManifest(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', action: 'created' }],
      'my-app'
    )

    const written = JSON.parse(fsMock.outputFile.mock.calls[0][1])
    expect(written).toMatchObject({
      version: '1.0.0',
      templateVersion: '1.0.0',
      defaultProject: 'my-app',
    })
    expect(written.createdAt).toBeDefined()
    expect(written.files).toHaveLength(1)
  })

  it('增量更新：已有清单保留 createdAt，新增 updatedAt', async () => {
    const existingManifest = {
      version: '1.0.0',
      createdAt: '2026-04-01T00:00:00Z',
      templateVersion: '1.0.0',
      defaultProject: 'my-app',
      files: [{ path: 'CLAUDE.md', type: 'workspace-claude' }],
    }
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readFile.mockResolvedValue(JSON.stringify(existingManifest))

    await writeManifest(
      WORKSPACE,
      [
        { path: 'CLAUDE.md', type: 'workspace-claude', action: 'skipped' },
        { path: 'app/CLAUDE.md', type: 'project-claude', action: 'created' },
      ],
      'my-app'
    )

    const written = JSON.parse(fsMock.outputFile.mock.calls[0][1])
    expect(written.createdAt).toBe('2026-04-01T00:00:00Z')
    expect(written.updatedAt).toBeDefined()
    expect(written.files).toHaveLength(2)
  })

  it('增量更新：合并已有和新增文件记录', async () => {
    const existingManifest = {
      version: '1.0.0',
      createdAt: '2026-04-01T00:00:00Z',
      templateVersion: '1.0.0',
      defaultProject: 'my-app',
      files: [
        { path: 'CLAUDE.md', type: 'workspace-claude' },
        { path: 'old-file.md', type: 'custom' },
      ],
    }
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readFile.mockResolvedValue(JSON.stringify(existingManifest))

    await writeManifest(
      WORKSPACE,
      [
        { path: 'CLAUDE.md', type: 'workspace-claude', action: 'skipped' },
        { path: 'app/CLAUDE.md', type: 'project-claude', action: 'created' },
      ],
      'my-app'
    )

    const written = JSON.parse(fsMock.outputFile.mock.calls[0][1])
    const paths = written.files.map((f) => f.path)
    expect(paths).toContain('CLAUDE.md')
    expect(paths).toContain('old-file.md')
    expect(paths).toContain('app/CLAUDE.md')
  })

  it('写入失败时抛出 BmadError E004', async () => {
    fsMock.pathExists.mockResolvedValue(false)
    fsMock.outputFile.mockRejectedValue(new Error('EACCES'))

    await expect(
      writeManifest(WORKSPACE, [], 'my-app')
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })

  it('损坏的 .bmad-init.json 降级为首次写入', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readFile.mockResolvedValue('not valid json{{{')

    await writeManifest(
      WORKSPACE,
      [{ path: 'CLAUDE.md', type: 'workspace-claude', action: 'created' }],
      'my-app'
    )

    const written = JSON.parse(fsMock.outputFile.mock.calls[0][1])
    expect(written.version).toBe('1.0.0')
    expect(written.createdAt).toBeDefined()
    expect(written.updatedAt).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// init 主函数
// ═══════════════════════════════════════════════════════════════════════════════

describe('init 主函数', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default

    // 默认：单项目 workspace
    fsMock.readdir.mockResolvedValue([
      { name: 'my-project', isDirectory: () => true },
    ])

    // 模板文件内容
    fsMock.readFile.mockImplementation((p) => {
      const path = String(p)
      if (path.includes('workspace-claude.md')) {
        return Promise.resolve('PROJECT_NAME at PROJECT_PATH')
      }
      if (path.includes('project-claude.md')) {
        return Promise.resolve('# PROJECT_NAME')
      }
      if (path.includes('workflow-single-repo.md')) {
        return Promise.resolve('# Workflow')
      }
      return Promise.resolve('')
    })
    fsMock.outputFile.mockResolvedValue(undefined)
    fsMock.ensureDir.mockResolvedValue(undefined)
    fsMock.copy.mockResolvedValue(undefined)
  })

  it('--yes 模式首次运行返回结果', async () => {
    // detectWorkspaceStructure pathExists: .git=true, _bmad=false, package.json=false
    // generateFiles checkExistingFiles pathExists: all false (first run)
    // writeManifest pathExists: false (no existing manifest)
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // .git
      .mockResolvedValueOnce(false)  // _bmad
      .mockResolvedValueOnce(false)  // package.json
      .mockResolvedValueOnce(false)  // CLAUDE.md exists check
      .mockResolvedValueOnce(false)  // project CLAUDE.md exists check
      .mockResolvedValueOnce(false)  // workflow exists check
      .mockResolvedValueOnce(false)  // .bmad-init.json exists check

    const result = await init({ yes: true, cwd: WORKSPACE })
    expect(result).toMatchObject({
      defaultProject: 'my-project',
      files: expect.any(Array),
    })
    expect(result.files).toHaveLength(3)
    expect(result.files.every((f) => f.action === 'created')).toBe(true)
  })

  it('--yes 模式重复运行已有文件被跳过', async () => {
    // detectWorkspaceStructure pathExists: .git=true, _bmad=false, package.json=false
    // generateFiles checkExistingFiles pathExists: all true (repeat run)
    // writeManifest pathExists: true (existing manifest)
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // .git
      .mockResolvedValueOnce(false)  // _bmad
      .mockResolvedValueOnce(false)  // package.json
      .mockResolvedValueOnce(true)   // CLAUDE.md exists
      .mockResolvedValueOnce(true)   // project CLAUDE.md exists
      .mockResolvedValueOnce(true)   // workflow exists
      .mockResolvedValueOnce(true)   // .bmad-init.json exists

    fsMock.readFile.mockImplementation((p) => {
      const path = String(p)
      if (path.includes('.bmad-init.json')) {
        return Promise.resolve(JSON.stringify({
          version: '1.0.0',
          createdAt: '2026-04-01T00:00:00Z',
          templateVersion: '1.0.0',
          defaultProject: 'my-project',
          files: [
            { path: 'CLAUDE.md', type: 'workspace-claude' },
            { path: 'my-project/CLAUDE.md', type: 'project-claude' },
            { path: 'my-project/workflow/story-dev-workflow-single-repo.md', type: 'workflow' },
          ],
        }))
      }
      if (path.includes('workspace-claude.md')) return Promise.resolve('PROJECT_NAME at PROJECT_PATH')
      if (path.includes('project-claude.md')) return Promise.resolve('# PROJECT_NAME')
      if (path.includes('workflow-single-repo.md')) return Promise.resolve('# Workflow')
      return Promise.resolve('')
    })

    const result = await init({ yes: true, cwd: WORKSPACE })
    expect(result.files).toHaveLength(3)
    expect(result.files.every((f) => f.action === 'skipped')).toBe(true)
  })

  it('--yes 模式调用 printProgress 和 printSuccess', async () => {
    fsMock.pathExists
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      .mockResolvedValue(false)

    const { printProgress, printSuccess } = await import('../lib/output.js')
    await init({ yes: true, cwd: WORKSPACE })
    expect(printProgress).toHaveBeenCalled()
    expect(printSuccess).toHaveBeenCalled()
  })

  it('--yes 模式写入 .bmad-init.json', async () => {
    fsMock.pathExists
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      .mockResolvedValue(false)

    await init({ yes: true, cwd: WORKSPACE })
    const manifestCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).includes('.bmad-init.json')
    )
    expect(manifestCall).toBeDefined()
  })

  it('无项目目录时抛出 BmadError E002', async () => {
    fsMock.readdir.mockResolvedValue([])

    await expect(init({ yes: true, cwd: WORKSPACE })).rejects.toMatchObject({
      bmadCode: 'E002',
    })
  })
})
