import { describe, it, expect } from 'vitest'
import { EXIT_CODES } from '../lib/exit-codes.js'

describe('EXIT_CODES', () => {
  it('exports EXIT_CODES as a named export', () => {
    expect(EXIT_CODES).toBeDefined()
    expect(typeof EXIT_CODES).toBe('object')
  })

  it('contains all 7 constants with correct values', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0)
    expect(EXIT_CODES.GENERAL_ERROR).toBe(1)
    expect(EXIT_CODES.INVALID_ARGS).toBe(2)
    expect(EXIT_CODES.MISSING_DEPENDENCY).toBe(3)
    expect(EXIT_CODES.PERMISSION_DENIED).toBe(4)
    expect(EXIT_CODES.NETWORK_ERROR).toBe(5)
    expect(EXIT_CODES.ALREADY_INSTALLED).toBe(6)
  })

  it('all constant values are integers', () => {
    for (const [key, value] of Object.entries(EXIT_CODES)) {
      expect(Number.isInteger(value), `${key} should be an integer`).toBe(true)
    }
  })

  it('has exactly 7 constants', () => {
    expect(Object.keys(EXIT_CODES)).toHaveLength(7)
  })

  it('SUCCESS is 0 (falsy)', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0)
  })

  it('PERMISSION_DENIED and NETWORK_ERROR are 4 and 5 (retryable codes)', () => {
    expect(EXIT_CODES.PERMISSION_DENIED).toBe(4)
    expect(EXIT_CODES.NETWORK_ERROR).toBe(5)
  })
})
