// test/param-builder.test.js
// 智能参数构建引擎 — Story 7.1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'fs'

// mock fs 模块（避免真实文件系统依赖）
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
  }
})

// 动态 import，确保 mock 在 module 加载前生效
const { buildParams } = await import('../lib/param-builder.js')

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(false)
  vi.mocked(readFileSync).mockReturnValue('')
  // 清理 LANG 环境变量，保证 language fallback 测试稳定
  delete process.env.LANG
  delete process.env.LC_ALL
  delete process.env.LC_MESSAGES
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── tools 参数推断 ──────────────────────────────────────────────────────────

describe('buildParams — tools 参数推断', () => {
  it('platform=happycapy → tools=null', () => {
    const result = buildParams('happycapy')
    expect(result.tools).toBeNull()
  })

  it('platform=claude-code → tools=claude-code', () => {
    const result = buildParams('claude-code')
    expect(result.tools).toBe('claude-code')
  })

  it('platform=openclaw → tools=null', () => {
    const result = buildParams('openclaw')
    expect(result.tools).toBeNull()
  })

  it('platform=codex → tools=null', () => {
    const result = buildParams('codex')
    expect(result.tools).toBeNull()
  })

  it('未知 platform → tools=null（安全 fallback）', () => {
    const result = buildParams('unknown-platform')
    expect(result.tools).toBeNull()
  })

  it('userOverrides.tools 覆盖平台推断（happycapy → custom-tool）', () => {
    const result = buildParams('happycapy', { userOverrides: { tools: 'custom-tool' } })
    expect(result.tools).toBe('custom-tool')
  })

  it('userOverrides.tools 覆盖 claude-code 推断（覆盖为 null）', () => {
    const result = buildParams('claude-code', { userOverrides: { tools: null } })
    expect(result.tools).toBeNull()
  })
})

// ── modules 参数推断 ──────────────────────────────────────────────────────

describe('buildParams — modules 参数推断', () => {
  it('无 projectRoot → 默认 modules=bmm', () => {
    const result = buildParams('happycapy')
    expect(result.modules).toBe('bmm')
  })

  it('projectRoot 下无 bmb 配置 → modules=bmm', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.modules).toBe('bmm')
  })

  it('projectRoot 下有 _bmad/bmb → modules=bmm,bmb', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('bmb'))
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.modules).toBe('bmm,bmb')
  })

  it('projectRoot 下有 _bmad-output/bmb → modules=bmm,bmb', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      p.includes('_bmad-output') && p.includes('bmb')
    )
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.modules).toBe('bmm,bmb')
  })

  it('userOverrides.modules 覆盖默认值', () => {
    const result = buildParams('happycapy', { userOverrides: { modules: 'bmb' } })
    expect(result.modules).toBe('bmb')
  })

  it('userOverrides.modules=null → 视为未指定，走推断（AC5）', () => {
    const result = buildParams('happycapy', { userOverrides: { modules: null } })
    expect(result.modules).toBe('bmm')
  })

  it('userOverrides.modules 覆盖 bmb 检测推断', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('bmb'))
    const result = buildParams('happycapy', {
      projectRoot: '/project',
      userOverrides: { modules: 'bmm' },
    })
    expect(result.modules).toBe('bmm')
  })
})

// ── communicationLanguage 推断 ─────────────────────────────────────────────

describe('buildParams — communicationLanguage 推断', () => {
  it('无 projectRoot + 无 LANG → communicationLanguage=null', () => {
    const result = buildParams('happycapy')
    expect(result.communicationLanguage).toBeNull()
  })

  it('config.yaml 含 communication_language: Chinese → 返回 Chinese', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('Chinese')
  })

  it('config.yaml 含行内注释 → 去除注释后返回', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: zh_CN # default\n')
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('zh_CN')
  })

  it('config.yaml 含带引号的语言 → 去引号返回', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue("communication_language: 'zh_CN'\n")
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('zh_CN')
  })

  it('config.yaml 读取失败 → fallback 系统 locale', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('read error')
    })
    process.env.LANG = 'zh_CN.UTF-8'
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('zh_CN')
  })

  it('无 config.yaml + 有 LANG=zh_CN.UTF-8 → 返回 zh_CN（去编码后缀）', () => {
    process.env.LANG = 'zh_CN.UTF-8'
    const result = buildParams('happycapy', { projectRoot: '/project' })
    expect(result.communicationLanguage).toBe('zh_CN')
  })

  it('LANG=C → communicationLanguage=null（忽略 C locale）', () => {
    process.env.LANG = 'C'
    const result = buildParams('happycapy')
    expect(result.communicationLanguage).toBeNull()
  })

  it('LANG=POSIX → communicationLanguage=null', () => {
    process.env.LANG = 'POSIX'
    const result = buildParams('happycapy')
    expect(result.communicationLanguage).toBeNull()
  })

  it('LANG=C.UTF-8 → communicationLanguage=null（不返回 "C"）', () => {
    process.env.LANG = 'C.UTF-8'
    const result = buildParams('happycapy')
    expect(result.communicationLanguage).toBeNull()
  })

  it('userOverrides.communicationLanguage 覆盖配置推断', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('happycapy', {
      projectRoot: '/project',
      userOverrides: { communicationLanguage: 'English' },
    })
    expect(result.communicationLanguage).toBe('English')
  })
})

