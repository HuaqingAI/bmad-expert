// lib/platform.js
// PLACEHOLDER — Story 2.1 将实现平台检测模块与适配器工厂
//
// 架构约束（后续故事必须遵守）：
// - 支持平台：happycapy, cursor, claude-code
// - 检测耗时必须 ≤3 秒（NFR3）
// - 路径计算必须通过适配器的 getInstallPath() 方法，禁止硬编码路径
// - 外部进程调用必须使用 execa，禁止 child_process

export async function detectPlatform() {}
