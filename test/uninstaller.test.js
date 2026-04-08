import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  collectUninstallTargets,
  displayCleanupPlan,
  backupFiles,
  executeUninstall,
  uninstall,
} from '../lib/uninstaller.js'
import { BmadError } from '../lib/errors.js'

// mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    readJson: vi.fn(),
    pathExists: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
  },
}))

// mock platform.js
vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn().mockReturnValue({
    getInstallPath: vi.fn().mockReturnValue('/home/user/.happycapy/agents/bmad-expert'),
  }),
}))

// mock output.js
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
}))

const CWD = '/workspace'
const INSTALL_PATH = '/home/user/.happycapy/agents/bmad-expert'
const FRAMEWORK_FILES = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'BOOTSTRAP.md', 'bmad-project-init.md']
const USER_DATA_PATHS = ['MEMORY.md', 'USER.md', 'memory/']

const MOCK_PKG = {
  version: '1.0.0',
  bmadExpert: {
    frameworkFiles: FRAMEWORK_FILES,
    userDataPaths: USER_DATA_PATHS,
  },
}

const MOCK_MANIFEST = {
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

describe('collectUninstallTargets', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
  })

  it('collects manifest files, _bmad/ dir, and agent framework files', async () => {
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return true
      if (p.endsWith('_bmad')) return true
      if (p === INSTALL_PATH) return true
      if (FRAMEWORK_FILES.some((f) => p.endsWith(f) && p.startsWith(INSTALL_PATH))) return true
      if (p === `${INSTALL_PATH}/MEMORY.md`) return true
      if (p === `${INSTALL_PATH}/USER.md`) return true
      return false
    })
    fsMock.readJson.mockResolvedValue(MOCK_MANIFEST)

    const plan = await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    expect(plan.toDelete.length).toBeGreaterThan(0)
    expect(plan.hasManifest).toBe(true)
    expect(plan.hasBmadDir).toBe(true)
  })

  it('preserves user data files (MEMORY.md, USER.md)', async () => {
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return false
      if (p.endsWith('_bmad')) return false
      if (p === INSTALL_PATH) return true
      if (p === `${INSTALL_PATH}/MEMORY.md`) return true
      if (p === `${INSTALL_PATH}/USER.md`) return true
      if (FRAMEWORK_FILES.some((f) => p === `${INSTALL_PATH}/${f}`)) return true
      return false
    })

    const plan = await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    expect(plan.toPreserve).toContain(`${INSTALL_PATH}/MEMORY.md`)
    expect(plan.toPreserve).toContain(`${INSTALL_PATH}/USER.md`)
    for (const p of plan.toDelete) {
      expect(p).not.toContain('MEMORY.md')
      expect(p).not.toContain('USER.md')
    }
  })

  it('returns empty toDelete when nothing is installed', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    const plan = await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    expect(plan.toDelete).toHaveLength(0)
    expect(plan.hasManifest).toBe(false)
    expect(plan.hasBmadDir).toBe(false)
  })

  it('skips manifest entries with path traversal (../ escaping cwd)', async () => {
    const maliciousManifest = {
      ...MOCK_MANIFEST,
      files: [
        { path: '../../etc/passwd', type: 'malicious' },
        { path: 'CLAUDE.md', type: 'workspace-claude' },
      ],
    }
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return true
      return false
    })
    fsMock.readJson.mockResolvedValue(maliciousManifest)

    const plan = await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    // Only the safe CLAUDE.md should be in toDelete, not ../../etc/passwd
    expect(plan.toDelete).toHaveLength(1)
    expect(plan.toDelete[0]).toContain('CLAUDE.md')
  })

  it('skips manifest entries with non-string or empty paths', async () => {
    const badManifest = {
      ...MOCK_MANIFEST,
      files: [
        { path: null, type: 'bad' },
        { path: '', type: 'bad' },
        { path: 'CLAUDE.md', type: 'workspace-claude' },
      ],
    }
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return true
      return false
    })
    fsMock.readJson.mockResolvedValue(badManifest)

    const plan = await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    expect(plan.toDelete).toHaveLength(1)
  })

  it('reads manifest only once (cached)', async () => {
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return true
      if (p.endsWith('_bmad')) return false
      return false
    })
    fsMock.readJson.mockResolvedValue(MOCK_MANIFEST)

    await collectUninstallTargets(CWD, INSTALL_PATH, FRAMEWORK_FILES, USER_DATA_PATHS)

    // readJson should be called only once (not twice)
    expect(fsMock.readJson).toHaveBeenCalledTimes(1)
  })
})

describe('displayCleanupPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls printProgress with plan details', async () => {
    const { printProgress } = await import('../lib/output.js')
    const plan = {
      toDelete: ['/workspace/CLAUDE.md', '/workspace/_bmad'],
      toPreserve: ['/home/user/.happycapy/agents/bmad-expert/MEMORY.md'],
    }

    displayCleanupPlan(plan)

    expect(printProgress).toHaveBeenCalledTimes(1)
    const output = printProgress.mock.calls[0][0]
    expect(output).toContain('将删除')
    expect(output).toContain('将保留')
    expect(output).toContain('MEMORY.md')
  })
})

