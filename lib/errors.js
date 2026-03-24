// lib/errors.js
// PLACEHOLDER — Story 1.2 将实现完整的 BmadError 类
//
// 架构约束（后续故事必须遵守）：
// - 所有错误场景必须使用 BmadError 类抛出，禁止直接 throw new Error()
// - BmadError 必须继承自 Error
// - 包含 bmadCode, cause, retryable 属性

export class BmadError extends Error {}