// ── 其他字段（outputFolder, userName, action, yes）────────────────────────

describe('buildParams — 其他字段默认值与覆盖', () => {
  it('默认 action=install', () => {
    const result = buildParams('happycapy')
    expect(result.action).toBe('install')
  })

  it('默认 yes=true', () => {
    const result = buildParams('happycapy')
    expect(result.yes).toBe(true)
  })

  it('默认 outputFolder=null', () => {
    const result = buildParams('happycapy')
    expect(result.outputFolder).toBeNull()
  })

  it('默认 userName=null', () => {
    const result = buildParams('happycapy')
    expect(result.userName).toBeNull()
  })

  it('userOverrides.outputFolder 覆盖默认值', () => {
    const result = buildParams('happycapy', { userOverrides: { outputFolder: '/custom/path' } })
    expect(result.outputFolder).toBe('/custom/path')
  })

  it('userOverrides.userName 覆盖默认值', () => {
    const result = buildParams('happycapy', { userOverrides: { userName: 'Alice' } })
    expect(result.userName).toBe('Alice')
  })

  it('userOverrides.action 覆盖默认值', () => {
    const result = buildParams('happycapy', { userOverrides: { action: 'update' } })
    expect(result.action).toBe('update')
  })
})

// ── toArgs() 转换 ──────────────────────────────────────────────────────────

describe('buildParams — toArgs() 转换', () => {
  it('claude-code 平台 → toArgs() 含 --tools claude-code', () => {
    const result = buildParams('claude-code')
    const args = result.toArgs()
    const toolsIdx = args.indexOf('--tools')
    expect(toolsIdx).toBeGreaterThanOrEqual(0)
    expect(args[toolsIdx + 1]).toBe('claude-code')
  })

  it('happycapy 平台（tools=null）→ toArgs() 不含 --tools', () => {
    const result = buildParams('happycapy')
    expect(result.toArgs()).not.toContain('--tools')
  })

  it('toArgs() 始终含 --yes', () => {
    const result = buildParams('happycapy')
    expect(result.toArgs()).toContain('--yes')
  })

  it('toArgs() 含 --modules bmm', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    const idx = args.indexOf('--modules')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe('bmm')
  })

  it('toArgs() 含 --action install', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    const idx = args.indexOf('--action')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe('install')
  })

  it('communicationLanguage=null → toArgs() 不含 --communication-language', () => {
    const result = buildParams('happycapy')
    expect(result.toArgs()).not.toContain('--communication-language')
  })

  it('有 communicationLanguage → toArgs() 含 --communication-language 值', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('happycapy', { projectRoot: '/project' })
    const args = result.toArgs()
    const idx = args.indexOf('--communication-language')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe('Chinese')
  })

  it('outputFolder=null → toArgs() 不含 --output-folder', () => {
    const result = buildParams('happycapy')
    expect(result.toArgs()).not.toContain('--output-folder')
  })

  it('有 outputFolder → toArgs() 含 --output-folder 值', () => {
    const result = buildParams('happycapy', { userOverrides: { outputFolder: '/out' } })
    const args = result.toArgs()
    const idx = args.indexOf('--output-folder')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe('/out')
  })

  it('有 userName → toArgs() 含 --user-name 值', () => {
    const result = buildParams('happycapy', { userOverrides: { userName: 'Alice' } })
    const args = result.toArgs()
    const idx = args.indexOf('--user-name')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(args[idx + 1]).toBe('Alice')
  })

  it('toArgs() 返回值为字符串数组', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    expect(Array.isArray(args)).toBe(true)
    args.forEach((a) => expect(typeof a).toBe('string'))
  })

  it('toArgs() 不含 null 或 undefined 值', () => {
    const result = buildParams('happycapy')
    const args = result.toArgs()
    expect(args.every((a) => a !== null && a !== undefined)).toBe(true)
  })
})

// ── 综合场景：完整参数构建 ──────────────────────────────────────────────────

describe('buildParams — 综合场景', () => {
  it('claude-code + Chinese 配置 → 完整 toArgs() 含 --tools 和 --communication-language', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('claude-code', { projectRoot: '/project' })
    const args = result.toArgs()
    expect(args).toContain('--tools')
    expect(args).toContain('claude-code')
    expect(args).toContain('--communication-language')
    expect(args).toContain('Chinese')
    expect(args).toContain('--yes')
  })

  it('所有 userOverrides 均生效（优先级验证）', () => {
    vi.mocked(existsSync).mockImplementation((p) => p.includes('config.yaml'))
    vi.mocked(readFileSync).mockReturnValue('communication_language: Chinese\n')
    const result = buildParams('claude-code', {
      projectRoot: '/project',
      userOverrides: {
        modules: 'custom-modules',
        tools: 'my-tool',
        communicationLanguage: 'English',
        outputFolder: '/my/output',
        userName: 'Bob',
        action: 'update',
      },
    })
    expect(result.modules).toBe('custom-modules')
    expect(result.tools).toBe('my-tool')
    expect(result.communicationLanguage).toBe('English')
    expect(result.outputFolder).toBe('/my/output')
    expect(result.userName).toBe('Bob')
    expect(result.action).toBe('update')
  })
})
