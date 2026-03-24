// lib/adapters/happycapy.js
// PLACEHOLDER — Story 2.1 将实现 HappyCapy 平台完整适配器
//
// 适配器接口契约（必须实现以下四个方法）：
//   detect()                 → boolean（检测是否为 HappyCapy 平台）
//   getInstallPath(agentId)  → string（返回 ~/.happycapy/agents/[agentId]/）
//   install(files, options)  → Promise<void>（文件写入 + happycapy-cli add 注册）
//   check(agentId)           → 'not_installed' | 'installed' | 'corrupted'
//
// 特殊处理：
// - 注册通过 execa 调用 happycapy-cli add
// - 必须有降级路径（happycapy-cli 不存在时输出手动注册命令）
// - 路径白名单：~/.happycapy/agents/[agent-id]/，拒绝任何 .. 路径遍历
