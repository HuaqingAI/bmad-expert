import { describe, it, expect, vi, beforeEach } from 'vitest'
import { replaceTemplateVars, writeAgentFiles, checkInstallStatus } from '../lib/installer.js'
import { BmadError } from '../lib/errors.js'
import { printProgress } from '../lib/output.js'

// mock fs-extra — vi.mock 被 vitest 自动 hoist 到文件顶部执行
vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('Hello {{agent_id}} on {{install_date}}'),
    outputFile: vi.fn().mockResolvedValue(undefined),
  },
}))

// mock output.js — 防止真实 stdout 输出影响测试结果
vi.mock('../lib/output.js', () => ({
  printProgress: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
}))

// ─── replaceTemplateVars ───────────────────────────────────────────────────

describe('replaceTemplateVars', () => {
  it('替换所有已知变量', () => {
    const content =
      'Agent: {{agent_name}} ({{agent_id}}) installed {{install_date}} model={{model}}'
    const result = replaceTemplateVars(content, {
      agentId: 'bmad-expert',
      agentName: 'BMAD Expert',
      model: 'claude-sonnet',
      installDate: '2026-03-24',
    })
    expect(result).toBe('Agent: BMAD Expert (bmad-expert) installed 2026-03-24 model=claude-sonnet')
    expect(result).not.toMatch(/\{\{.*?\}\}/) // 无残留已知占位符
  })

  it('空值替换为空字符串（不报错，不保留占位符）', () => {
    const result = replaceTemplateVars('{{agent_id}}', { agentId: '' })
    expect(result).toBe('')
  })

  it('未传入变量时默认替换为空字符串', () => {
    const result = replaceTemplateVars('{{agent_id}} {{agent_name}}', {})
    expect(result).toBe(' ')
  })

  it('变量值含 $ 特殊字符时不产生 regex 副作用', () => {
    const result = replaceTemplateVars('{{agent_name}}', { agentName: 'Agent$2' })
    expect(result).toBe('Agent$2')
  })

  it('变量值含 $& 特殊字符时不扩展为匹配子串', () => {
    const result = replaceTemplateVars('{{agent_name}}', { agentName: '$&-suffix' })
    expect(result).toBe('$&-suffix')
  })

  it('多次出现的变量全部替换', () => {
    const content = '{{agent_id}} and {{agent_id}} again'
    const result = replaceTemplateVars(content, { agentId: 'my-agent' })
    expect(result).toBe('my-agent and my-agent again')
  })

  it('未知占位符（非 4 个已知变量）保持原样', () => {
    const result = replaceTemplateVars('{{unknown_var}}', {
      agentId: 'test',
      agentName: 'Test',
      model: '',
      installDate: '2026-03-24',
    })
    expect(result).toBe('{{unknown_var}}')
  })
})

// ─── writeAgentFiles ───────────────────────────────────────────────────────

