import { describe, it, expect } from 'vitest'
import { BmadError } from '../lib/errors.js'

describe('BmadError', () => {
  it('exports BmadError as a named export', () => {
    expect(BmadError).toBeDefined()
    expect(typeof BmadError).toBe('function')
  })

  it('sets bmadCode, message, and cause correctly', () => {
    const cause = new Error('original error')
    const err = new BmadError('E004', '文件写入失败', cause)
    expect(err.bmadCode).toBe('E004')
    expect(err.message).toBe('文件写入失败')
    expect(err.cause).toBe(cause)
  })

  it('inherits from Error', () => {
    const err = new BmadError('E001', 'test error')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof BmadError).toBe(true)
  })

  it('sets name to BmadError', () => {
    const err = new BmadError('E001', 'test')
    expect(err.name).toBe('BmadError')
  })

  it('retryable is true for E004 (PERMISSION_DENIED)', () => {
    const err = new BmadError('E004', 'permission denied')
    expect(err.retryable).toBe(true)
  })

  it('retryable is true for E005 (NETWORK_ERROR)', () => {
    const err = new BmadError('E005', 'network error')
    expect(err.retryable).toBe(true)
  })

  it('retryable is false for E001 (GENERAL_ERROR)', () => {
    const err = new BmadError('E001', 'general error')
    expect(err.retryable).toBe(false)
  })

  it('retryable is false for E002 (INVALID_ARGS)', () => {
    const err = new BmadError('E002', 'invalid args')
    expect(err.retryable).toBe(false)
  })

  it('retryable is false for E003 (MISSING_DEPENDENCY)', () => {
    const err = new BmadError('E003', 'missing dep')
    expect(err.retryable).toBe(false)
  })

  it('retryable is false for E006 (ALREADY_INSTALLED)', () => {
    const err = new BmadError('E006', 'already installed')
    expect(err.retryable).toBe(false)
  })

  it('works without a cause argument', () => {
    const err = new BmadError('E001', 'no cause')
    expect(err.cause).toBeUndefined()
    expect(err.message).toBe('no cause')
    expect(err.retryable).toBe(false)
  })

  it('has a stack trace', () => {
    const err = new BmadError('E001', 'has stack')
    expect(err.stack).toBeDefined()
  })
})

describe('BmadError E002 场景', () => {
  it('E002 retryable=false 且支持传入 fixSteps', () => {
    const err = new BmadError("E002", "无效参数: --platform 值 'xxx' 不被支持", null, [
      '使用支持的平台值：happycapy, cursor, claude-code',
    ])
    expect(err.bmadCode).toBe('E002')
    expect(err.retryable).toBe(false)
    expect(err.fixSteps).toHaveLength(1)
    expect(err.fixSteps[0]).toContain('happycapy')
  })
})

describe('BmadError E003 场景', () => {
  it('E003 bmadCode 正确且 retryable=false', () => {
    const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
      '升级 Node.js 至 20.19+ 或更高版本',
    ])
    expect(err.bmadCode).toBe('E003')
    expect(err.retryable).toBe(false)
  })

  it('E003 fixSteps 可传入且包含升级指令', () => {
    const err = new BmadError('E003', '依赖缺失: Node.js 版本不足（当前 v18.0.0，需要 ≥20.19.0）', null, [
      '升级 Node.js 至 20.19+ 或更高版本',
    ])
    expect(err.fixSteps).toHaveLength(1)
    expect(err.fixSteps[0]).toContain('20.19')
  })
})

describe('BmadError fixSteps', () => {
  it('传入 fixSteps 数组时正确保存', () => {
    const fixSteps = ['步骤一：执行 X', '步骤二：执行 Y']
    const err = new BmadError('E004', '权限不足', null, fixSteps)
    expect(err.fixSteps).toEqual(fixSteps)
  })

  it('不传第四参数时 fixSteps 默认为空数组', () => {
    const err = new BmadError('E004', '权限不足', null)
    expect(err.fixSteps).toEqual([])
  })

  it('传入非数组时 fixSteps 被规范化为空数组', () => {
    const err = new BmadError('E004', '权限不足', null, '无效')
    expect(err.fixSteps).toEqual([])
  })

  it('E004 retryable=true 且 fixSteps 独立（互不影响）', () => {
    const err = new BmadError('E004', '权限不足', null, ['步骤A'])
    expect(err.retryable).toBe(true)
    expect(err.fixSteps).toEqual(['步骤A'])
  })
})
