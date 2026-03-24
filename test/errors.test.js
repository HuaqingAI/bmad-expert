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
