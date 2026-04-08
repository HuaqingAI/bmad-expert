import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectWorkspaceStructure, collectProjectInfo, generateFiles, writeManifest, init } from '../lib/initializer.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    readdir: vi.fn(),
    pathExists: vi.fn(),
    readFile: vi.fn(),
    outputFile: vi.fn(),
    ensureDir: vi.fn(),
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
  }),
}))

const WORKSPACE = '/workspace'

describe('detectWorkspaceStructure', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
  })

  // ─── 单项目 workspace ──────────────────────────────────────────────

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

  // ─── 多项目 workspace ──────────────────────────────────────────────

  it('检测到多个项目目录', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: 'project-a', isDirectory: () => true },
      { name: 'project-b', isDirectory: () => true },
    ])
    // project-a: has .git
    fsMock.pathExists
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
      // project-b: has .git
      .mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(2)
  })

  // ─── 无项目目录 ────────────────────────────────────────────────────

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

  // ─── 跳过隐藏目录和 node_modules ──────────────────────────────────

  it('跳过 . 开头的隐藏目录', async () => {
    fsMock.readdir.mockResolvedValue([
      { name: '.hidden', isDirectory: () => true },
      { name: 'real-project', isDirectory: () => true },
    ])
    // real-project: has .git
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
    // my-app: has package.json
    fsMock.pathExists
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const result = await detectWorkspaceStructure(WORKSPACE)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('my-app')
  })
})

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
  })

  it('生成 3 个文件（workspace CLAUDE.md + project CLAUDE.md + workflow）', async () => {
    const files = await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: true,
    })
    expect(files).toHaveLength(3)
  })

  it('workspace CLAUDE.md 包含正确的项目名', async () => {
    await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: true,
    })
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).endsWith('/CLAUDE.md') && !String(p).includes('my-app')
    )
    expect(writeCall).toBeDefined()
    expect(writeCall[1]).toContain('my-app')
    expect(writeCall[1]).not.toContain('PROJECT_NAME')
  })

  it('project CLAUDE.md 包含正确的项目名', async () => {
    await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: true,
    })
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).includes('my-app/CLAUDE.md')
    )
    expect(writeCall).toBeDefined()
    expect(writeCall[1]).toContain('my-app')
    expect(writeCall[1]).not.toContain('PROJECT_NAME')
  })

  it('workspace CLAUDE.md 中 PROJECT_PATH 被替换为实际路径', async () => {
    await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: true,
    })
    const writeCall = fsMock.outputFile.mock.calls.find(([p]) =>
      String(p).endsWith('/CLAUDE.md') && !String(p).includes('my-app')
    )
    expect(writeCall[1]).not.toContain('PROJECT_PATH')
  })

  it('generateWorkflow=false 时不生成 workflow 文件', async () => {
    const files = await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: false,
    })
    expect(files).toHaveLength(2)
    expect(files.every((f) => f.type !== 'workflow')).toBe(true)
  })

  it('files 数组包含正确的类型标签', async () => {
    const files = await generateFiles(WORKSPACE, {
      projectName: 'my-app',
      projectPath: 'my-app',
      generateWorkflow: true,
    })
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'workspace-claude' }),
        expect.objectContaining({ type: 'project-claude' }),
        expect.objectContaining({ type: 'workflow' }),
      ])
    )
  })

  it('文件写入失败时抛出 BmadError E004', async () => {
    fsMock.outputFile.mockRejectedValue(new Error('EACCES'))

    await expect(
      generateFiles(WORKSPACE, {
        projectName: 'my-app',
        projectPath: 'my-app',
        generateWorkflow: true,
      })
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })
})

describe('writeManifest', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.outputFile.mockResolvedValue(undefined)
  })

  it('写入 .bmad-init.json 到 workspace 根目录', async () => {
    await writeManifest(WORKSPACE, [{ path: 'CLAUDE.md', type: 'workspace-claude' }], 'my-app')
    expect(fsMock.outputFile).toHaveBeenCalledWith(
      expect.stringContaining('.bmad-init.json'),
      expect.any(String)
    )
  })

  it('清单包含 version、templateVersion、defaultProject、files 字段', async () => {
    const files = [{ path: 'CLAUDE.md', type: 'workspace-claude' }]
    await writeManifest(WORKSPACE, files, 'my-app')

    const written = JSON.parse(fsMock.outputFile.mock.calls[0][1])
    expect(written).toMatchObject({
      version: '1.0.0',
      templateVersion: '1.0.0',
      defaultProject: 'my-app',
      files,
    })
    expect(written.createdAt).toBeDefined()
  })

  it('写入失败时抛出 BmadError E004', async () => {
    fsMock.outputFile.mockRejectedValue(new Error('EACCES'))

    await expect(
      writeManifest(WORKSPACE, [], 'my-app')
    ).rejects.toMatchObject({ bmadCode: 'E004' })
  })
})

describe('init 主函数', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default

    // 默认：单项目 workspace
    fsMock.readdir.mockResolvedValue([
      { name: 'my-project', isDirectory: () => true },
    ])
    fsMock.pathExists
      .mockResolvedValueOnce(true)   // .git
      .mockResolvedValueOnce(false)  // _bmad
      .mockResolvedValueOnce(false)  // package.json

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
  })

  it('--yes 模式完整流程返回结果', async () => {
    const result = await init({ yes: true, cwd: WORKSPACE })
    expect(result).toMatchObject({
      defaultProject: 'my-project',
      files: expect.any(Array),
    })
    expect(result.files).toHaveLength(3)
  })

  it('--yes 模式调用 printProgress 和 printSuccess', async () => {
    const { printProgress, printSuccess } = await import('../lib/output.js')
    await init({ yes: true, cwd: WORKSPACE })
    expect(printProgress).toHaveBeenCalled()
    expect(printSuccess).toHaveBeenCalled()
  })

  it('--yes 模式写入 .bmad-init.json', async () => {
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
