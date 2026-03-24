// lib/adapters/cursor.js
// PLACEHOLDER — Phase 1.5 将实现 Cursor 平台适配器
//
// 适配器接口契约（必须实现以下四个方法）：
//   detect()                 → boolean
//   getInstallPath(agentId)  → string（返回 [cwd]/.cursor/）
//   install(files, options)  → Promise<void>
//   check(agentId)           → 'not_installed' | 'installed' | 'corrupted'
//
// 路径白名单：[cwd]/.cursor/，拒绝任何 .. 路径遍历