describe('writeAgentFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('路径含 .. 路径段时抛出 BmadError E002', async () => {
    await expect(
      writeAgentFiles('/home/user/../etc/passwd', { agentId: 'test' })
    ).rejects.toMatchObject({ bmadCode: 'E002' })
  })

  it('路径含 .. 时抛出的错误是 BmadError 实例', async () => {
    await expect(writeAgentFiles('/tmp/../etc', { agentId: 'test' })).rejects.toBeInstanceOf(
      BmadError
    )
  })

  it('目录名包含 .. 但不是路径段时允许写入', async () => {
    const fsExtra = (await import('fs-extra')).default
    await expect(
      writeAgentFiles('/home/user/my..project/agents/test', { agentId: 'test' })
    ).resolves.toBeUndefined()
    expect(fsExtra.ensureDir).toHaveBeenCalledWith('/home/user/my..project/agents/test')
  })

  it('相对路径时抛出 BmadError E002', async () => {
    await expect(writeAgentFiles('relative/path', { agentId: 'test' })).rejects.toMatchObject({
      bmadCode: 'E002',
    })
  })

  it('正常路径时调用 ensureDir', async () => {
    const fsExtra = (await import('fs-extra')).default
    await writeAgentFiles('/home/user/.happycapy/agents/test', {
      agentId: 'test',
      agentName: 'Test Agent',
      model: '',
      installDate: '2026-03-24',
    })
    expect(fsExtra.ensureDir).toHaveBeenCalledWith('/home/user/.happycapy/agents/test')
  })

  it('正常路径时为 4 个框架文件各调用 outputFile 一次', async () => {
    const fsExtra = (await import('fs-extra')).default
    await writeAgentFiles('/home/user/.happycapy/agents/test', {
      agentId: 'test',
      agentName: 'Test Agent',
      model: 'claude-sonnet',
      installDate: '2026-03-24',
    })
    expect(fsExtra.outputFile).toHaveBeenCalledTimes(4)
  })

  it('写入内容中不存在未替换的 {{agent_id}} 占位符', async () => {
    const fsExtra = (await import('fs-extra')).default
    await writeAgentFiles('/home/user/.happycapy/agents/bmad-expert', {
      agentId: 'bmad-expert',
      agentName: 'BMAD Expert',
      model: '',
      installDate: '2026-03-24',
    })
    // mock readFile 返回 'Hello {{agent_id}} on {{install_date}}'
    // 替换后应为 'Hello bmad-expert on 2026-03-24'
    const calls = fsExtra.outputFile.mock.calls
    for (const [, content] of calls) {
      expect(content).not.toContain('{{agent_id}}')
      expect(content).not.toContain('{{install_date}}')
    }
  })

  it('创建目录权限失败时包装为 BmadError E004 并保留 cause', async () => {
    const fsExtra = (await import('fs-extra')).default
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    fsExtra.ensureDir.mockRejectedValueOnce(permissionError)

    await expect(
      writeAgentFiles('/home/user/.happycapy/agents/test', { agentId: 'test' })
    ).rejects.toMatchObject({
      bmadCode: 'E004',
      cause: permissionError,
    })
  })

  it('读取模板失败时包装为 BmadError E001 并保留 cause', async () => {
    const fsExtra = (await import('fs-extra')).default
    const ioError = Object.assign(new Error('missing template'), { code: 'ENOENT' })
    fsExtra.readFile.mockRejectedValueOnce(ioError)

    await expect(
      writeAgentFiles('/home/user/.happycapy/agents/test', { agentId: 'test' })
    ).rejects.toMatchObject({
      bmadCode: 'E001',
      cause: ioError,
    })
  })

  it('写入模板失败时包装为 BmadError E004 并保留 cause', async () => {
    const fsExtra = (await import('fs-extra')).default
    const permissionError = Object.assign(new Error('cannot write'), { code: 'EPERM' })
    fsExtra.outputFile.mockRejectedValueOnce(permissionError)

    await expect(
      writeAgentFiles('/home/user/.happycapy/agents/test', { agentId: 'test' })
    ).rejects.toMatchObject({
      bmadCode: 'E004',
      cause: permissionError,
    })
  })
})

// ─── checkInstallStatus ────────────────────────────────────────────────────

describe('checkInstallStatus', () => {
  let mockAdapter

  beforeEach(() => {
    mockAdapter = { check: vi.fn() }
    vi.clearAllMocks()
  })

  it('status 为 installed 时抛出 BmadError 实例', async () => {
    mockAdapter.check.mockResolvedValueOnce('installed')
    await expect(checkInstallStatus(mockAdapter, 'bmad-expert')).rejects.toBeInstanceOf(BmadError)
  })

  it('status 为 installed 时抛出 bmadCode 为 E006 的错误', async () => {
    mockAdapter.check.mockResolvedValueOnce('installed')
    await expect(checkInstallStatus(mockAdapter, 'bmad-expert')).rejects.toMatchObject({
      bmadCode: 'E006',
    })
  })

  it('status 为 corrupted 时返回 { status: corrupted }，不抛出', async () => {
    mockAdapter.check.mockResolvedValueOnce('corrupted')
    const result = await checkInstallStatus(mockAdapter, 'bmad-expert')
    expect(result).toMatchObject({ status: 'corrupted' })
    expect(printProgress).toHaveBeenCalledWith('检测到安装损坏，将重新安装...')
  })

  it('status 为 not_installed 时返回 { status: not_installed }，不抛出', async () => {
    mockAdapter.check.mockResolvedValueOnce('not_installed')
    const result = await checkInstallStatus(mockAdapter, 'bmad-expert')
    expect(result).toMatchObject({ status: 'not_installed' })
  })

  it('调用 adapter.check 时传入正确的 agentId', async () => {
    mockAdapter.check.mockResolvedValueOnce('not_installed')
    await checkInstallStatus(mockAdapter, 'my-custom-agent')
    expect(mockAdapter.check).toHaveBeenCalledWith('my-custom-agent')
  })
})
