import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeInstall, writeSupplementFiles } from '../lib/orchestrator.js'
import { BmadError } from '../lib/errors.js'

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('content {{agent_id}} {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
}))

// replaceTemplateVars 直接返回原始 content，方便断言调用次数而不依赖真实替换逻辑
vi.mock('../lib/installer.js', () => ({
  replaceTemplateVars: vi.fn((content) => content),
}))

// ─── 获取 mock 引用 ──────────────────────────────────────────────────────────

import { execa } from 'execa'
import fs from 'fs-extra'
import { printProgress } from '../lib/output.js'
import { replaceTemplateVars } from '../lib/installer.js'

// ─── executeInstall ───────────────────────────────────────────────────────────

describe('executeInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功时以正确参数调用 execa（含 --yes）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', all: 'ok' })

    await executeInstall(['--modules', 'bmm', '--tools', 'claude-code'])

    expect(execa).toHaveBeenCalledWith(
      'npx',
      ['bmad-method', 'install', '--modules', 'bmm', '--tools', 'claude-code', '--yes'],
      expect.objectContaining({ all: true, reject: false })
    )
  })

  it('params 为空数组时仍追加 --yes', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', all: '' })

    await executeInstall([])

    expect(execa).toHaveBeenCalledWith(
      'npx',
      ['bmad-method', 'install', '--yes'],
      expect.objectContaining({ all: true, reject: false })
    )
  })

  it('成功时返回 { stdout, stderr }', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: 'install output', stderr: 'warn', all: 'install output\nwarn' })

    const result = await executeInstall([])

    expect(result).toEqual({ stdout: 'install output', stderr: 'warn' })
  })

  it('成功时调用 printProgress 完成标记（done=true）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', all: '' })

    await executeInstall([])

    expect(printProgress).toHaveBeenCalledWith('', true)
  })

  it('exitCode 非零时 throw BmadError("E001")', async () => {
    execa.mockResolvedValue({
      exitCode: 1,
      stdout: 'build output',
      stderr: 'install error',
      all: 'build output\ninstall error',
    })

    await expect(executeInstall([])).rejects.toMatchObject({
      bmadCode: 'E001',
      message: 'BMAD 官方安装器执行失败',
    })
  })

  it('exitCode 非零时错误上下文包含官方安装器输出', async () => {
    execa.mockResolvedValue({
      exitCode: 2,
      stdout: 'stdout content',
      stderr: '',
      all: 'stdout content',
    })

    let caught
    try {
      await executeInstall([])
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(BmadError)
    expect(caught.cause?.message).toContain('stdout content')
  })

  it('execa 抛出网络错误（ECONNREFUSED）时 throw BmadError("E005")', async () => {
    const networkErr = new Error('connect ECONNREFUSED')
    networkErr.code = 'ECONNREFUSED'
    execa.mockRejectedValue(networkErr)

    await expect(executeInstall([])).rejects.toMatchObject({
      bmadCode: 'E005',
      message: expect.stringContaining('网络错误'),
    })
  })

  it('execa 抛出非网络错误时 throw BmadError("E001")', async () => {
    const genericErr = new Error('npx not found')
    genericErr.code = 'ENOENT'
    execa.mockRejectedValue(genericErr)

    await expect(executeInstall([])).rejects.toMatchObject({
      bmadCode: 'E001',
      message: 'BMAD 官方安装器调用失败',
    })
  })

  it('结果 stdout/stderr 为 undefined 时返回空字符串（防 undefined 传递）', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: undefined, stderr: undefined, all: undefined })

    const result = await executeInstall([])

    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })
})

// ─── writeSupplementFiles ─────────────────────────────────────────────────────

