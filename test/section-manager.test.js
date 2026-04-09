import { describe, it, expect } from 'vitest'
import {
  hasBmadSection,
  extractBmadSection,
  replaceBmadSection,
  removeBmadSection,
  wrapBmadSection,
} from '../lib/section-manager.js'

// ═══════════════════════════════════════════════════════════════════════════════
// hasBmadSection
// ═══════════════════════════════════════════════════════════════════════════════

describe('hasBmadSection', () => {
  it('完整标记对返回 true', () => {
    const content = '前文\n<!-- bmad-workspace-config -->\n内容\n<!-- /bmad-workspace-config -->\n后文'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(true)
  })

  it('仅开标记返回 false（残缺）', () => {
    const content = '前文\n<!-- bmad-workspace-config -->\n内容'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(false)
  })

  it('仅闭标记返回 false（残缺）', () => {
    const content = '前文\n内容\n<!-- /bmad-workspace-config -->'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(false)
  })

  it('无标记返回 false', () => {
    const content = '纯文本内容，无标记'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(hasBmadSection('', 'bmad-workspace-config')).toBe(false)
  })

  it('闭标记在开标记之前（乱序）返回 false', () => {
    const content = '<!-- /bmad-workspace-config -->\n内容\n<!-- bmad-workspace-config -->'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(false)
  })

  it('不同 sectionId 的标记不匹配', () => {
    const content = '<!-- bmad-project-config -->\n内容\n<!-- /bmad-project-config -->'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(false)
    expect(hasBmadSection(content, 'bmad-project-config')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// extractBmadSection
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractBmadSection', () => {
  it('提取完整标记段落（含标记本身）', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n配置内容\n<!-- /bmad-workspace-config -->\n\n后文'
    const result = extractBmadSection(content, 'bmad-workspace-config')
    expect(result).toBe('<!-- bmad-workspace-config -->\n配置内容\n<!-- /bmad-workspace-config -->')
  })

  it('无标记时返回 null（非 workspace-config sectionId）', () => {
    const content = '无标记内容'
    expect(extractBmadSection(content, 'bmad-project-config')).toBeNull()
  })

  it('bmad-workspace-config fallback：从 ## Default Project 起包裹', () => {
    const content = '# Claude\n\n## Default Project\nmy-app\n## Other'
    const result = extractBmadSection(content, 'bmad-workspace-config')
    expect(result).toContain('<!-- bmad-workspace-config -->')
    expect(result).toContain('<!-- /bmad-workspace-config -->')
    expect(result).toContain('## Default Project')
    expect(result).toContain('## Other')
  })

  it('bmad-workspace-config fallback：无 ## Default Project 时包裹全部', () => {
    const content = 'random content'
    const result = extractBmadSection(content, 'bmad-workspace-config')
    expect(result).toBe('<!-- bmad-workspace-config -->\nrandom content\n<!-- /bmad-workspace-config -->')
  })

  it('内容前后有其他文本时只提取标记段落', () => {
    const content = '用户段落1\n\n<!-- bmad-project-config -->\n项目配置\n<!-- /bmad-project-config -->\n\n用户段落2'
    const result = extractBmadSection(content, 'bmad-project-config')
    expect(result).toBe('<!-- bmad-project-config -->\n项目配置\n<!-- /bmad-project-config -->')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// replaceBmadSection
// ═══════════════════════════════════════════════════════════════════════════════

describe('replaceBmadSection', () => {
  it('正常替换标记段落，用户自定义内容不变', () => {
    const content = '用户内容1\n\n<!-- bmad-workspace-config -->\n旧配置\n<!-- /bmad-workspace-config -->\n\n用户内容2'
    const newSection = '<!-- bmad-workspace-config -->\n新配置\n<!-- /bmad-workspace-config -->'
    const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
    expect(result).toContain('用户内容1')
    expect(result).toContain('用户内容2')
    expect(result).toContain('新配置')
    expect(result).not.toContain('旧配置')
  })

  it('无标记时返回原 content（幂等）', () => {
    const content = '无标记内容'
    const newSection = '<!-- bmad-workspace-config -->\n新配置\n<!-- /bmad-workspace-config -->'
    expect(replaceBmadSection(content, 'bmad-workspace-config', newSection)).toBe(content)
  })

  it('替换后段落前后各有一个空行', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n旧\n<!-- /bmad-workspace-config -->\n\n后文'
    const newSection = '<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->'
    const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
    // 前后各一个空行
    expect(result).toBe('前文\n\n<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->\n\n后文')
  })

  it('段落在文件开头时正确处理', () => {
    const content = '<!-- bmad-workspace-config -->\n旧\n<!-- /bmad-workspace-config -->\n\n后文'
    const newSection = '<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->'
    const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
    expect(result).toContain('新')
    expect(result).toContain('后文')
    expect(result).not.toContain('旧')
  })

  it('段落在文件末尾时正确处理', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n旧\n<!-- /bmad-workspace-config -->'
    const newSection = '<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->'
    const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
    expect(result).toContain('前文')
    expect(result).toContain('新')
    expect(result).not.toContain('旧')
  })

  it('content 仅含标记段落时正确替换', () => {
    const content = '<!-- bmad-workspace-config -->\n旧\n<!-- /bmad-workspace-config -->'
    const newSection = '<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->'
    const result = replaceBmadSection(content, 'bmad-workspace-config', newSection)
    expect(result).toBe('<!-- bmad-workspace-config -->\n新\n<!-- /bmad-workspace-config -->\n')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// removeBmadSection
// ═══════════════════════════════════════════════════════════════════════════════

describe('removeBmadSection', () => {
  it('正常移除标记段落，保留其余内容', () => {
    const content = '用户内容1\n\n<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->\n\n用户内容2'
    const result = removeBmadSection(content, 'bmad-workspace-config')
    expect(result).toContain('用户内容1')
    expect(result).toContain('用户内容2')
    expect(result).not.toContain('配置')
    expect(result).not.toContain('bmad-workspace-config')
  })

  it('无标记时返回原 content（幂等）', () => {
    const content = '无标记内容'
    expect(removeBmadSection(content, 'bmad-workspace-config')).toBe(content)
  })

  it('移除后不留多余空行', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->\n\n后文'
    const result = removeBmadSection(content, 'bmad-workspace-config')
    expect(result).toBe('前文\n\n后文')
  })

  it('content 仅含标记段落时返回空字符串', () => {
    const content = '<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->'
    expect(removeBmadSection(content, 'bmad-workspace-config')).toBe('')
  })

  it('标记在开头时正确移除', () => {
    const content = '<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->\n\n后续内容'
    const result = removeBmadSection(content, 'bmad-workspace-config')
    expect(result).toBe('后续内容')
  })

  it('标记在末尾时正确移除', () => {
    const content = '前置内容\n\n<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->'
    const result = removeBmadSection(content, 'bmad-workspace-config')
    expect(result).toBe('前置内容\n')
  })

  it('幂等验证：对已移除的内容再次调用', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n配置\n<!-- /bmad-workspace-config -->\n\n后文'
    const once = removeBmadSection(content, 'bmad-workspace-config')
    const twice = removeBmadSection(once, 'bmad-workspace-config')
    expect(twice).toBe(once)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// wrapBmadSection
// ═══════════════════════════════════════════════════════════════════════════════

describe('wrapBmadSection', () => {
  it('基本包裹格式正确', () => {
    const result = wrapBmadSection('内容', 'bmad-project-config')
    expect(result).toBe('<!-- bmad-project-config -->\n内容\n<!-- /bmad-project-config -->')
  })

  it('包裹多行内容', () => {
    const result = wrapBmadSection('第一行\n第二行\n第三行', 'bmad-workspace-config')
    expect(result).toBe('<!-- bmad-workspace-config -->\n第一行\n第二行\n第三行\n<!-- /bmad-workspace-config -->')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 综合边界场景
// ═══════════════════════════════════════════════════════════════════════════════

describe('综合边界场景', () => {
  it('多个不同 sectionId 共存时只操作指定 sectionId', () => {
    const content = [
      '# CLAUDE.md',
      '',
      '<!-- bmad-workspace-config -->',
      'workspace 配置',
      '<!-- /bmad-workspace-config -->',
      '',
      '用户自定义',
      '',
      '<!-- bmad-project-config -->',
      '项目配置',
      '<!-- /bmad-project-config -->',
    ].join('\n')

    // 替换 workspace 不影响 project
    const newWs = '<!-- bmad-workspace-config -->\n新 workspace\n<!-- /bmad-workspace-config -->'
    const replaced = replaceBmadSection(content, 'bmad-workspace-config', newWs)
    expect(replaced).toContain('新 workspace')
    expect(replaced).toContain('项目配置')
    expect(replaced).toContain('用户自定义')

    // 移除 project 不影响 workspace
    const removed = removeBmadSection(content, 'bmad-project-config')
    expect(removed).toContain('workspace 配置')
    expect(removed).toContain('用户自定义')
    expect(removed).not.toContain('项目配置')
  })

  it('空内容标记段落的检测和操作', () => {
    const content = '前文\n\n<!-- bmad-workspace-config -->\n<!-- /bmad-workspace-config -->\n\n后文'
    expect(hasBmadSection(content, 'bmad-workspace-config')).toBe(true)

    const extracted = extractBmadSection(content, 'bmad-workspace-config')
    expect(extracted).toBe('<!-- bmad-workspace-config -->\n<!-- /bmad-workspace-config -->')

    const removed = removeBmadSection(content, 'bmad-workspace-config')
    expect(removed).toBe('前文\n\n后文')
  })
})
