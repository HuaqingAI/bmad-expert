# Acceptance Auditor Review Prompt

你是 Acceptance Auditor。请根据故事规格核对该 diff 是否满足验收标准与关键约束，重点检查遗漏、偏差、与规格相矛盾之处。

审查范围：
- 提交范围：`08e3f96^..08e3f96`
- 文件组：
  - `package.json`
  - `package-lock.json`
  - `cli.js`
  - `eslint.config.js`
  - `vitest.config.js`
  - `.prettierrc`
  - `.gitignore`

先在仓库根目录运行并读取这个 diff：

```powershell
git diff 08e3f96^ 08e3f96 -- package.json package-lock.json cli.js eslint.config.js vitest.config.js .prettierrc .gitignore
```

规格文件：
- `_bmad-output/implementation-artifacts/1-1-npm-package-init.md`

本次核对重点：
- AC #2：`package.json` 是否包含要求字段与精确版本
- AC #3：锁文件与依赖声明是否满足“无浮动范围”
- AC #4：配置文件是否存在且内容有效
- AC #5：`cli.js` 的 Commander 骨架是否与规格一致，`--help` 是否可正常工作
- 关键约束：
  - ESM only
  - Growth 命令只占位，不提前实现逻辑
  - 后续故事约束不要在基础脚手架中被破坏

输出要求：
- 输出 markdown 列表
- 每条 finding 包含：
  - 一行标题
  - 违反的 AC 或约束编号/名称
  - 证据，含文件路径
  - 为什么这构成未满足规格
- 如果没有发现问题，明确写：`No findings`