describe('backupFiles', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.pathExists.mockResolvedValue(true)
  })

  it('copies all target files to .bmad-backup-{timestamp}/ directory', async () => {
    const plan = {
      toDelete: ['/workspace/CLAUDE.md', '/workspace/_bmad'],
    }

    const backupDir = await backupFiles(plan, '/workspace')

    expect(backupDir).toContain('.bmad-backup-')
    expect(fsMock.copy).toHaveBeenCalledTimes(2)
  })

  it('returns the backup directory path', async () => {
    const plan = { toDelete: ['/workspace/CLAUDE.md'] }

    const backupDir = await backupFiles(plan, '/workspace')

    expect(typeof backupDir).toBe('string')
    expect(backupDir).toContain('.bmad-backup-')
  })

  it('handles files outside cwd by flattening path into external/ subfolder', async () => {
    const plan = {
      toDelete: ['/home/user/.happycapy/agents/bmad-expert/SOUL.md'],
    }

    const backupDir = await backupFiles(plan, '/workspace')

    // Verify copy was called with a path inside backupDir (not the original absolute path)
    const [, destPath] = fsMock.copy.mock.calls[0]
    expect(destPath).toContain(backupDir)
    expect(destPath).toContain('external/')
  })

  it('throws BmadError E004 on copy failure', async () => {
    fsMock.copy.mockRejectedValueOnce(new Error('disk full'))
    const plan = { toDelete: ['/workspace/CLAUDE.md'] }

    await expect(backupFiles(plan, '/workspace')).rejects.toMatchObject({
      bmadCode: 'E004',
    })
  })
})

describe('executeUninstall', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
    fsMock.pathExists.mockResolvedValue(true)
  })

  it('removes all target files and returns count', async () => {
    const plan = {
      toDelete: ['/workspace/CLAUDE.md', '/workspace/_bmad'],
      hasManifest: true,
    }

    const count = await executeUninstall(plan, '/workspace')

    // 2 files + 1 manifest = 3
    expect(count).toBe(3)
    expect(fsMock.remove).toHaveBeenCalledTimes(3)
  })

  it('deletes .bmad-init.json last', async () => {
    const plan = {
      toDelete: ['/workspace/CLAUDE.md'],
      hasManifest: true,
    }

    await executeUninstall(plan, '/workspace')

    const removeCalls = fsMock.remove.mock.calls.map(([p]) => p)
    const manifestIndex = removeCalls.findIndex((p) => p.endsWith('.bmad-init.json'))
    expect(manifestIndex).toBe(removeCalls.length - 1)
  })

  it('collects errors per-item and throws after attempting all deletions', async () => {
    fsMock.remove
      .mockResolvedValueOnce(undefined) // first file OK
      .mockRejectedValueOnce(new Error('permission denied')) // second file fails

    const plan = {
      toDelete: ['/workspace/CLAUDE.md', '/workspace/_bmad'],
      hasManifest: false,
    }

    const err = await executeUninstall(plan, '/workspace').catch((e) => e)

    expect(err).toBeInstanceOf(BmadError)
    expect(err.bmadCode).toBe('E004')
    expect(err.message).toContain('已删除 1 项')
    expect(err.message).toContain('失败 1 项')
  })
})

describe('uninstall (main function)', () => {
  let fsMock

  beforeEach(async () => {
    vi.clearAllMocks()
    fsMock = (await import('fs-extra')).default
  })

  function setupInstalledState() {
    fsMock.readFile.mockImplementation(async (p) => {
      if (String(p).includes('package.json')) {
        return JSON.stringify(MOCK_PKG)
      }
      throw new Error('ENOENT')
    })
    fsMock.readJson.mockResolvedValue(MOCK_MANIFEST)
    fsMock.pathExists.mockImplementation(async (p) => {
      if (p.endsWith('.bmad-init.json')) return true
      if (p.endsWith('_bmad')) return true
      if (p === INSTALL_PATH) return true
      if (FRAMEWORK_FILES.some((f) => p === `${INSTALL_PATH}/${f}`)) return true
      return false
    })
  }

  it('throws BmadError E007 when nothing is installed', async () => {
    fsMock.readFile.mockImplementation(async (p) => {
      if (String(p).includes('package.json')) {
        return JSON.stringify(MOCK_PKG)
      }
      throw new Error('ENOENT')
    })
    fsMock.pathExists.mockResolvedValue(false)

    await expect(
      uninstall({ yes: true, cwd: CWD })
    ).rejects.toMatchObject({ bmadCode: 'E007' })
  })

  it('E007 error is BmadError instance', async () => {
    fsMock.readFile.mockImplementation(async (p) => {
      if (String(p).includes('package.json')) {
        return JSON.stringify(MOCK_PKG)
      }
      throw new Error('ENOENT')
    })
    fsMock.pathExists.mockResolvedValue(false)

    const err = await uninstall({ yes: true, cwd: CWD }).catch((e) => e)
    expect(err).toBeInstanceOf(BmadError)
  })

  it('--yes mode skips confirmation and executes cleanup', async () => {
    setupInstalledState()

    const result = await uninstall({ yes: true, cwd: CWD })

    expect(result.deleted).toBeGreaterThan(0)
    expect(result.message).toContain('卸载完成')
  })

  it('returns structured result with deleted/preserved/backedUp/message', async () => {
    setupInstalledState()

    const result = await uninstall({ yes: true, cwd: CWD })

    expect(typeof result.deleted).toBe('number')
    expect(typeof result.preserved).toBe('number')
    expect(typeof result.backedUp).toBe('boolean')
    expect(typeof result.message).toBe('string')
  })

  it('--backup mode triggers file backup and includes backupDir in result', async () => {
    setupInstalledState()

    const result = await uninstall({ yes: true, backup: true, cwd: CWD })

    expect(result.backedUp).toBe(true)
    expect(result.backupDir).toBeDefined()
    expect(result.backupDir).toContain('.bmad-backup-')
    expect(fsMock.copy).toHaveBeenCalled()
  })

  it('printSuccess is called with summary message', async () => {
    setupInstalledState()
    const { printSuccess } = await import('../lib/output.js')

    await uninstall({ yes: true, cwd: CWD })

    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('卸载完成'))
  })
})
