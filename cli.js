#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { EXIT_CODES } from './lib/exit-codes.js'
import { BmadError } from './lib/errors.js'
import { printError, printJSON, setJsonMode, getJsonMode } from './lib/output.js'
import { install } from './lib/installer.js'
import { update } from './lib/updater.js'
import { checkStatus } from './lib/checker.js'
import { init } from './lib/initializer.js'
import { uninstall } from './lib/uninstaller.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

const program = new Command()

program
  .name('bmad-expert')
  .description('BMAD Agent 安装器与新手教练 - 一条命令完成跨平台 BMAD 安装')
  .version(pkg.version)

program
  .command('install')
  .description('平台感知完整安装 BMAD agent')
  .option('--platform <name>', '指定目标平台（happycapy/openclaw/claude-code/codex）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '非交互模式，跳过所有确认提示')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  // Phase 2 参数（Story 7.1 新增，Story 7.3 中 installer.js 接入两阶段调用链时消费）
  .option('--modules <modules>', 'BMAD 安装模块（覆盖智能推断，如 bmm 或 bmm,bmb）')
  .option('--tools <tools>', 'BMAD 工具链（覆盖智能推断，如 claude-code）')
  .option('--communication-language <lang>', 'BMAD 通讯语言（覆盖智能推断）')
  .option('--output-folder <path>', 'BMAD 输出目录（覆盖智能推断）')
  .option('--user-name <name>', '用户名称（传入 BMAD 安装器）')
  .option('--action <type>', 'BMAD 安装器动作类型（默认 install）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await install({
      platform: options.platform ?? null,
      agentId: options.agentId,
      yes: options.yes ?? false,
      // Phase 2 参数（Story 7.3 中 installer.js 会消费）
      modules: options.modules ?? null,
      tools: options.tools ?? null,
      communicationLanguage: options.communicationLanguage ?? null,
      outputFolder: options.outputFolder ?? null,
      userName: options.userName ?? null,
      action: options.action ?? null,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

program
  .command('update')
  .description('安全更新框架文件，保留用户 memory 与个性化配置（Growth）')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await update({
      platform: options.platform ?? null,
      agentId: options.agentId,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

program
  .command('status')
  .description('检查当前安装健康度（Growth）')
  .option('--platform <name>', '指定目标平台（happycapy/cursor/claude-code）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await checkStatus({
      platform: options.platform ?? null,
      agentId: options.agentId,
    })
    if (options.json) {
      // result 已含 success/status/version/platform/installPath/files 字段（Story 9.1 FR49）
      printJSON(result)
      if (!result.success) {
        process.exit(EXIT_CODES.GENERAL_ERROR)
      }
    } else if (!result.success) {
      // 非 JSON 模式：text 报告已由 checkStatus 通过 printSuccess 输出至 stdout
      // 直接以非零 exit code 退出（原来靠 throw BmadError → global catch 触发）
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
  })

program
  .command('init')
  .description('初始化工作环境：生成 CLAUDE.md 和 workflow 配置文件（Phase 3）')
  .option('--yes', '非交互模式，使用默认值')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await init({ yes: options.yes ?? false })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

program
  .command('uninstall')
  .description('卸载 BMAD：清理 init 生成的配置文件和 install 安装的 _bmad 目录（Phase 3）')
  .option('--platform <name>', '指定目标平台（happycapy/openclaw/claude-code/codex）')
  .option('--agent-id <id>', 'Agent 标识符', 'bmad-expert')
  .option('--yes', '跳过确认直接执行清理')
  .option('--backup', '卸载前备份所有文件至 .bmad-backup-{timestamp}/')
  .option('--json', '输出结构化 JSON 结果（AI 调用专用）')
  .action(async (options) => {
    if (options.json) setJsonMode(true)
    const result = await uninstall({
      platform: options.platform ?? null,
      agentId: options.agentId,
      yes: options.yes ?? false,
      backup: options.backup ?? false,
    })
    if (options.json) {
      printJSON({ success: true, ...result })
    }
  })

const CODE_TO_EXIT = {
  E001: EXIT_CODES.GENERAL_ERROR,
  E002: EXIT_CODES.INVALID_ARGS,
  E003: EXIT_CODES.MISSING_DEPENDENCY,
  E004: EXIT_CODES.PERMISSION_DENIED,
  E005: EXIT_CODES.NETWORK_ERROR,
  E006: EXIT_CODES.ALREADY_INSTALLED,
  E007: EXIT_CODES.NOT_INSTALLED,
}

// Node.js 版本检查（E003）— 必须在 parseAsync 之前执行
const nodeVersion = process.versions.node
const [nodeMajor, nodeMinor] = nodeVersion.split('.').map(Number)
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) {
  printError(
    new BmadError(
      'E003',
      `依赖缺失: Node.js 版本不足（当前 v${nodeVersion}，需要 ≥20.19.0）`,
      null,
      ['升级 Node.js 至 20.19+ 或更高版本']
    )
  )
  process.exit(EXIT_CODES.MISSING_DEPENDENCY)
}

program.parseAsync().catch(err => {
  if (getJsonMode()) {
    // JSON 模式：所有输出（含错误）走 stdout，stderr 保持空白（FR40）
    if (err instanceof BmadError && err.bmadCode === 'E006') {
      printJSON({ success: true, alreadyInstalled: true })
      process.exit(EXIT_CODES.ALREADY_INSTALLED)
    }
    const errorJson = err instanceof BmadError
      ? {
          success: false,
          errorCode: err.bmadCode,
          errorMessage: err.message,
          fixSteps: err.fixSteps ?? [],
          retryable: err.retryable ?? false,
        }
      : {
          success: false,
          errorCode: 'E001',
          errorMessage: err.message,
          fixSteps: [],
          retryable: false,
        }
    printJSON(errorJson)
    process.exit(
      err instanceof BmadError
        ? (CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
        : EXIT_CODES.GENERAL_ERROR
    )
  } else if (err instanceof BmadError && err.bmadCode === 'E006') {
    // ALREADY_INSTALLED 是正常状态：消息已由 checkInstallStatus 打印到 stdout
    // 不走 printError（不是真正的错误），直接以 exit code 6 退出
    process.exit(EXIT_CODES.ALREADY_INSTALLED)
  } else {
    printError(err)
    if (err instanceof BmadError) {
      process.exit(CODE_TO_EXIT[err.bmadCode] ?? EXIT_CODES.GENERAL_ERROR)
    } else {
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
  }
})
