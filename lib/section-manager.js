/**
 * 标记化段落管理引擎 — 统一管理所有 bmad 标记段落的 CRUD 操作。
 *
 * 纯字符串操作，无文件 I/O，无外部依赖。
 * 标记格式：<!-- sectionId --> ... <!-- /sectionId -->
 * 实现约束：不使用正则匹配标记，仅 indexOf + substring。
 */

/**
 * 构造标记对。
 * @param {string} sectionId
 * @returns {{ open: string, close: string }}
 */
function markers(sectionId) {
  return {
    open: `<!-- ${sectionId} -->`,
    close: `<!-- /${sectionId} -->`,
  }
}

/**
 * 检测 content 中是否包含完整的开闭标记对。
 * 残缺标记（只有开/只有闭）返回 false。
 *
 * @param {string} content
 * @param {string} sectionId
 * @returns {boolean}
 */
export function hasBmadSection(content, sectionId) {
  const { open, close } = markers(sectionId)
  const openIdx = content.indexOf(open)
  const closeIdx = content.indexOf(close)
  return openIdx !== -1 && closeIdx !== -1 && openIdx < closeIdx
}

/**
 * 提取标记段落（含开闭标记本身）。
 *
 * 当 sectionId === 'bmad-workspace-config' 且找不到完整标记对时，
 * 保留 Phase 3 兼容 fallback：从 "## Default Project" 开始包裹。
 *
 * @param {string} content
 * @param {string} sectionId
 * @returns {string|null} 含标记的段落，或 null（无标记且无 fallback）
 */
export function extractBmadSection(content, sectionId) {
  const { open, close } = markers(sectionId)
  const openIdx = content.indexOf(open)
  const closeIdx = content.indexOf(close)

  if (openIdx !== -1 && closeIdx !== -1 && openIdx < closeIdx) {
    return content.substring(openIdx, closeIdx + close.length)
  }

  // Phase 3 兼容 fallback —— 仅 bmad-workspace-config 需要
  if (sectionId === 'bmad-workspace-config') {
    const dpIdx = content.indexOf('## Default Project')
    if (dpIdx === -1) return `${open}\n${content}\n${close}`
    return `${open}\n${content.substring(dpIdx)}\n${close}`
  }

  return null
}

/**
 * 替换标记段落为 newSection。
 * 若标记不存在，返回原 content（幂等）。
 * 保证替换后段落前后各有一个空行。
 *
 * @param {string} content
 * @param {string} sectionId
 * @param {string} newSection - 新段落（应含开闭标记）
 * @returns {string}
 */
export function replaceBmadSection(content, sectionId, newSection) {
  const { open, close } = markers(sectionId)
  const openIdx = content.indexOf(open)
  const closeIdx = content.indexOf(close)

  if (openIdx === -1 || closeIdx === -1 || openIdx >= closeIdx) return content

  const before = content.substring(0, openIdx)
  const after = content.substring(closeIdx + close.length)

  const trimmedBefore = before.replace(/\n+$/, '')
  const trimmedAfter = after.replace(/^\n+/, '')

  if (trimmedBefore.length === 0 && trimmedAfter.length === 0) {
    return newSection + '\n'
  }
  if (trimmedBefore.length === 0) {
    return newSection + '\n\n' + trimmedAfter
  }
  if (trimmedAfter.length === 0) {
    return trimmedBefore + '\n\n' + newSection + '\n'
  }
  return trimmedBefore + '\n\n' + newSection + '\n\n' + trimmedAfter
}

/**
 * 移除标记段落，保留其余内容。
 * 若标记不存在，返回原 content（幂等）。
 * 移除后清理多余空行。
 *
 * @param {string} content
 * @param {string} sectionId
 * @returns {string}
 */
export function removeBmadSection(content, sectionId) {
  const { open, close } = markers(sectionId)
  const openIdx = content.indexOf(open)
  const closeIdx = content.indexOf(close)

  if (openIdx === -1 || closeIdx === -1 || openIdx >= closeIdx) return content

  const before = content.substring(0, openIdx)
  const after = content.substring(closeIdx + close.length)

  const trimmedBefore = before.replace(/\n+$/, '')
  const trimmedAfter = after.replace(/^\n+/, '')

  if (trimmedBefore.length === 0 && trimmedAfter.length === 0) return ''
  if (trimmedBefore.length === 0) return trimmedAfter
  if (trimmedAfter.length === 0) return trimmedBefore + '\n'
  return trimmedBefore + '\n\n' + trimmedAfter
}

/**
 * 为内容添加开闭标记包裹。
 *
 * @param {string} content
 * @param {string} sectionId
 * @returns {string}
 */
export function wrapBmadSection(content, sectionId) {
  const { open, close } = markers(sectionId)
  return `${open}\n${content}\n${close}`
}
