// lib/errors.js
// 统一错误类 BmadError — Story 1.2
//
// 架构约束（后续故事必须遵守）：
// - 所有错误场景必须使用 BmadError 类抛出，禁止直接 throw new Error()
// - 禁止在 lib 模块内直接 console.error 或 process.exit
// - 错误统一在 cli.js 顶层捕获并通过 output.js 格式化输出（Story 1.3 实现）

export class BmadError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'BmadError'
    this.bmadCode = code                             // 'E001'~'E006'
    this.cause = cause                               // 原始错误对象（可 undefined）
    this.retryable = ['E004', 'E005'].includes(code) // PERMISSION_DENIED / NETWORK_ERROR 可重试
  }
}
