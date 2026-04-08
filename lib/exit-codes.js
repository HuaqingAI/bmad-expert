// lib/exit-codes.js
// 语义化 Exit Code 常量表 — Story 1.2
//
// 架构约束（后续故事必须遵守）：
// - 所有退出码通过此模块的 EXIT_CODES 常量引用，禁止硬编码数字
// - 使用 UPPER_SNAKE_CASE 命名，具名导出，禁止 export default

export const EXIT_CODES = {
  SUCCESS: 0,            // 安装完成
  GENERAL_ERROR: 1,      // 未分类异常
  INVALID_ARGS: 2,       // --platform 值不合法
  MISSING_DEPENDENCY: 3, // Node.js/npm 版本不足
  PERMISSION_DENIED: 4,  // 沙盒路径写入失败（可重试）
  NETWORK_ERROR: 5,      // 网络错误，预留（可重试）
  ALREADY_INSTALLED: 6,  // 幂等检测：已有安装，跳过
  NOT_INSTALLED: 7,      // uninstall 检测到无安装内容
}
