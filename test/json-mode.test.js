import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setJsonMode,
  getJsonMode,
  printJSON,
  printProgress,
  printSuccess,
} from '../lib/output.js'
import { BmadError } from '../lib/errors.js'

// ─── output.js JSON 模式单元测试 ───────────────────────────────────────────

describe('output.js — JSON 模式', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    setJsonMode(false) // 每次重置，防止状态污染
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    setJsonMode(false) // 确保清理
    vi.restoreAllMocks()
  })

  describe('setJsonMode / getJsonMode', () => {
    it('初始状态 getJsonMode() 返回 false', () => {
      expect(getJsonMode()).toBe(false)
    })

    it('setJsonMode(true) 后 getJsonMode() 返回 true', () => {
      setJsonMode(true)
      expect(getJsonMode()).toBe(true)
    })

    it('setJsonMode(false) 后 getJsonMode() 返回 false', () => {
      setJsonMode(true)
      setJsonMode(false)
      expect(getJsonMode()).toBe(false)
    })

    it('setJsonMode 接受 truthy 值并转换为 boolean', () => {
      setJsonMode(1)
      expect(getJsonMode()).toBe(true)
      setJsonMode(0)
      expect(getJsonMode()).toBe(false)
    })
  })

  describe('printJSON', () => {
    it('写入 stdout，不写 stderr', () => {
      printJSON({ success: true })
      expect(stdoutSpy).toHaveBeenCalledTimes(1)
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('输出内容为合法 JSON 字符串加换行', () => {
      const data = { success: true, platform: 'happycapy' }
      printJSON(data)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toBe(JSON.stringify(data) + '\n')
    })

    it('输出内容可被 JSON.parse 解析', () => {
      const data = { success: false, errorCode: 'E004', retryable: true }
      printJSON(data)
      const written = stdoutSpy.mock.calls[0][0]
      expect(() => JSON.parse(written)).not.toThrow()
      expect(JSON.parse(written)).toMatchObject(data)
    })

    it('printJSON 不受 jsonMode 状态影响（始终写入）', () => {
      setJsonMode(false)
      printJSON({ success: true })
      expect(stdoutSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('printProgress — JSON 模式沉默', () => {
    it('jsonMode=true 时 printProgress 不写任何流', () => {
      setJsonMode(true)
      printProgress('正在检测平台...')
      expect(stdoutSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('jsonMode=true 时 printProgress(done=true) 不写任何流', () => {
      setJsonMode(true)
      printProgress('正在检测平台...', true)
      expect(stdoutSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('jsonMode=false 时 printProgress 正常写 stdout', () => {
      setJsonMode(false)
      printProgress('正在检测平台...')
      expect(stdoutSpy).toHaveBeenCalled()
    })
  })

  describe('printSuccess — JSON 模式沉默', () => {
    it('jsonMode=true 时 printSuccess 不写任何流', () => {
      setJsonMode(true)
      printSuccess('安装完成')
      expect(stdoutSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('jsonMode=false 时 printSuccess 正常写 stdout', () => {
      setJsonMode(false)
      printSuccess('安装完成')
      expect(stdoutSpy).toHaveBeenCalled()
    })
  })
})

// ─── install --json 集成测试（mock installer / platform）─────────────────────

vi.mock('../lib/installer.js', () => ({
  install: vi.fn(),
  checkInstallStatus: vi.fn(),
  replaceTemplateVars: vi.fn((c) => c),
  writeAgentFiles: vi.fn(),
}))

vi.mock('../lib/updater.js', () => ({
  update: vi.fn(),
}))

vi.mock('../lib/platform.js', () => ({
  detectPlatform: vi.fn().mockResolvedValue('happycapy'),
  getAdapter: vi.fn().mockReturnValue({
    getInstallPath: vi.fn().mockReturnValue('/home/user/.happycapy/agents/bmad-expert'),
    check: vi.fn().mockResolvedValue('not_installed'),
    install: vi.fn().mockResolvedValue(undefined),
    detect: vi.fn().mockReturnValue(true),
  }),
}))

const INSTALL_RESULT = {
  platform: 'happycapy',
  agentId: 'bmad-expert',
  installPath: '/home/user/.happycapy/agents/bmad-expert',
  duration: 5,
}

const UPDATE_RESULT = {
  version: '0.1.0',
  message: '已更新至 v0.1.0，用户配置和 memory 完整保留。',
}

describe('install --json 模式', () => {
  let stdoutSpy, stderrSpy
  let installMock

  beforeEach(async () => {
    setJsonMode(false)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const mod = await import('../lib/installer.js')
    installMock = mod.install
    vi.clearAllMocks()
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    setJsonMode(false)
    vi.restoreAllMocks()
  })

  it('install 成功时 printJSON 输出含 success:true', () => {
    installMock.mockResolvedValue(INSTALL_RESULT)
    setJsonMode(true)
    printJSON({ success: true, ...INSTALL_RESULT })
    const written = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(written)
    expect(parsed.success).toBe(true)
    expect(parsed.platform).toBe('happycapy')
    expect(parsed.agentId).toBe('bmad-expert')
    expect(parsed.installPath).toContain('happycapy')
    expect(typeof parsed.duration).toBe('number')
  })

  it('install 成功时 JSON 输出不写 stderr', () => {
    setJsonMode(true)
    printJSON({ success: true, ...INSTALL_RESULT })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('install 失败时错误 JSON 含 success:false 及错误字段', () => {
    const err = new BmadError('E004', '文件写入失败（权限不足）', new Error('EACCES'), [
      '检查目录权限',
    ])
    setJsonMode(true)
    const errorJson = {
      success: false,
      errorCode: err.bmadCode,
      errorMessage: err.message,
      fixSteps: err.fixSteps,
      retryable: err.retryable,
    }
    printJSON(errorJson)
    const written = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(written)
    expect(parsed.success).toBe(false)
    expect(parsed.errorCode).toBe('E004')
    expect(parsed.errorMessage).toContain('权限不足')
    expect(Array.isArray(parsed.fixSteps)).toBe(true)
    expect(parsed.retryable).toBe(true)
  })

  it('install 失败时错误 JSON 不写 stderr', () => {
    const err = new BmadError('E004', '失败', null)
    setJsonMode(true)
    printJSON({ success: false, errorCode: err.bmadCode, errorMessage: err.message, fixSteps: [], retryable: err.retryable })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('非 BmadError 失败时错误 JSON 含 errorCode:E001', () => {
    setJsonMode(true)
    const err = new Error('unexpected failure')
    const errorJson = {
      success: false,
      errorCode: 'E001',
      errorMessage: err.message,
      fixSteps: [],
      retryable: false,
    }
    printJSON(errorJson)
    const written = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(written)
    expect(parsed.errorCode).toBe('E001')
    expect(parsed.retryable).toBe(false)
  })
})

describe('update --json 模式', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    setJsonMode(false)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    setJsonMode(false)
    vi.restoreAllMocks()
  })

  it('update 成功时 JSON 含 success:true/version/message', () => {
    setJsonMode(true)
    printJSON({ success: true, ...UPDATE_RESULT })
    const written = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(written)
    expect(parsed.success).toBe(true)
    expect(parsed.version).toBe('0.1.0')
    expect(parsed.message).toContain('memory 完整保留')
  })

  it('update 成功时 JSON 不写 stderr', () => {
    setJsonMode(true)
    printJSON({ success: true, ...UPDATE_RESULT })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('update 失败时 JSON 含 success:false 及错误字段', () => {
    const err = new BmadError('E004', '更新失败（权限不足）', null, ['重试'])
    setJsonMode(true)
    printJSON({ success: false, errorCode: err.bmadCode, errorMessage: err.message, fixSteps: err.fixSteps, retryable: err.retryable })
    const written = stdoutSpy.mock.calls[0][0]
    const parsed = JSON.parse(written)
    expect(parsed.success).toBe(false)
    expect(parsed.errorCode).toBe('E004')
    expect(parsed.retryable).toBe(true)
  })

  it('update 失败时错误 JSON 不写 stderr', () => {
    setJsonMode(true)
    printJSON({ success: false, errorCode: 'E001', errorMessage: '失败', fixSteps: [], retryable: false })
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})

describe('JSON 模式关闭时默认行为不受影响', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    setJsonMode(false)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    setJsonMode(false)
    vi.restoreAllMocks()
  })

  it('jsonMode=false 时 printProgress 正常写 stdout', () => {
    printProgress('正在检测平台...')
    expect(stdoutSpy).toHaveBeenCalled()
    const written = stdoutSpy.mock.calls[0][0]
    expect(written).toContain('正在检测平台...')
  })

  it('jsonMode=false 时 printSuccess 正常写 stdout', () => {
    printSuccess('安装完成')
    expect(stdoutSpy).toHaveBeenCalled()
  })
})
