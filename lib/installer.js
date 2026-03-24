// lib/installer.js
// PLACEHOLDER — Story 2.x 将实现安装编排、幂等检测、模板变量替换
//
// 架构约束（后续故事必须遵守）：
// - 文件操作必须使用 fs-extra，禁止原生 fs
// - 安装状态检测结果：'not_installed' | 'installed' | 'corrupted'
// - 模板变量格式：{{variable_name}}，安装时替换
// - 调用链：platform.js → adapter.check() → 文件复制+替换 → adapter.install() → output.js
// - 全流程 ≤60 秒（NFR1），每步进度 ≤2 秒（NFR2）

export async function install(options) {}
