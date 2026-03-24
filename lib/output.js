// lib/output.js
// PLACEHOLDER — Story 1.3 将实现完整的输出格式化模块
//
// 架构约束（后续故事必须遵守）：
// - 所有进度/成功/错误输出必须通过此模块路由，禁止直接 console.log/console.error
// - stdout 用于进度与成功确认，stderr 用于错误信息
// - printProgress: 进度输出，完成后追加 ✓
// - printSuccess: 安装后引导信息
// - printError: 结构化 AI 可读错误（写入 stderr）

export function printProgress(msg, done = false) {}

export function printSuccess(msg) {}

export function printError(err) {}