describe('writeSupplementFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.ensureDir.mockResolvedValue(undefined)
    fs.readFile.mockResolvedValue('template content {{agent_id}}')
    fs.outputFile.mockResolvedValue(undefined)
  })

  it('调用 fs.ensureDir 确保目标目录存在', async () => {
    await writeSupplementFiles('/target/path')

    expect(fs.ensureDir).toHaveBeenCalledWith('/target/path')
  })

  it('写入全部 4 个补充文件（SOUL.md IDENTITY.md AGENTS.md BOOTSTRAP.md）', async () => {
    await writeSupplementFiles('/target/path')

    expect(fs.outputFile).toHaveBeenCalledTimes(4)

    const writtenPaths = fs.outputFile.mock.calls.map((call) => call[0])
    expect(writtenPaths).toEqual(
      expect.arrayContaining([
        expect.stringContaining('SOUL.md'),
        expect.stringContaining('IDENTITY.md'),
        expect.stringContaining('AGENTS.md'),
        expect.stringContaining('BOOTSTRAP.md'),
      ])
    )
  })

  it('所有文件写入到指定的 targetPath 下', async () => {
    await writeSupplementFiles('/my/agent/dir')

    for (const call of fs.outputFile.mock.calls) {
      expect(call[0]).toMatch(/^\/my\/agent\/dir/)
    }
  })

  it('调用 replaceTemplateVars 对每个文件进行变量替换', async () => {
    await writeSupplementFiles('/target/path')

    expect(replaceTemplateVars).toHaveBeenCalledTimes(4)
  })

  it('调用 replaceTemplateVars 时传入正确的变量对象（含 agentId/agentName/installDate）', async () => {
    await writeSupplementFiles('/target/path', { agentId: 'my-agent', agentName: 'My Agent' })

    expect(replaceTemplateVars).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        agentId: 'my-agent',
        agentName: 'My Agent',
        installDate: expect.any(String),
      })
    )
  })

  it('vars 未指定时使用默认值 agentId=bmad-expert', async () => {
    await writeSupplementFiles('/target/path')

    expect(replaceTemplateVars).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ agentId: 'bmad-expert' })
    )
  })

  it('成功时调用 printProgress 完成标记（done=true）', async () => {
    await writeSupplementFiles('/target/path')

    expect(printProgress).toHaveBeenCalledWith('', true)
  })

  it('ensureDir 抛出 EACCES 时 throw BmadError("E004", "补充文件写入失败")', async () => {
    const permErr = new Error('permission denied')
    permErr.code = 'EACCES'
    fs.ensureDir.mockRejectedValue(permErr)

    await expect(writeSupplementFiles('/target/path')).rejects.toMatchObject({
      bmadCode: 'E004',
      message: '补充文件写入失败',
    })
  })

  it('ensureDir 抛出 EPERM 时也 throw BmadError("E004")', async () => {
    const permErr = new Error('operation not permitted')
    permErr.code = 'EPERM'
    fs.ensureDir.mockRejectedValue(permErr)

    await expect(writeSupplementFiles('/target/path')).rejects.toMatchObject({
      bmadCode: 'E004',
    })
  })

  it('outputFile 抛出 EACCES 时 throw BmadError("E004", "补充文件写入失败")', async () => {
    const permErr = new Error('permission denied')
    permErr.code = 'EACCES'
    fs.outputFile.mockRejectedValue(permErr)

    await expect(writeSupplementFiles('/target/path')).rejects.toMatchObject({
      bmadCode: 'E004',
      message: '补充文件写入失败',
    })
  })

  it('outputFile 抛出普通 I/O 错误时 throw BmadError("E001")', async () => {
    const ioErr = new Error('ENOSPC: no space left on device')
    ioErr.code = 'ENOSPC'
    fs.outputFile.mockRejectedValue(ioErr)

    await expect(writeSupplementFiles('/target/path')).rejects.toMatchObject({
      bmadCode: 'E001',
    })
  })

  it('BmadError("E004") 的 retryable 为 true', async () => {
    const permErr = new Error('permission denied')
    permErr.code = 'EACCES'
    fs.ensureDir.mockRejectedValue(permErr)

    let caught
    try {
      await writeSupplementFiles('/target/path')
    } catch (err) {
      caught = err
    }

    expect(caught.retryable).toBe(true)
  })

  it('写入文件路径为 targetPath + 文件名（正确路径拼接）', async () => {
    await writeSupplementFiles('/base/path')

    const paths = fs.outputFile.mock.calls.map((c) => c[0])
    expect(paths).toContainEqual(expect.stringContaining('SOUL.md'))
    // 验证路径起点
    paths.forEach((p) => expect(p.startsWith('/base/path')).toBe(true))
  })
})
