import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printProgress, printSuccess, printError } from '../lib/output.js'
import { BmadError } from '../lib/errors.js'

describe('output.js', () => {
  let stdoutSpy, stderrSpy

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('printProgress', () => {
    it('写入 stdout，不写 stderr', () => {
      printProgress('正在检测平台...')
      expect(stdoutSpy).toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('非完成态输出包含消息文本', () => {
      printProgress('正在检测平台...')
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('正在检测平台...')
    })

    it('完成态（done=true）输出包含 ✓', () => {
      printProgress('正在检测平台...', true)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('✓')
    })

    it('完成态写入 stdout，不写 stderr', () => {
      printProgress('正在检测平台...', true)
      expect(stdoutSpy).toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })
  })

  describe('printSuccess', () => {
    it('写入 stdout，不写 stderr', () => {
      printSuccess('安装完成')
      expect(stdoutSpy).toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('输出包含消息文本', () => {
      printSuccess('bmad-expert 已就绪')
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('bmad-expert 已就绪')
    })

    it('安装后引导消息包含情感性确认（FR20）', () => {
      const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
      printSuccess(msg)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('bmad-expert 已就绪')
    })

    it('安装后引导消息包含两个编号操作选项（FR21）', () => {
      const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
      printSuccess(msg)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('①')
      expect(written).toContain('②')
    })

    it('安装后引导消息包含 bmad-help 引导路径（FR22）', () => {
      const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
      printSuccess(msg)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('bmad-help')
    })

    it('安装后引导消息包含安装耗时信息', () => {
      const msg = `安装完成（用时 5s）\n\nbmad-expert 已就绪。现在你可以：\n  ① 说"初始化这个项目"开始使用\n  ② 说"进入 bmad-help"了解工作流`
      printSuccess(msg)
      const written = stdoutSpy.mock.calls[0][0]
      expect(written).toContain('安装完成（用时')
    })
  })

  describe('printError', () => {
    it('BmadError 写入 stderr，不写 stdout', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      expect(stderrSpy).toHaveBeenCalled()
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('stderr 包含错误码', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('ERROR [E004]')
    })

    it('stderr 包含错误消息', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('文件写入失败')
    })

    it('retryable=true 时输出"可重试：是"', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES'))
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('可重试：是')
    })

    it('retryable=false 时输出"可重试：否"', () => {
      const err = new BmadError('E002', '参数无效', null)
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('可重试：否')
    })

    it('stderr 包含"原因："字段', () => {
      const err = new BmadError('E004', '文件写入失败', new Error('EACCES: permission denied'))
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('原因：')
    })

    it('cause 为 null 时不报错，原因显示"未知原因"', () => {
      const err = new BmadError('E001', '通用错误', null)
      expect(() => printError(err)).not.toThrow()
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('未知原因')
    })

    it('普通 Error 也写入 stderr，不写 stdout', () => {
      printError(new Error('普通错误'))
      expect(stderrSpy).toHaveBeenCalled()
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('普通 Error 输出包含错误消息', () => {
      printError(new Error('普通错误'))
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('普通错误')
    })

    it('BmadError 含 fixSteps 时将步骤写入 stderr', () => {
      const err = new BmadError('E004', '文件写入失败（权限不足）', new Error('EACCES'), [
        '手动创建目标目录：mkdir -p ~/.happycapy/agents/bmad-expert',
        '确认权限后重新执行：npx bmad-expert install',
      ])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('手动创建目标目录')
      expect(written).toContain('确认权限后重新执行')
    })

    it('BmadError 无 fixSteps（空数组）时输出默认步骤', () => {
      const err = new BmadError('E001', '通用错误', null)
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('检查错误原因并重试')
    })

    it('stderr 包含"修复步骤："字段', () => {
      const err = new BmadError('E004', '权限错误', null, ['步骤一'])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('修复步骤：')
    })

    it('E002 完整 Schema 格式验证', () => {
      const err = new BmadError("E002", "无效参数: --platform 值 'unknown' 不被支持", null, [
        '使用支持的平台值：happycapy, cursor, claude-code',
      ])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('ERROR [E002]')
      expect(written).toContain("--platform 值 'unknown' 不被支持")
      expect(written).toContain('修复步骤：')
      expect(written).toContain('使用支持的平台值')
      expect(written).toContain('可重试：否')
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('E003 完整 Schema 格式验证', () => {
      const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
        '升级 Node.js 至 20.19+ 或更高版本',
      ])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('ERROR [E003]')
      expect(written).toContain('Node.js 版本不足')
      expect(written).toContain('修复步骤：')
      expect(written).toContain('升级 Node.js')
      expect(written).toContain('可重试：否')
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('E004 完整 Schema 格式验证', () => {
      const err = new BmadError('E004', '文件写入失败（权限不足）', new Error('沙盒限制写入路径 /path'), [
        '手动创建并授权目标目录：mkdir -p ~/.happycapy/agents/bmad-expert',
        '确认路径权限后重新执行：npx bmad-expert install',
      ])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('ERROR [E004]')
      expect(written).toContain('文件写入失败（权限不足）')
      expect(written).toContain('原因：')
      expect(written).toContain('沙盒限制写入路径')
      expect(written).toContain('修复步骤：')
      expect(written).toContain('可重试：是')
      expect(stdoutSpy).not.toHaveBeenCalled()
    })

    it('E005 完整 Schema 格式验证', () => {
      const err = new BmadError('E005', '网络错误', new Error('connection refused'), [
        '检查网络连接后重新执行安装命令：npx bmad-expert install',
        '若持续失败，检查代理设置',
      ])
      printError(err)
      const written = stderrSpy.mock.calls.map(c => c[0]).join('')
      expect(written).toContain('ERROR [E005]')
      expect(written).toContain('网络错误')
      expect(written).toContain('原因：')
      expect(written).toContain('connection refused')
      expect(written).toContain('修复步骤：')
      expect(written).toContain('npx bmad-expert install')
      expect(written).toContain('代理设置')
      expect(written).toContain('可重试：是')
      expect(stdoutSpy).not.toHaveBeenCalled()
    })
  })
})
